/**
 * 私聊消息模型
 * @author 小琳
 * @date 2026-02-06
 */
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class PrivateMessageModel {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
    this.dbPromise = this.init();
  }

  async init() {
    const db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await db.exec(`
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
    return db;
  }

  generateConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  async send({ senderId, senderName, receiverId, receiverName, content, messageType = 'text', source = 'web' }) {
    const db = await this.dbPromise;
    const id = uuidv4();
    const conversationId = this.generateConversationId(senderId, receiverId);
    const now = Date.now();

    await db.run(`
      INSERT INTO private_messages 
      (id, conversation_id, sender_id, sender_name, receiver_id, receiver_name, content, message_type, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, conversationId, senderId, senderName, receiverId, receiverName, content, messageType, source, now, now]);

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

  async getConversations(userId, { limit = 20, offset = 0 } = {}) {
    const db = await this.dbPromise;
    
    const rows = await db.all(`
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
    `, [userId, userId, userId, limit, offset]);
    
    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
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

  async getMessages(conversationId, { limit = 50, before = null } = {}) {
    const db = await this.dbPromise;
    
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

    const rows = await db.all(sql, params);

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
    })).reverse();
  }

  async markAsRead(conversationId, userId) {
    const db = await this.dbPromise;
    const now = Date.now();
    
    const result = await db.run(`
      UPDATE private_messages 
      SET read_at = ?, updated_at = ?
      WHERE conversation_id = ? 
      AND receiver_id = ? 
      AND read_at IS NULL
    `, [now, now, conversationId, userId]);
    
    return result.changes;
  }

  async delete(messageId, userId) {
    const db = await this.dbPromise;
    
    const result = await db.run(`
      DELETE FROM private_messages 
      WHERE id = ? AND sender_id = ?
    `, [messageId, userId]);
    
    return result.changes > 0;
  }

  async getUnreadCount(userId) {
    const db = await this.dbPromise;
    
    const row = await db.get(`
      SELECT COUNT(*) as count FROM private_messages 
      WHERE receiver_id = ? AND read_at IS NULL
    `, [userId]);
    
    return row.count;
  }

  async search(userId, query, { limit = 20 } = {}) {
    const db = await this.dbPromise;
    
    const rows = await db.all(`
      SELECT * FROM private_messages 
      WHERE (sender_id = ? OR receiver_id = ?)
      AND content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, userId, `%${query}%`, limit]);

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

  async close() {
    const db = await this.dbPromise;
    await db.close();
  }
}

module.exports = PrivateMessageModel;
