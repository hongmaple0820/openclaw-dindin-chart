/**
 * Memory Store - 记忆存储
 * 
 * 功能：
 * - 短期记忆管理
 * - 长期记忆持久化
 * - 记忆检索
 */

import * as crypto from 'crypto';

// ============ Types & Interfaces ============

export interface MemoryStoreConfig {
  maxShortTerm: number;
  maxLongTerm: number;
  compressionThreshold: number;
  shortTermTTL: number;
  longTermTTL: number | null;
}

export interface MemoryStoreOptions {
  agentId: string;
  maxShortTerm?: number;
  maxLongTerm?: number;
  compressionThreshold?: number;
  shortTermTTL?: number;
  longTermTTL?: number | null;
}

export interface AddMemoryOptions {
  type?: 'short-term' | 'long-term' | 'episodic';
  metadata?: Record<string, unknown>;
  importance?: number;
  summary?: string | null;
}

export interface Memory {
  id: string;
  agentId: string;
  memoryType: 'short-term' | 'long-term' | 'episodic';
  content: string;
  contentSummary: string;
  metadata: Record<string, unknown>;
  importance: number;
  accessCount: number;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number | null;
  vector?: number[];
}

export interface RetrieveOptions {
  type?: 'short-term' | 'long-term' | 'episodic' | null;
  limit?: number;
  minImportance?: number;
  maxAge?: number | null;
  metadata?: Record<string, unknown> | null;
  includeExpired?: boolean;
}

export interface MemoryRow {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  content_summary: string;
  metadata: string;
  importance: number;
  access_count: number;
  created_at: number;
  last_accessed: number;
  expires_at: number | null;
  embedding?: Buffer | null;
  embedding_model?: string | null;
}

export interface MemoryStoreStats {
  shortTerm: { count: number; max: number };
  longTerm: { count: number; max: number };
  total: number;
}

// Database interface for better-sqlite3 style
interface Database {
  prepare(sql: string): {
    run(...params: unknown[]): void;
    get(...params: unknown[]): MemoryRow | undefined;
    all(...params: unknown[]): MemoryRow[];
  };
  exec(sql: string): void;
}

/**
 * MemoryStore - 记忆存储类
 */
export class MemoryStore {
  private db: Database;
  private agentId: string;
  private config: MemoryStoreConfig;
  private shortTermCache: Memory[];
  private longTermCache: Map<string, Memory>;

  constructor(db: Database, options: MemoryStoreOptions = {} as MemoryStoreOptions) {
    this.db = db;
    this.agentId = options.agentId;
    
    // 配置
    this.config = {
      maxShortTerm: options.maxShortTerm ?? 50,
      maxLongTerm: options.maxLongTerm ?? 1000,
      compressionThreshold: options.compressionThreshold ?? 10,
      shortTermTTL: options.shortTermTTL ?? 3600000,
      longTermTTL: options.longTermTTL ?? null
    };

    // 内存缓存
    this.shortTermCache = [];
    this.longTermCache = new Map();
  }

  /**
   * 生成记忆 ID
   */
  generateId(): string {
    return `mem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 添加记忆
   */
  add(content: string, options: AddMemoryOptions = {}): Memory {
    const {
      type = 'short-term',
      metadata = {},
      importance = 0.5,
      summary = null
    } = options;

    const id = this.generateId();
    const now = Date.now();

    const memory: Memory = {
      id,
      agentId: this.agentId,
      memoryType: type,
      content,
      contentSummary: summary ?? this.summarize(content),
      metadata: {
        ...metadata,
        createdAt: now
      },
      importance: Math.max(0, Math.min(1, importance)),
      accessCount: 0,
      createdAt: now,
      lastAccessed: now,
      expiresAt: type === 'short-term' ? now + this.config.shortTermTTL : this.config.longTermTTL
    };

    // 保存到数据库
    this.saveToDB(memory);

    // 更新缓存
    if (type === 'short-term') {
      this.shortTermCache.push(memory);
      this.pruneShortTerm();
    } else {
      this.longTermCache.set(id, memory);
    }

    return memory;
  }

  /**
   * 批量添加记忆
   */
  addBatch(memories: Array<{ content: string; options?: AddMemoryOptions }>): Memory[] {
    const results: Memory[] = [];
    for (const mem of memories) {
      results.push(this.add(mem.content, mem.options ?? {}));
    }
    return results;
  }

  /**
   * 获取记忆
   */
  get(memoryId: string): Memory | null {
    // 检查缓存
    let memory = this.shortTermCache.find(m => m.id === memoryId);
    if (memory) return memory;

    memory = this.longTermCache.get(memoryId) ?? null;
    if (memory) return memory;

    // 从数据库加载
    memory = this.loadFromDB(memoryId);
    if (memory) {
      // 更新访问计数
      this.updateAccess(memoryId);
    }

    return memory;
  }

  /**
   * 检索记忆
   */
  retrieve(options: RetrieveOptions = {}): Memory[] {
    const {
      type = null,
      limit = 10,
      minImportance = 0,
      maxAge = null,
      metadata = null,
      includeExpired = false
    } = options;

    const now = Date.now();
    let results: Memory[] = [];

    // 从短期记忆获取
    if (!type || type === 'short-term') {
      results.push(...this.shortTermCache.filter(m => {
        if (!includeExpired && m.expiresAt && m.expiresAt < now) return false;
        if (m.importance < minImportance) return false;
        if (maxAge && now - m.createdAt > maxAge) return false;
        if (metadata) {
          for (const [key, value] of Object.entries(metadata)) {
            if (m.metadata[key] !== value) return false;
          }
        }
        return true;
      }));
    }

    // 从长期记忆获取
    if (!type || type === 'long-term' || type === 'episodic') {
      for (const memory of Array.from(this.longTermCache.values())) {
        if (!includeExpired && memory.expiresAt && memory.expiresAt < now) continue;
        if (type && memory.memoryType !== type) continue;
        if (memory.importance < minImportance) continue;
        if (maxAge && now - memory.createdAt > maxAge) continue;
        if (metadata) {
          let match = true;
          for (const [key, value] of Object.entries(metadata)) {
            if (memory.metadata[key] !== value) {
              match = false;
              break;
            }
          }
          if (!match) continue;
        }
        results.push(memory);
      }
    }

    // 从数据库获取更多
    const dbResults = this.queryFromDB(options);
    for (const memory of dbResults) {
      if (!results.some(r => r.id === memory.id)) {
        results.push(memory);
      }
    }

    // 排序：重要性 + 最近访问
    results.sort((a, b) => {
      const scoreA = a.importance * 0.5 + (1 - (now - a.lastAccessed) / 86400000) * 0.5;
      const scoreB = b.importance * 0.5 + (1 - (now - b.lastAccessed) / 86400000) * 0.5;
      return scoreB - scoreA;
    });

    return results.slice(0, limit);
  }

  /**
   * 更新记忆
   */
  update(memoryId: string, updates: Partial<Pick<Memory, 'content' | 'importance' | 'metadata'>>): Memory | null {
    const memory = this.get(memoryId);
    if (!memory) return null;

    const allowedUpdates = ['content', 'importance', 'metadata'] as const;
    const changes: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (key in updates) {
        if (key === 'content') memory.content = updates.content!;
        else if (key === 'importance') memory.importance = updates.importance!;
        else if (key === 'metadata') memory.metadata = updates.metadata!;
        changes[key] = updates[key] as unknown;
      }
    }

    if (updates.content) {
      memory.contentSummary = this.summarize(updates.content);
      changes.contentSummary = memory.contentSummary;
    }

    memory.lastAccessed = Date.now();
    changes.lastAccessed = memory.lastAccessed;

    // 更新数据库
    this.updateInDB(memoryId, changes);

    // 更新缓存
    this.updateCache(memory);

    return memory;
  }

  /**
   * 删除记忆
   */
  delete(memoryId: string): boolean {
    // 从缓存删除
    this.shortTermCache = this.shortTermCache.filter(m => m.id !== memoryId);
    this.longTermCache.delete(memoryId);

    // 从数据库删除
    this.deleteFromDB(memoryId);

    return true;
  }

  /**
   * 清空记忆
   */
  clear(type: 'short-term' | 'long-term' | null = null): void {
    if (type === 'short-term') {
      this.shortTermCache = [];
      this.deleteByTypeFromDB('short-term');
    } else if (type === 'long-term') {
      this.longTermCache.clear();
      this.deleteByTypeFromDB('long-term');
    } else {
      this.shortTermCache = [];
      this.longTermCache.clear();
      this.deleteAllFromDB();
    }
  }

  /**
   * 提升短期记忆到长期
   */
  promote(memoryId: string): Memory | null {
    const memory = this.get(memoryId);
    if (!memory || memory.memoryType !== 'short-term') return null;

    memory.memoryType = 'long-term';
    memory.expiresAt = null;

    // 从短期缓存移除
    this.shortTermCache = this.shortTermCache.filter(m => m.id !== memoryId);

    // 添加到长期缓存
    this.longTermCache.set(memoryId, memory);

    // 更新数据库
    this.updateInDB(memoryId, { memoryType: 'long-term', expiresAt: null });

    return memory;
  }

  /**
   * 压缩记忆
   */
  compress(): number {
    // 当短期记忆超过阈值时，压缩低重要性的记忆
    if (this.shortTermCache.length > this.config.compressionThreshold) {
      const toCompress = this.shortTermCache
        .filter(m => m.importance < 0.3)
        .slice(0, Math.floor(this.shortTermCache.length * 0.3));

      for (const memory of toCompress) {
        // 合并内容或删除
        this.delete(memory.id);
      }

      return toCompress.length;
    }
    return 0;
  }

  /**
   * 总结内容
   */
  summarize(content: string | unknown, maxLength = 100): string {
    if (!content) return '';
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  /**
   * 修剪短期记忆
   */
  private pruneShortTerm(): void {
    if (this.shortTermCache.length > this.config.maxShortTerm) {
      // 按重要性排序，删除最不重要的
      this.shortTermCache.sort((a, b) => b.importance - a.importance);
      const removed = this.shortTermCache.splice(this.config.maxShortTerm);
      
      // 从数据库删除
      for (const memory of removed) {
        this.deleteFromDB(memory.id);
      }
    }
  }

  // ========== 数据库操作 ==========

  private saveToDB(memory: Memory): void {
    const stmt = this.db.prepare(`
      INSERT INTO agent_memories (
        id, agent_id, memory_type, content, content_summary,
        metadata, importance, access_count, created_at, last_accessed, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      memory.id,
      memory.agentId,
      memory.memoryType,
      memory.content,
      memory.contentSummary,
      JSON.stringify(memory.metadata),
      memory.importance,
      memory.accessCount,
      memory.createdAt,
      memory.lastAccessed,
      memory.expiresAt
    );
  }

  private loadFromDB(memoryId: string): Memory | null {
    const row = this.db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(memoryId);
    if (!row) return null;

    return this.parseMemory(row);
  }

  private queryFromDB(options: RetrieveOptions): Memory[] {
    const { type, limit, minImportance, maxAge, metadata, includeExpired } = options;
    const now = Date.now();

    let sql = 'SELECT * FROM agent_memories WHERE agent_id = ?';
    const params: unknown[] = [this.agentId];

    if (type) {
      sql += ' AND memory_type = ?';
      params.push(type);
    }

    if (minImportance && minImportance > 0) {
      sql += ' AND importance >= ?';
      params.push(minImportance);
    }

    if (!includeExpired) {
      sql += ' AND (expires_at IS NULL OR expires_at > ?)';
      params.push(now);
    }

    if (maxAge) {
      sql += ' AND created_at > ?';
      params.push(now - maxAge);
    }

    sql += ' ORDER BY importance DESC, last_accessed DESC LIMIT ?';
    params.push((limit ?? 10) * 2); // 多获取一些，后面去重

    const rows = this.db.prepare(sql).all(...params);
    let memories = rows.map(r => this.parseMemory(r));

    // 元数据过滤
    if (metadata) {
      memories = memories.filter(m => {
        for (const [key, value] of Object.entries(metadata)) {
          if (m.metadata[key] !== value) return false;
        }
        return true;
      });
    }

    return memories;
  }

  private updateInDB(memoryId: string, updates: Record<string, unknown>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${snakeKey} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    values.push(memoryId);

    const sql = `UPDATE agent_memories SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  private updateAccess(memoryId: string): void {
    this.db.prepare(`
      UPDATE agent_memories 
      SET access_count = access_count + 1, last_accessed = ? 
      WHERE id = ?
    `).run(Date.now(), memoryId);
  }

  private deleteFromDB(memoryId: string): void {
    this.db.prepare('DELETE FROM agent_memories WHERE id = ?').run(memoryId);
  }

  private deleteByTypeFromDB(type: string): void {
    this.db.prepare('DELETE FROM agent_memories WHERE agent_id = ? AND memory_type = ?')
      .run(this.agentId, type);
  }

  private deleteAllFromDB(): void {
    this.db.prepare('DELETE FROM agent_memories WHERE agent_id = ?').run(this.agentId);
  }

  private parseMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      agentId: row.agent_id,
      memoryType: row.memory_type as Memory['memoryType'],
      content: row.content,
      contentSummary: row.content_summary,
      metadata: JSON.parse(row.metadata || '{}'),
      importance: row.importance,
      accessCount: row.access_count,
      createdAt: row.created_at,
      lastAccessed: row.last_accessed,
      expiresAt: row.expires_at
    };
  }

  private updateCache(memory: Memory): void {
    const idx = this.shortTermCache.findIndex(m => m.id === memory.id);
    if (idx >= 0) {
      this.shortTermCache[idx] = memory;
    } else if (memory.memoryType !== 'short-term') {
      this.longTermCache.set(memory.id, memory);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): MemoryStoreStats {
    return {
      shortTerm: {
        count: this.shortTermCache.length,
        max: this.config.maxShortTerm
      },
      longTerm: {
        count: this.longTermCache.size,
        max: this.config.maxLongTerm
      },
      total: this.shortTermCache.length + this.longTermCache.size
    };
  }
}

export default MemoryStore;