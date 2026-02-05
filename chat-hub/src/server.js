const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default.json');
const redisClient = require('./redis-client');
const dingtalk = require('./dingtalk');

const app = express();
app.use(express.json());

/**
 * 接收钉钉 Outgoing 消息
 * POST /webhook/dingtalk
 */
app.post('/webhook/dingtalk', async (req, res) => {
  try {
    const { msgtype, text, senderNick, createAt, msgId } = req.body;

    console.log('[Server] 收到钉钉消息:', senderNick, '->', text?.content);

    // 构造标准消息格式
    const message = {
      id: msgId || uuidv4(),
      type: 'human',
      sender: senderNick || '未知用户',
      content: text?.content || '',
      timestamp: createAt || Date.now(),
      replyTo: null
    };

    // 发布到消息频道
    await redisClient.publish(config.channels.messages, message);

    res.json({ success: true });
  } catch (error) {
    console.error('[Server] 处理消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 手动发送消息（用于测试）
 * POST /api/send
 */
app.post('/api/send', async (req, res) => {
  try {
    const { content, sender = 'TestUser' } = req.body;

    const message = {
      id: uuidv4(),
      type: 'human',
      sender,
      content,
      timestamp: Date.now(),
      replyTo: null
    };

    await redisClient.publish(config.channels.messages, message);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * 启动服务器并订阅回复频道
 */
async function start() {
  // 订阅机器人回复频道，转发到钉钉
  await redisClient.subscribe(config.channels.replies, async (message) => {
    console.log('[Server] 收到机器人回复:', message.sender, '->', message.content?.substring(0, 50));

    // 发送到钉钉
    await dingtalk.sendText(message.content, message.sender);

    // 同时发布到消息频道，让其他机器人可以看到
    const forwardMessage = {
      ...message,
      id: uuidv4(), // 新的消息ID
      type: 'bot'
    };
    await redisClient.publish(config.channels.messages, forwardMessage);
  });

  app.listen(config.server.port, () => {
    console.log(`[Server] 消息中转服务已启动: http://localhost:${config.server.port}`);
    console.log('[Server] 钉钉回调地址: POST /webhook/dingtalk');
    console.log('[Server] 测试接口: POST /api/send');
  });
}

module.exports = { app, start };
