const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
const db = new Database(dbPath);

/**
 * 生成会话ID（user1_user2 排序）
 */
function generateConversationId(user1Id, user2Id) {
  const ids = [user1Id, user2Id].sort();
  return `${ids[0]}_${ids[1]}`;
}

/**
 * 获取或创建会话
 */
function getOrCreateConversation(user1Id, user1Name, user2Id, user2Name) {
  const conversationId = generateConversationId(user1Id, user2Id);
  const now = Date.now();
  
  let conversation = db.prepare('SELECT * FROM ch_conversation WHERE id = ?').get(conversationId);
  
  if (!conversation) {
    // 创建新会话
    db.prepare(`
      INSERT INTO ch_conversation (id, user1_id, user1_name, user2_id, user2_name, create_time, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, user1Id, user1Name, user2Id, user2Name, now, now);
    
    conversation = db.prepare('SELECT * FROM ch_conversation WHERE id = ?').get(conversationId);
  }
  
  return conversation;
}

/**
 * 发送私信
 * POST /api/chat/dm/send
 */
router.post('/send', (req, res) => {
  try {
    const { senderId, sender, receiverId, receiver, content, type = 'text', mediaUrl, replyTo } = req.body;
    
    if (!senderId || !sender || !receiverId || !receiver || !content) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    
    const conversationId = generateConversationId(senderId, receiverId);
    const messageId = uuidv4();
    const timestamp = Date.now();
    
    // 获取或创建会话
    getOrCreateConversation(senderId, sender, receiverId, receiver);
    
    // 插入消息
    db.prepare(`
      INSERT INTO ch_direct_message 
      (id, conversation_id, sender_id, sender, receiver_id, receiver, content, type, media_url, reply_to, timestamp, source, is_read, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(messageId, conversationId, senderId, sender, receiverId, receiver, content, type, mediaUrl, replyTo, timestamp, 'web', 0, 0);
    
    // 更新会话最后消息
    db.prepare(`
      UPDATE ch_conversation 
      SET last_message = ?,
          last_message_time = ?,
          update_time = ?,
          unread_count_user1 = CASE WHEN user1_id = ? THEN unread_count_user1 ELSE unread_count_user1 + 1 END,
          unread_count_user2 = CASE WHEN user2_id = ? THEN unread_count_user2 ELSE unread_count_user2 + 1 END
      WHERE id = ?
    `).run(content, timestamp, timestamp, receiverId, receiverId, conversationId);
    
    // TODO: 发送 Redis 通知
    
    res.json({
      success: true,
      message: {
        id: messageId,
        conversationId,
        senderId,
        sender,
        receiverId,
        receiver,
        content,
        type,
        mediaUrl,
        replyTo,
        timestamp,
        isRead: false
      }
    });
  } catch (error) {
    console.error('发送私信失败:', error);
    res.status(500).json({ success: false, message: '发送失败', error: (error as Error).message });
  }
});

/**
 * 获取会话列表
 * GET /api/chat/dm/conversations?userId=xxx
 */
router.get('/conversations', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少 userId 参数' });
    }
    
    const conversations = db.prepare(`
      SELECT * FROM ch_conversation
      WHERE user1_id = ? OR user2_id = ?
      ORDER BY update_time DESC
    `).all(userId, userId);
    
    // 转换数据格式
    const result = conversations.map(conv => {
      const isUser1 = conv.user1_id === userId;
      return {
        id: conv.id,
        userId: isUser1 ? conv.user2_id : conv.user1_id,
        userName: isUser1 ? conv.user2_name : conv.user1_name,
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time,
        unreadCount: isUser1 ? conv.unread_count_user1 : conv.unread_count_user2,
        createTime: conv.create_time,
        updateTime: conv.update_time
      };
    });
    
    res.json({ success: true, conversations: result });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 获取与某用户的对话历史
 * GET /api/chat/dm/conversation/:userId?currentUserId=xxx&limit=50&offset=0
 */
router.get('/conversation/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { currentUserId, limit = 50, offset = 0 } = req.query;
    
    if (!currentUserId) {
      return res.status(400).json({ success: false, message: '缺少 currentUserId 参数' });
    }
    
    const conversationId = generateConversationId(currentUserId, userId);
    
    const messages = db.prepare(`
      SELECT * FROM ch_direct_message
      WHERE conversation_id = ? AND is_deleted = 0
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(conversationId, parseInt(limit), parseInt(offset));
    
    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('获取对话历史失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 标记消息已读
 * POST /api/chat/dm/read
 */
router.post('/read', (req, res) => {
  try {
    const { userId, conversationId } = req.body;
    
    if (!userId || !conversationId) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    
    // 标记消息为已读
    db.prepare(`
      UPDATE ch_direct_message
      SET is_read = 1
      WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0
    `).run(conversationId, userId);
    
    // 更新会话未读数
    const conversation = db.prepare('SELECT * FROM ch_conversation WHERE id = ?').get(conversationId);
    if (conversation) {
      if (conversation.user1_id === userId) {
        db.prepare('UPDATE ch_conversation SET unread_count_user1 = 0 WHERE id = ?').run(conversationId);
      } else {
        db.prepare('UPDATE ch_conversation SET unread_count_user2 = 0 WHERE id = ?').run(conversationId);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ success: false, message: '标记失败', error: (error as Error).message });
  }
});

/**
 * 获取总未读数
 * GET /api/chat/dm/unread-count?userId=xxx
 */
router.get('/unread-count', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少 userId 参数' });
    }
    
    const result = db.prepare(`
      SELECT 
        SUM(CASE WHEN user1_id = ? THEN unread_count_user1 ELSE 0 END) +
        SUM(CASE WHEN user2_id = ? THEN unread_count_user2 ELSE 0 END) as total_unread
      FROM ch_conversation
      WHERE user1_id = ? OR user2_id = ?
    `).get(userId, userId, userId, userId);
    
    res.json({ success: true, count: result.total_unread || 0 });
  } catch (error) {
    console.error('获取未读数失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 删除会话
 * DELETE /api/chat/dm/conversation/:userId?currentUserId=xxx
 */
router.delete('/conversation/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { currentUserId } = req.query;
    
    if (!currentUserId) {
      return res.status(400).json({ success: false, message: '缺少 currentUserId 参数' });
    }
    
    const conversationId = generateConversationId(currentUserId, userId);
    
    // 标记消息为删除（软删除）
    db.prepare(`
      UPDATE ch_direct_message
      SET is_deleted = 1
      WHERE conversation_id = ?
    `).run(conversationId);
    
    // 删除会话
    db.prepare('DELETE FROM ch_conversation WHERE id = ?').run(conversationId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: (error as Error).message });
  }
});

module.exports = router;

// Make this a module
export {};
