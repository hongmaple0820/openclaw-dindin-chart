/**
 * 角色记忆管理器
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

type SqliteDatabase = ReturnType<typeof Database>;

// 类型定义
export interface MemoryData {
  userId?: string;
  type: string;
  content: string;
  importance?: number;
  tags?: string[];
}

export interface Memory {
  id?: number;
  character_id: string;
  user_id?: string;
  memory_type: string;
  content: string;
  importance: number;
  timestamp: number;
  tags: string[];
}

export interface MemorySearchOptions {
  userId?: string;
  type?: string;
  limit?: number;
  minImportance?: number;
}

export class MemoryManager {
  private db: SqliteDatabase;

  constructor(dbPath?: string) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    }
    this.db = Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS character_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT NOT NULL,
        user_id TEXT,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 5,
        timestamp INTEGER NOT NULL,
        tags TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_memories_character ON character_memories(character_id);
      CREATE INDEX IF NOT EXISTS idx_memories_user ON character_memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON character_memories(memory_type);
    `);
  }

  // 添加记忆
  addMemory(characterId: string, data: MemoryData): Memory {
    const { userId, type, content, importance = 5, tags = [] } = data;
    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO character_memories (character_id, user_id, memory_type, content, importance, timestamp, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(characterId, userId || null, type, content, importance, timestamp, JSON.stringify(tags));
    return { id: result.lastInsertRowid as number, character_id: characterId, user_id: userId, memory_type: type, content, importance, timestamp, tags };
  }

  // 获取角色记忆
  getMemories(characterId: string, options: MemorySearchOptions = {}): Memory[] {
    const { userId, type, limit = 20, minImportance } = options;

    let query = 'SELECT * FROM character_memories WHERE character_id = ?';
    const params: (string | number)[] = [characterId];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (type) {
      query += ' AND memory_type = ?';
      params.push(type);
    }

    if (minImportance) {
      query += ' AND importance >= ?';
      params.push(minImportance);
    }

    query += ' ORDER BY importance DESC, timestamp DESC LIMIT ?';
    params.push(limit);

    const memories = this.db.prepare(query).all(...params) as Memory[];
    return memories.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags as unknown as string) : []
    }));
  }

  // 搜索记忆
  searchMemories(characterId: string, query: string, options: { limit?: number } = {}): Memory[] {
    const { limit = 10 } = options;

    const memories = this.db.prepare(`
      SELECT * FROM character_memories 
      WHERE character_id = ? AND content LIKE ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `).all(characterId, `%${query}%`, limit) as Memory[];

    return memories.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags as unknown as string) : []
    }));
  }

  // 更新记忆重要性
  updateImportance(memoryId: number, importance: number): void {
    this.db.prepare('UPDATE character_memories SET importance = ? WHERE id = ?').run(importance, memoryId);
  }

  // 删除记忆
  deleteMemory(memoryId: number): void {
    this.db.prepare('DELETE FROM character_memories WHERE id = ?').run(memoryId);
  }

  // 清除角色所有记忆
  clearMemories(characterId: string): void {
    this.db.prepare('DELETE FROM character_memories WHERE character_id = ?').run(characterId);
  }

  // 获取记忆统计
  getStats(characterId: string): { memory_type: string; count: number; avg_importance: number }[] {
    const stats = this.db.prepare(`
      SELECT 
        memory_type,
        COUNT(*) as count,
        AVG(importance) as avg_importance
      FROM character_memories 
      WHERE character_id = ?
      GROUP BY memory_type
    `).all(characterId) as { memory_type: string; count: number; avg_importance: number }[];

    return stats;
  }
}

export default MemoryManager;