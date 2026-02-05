const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const redisClient = require('./redis-client');
const dingtalk = require('./dingtalk');

const app = express();
app.use(express.json());

/**
 * 识别消息是否来自机器人
 */
function isBotMessage(senderNick, content) {
  const botNames = config.bots?.names || [];
  
  // 检查发送者名称
  if (botNames.some(name => senderNick?.includes(name))) {
    return true;
  }
  
  // 检查消息末尾的签名格式 [机器人名]
  const signatureMatch = content?.match(/\[([^\]]+)\]\s*$/);
  if (signatureMatch && botNames.includes(signatureMatch[1])) {
    return true;
  }
  
  return false;
}

/**
 * 接收钉钉 Outgoing 消息
 * POST /webhook/dingtalk
 */
app.post('/webhook/dingtalk', async (req, res) => {
  try {
    const { msgtype, text, senderNick, createAt, msgId } = req.body;
    const content = text?.content || '';

    console.log('[Server] 收到钉钉消息:', senderNick, '->', content.substring(0, 50));

    // 生成消息 ID（用于去重）
    const messageId = msgId || `${senderNick}-${createAt}-${content.substring(0, 20)}`;

    // 去重检查
    if (await redisClient.isDuplicate(messageId)) {
      return res.json({ success: true, skipped: true, reason: 'duplicate' });
    }

    // 识别消息类型
    const isBot = isBotMessage(senderNick, content);

    // 构造标准消息格式
    const message = {
      id: messageId,
      type: isBot ? 'bot' : 'human',
      sender: senderNick || '未知用户',
      content: content,
      timestamp: createAt || Date.now(),
      replyTo: null
    };

    // 保存到上下文
    await redisClient.addToContext(message);

    // 发布到消息频道
    await redisClient.publish(config.channels.messages, message);

    res.json({ success: true, messageId: message.id, type: message.type });
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
    const { content, sender = 'TestUser', type = 'human' } = req.body;

    const message = {
      id: uuidv4(),
      type,
      sender,
      content,
      timestamp: Date.now(),
      replyTo: null
    };

    // 去重检查
    if (await redisClient.isDuplicate(message.id)) {
      return res.json({ success: true, skipped: true });
    }

    await redisClient.addToContext(message);
    await redisClient.publish(config.channels.messages, message);
    
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 机器人发送回复（会自动转发到钉钉）
 * POST /api/reply
 */
app.post('/api/reply', async (req, res) => {
  try {
    const { content, sender = 'Bot', atTargets = null } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    const message = {
      id: uuidv4(),
      type: 'bot',
      sender,
      content,
      timestamp: Date.now(),
      atTargets,  // 可选：@ 用户
      replyTo: null
    };

    // 发布到回复频道（订阅者会自动发送到钉钉）
    await redisClient.publish(config.channels.replies, message);
    
    console.log('[Server] 机器人回复:', sender, '->', content.substring(0, 50));
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取聊天上下文
 * GET /api/context
 */
app.get('/api/context', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const context = await redisClient.getContext(limit);
    res.json({ success: true, context });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    config: {
      bots: config.bots?.names || [],
      dedup: config.dedup?.enabled || false
    }
  });
});

/**
 * 启动服务器并订阅回复频道
 */
async function start() {
  const myBotName = config.bot?.name || '小琳';
  
  // 订阅机器人回复频道，只转发自己的回复到钉钉
  await redisClient.subscribe(config.channels.replies, async (message) => {
    // 只处理自己的回复
    if (message.sender !== myBotName) {
      console.log(`[Server] 忽略其他机器人回复: ${message.sender}`);
      return;
    }
    
    console.log('[Server] 收到自己的回复:', message.sender, '->', message.content?.substring(0, 50));

    // 去重：避免重复发送
    const replyId = `reply-${message.id}`;
    if (await redisClient.isDuplicate(replyId)) {
      console.log('[Server] 重复回复，跳过发送');
      return;
    }

    // 发送到钉钉（支持 @ 用户）
    await dingtalk.sendText(message.content, message.sender, message.atTargets);

    // 保存到上下文
    await redisClient.addToContext(message);

    // 发布到消息频道，让其他机器人可以看到（但标记为 bot 类型）
    const forwardMessage = {
      ...message,
      id: uuidv4(),
      type: 'bot',
      forwarded: true
    };
    await redisClient.publish(config.channels.messages, forwardMessage);
  });

  const port = config.server?.port || 3000;
  app.listen(port, () => {
    console.log(`[Server] 消息中转服务已启动: http://localhost:${port}`);
    console.log('[Server] 钉钉回调地址: POST /webhook/dingtalk');
    console.log('[Server] 测试接口: POST /api/send');
    console.log('[Server] 上下文接口: GET /api/context');
    console.log('[Server] 机器人列表:', config.bots?.names?.join(', ') || '未配置');
  });
}

module.exports = { app, start };
