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

    // 创建已读表（群聊）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_reads (
        message_id TEXT NOT NULL,
        reader_id TEXT NOT NULL,
        read_at INTEGER NOT NULL,
        PRIMARY KEY (message_id, reader_id)
      );

      CREATE INDEX IF NOT EXISTS idx_reads_message ON message_reads(message_id);
      CREATE INDEX IF NOT EXISTS idx_reads_reader ON message_reads(reader_id);
    `);
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

  // ==================== 已读功能 ====================

  /**
   * 标记消息已读（单条）
   * @param {string} messageId 消息ID
   * @param {string} readerId 读者ID（如 "小琳"、"小猪"、"maple"）
   */
  markAsRead(messageId, readerId) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO message_reads (message_id, reader_id, read_at)
        VALUES (?, ?, ?)
      `);
      stmt.run(messageId, readerId, Date.now());
      return true;
    } catch (error) {
      console.error('[Store] 标记已读失败:', error.message);
      return false;
    }
  }

  /**
   * 批量标记已读（到某个时间点之前的所有消息）
   * @param {string} readerId 读者ID
   * @param {number} beforeTimestamp 时间戳，标记此时间之前的所有消息
   */
  markAllAsRead(readerId, beforeTimestamp = Date.now()) {
    try {
      // 获取所有未读消息ID
      const msgStmt = this.db.prepare(`
        SELECT m.id FROM messages m
        LEFT JOIN message_reads r ON m.id = r.message_id AND r.reader_id = ?
        WHERE m.timestamp <= ? AND r.message_id IS NULL
      `);
      const unreadMessages = msgStmt.all(readerId, beforeTimestamp);

      if (unreadMessages.length === 0) {
        return { marked: 0 };
      }

      // 批量插入
      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO message_reads (message_id, reader_id, read_at)
        VALUES (?, ?, ?)
      `);

      const now = Date.now();
      const insertMany = this.db.transaction((messages) => {
        for (const msg of messages) {
          insertStmt.run(msg.id, readerId, now);
        }
      });

      insertMany(unreadMessages);
      return { marked: unreadMessages.length };
    } catch (error) {
      console.error('[Store] 批量标记已读失败:', error.message);
      return { marked: 0, error: error.message };
    }
  }

  /**
   * 获取未读消息
   * @param {string} readerId 读者ID
   * @param {number} limit 限制数量
   */
  getUnreadMessages(readerId, limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT m.* FROM messages m
        LEFT JOIN message_reads r ON m.id = r.message_id AND r.reader_id = ?
        WHERE r.message_id IS NULL
        ORDER BY m.timestamp ASC
        LIMIT ?
      `);
      const rows = stmt.all(readerId, limit);

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
      console.error('[Store] 获取未读消息失败:', error.message);
      return [];
    }
  }

  /**
   * 获取未读消息数量
   * @param {string} readerId 读者ID
   */
  getUnreadCount(readerId) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages m
        LEFT JOIN message_reads r ON m.id = r.message_id AND r.reader_id = ?
        WHERE r.message_id IS NULL
      `);
      return stmt.get(readerId).count;
    } catch (error) {
      console.error('[Store] 获取未读数量失败:', error.message);
      return 0;
    }
  }

  /**
   * 获取消息的已读状态（谁读了）
   * @param {string} messageId 消息ID
   */
  getMessageReadStatus(messageId) {
    try {
      const stmt = this.db.prepare(`
        SELECT reader_id, read_at FROM message_reads WHERE message_id = ?
      `);
      const rows = stmt.all(messageId);
      return rows.map(row => ({
        readerId: row.reader_id,
        readAt: row.read_at
      }));
    } catch (error) {
      console.error('[Store] 获取已读状态失败:', error.message);
      return [];
    }
  }

  /**
   * 获取所有参与者的已读状态摘要
   */
  getReadStatusSummary() {
    try {
      // 获取所有已知的读者
      const readersStmt = this.db.prepare(`
        SELECT DISTINCT reader_id FROM message_reads
        UNION
        SELECT DISTINCT sender FROM messages
      `);
      const readers = readersStmt.all().map(r => r.reader_id || r.sender);

      const summary = {};
      for (const reader of readers) {
        const unreadCount = this.getUnreadCount(reader);
        const lastReadStmt = this.db.prepare(`
          SELECT MAX(read_at) as last_read FROM message_reads WHERE reader_id = ?
        `);
        const lastRead = lastReadStmt.get(reader)?.last_read || null;

        summary[reader] = {
          unreadCount,
          lastRead,
          lastReadTime: lastRead ? new Date(lastRead).toISOString() : null
        };
      }
      return summary;
    } catch (error) {
      console.error('[Store] 获取已读摘要失败:', error.message);
      return {};
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
