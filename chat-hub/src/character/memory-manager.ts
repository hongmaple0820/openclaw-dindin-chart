/**
 * 角色记忆管理器
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

class MemoryManager {
  constructor(dbPath) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    }
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
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
  addMemory(characterId, data) {
    const { userId, type, content, importance = 5, tags = [] } = data;
    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO character_memories (character_id, user_id, memory_type, content, importance, timestamp, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(characterId, userId || null, type, content, importance, timestamp, JSON.stringify(tags));
    return { id: result.lastInsertRowid, characterId, type, content, importance, timestamp, tags };
  }

  // 获取角色记忆
  getMemories(characterId, options = {}) {
    const { userId, type, limit = 20, minImportance } = options;

    let query = 'SELECT * FROM character_memories WHERE character_id = ?';
    const params = [characterId];

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

    const memories = this.db.prepare(query).all(...params);
    return memories.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags) : []
    }));
  }

  // 搜索记忆
  searchMemories(characterId, query, options = {}) {
    const { limit = 10 } = options;

    const memories = this.db.prepare(`
      SELECT * FROM character_memories 
      WHERE character_id = ? AND content LIKE ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `).all(characterId, `%${query}%`, limit);

    return memories.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags) : []
    }));
  }

  // 更新记忆重要性
  updateImportance(memoryId, importance) {
    this.db.prepare('UPDATE character_memories SET importance = ? WHERE id = ?').run(importance, memoryId);
  }

  // 删除记忆
  deleteMemory(memoryId) {
    this.db.prepare('DELETE FROM character_memories WHERE id = ?').run(memoryId);
  }

  // 清除角色所有记忆
  clearMemories(characterId) {
    this.db.prepare('DELETE FROM character_memories WHERE character_id = ?').run(characterId);
  }

  // 获取记忆统计
  getStats(characterId) {
    const stats = this.db.prepare(`
      SELECT 
        memory_type,
        COUNT(*) as count,
        AVG(importance) as avg_importance
      FROM character_memories 
      WHERE character_id = ?
      GROUP BY memory_type
    `).all(characterId);

    return stats;
  }
}

module.exports = MemoryManager;
