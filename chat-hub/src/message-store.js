const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

/**
 * SQLite 消息存储
 * 消息持久化到 SQLite 数据库
 */
class MessageStore {
  constructor() {
    // 存储目录
    this.storeDir = config.store?.dir || path.join(process.env.HOME, '.openclaw', 'chat-data');
    this.dbPath = path.join(this.storeDir, 'messages.db');
    
    this.init();
  }

  /**
   * 初始化数据库
   */
  init() {
    // 创建目录
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
      console.log('[Store] 创建存储目录:', this.storeDir);
    }

    // 连接数据库
    this.db = new Database(this.dbPath);
    console.log('[Store] 数据库:', this.dbPath);

    // 创建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        source TEXT,
        at_targets TEXT,
        reply_to TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);

      CREATE TABLE IF NOT EXISTS sync_state (
        participant_id TEXT PRIMARY KEY,
        last_sync INTEGER NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // 统计消息数量
    const count = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log('[Store] 已加载消息:', count.count, '条');
  }

  /**
   * 添加消息
   */
  addMessage(message) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO messages (id, type, sender, content, timestamp, source, at_targets, reply_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        message.id,
        message.type,
        message.sender,
        message.content,
        message.timestamp,
        message.source || null,
        message.atTargets ? JSON.stringify(message.atTargets) : null,
        message.replyTo || null
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('[Store] 添加消息失败:', error.message);
      return false;
    }
  }

  /**
   * 删除消息
   */
  deleteMessage(messageId) {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
      const result = stmt.run(messageId);
      return result.changes > 0;
    } catch (error) {
      console.error('[Store] 删除消息失败:', error.message);
      return false;
    }
  }

  /**
   * 获取最近消息
   */
  getMessages(limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
      `);
      const rows = stmt.all(limit);
      
      // 转换格式并反转顺序（最新的在后面）
      return rows.reverse().map(row => ({
        id: row.id,
        type: row.type,
        sender: row.sender,
        content: row.content,
        timestamp: row.timestamp,
        source: row.source,
        atTargets: row.at_targets ? JSON.parse(row.at_targets) : null,
        replyTo: row.reply_to
      }));
    } catch (error) {
      console.error('[Store] 获取消息失败:', error.message);
      return [];
    }
  }

  /**
   * 获取参与者未同步的消息
   */
  getUnsyncedMessages(participantId) {
    try {
      // 获取上次同步时间
      const syncStmt = this.db.prepare('SELECT last_sync FROM sync_state WHERE participant_id = ?');
      const syncRow = syncStmt.get(participantId);
      const lastSync = syncRow?.last_sync || 0;

      // 获取未同步消息
      const msgStmt = this.db.prepare(`
        SELECT * FROM messages WHERE timestamp > ? ORDER BY timestamp ASC
      `);
      const rows = msgStmt.all(lastSync);

      return rows.map(row => ({
        id: row.id,
        type: row.type,
        sender: row.sender,
        content: row.content,
        timestamp: row.timestamp,
        source: row.source,
        atTargets: row.at_targets ? JSON.parse(row.at_targets) : null,
        replyTo: row.reply_to
      }));
    } catch (error) {
      console.error('[Store] 获取未同步消息失败:', error.message);
      return [];
    }
  }

  /**
   * 标记参与者已同步
   */
  markSynced(participantId, timestamp = Date.now()) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_state (participant_id, last_sync, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(participant_id) DO UPDATE SET last_sync = ?, updated_at = ?
      `);
      stmt.run(participantId, timestamp, Date.now(), timestamp, Date.now());
      return true;
    } catch (error) {
      console.error('[Store] 标记同步失败:', error.message);
      return false;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    try {
      const stmt = this.db.prepare('SELECT * FROM sync_state');
      const rows = stmt.all();
      
      const status = {};
      for (const row of rows) {
        // 计算未同步消息数
        const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE timestamp > ?');
        const countRow = countStmt.get(row.last_sync);
        
        status[row.participant_id] = {
          lastSync: row.last_sync,
          lastSyncTime: new Date(row.last_sync).toISOString(),
          unsyncedCount: countRow.count
        };
      }
      return status;
    } catch (error) {
      console.error('[Store] 获取同步状态失败:', error.message);
      return {};
    }
  }

  /**
   * 检查消息是否重复
   */
  isDuplicate(messageId) {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM messages WHERE id = ?');
      return !!stmt.get(messageId);
    } catch (error) {
      return false;
    }
  }

  /**
   * 搜索消息
   */
  searchMessages(query, limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE content LIKE ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      const rows = stmt.all(`%${query}%`, limit);
      
      return rows.map(row => ({
        id: row.id,
        type: row.type,
        sender: row.sender,
        content: row.content,
        timestamp: row.timestamp,
        source: row.source,
        atTargets: row.at_targets ? JSON.parse(row.at_targets) : null,
        replyTo: row.reply_to
      }));
    } catch (error) {
      console.error('[Store] 搜索消息失败:', error.message);
      return [];
    }
  }

  /**
   * 获取消息统计
   */
  getStats() {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages');
      const total = totalStmt.get().count;

      const bySenderStmt = this.db.prepare(`
        SELECT sender, COUNT(*) as count FROM messages GROUP BY sender ORDER BY count DESC
      `);
      const bySender = bySenderStmt.all();

      const todayStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages WHERE timestamp > ?
      `);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const today = todayStmt.get(todayStart.getTime()).count;

      return { total, today, bySender };
    } catch (error) {
      console.error('[Store] 获取统计失败:', error.message);
      return { total: 0, today: 0, bySender: [] };
    }
  }

  /**
   * 清空所有消息
   */
  clear() {
    try {
      this.db.exec('DELETE FROM messages');
      return true;
    } catch (error) {
      console.error('[Store] 清空消息失败:', error.message);
      return false;
    }
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new MessageStore();
