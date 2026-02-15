/**
 * 钉钉消息 Webhook 处理器
 * 接收 OpenClaw 钉钉插件推送的消息，自动存入 chat-hub
 */

const express = require('express');
const router = express.Router();
const config = require('../config');

// 获取用户映射
function getUserMapping() {
  const userMap = {};
  if (config.userPhones) {
    // 反向映射：从真实姓名到用户名
    Object.entries(config.userPhones).forEach(([username, realName]) => {
      userMap[realName] = username;
    });
  }
  return userMap;
}

/**
 * 转换发送者名称
 * @param {string} sender - 原始发送者名称（可能包含真实姓名）
 * @returns {string} 转换后的发送者名称（使用配置的用户名）
 */
function resolveSenderName(sender) {
  const userMap = getUserMapping();
  
  // 如果在映射中找到，使用映射的用户名
  if (userMap[sender]) {
    return userMap[sender];
  }
  
  // 否则保持原样
  return sender;
}

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

    // 转换发送者名称，保护隐私
    const resolvedSender = resolveSenderName(sender);

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
      sender: resolvedSender,
      content,
      timestamp: timestamp || Date.now(),
      source: 'dingtalk-webhook',
      atTargets: null,
      replyTo: null
    };

    await messageStore.addMessage(message);

    console.log(`[webhook/dingtalk] Message stored: ${resolvedSender} -> ${content.substring(0, 50)}...`);

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