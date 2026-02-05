/**
 * 私聊消息模型
 * @author 小琳
 * @date 2026-02-06
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class PrivateMessageModel {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
    this.db = new Database(this.dbPath);
    this.init();
  }

  /**
   * 初始化数据库表
   */
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        receiver_name TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        source TEXT DEFAULT 'web',
        read_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_pm_conversation ON private_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_pm_sender ON private_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_pm_receiver ON private_messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_pm_created ON private_messages(created_at DESC);
    `);
    console.log('[PrivateMessageModel] 数据库表初始化完成');
  }

  /**
   * 生成会话 ID（两个用户之间唯一）
   */
  generateConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  /**
   * 发送私信
   */
  send({ senderId, senderName, receiverId, receiverName, content, messageType = 'text', source = 'web' }) {
    const id = uuidv4();
    const conversationId = this.generateConversationId(senderId, receiverId);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO private_messages 
      (id, conversation_id, sender_id, sender_name, receiver_id, receiver_name, content, message_type, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, conversationId, senderId, senderName, receiverId, receiverName, content, messageType, source, now, now);

    return {
      id,
      conversationId,
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      messageType,
      source,
      readAt: null,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 获取用户的会话列表
   */
  getConversations(userId, { limit = 20, offset = 0 } = {}) {
    // 获取每个会话的最后一条消息
    const stmt = this.db.prepare(`
      SELECT 
        pm.*,
        (SELECT COUNT(*) FROM private_messages 
         WHERE conversation_id = pm.conversation_id 
         AND receiver_id = ? 
         AND read_at IS NULL) as unread_count
      FROM private_messages pm
      WHERE pm.id IN (
        SELECT id FROM private_messages p2
        WHERE p2.conversation_id = pm.conversation_id
        ORDER BY p2.created_at DESC
        LIMIT 1
      )
      AND (pm.sender_id = ? OR pm.receiver_id = ?)
      ORDER BY pm.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(userId, userId, userId, limit, offset);
    
    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      // 对方的信息
      partnerId: row.sender_id === userId ? row.receiver_id : row.sender_id,
      partnerName: row.sender_id === userId ? row.receiver_name : row.sender_name,
      lastMessage: {
        content: row.content,
        senderId: row.sender_id,
        createdAt: row.created_at
      },
      unreadCount: row.unread_count,
      updatedAt: row.created_at
    }));
  }

  /**
   * 获取会话消息
   */
  getMessages(conversationId, { limit = 50, before = null } = {}) {
    let sql = `
      SELECT * FROM private_messages 
      WHERE conversation_id = ?
    `;
    const params = [conversationId];

    if (before) {
      sql += ` AND created_at < ?`;
      params.push(before);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      receiverId: row.receiver_id,
      receiverName: row.receiver_name,
      content: row.content,
      messageType: row.message_type,
      source: row.source,
      readAt: row.read_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })).reverse(); // 返回正序
  }

  /**
   * 标记消息已读
   */
  markAsRead(conversationId, userId) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE private_messages 
      SET read_at = ?, updated_at = ?
      WHERE conversation_id = ? 
      AND receiver_id = ? 
      AND read_at IS NULL
    `);

    const result = stmt.run(now, now, conversationId, userId);
    return result.changes;
  }

  /**
   * 删除消息
   */
  delete(messageId, userId) {
    // 只能删除自己发的消息
    const stmt = this.db.prepare(`
      DELETE FROM private_messages 
      WHERE id = ? AND sender_id = ?
    `);

    const result = stmt.run(messageId, userId);
    return result.changes > 0;
  }

  /**
   * 获取未读消息数
   */
  getUnreadCount(userId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM private_messages 
      WHERE receiver_id = ? AND read_at IS NULL
    `);

    const row = stmt.get(userId);
    return row.count;
  }

  /**
   * 搜索私信
   */
  search(userId, query, { limit = 20 } = {}) {
    const stmt = this.db.prepare(`
      SELECT * FROM private_messages 
      WHERE (sender_id = ? OR receiver_id = ?)
      AND content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, userId, `%${query}%`, limit);

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      receiverId: row.receiver_id,
      receiverName: row.receiver_name,
      content: row.content,
      createdAt: row.created_at
    }));
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}

module.exports = PrivateMessageModel;
