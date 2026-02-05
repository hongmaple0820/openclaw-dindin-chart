/**
 * 钉钉私聊处理器
 * 处理钉钉私聊消息并存储到数据库
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const redisClient = require('./redis-client');
const config = require('./config');

// 数据库连接 - 使用与chat-hub相同的数据库路径
const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
const db = new Database(dbPath);

// 设置 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

// 创建私聊消息表（如果不存在）
db.exec(`
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
`);

// 创建索引
db.exec(`CREATE INDEX IF NOT EXISTS idx_pm_conversation ON private_messages(conversation_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pm_sender ON private_messages(sender_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pm_receiver ON private_messages(receiver_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pm_created ON private_messages(created_at)`);

class DMHandler {
  /**
   * 判断消息是否为私聊
   */
  isDM(message) {
    // 钉钉私聊通常有以下特征之一：
    // 1. conversationType === '1' (单聊)
    // 2. chatType === 'singleChat'
    // 3. 消息来自特定用户而非群聊
    return message.conversationType === '1' || 
           message.chatType === 'singleChat' ||
           (message.senderNick && message.conversationTitle === message.senderNick);
  }

  /**
   * 存储私聊消息
   */
  async storeDM(message) {
    try {
      // 提取消息信息
      const dmData = {
        id: message.msgId || `dm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sender_id: message.senderId || message.senderStaffId || 'unknown',
        sender_name: message.senderNick || message.senderName || 'Unknown',
        receiver_id: message.receiverId || message.robotCode || config.bot?.name || 'unknown',
        receiver_name: config.bot?.name || 'Bot',
        content: this.extractContent(message),
        source: 'dingtalk',
        created_at: message.createAt || Date.now()
      };

      // 生成会话ID（按字母顺序排列，确保两个用户之间的会话ID一致）
      const sortedIds = [dmData.sender_id, dmData.receiver_id].sort();
      const conversationId = sortedIds.join('_');
      
      // 准备插入语句
      const stmt = db.prepare(`
        INSERT INTO private_messages (
          id, conversation_id, sender_id, sender_name, 
          receiver_id, receiver_name, content, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        dmData.id,
        conversationId,
        dmData.sender_id,
        dmData.sender_name,
        dmData.receiver_id,
        dmData.receiver_name,
        dmData.content,
        dmData.source,
        dmData.created_at
      ]);

      console.log(`[DM Handler] 私聊消息已存储: ${dmData.sender_name} -> ${dmData.receiver_name}`);

      // 发布Redis通知，用于实时推送
      const notification = {
        type: 'new_dm',
        receiverId: dmData.receiver_id,
        senderId: dmData.sender_id,
        senderName: dmData.sender_name,
        conversationId: conversationId,
        messageId: dmData.id,
        preview: dmData.content.substring(0, 50)
      };
      
      await redisClient.publish('dm:notification', JSON.stringify(notification));

      return {
        id: dmData.id,
        conversation_id: conversationId,
        ...dmData
      };
    } catch (error) {
      console.error('[DM Handler] 存储私聊消息失败:', error);
      return null;
    }
  }

  /**
   * 提取消息内容
   */
  extractContent(message) {
    // 根据不同的消息类型提取内容
    if (message.text && message.text.content) {
      return message.text.content.trim();
    } else if (message.content) {
      return message.content.trim();
    } else if (typeof message === 'string') {
      return message.trim();
    }
    
    return JSON.stringify(message);
  }

  /**
   * 获取用户的私聊会话列表
   */
  async getUserConversations(userId, options = {}) {
    try {
      // 查找该用户参与的所有会话
      const sql = `
        SELECT DISTINCT conversation_id,
               CASE 
                 WHEN sender_id = ? THEN receiver_name 
                 ELSE sender_name 
               END as other_party_name,
               CASE 
                 WHEN sender_id = ? THEN receiver_id 
                 ELSE sender_id 
               END as other_party_id,
               MAX(created_at) as last_message_time
        FROM private_messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY conversation_id
        ORDER BY last_message_time DESC
        ${options.limit ? `LIMIT ?` : ''}
      `;
      
      const params = [userId, userId, userId, userId];
      if (options.limit) {
        params.push(options.limit);
      }
      
      const rows = db.prepare(sql).all(...params);
      return rows;
    } catch (error) {
      console.error('[DM Handler] 获取用户会话列表失败:', error);
      return [];
    }
  }

  /**
   * 获取私聊会话消息
   */
  async getConversationMessages(conversationId, options = {}) {
    try {
      let sql = `SELECT * FROM private_messages WHERE conversation_id = ?`;
      const params = [conversationId];
      
      if (options.limit) {
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(options.limit);
      } else {
        sql += ` ORDER BY created_at ASC`;
      }
      
      const rows = db.prepare(sql).all(...params);
      return rows;
    } catch (error) {
      console.error('[DM Handler] 获取会话消息失败:', error);
      return [];
    }
  }

  /**
   * 标记私聊消息为已读
   */
  async markAsRead(messageId, userId) {
    try {
      const stmt = db.prepare(`
        UPDATE private_messages 
        SET read_at = ? 
        WHERE id = ? AND receiver_id = ?
      `);
      
      stmt.run([Date.now(), messageId, userId]);
      
      return { success: true };
    } catch (error) {
      console.error('[DM Handler] 标记消息已读失败:', error);
      return { success: false };
    }
  }
}

// 创建单例
const dmHandler = new DMHandler();

module.exports = dmHandler;