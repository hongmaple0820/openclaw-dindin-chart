/**
 * Memory Store - 记忆存储
 * 
 * 功能：
 * - 短期记忆管理
 * - 长期记忆持久化
 * - 记忆检索
 */

const crypto = require('crypto');

class MemoryStore {
  constructor(db, options = {}) {
    this.db = db;
    this.agentId = options.agentId;
    
    // 配置
    this.config = {
      maxShortTerm: options.maxShortTerm || 50,        // 短期记忆最大数量
      maxLongTerm: options.maxLongTerm || 1000,        // 长期记忆最大数量
      compressionThreshold: options.compressionThreshold || 10, // 压缩阈值
      shortTermTTL: options.shortTermTTL || 3600000,   // 短期记忆过期时间 (1小时)
      longTermTTL: options.longTermTTL || null         // 长期记忆永不过期
    };

    // 内存缓存
    this.shortTermCache = [];
    this.longTermCache = new Map();
  }

  /**
   * 生成记忆 ID
   */
  generateId() {
    return `mem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 添加记忆
   */
  add(content, options = {}) {
    const {
      type = 'short-term', // short-term | long-term | episodic
      metadata = {},
      importance = 0.5,
      summary = null
    } = options;

    const id = this.generateId();
    const now = Date.now();

    const memory = {
      id,
      agentId: this.agentId,
      memoryType: type,
      content,
      contentSummary: summary || this.summarize(content),
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
  addBatch(memories) {
    const results = [];
    for (const mem of memories) {
      results.push(this.add(mem.content, mem.options));
    }
    return results;
  }

  /**
   * 获取记忆
   */
  get(memoryId) {
    // 检查缓存
    let memory = this.shortTermCache.find(m => m.id === memoryId);
    if (memory) return memory;

    memory = this.longTermCache.get(memoryId);
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
  retrieve(options = {}) {
    const {
      type = null,          // 按类型过滤
      limit = 10,           // 返回数量
      minImportance = 0,    // 最小重要性
      maxAge = null,        // 最大年龄 (ms)
      metadata = null,      // 元数据过滤
      includeExpired = false
    } = options;

    const now = Date.now();
    let results = [];

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
      for (const memory of this.longTermCache.values()) {
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
  update(memoryId, updates) {
    const memory = this.get(memoryId);
    if (!memory) return null;

    const allowedUpdates = ['content', 'importance', 'metadata'];
    const changes = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        memory[key] = value;
        changes[key] = value;
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
  delete(memoryId) {
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
  clear(type = null) {
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
  promote(memoryId) {
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
  compress() {
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
  summarize(content, maxLength = 100) {
    if (!content) return '';
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  /**
   * 修剪短期记忆
   */
  pruneShortTerm() {
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

  saveToDB(memory) {
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

  loadFromDB(memoryId) {
    const row = this.db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(memoryId);
    if (!row) return null;

    return this.parseMemory(row);
  }

  queryFromDB(options) {
    const { type, limit, minImportance, maxAge, metadata, includeExpired } = options;
    const now = Date.now();

    let sql = 'SELECT * FROM agent_memories WHERE agent_id = ?';
    const params = [this.agentId];

    if (type) {
      sql += ' AND memory_type = ?';
      params.push(type);
    }

    if (minImportance > 0) {
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
    params.push(limit * 2); // 多获取一些，后面去重

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

  updateInDB(memoryId, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${snakeKey} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    values.push(memoryId);

    const sql = `UPDATE agent_memories SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  updateAccess(memoryId) {
    this.db.prepare(`
      UPDATE agent_memories 
      SET access_count = access_count + 1, last_accessed = ? 
      WHERE id = ?
    `).run(Date.now(), memoryId);
  }

  deleteFromDB(memoryId) {
    this.db.prepare('DELETE FROM agent_memories WHERE id = ?').run(memoryId);
  }

  deleteByTypeFromDB(type) {
    this.db.prepare('DELETE FROM agent_memories WHERE agent_id = ? AND memory_type = ?')
      .run(this.agentId, type);
  }

  deleteAllFromDB() {
    this.db.prepare('DELETE FROM agent_memories WHERE agent_id = ?').run(this.agentId);
  }

  parseMemory(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      memoryType: row.memory_type,
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

  updateCache(memory) {
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
  getStats() {
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

module.exports = MemoryStore;