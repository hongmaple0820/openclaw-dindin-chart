/**
 * 私信 API 路由
 * @author 小琳
 * @date 2026-02-06
 */
const express = require('express');
const router = express.Router();
const PrivateMessageModel = require('../models/private-message');
const { authenticate } = require('../middleware/auth');

// 初始化模型
const pmModel = new PrivateMessageModel();

/**
 * 发送私信
 * POST /api/dm/send
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const { receiverId, receiverName, content, messageType } = req.body;
    const senderId = req.user.userId;
    const senderName = req.user.nickname || req.user.username;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: '接收者和内容不能为空'
      });
    }

    const message = pmModel.send({
      senderId,
      senderName,
      receiverId,
      receiverName: receiverName || receiverId,
      content,
      messageType: messageType || 'text',
      source: 'web'
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('[DM] 发送失败:', error);
    res.status(500).json({
      success: false,
      error: '发送失败'
    });
  }
});

/**
 * 获取会话列表
 * GET /api/dm/conversations
 */
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const conversations = pmModel.getConversations(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('[DM] 获取会话列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取失败'
    });
  }
});

/**
 * 获取会话消息
 * GET /api/dm/messages/:conversationId
 */
router.get('/messages/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const { limit = 50, before } = req.query;

    // 验证用户是会话参与者
    if (!conversationId.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: '无权访问该会话'
      });
    }

    const messages = pmModel.getMessages(conversationId, {
      limit: parseInt(limit),
      before: before ? parseInt(before) : null
    });

    // 标记为已读
    pmModel.markAsRead(conversationId, userId);

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('[DM] 获取消息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取失败'
    });
  }
});

/**
 * 标记会话已读
 * POST /api/dm/read/:conversationId
 */
router.post('/read/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    const count = pmModel.markAsRead(conversationId, userId);

    res.json({
      success: true,
      markedCount: count
    });
  } catch (error) {
    console.error('[DM] 标记已读失败:', error);
    res.status(500).json({
      success: false,
      error: '操作失败'
    });
  }
});

/**
 * 删除消息
 * DELETE /api/dm/message/:messageId
 */
router.delete('/message/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const deleted = pmModel.delete(messageId, userId);

    if (deleted) {
      res.json({
        success: true,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '消息不存在或无权删除'
      });
    }
  } catch (error) {
    console.error('[DM] 删除失败:', error);
    res.status(500).json({
      success: false,
      error: '删除失败'
    });
  }
});

/**
 * 获取未读数
 * GET /api/dm/unread
 */
router.get('/unread', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = pmModel.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('[DM] 获取未读数失败:', error);
    res.status(500).json({
      success: false,
      error: '获取失败'
    });
  }
});

/**
 * 搜索私信
 * GET /api/dm/search
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词不能为空'
      });
    }

    const results = pmModel.search(userId, q, { limit: parseInt(limit) });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[DM] 搜索失败:', error);
    res.status(500).json({
      success: false,
      error: '搜索失败'
    });
  }
});

module.exports = router;
