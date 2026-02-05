const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const redisClient = require('./redis-client');
const messageStore = require('./message-store');
const dingtalk = require('./dingtalk');
const dmHandler = require('./dm-handler');

const app = express();

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

/**
 * 解析消息中的 @ 提及
 * 支持格式：@小琳 @小猪 @鸿枫 等
 */
function parseAtMentions(content) {
  if (!content) return [];
  // 匹配 @xxx 格式（中文、英文、数字、下划线、连字符）
  const matches = content.match(/@[\w\u4e00-\u9fa5-]+/g) || [];
  return matches.map(m => m.substring(1)); // 去掉 @ 符号
}

/**
 * 识别消息是否来自机器人
 */
function isBotMessage(senderNick, content) {
  const botNames = config.bots?.names || [];
  
  if (botNames.some(name => senderNick?.includes(name))) {
    return true;
  }
  
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
    const { msgtype, text, senderNick, createAt, msgId, conversationType, chatType, conversationTitle, senderId, receiverId, robotCode } = req.body;
    const content = text?.content || '';

    console.log('[Server] 收到钉钉消息:', senderNick, '->', content.substring(0, 50));

    const messageId = msgId || `${senderNick}-${createAt}-${content.substring(0, 20)}`;

    // 检查是否为私聊消息
    const isPrivateChat = dmHandler.isDM({
      conversationType,
      chatType,
      senderNick,
      conversationTitle
    });

    if (isPrivateChat) {
      console.log('[Server] 识别为私聊消息:', senderNick);

      // 存储私聊消息
      const dmData = {
        senderId: senderId || senderNick, // 优先使用ID，如果没ID则用昵称
        senderNick,
        receiverId: receiverId || robotCode || config.bot?.name,
        text: { content },
        msgId,
        createAt,
        conversationType,
        chatType,
        conversationTitle
      };
      
      await dmHandler.storeDM(dmData);
      
      // 返回成功响应，但不将其作为普通群聊消息处理
      return res.json({ 
        success: true, 
        skipped: true, 
        reason: 'dm_handled',
        type: 'dm'
      });
    }

    // 本地去重（对于非私聊消息）
    if (messageStore.isDuplicate(messageId)) {
      return res.json({ success: true, skipped: true, reason: 'duplicate' });
    }

    const isBot = isBotMessage(senderNick, content);
    
    // 解析 @ 提及
    const atTargets = parseAtMentions(content);

    const message = {
      id: messageId,
      type: isBot ? 'bot' : 'human',
      sender: senderNick || '未知用户',
      content: content,
      timestamp: createAt || Date.now(),
      source: 'dingtalk',
      atTargets: atTargets.length > 0 ? atTargets : null,
      replyTo: null
    };

    // 保存到本地
    messageStore.addMessage(message);

    // 发布到 Redis（仅用于中转通知）
    await redisClient.publish(config.channels.messages, message);
    
    if (atTargets.length > 0) {
      console.log('[Server] @ 提及:', atTargets.join(', '));
    }

    res.json({ success: true, messageId: message.id, type: message.type, atTargets });
  } catch (error) {
    console.error('[Server] 处理消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Web 前端发送消息（同步到钉钉）
 * POST /api/send
 */
app.post('/api/send', async (req, res) => {
  try {
    const { content, sender = 'WebUser', atTargets } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    // 自动解析 @ 提及（如果没有传入 atTargets）
    const parsedAtTargets = atTargets || parseAtMentions(content);

    const message = {
      id: uuidv4(),
      type: 'human',
      sender,
      content,
      timestamp: Date.now(),
      source: 'web',
      atTargets: parsedAtTargets.length > 0 ? parsedAtTargets : null,
      replyTo: null
    };

    // 保存到本地
    messageStore.addMessage(message);
    
    // 发布到 Redis（通知其他机器人）
    await redisClient.publish(config.channels.messages, message);
    
    // 发送到钉钉群
    const dingtalkContent = `${sender}：${content}`;
    await dingtalk.sendText(dingtalkContent);
    
    console.log('[Server] Web 消息已发送:', sender, '->', content.substring(0, 50));
    res.json({ success: true, message });
  } catch (error) {
    console.error('[Server] 发送消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 机器人发送回复（同步到钉钉）
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
      source: 'bot',
      atTargets,
      replyTo: null
    };

    // 发布到回复频道（订阅者会发送到钉钉）
    await redisClient.publish(config.channels.replies, message);
    
    console.log('[Server] 机器人回复:', sender, '->', content.substring(0, 50));
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 仅存储消息（不发钉钉，用于 OpenClaw 转存收到的消息）
 * POST /api/store
 */
app.post('/api/store', async (req, res) => {
  try {
    const { content, sender, source = 'openclaw', timestamp, atTargets } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    if (!sender) {
      return res.status(400).json({ success: false, error: 'sender is required' });
    }

    // 自动解析 @ 提及（如果没有传入 atTargets）
    const parsedAtTargets = atTargets || parseAtMentions(content);

    const message = {
      id: uuidv4(),
      type: 'human',
      sender,
      content,
      timestamp: timestamp || Date.now(),
      source,
      atTargets: parsedAtTargets.length > 0 ? parsedAtTargets : null,
      replyTo: null
    };

    // 仅保存到本地，不发钉钉
    messageStore.addMessage(message);
    
    // 发布到 Redis（通知其他机器人）
    await redisClient.publish(config.channels.messages, message);
    
    console.log('[Server] 存储消息:', sender, '->', content.substring(0, 50), atTargets ? `(@${parsedAtTargets.join(', @')})` : '');
    res.json({ success: true, message });
  } catch (error) {
    console.error('[Server] 存储消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取聊天消息
 * GET /api/context
 */
app.get('/api/context', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const context = messageStore.getMessages(limit);
    res.json({ success: true, context });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取未同步消息（离线参与者重连时调用）
 * GET /api/sync/:participantId
 */
app.get('/api/sync/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const messages = messageStore.getUnsyncedMessages(participantId);
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 标记同步完成
 * POST /api/sync/:participantId
 */
app.post('/api/sync/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const { timestamp } = req.body;
    messageStore.markSynced(participantId, timestamp || Date.now());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取同步状态
 * GET /api/sync-status
 */
app.get('/api/sync-status', async (req, res) => {
  try {
    const status = messageStore.getSyncStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除消息
 * DELETE /api/message/:messageId
 */
app.delete('/api/message/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const deleted = messageStore.deleteMessage(messageId);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Message not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  const stats = messageStore.getStats();
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    messageCount: stats.total,
    todayCount: stats.today,
    config: {
      bot: config.bot?.name,
      storeDir: messageStore.storeDir,
      dbPath: messageStore.dbPath
    }
  });
});

/**
 * 搜索消息
 * GET /api/search?q=关键词&limit=50
 */
app.get('/api/search', (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'q is required' });
    }
    const messages = messageStore.searchMessages(q, parseInt(limit) || 50);
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取统计信息
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = messageStore.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 启动服务器
 */
async function start() {
  const myBotName = config.bot?.name || '小琳';
  
  // 订阅回复频道
  await redisClient.subscribe(config.channels.replies, async (message) => {
    // 保存所有回复到本地数据库（不管是谁发的）
    const savedMessage = {
      ...message,
      id: `reply-${message.id}`,
      source: 'redis'
    };
    
    if (!messageStore.isDuplicate(savedMessage.id)) {
      messageStore.addMessage(savedMessage);
      console.log(`[Server] 保存回复: ${message.sender} -> ${message.content?.substring(0, 30)}...`);
    }

    // 只转发自己的回复到钉钉
    if (message.sender !== myBotName) {
      return;
    }
    
    console.log('[Server] 发送到钉钉:', message.sender, '->', message.content?.substring(0, 50));

    // 发送到钉钉
    await dingtalk.sendText(message.content, message.sender, message.atTargets);

    // 通知其他机器人（发布到 messages 频道）
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
    const stats = messageStore.getStats();
    console.log(`[Server] 消息中转服务已启动: http://localhost:${port}`);
    console.log('[Server] 存储目录:', messageStore.storeDir);
    console.log('[Server] 数据库:', messageStore.dbPath);
    console.log('[Server] 已加载消息:', stats.total, '条');
    console.log('[Server] 钉钉回调: POST /webhook/dingtalk');
    console.log('[Server] 发送消息: POST /api/send');
    console.log('[Server] 机器人回复: POST /api/reply');
    console.log('[Server] 获取消息: GET /api/context');
    console.log('[Server] 搜索消息: GET /api/search?q=关键词');
    console.log('[Server] 统计信息: GET /api/stats');
    console.log('[Server] 同步消息: GET /api/sync/:participantId');
    console.log('[Server] 删除消息: DELETE /api/message/:messageId');
  });
}

module.exports = { app, start };
