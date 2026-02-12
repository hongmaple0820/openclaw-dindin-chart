/**
 * 私信 API 路由
 * @author 小琳
 * @date 2026-02-06
 */
const express = require('express');
const router = express.Router();
const PrivateMessageModel = require('../models/private-message');
const { authenticate } = require('../middleware/auth');
const { notifyNewDM } = require('../services/redis');

const pmModel = new PrivateMessageModel();

router.post('/send', authenticate, async (req, res) => {
  try {
    const { receiverId, receiverName, content, messageType } = req.body;
    const senderId = req.user.id;
    const senderName = req.user.nickname || req.user.username;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: '接收者和内容不能为空'
      });
    }

    const message = await pmModel.send({
      senderId,
      senderName,
      receiverId,
      receiverName: receiverName || receiverId,
      content,
      messageType: messageType || 'text',
      source: 'web'
    });

    await notifyNewDM(message);

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

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const conversations = await pmModel.getConversations(userId, {
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

router.get('/messages/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { limit = 50, before } = req.query;

    if (!conversationId.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: '无权访问该会话'
      });
    }

    const messages = await pmModel.getMessages(conversationId, {
      limit: parseInt(limit),
      before: before ? parseInt(before) : null
    });

    await pmModel.markAsRead(conversationId, userId);

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

router.post('/read/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const count = await pmModel.markAsRead(conversationId, userId);

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

router.delete('/message/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const deleted = await pmModel.delete(messageId, userId);

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

router.get('/unread', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await pmModel.getUnreadCount(userId);

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

router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词不能为空'
      });
    }

    const results = await pmModel.search(userId, q, { limit: parseInt(limit) });

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
