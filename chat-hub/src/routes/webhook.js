/**
 * 钉钉消息 Webhook 处理器
 * 接收 OpenClaw 钉钉插件推送的消息，自动存入 chat-hub
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/webhook/dingtalk
 * 接收钉钉消息并存入数据库
 * 
 * Body:
 * {
 *   "sender": "发送者名字",
 *   "content": "消息内容",
 *   "conversationId": "会话ID（可选）",
 *   "messageId": "消息ID（可选）",
 *   "timestamp": 1234567890（可选）
 * }
 */
router.post('/dingtalk', async (req, res) => {
  try {
    const { sender, content, conversationId, messageId, timestamp } = req.body;

    if (!sender || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sender, content'
      });
    }

    // 获取 message-store 实例
    const messageStore = req.app.get('messageStore');
    if (!messageStore) {
      console.error('[webhook/dingtalk] message-store not available');
      return res.status(500).json({
        success: false,
        error: 'Message store not initialized'
      });
    }

    // 存储消息
    const message = {
      id: messageId || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'human',
      sender,
      content,
      timestamp: timestamp || Date.now(),
      source: 'dingtalk-webhook',
      atTargets: null,
      replyTo: null
    };

    await messageStore.addMessage(message);

    console.log(`[webhook/dingtalk] Message stored: ${sender} -> ${content.substring(0, 50)}...`);

    res.json({
      success: true,
      message: {
        id: message.id,
        sender: message.sender,
        timestamp: message.timestamp
      }
    });

  } catch (error) {
    console.error('[webhook/dingtalk] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/webhook/dingtalk/health
 * 健康检查
 */
router.get('/dingtalk/health', (req, res) => {
  res.json({
    success: true,
    service: 'dingtalk-webhook',
    status: 'ok',
    timestamp: Date.now()
  });
});

module.exports = router;
