const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const redisClient = require('./redis-client');
const messageStore = require('./message-store');
const dingtalk = require('./dingtalk');
const dmHandler = require('./dm-handler');
const fileRoutes = require('./routes/files');
const sseManager = require('./sse-manager');

const app = express();

// 静态文件服务 - 前端 SPA
const webDistPath = path.resolve(__dirname, '../../chat-web/dist');
const adminDistPath = path.resolve(__dirname, '../../chat-admin-ui/dist');
console.log('[Server] 前端目录:', webDistPath);
console.log('[Server] 管理后台:', adminDistPath);

// 管理后台静态文件（/admin 路径）
app.use('/admin', express.static(adminDistPath));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// 主前端静态文件
app.use(express.static(webDistPath));

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// 用户认证模块
const auth = require('./auth');

// ============ 认证 API ============

/**
 * 注册
 * POST /api/auth/register
 */
app.post('/api/auth/register', (req, res) => {
  const { username, nickname, email, password, type } = req.body;
  const result = auth.register({ username, nickname, email, password, type });
  
  if (result.success) {
    console.log('[Auth] 新用户注册（待审核）:', username, type || 'human');
    res.json(result);  // 返回审核待定状态，不返回 token
  } else {
    res.status(400).json(result);
  }
});

/**
 * 登录
 * POST /api/auth/login
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const result = auth.login(username, password);
  
  if (result.success) {
    console.log('[Auth] 用户登录:', username);
    res.json(result);
  } else {
    // 返回状态码，前端需要判断
    const status = result.code === 'PENDING' ? 403 : 401;
    res.status(status).json(result);
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============ 消息相关 ============

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

    // WebSocket 推送新消息
    try {
      const websocket = require('./websocket');
      websocket.pushMessage(message);
    } catch (e) {}

    // SSE 推送新消息
    sseManager.broadcast('message', message);

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
    
    // WebSocket 推送新消息
    try {
      const websocket = require('./websocket');
      const sent = websocket.pushMessage(message);
      console.log(`[WS] 推送消息给 ${sent} 个客户端`);
    } catch (e) {
      // WebSocket 可能未初始化
    }
    
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

// ==================== 已读功能 API ====================

/**
 * 标记单条消息已读
 * POST /api/read/:messageId
 * Body: { readerId: "小琳" }
 */
app.post('/api/read/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { readerId } = req.body;

    if (!readerId) {
      return res.status(400).json({ success: false, error: 'readerId is required' });
    }

    const result = messageStore.markAsRead(messageId, readerId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量标记已读（标记到某个时间点之前的所有消息）
 * POST /api/read-all
 * Body: { readerId: "小琳", beforeTimestamp?: 1234567890 }
 */
app.post('/api/read-all', async (req, res) => {
  try {
    const { readerId, beforeTimestamp } = req.body;

    if (!readerId) {
      return res.status(400).json({ success: false, error: 'readerId is required' });
    }

    const result = messageStore.markAllAsRead(readerId, beforeTimestamp || Date.now());
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取未读消息
 * GET /api/unread/:readerId
 */
app.get('/api/unread/:readerId', async (req, res) => {
  try {
    const { readerId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const messages = messageStore.getUnreadMessages(readerId, limit);
    const count = messageStore.getUnreadCount(readerId);

    res.json({ 
      success: true, 
      count,
      messages 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取未读消息数量
 * GET /api/unread-count/:readerId
 */
app.get('/api/unread-count/:readerId', async (req, res) => {
  try {
    const { readerId } = req.params;
    const count = messageStore.getUnreadCount(readerId);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取消息的已读状态（谁读了这条消息）
 * GET /api/read-status/:messageId
 */
app.get('/api/read-status/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const readers = messageStore.getMessageReadStatus(messageId);
    res.json({ success: true, readers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有参与者的已读状态摘要
 * GET /api/read-summary
 */
app.get('/api/read-summary', async (req, res) => {
  try {
    const summary = messageStore.getReadStatusSummary();
    res.json({ success: true, summary });
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
 * 获取私聊会话列表
 * GET /api/dm/conversations
 */
app.get('/api/dm/conversations', async (req, res) => {
  try {
    const userId = req.query.userId || req.query.sender;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const conversations = await dmHandler.getUserConversations(userId, { limit });
    
    res.json({ 
      success: true, 
      count: conversations.length,
      conversations 
    });
  } catch (error) {
    console.error('[Server] 获取私聊会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取私聊消息
 * GET /api/dm/messages/:conversationId
 */
app.get('/api/dm/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // 验证用户是否有权访问此会话
    const userId = req.query.userId || req.query.sender;
    if (userId) {
      const conversationUsers = conversationId.split('_');
      if (!conversationUsers.includes(userId)) {
        return res.status(403).json({ success: false, error: 'Unauthorized to access this conversation' });
      }
    }
    
    const messages = await dmHandler.getConversationMessages(conversationId, { limit });
    
    res.json({ 
      success: true, 
      count: messages.length,
      messages 
    });
  } catch (error) {
    console.error('[Server] 获取私聊消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 存储私聊消息
 * POST /api/dm/store
 */
app.post('/api/dm/store', async (req, res) => {
  try {
    const { content, sender, senderId, receiver, receiverId, source = 'web' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    if (!sender || !senderId) {
      return res.status(400).json({ success: false, error: 'sender and senderId are required' });
    }

    // 构造消息对象用于存储 - 使用 dmHandler 期望的字段名
    const messageData = {
      senderId: senderId,  // dmHandler 期望的字段名
      senderNick: sender,
      receiverId: receiverId || config.bot?.name || 'bot',
      receiverName: receiver || config.bot?.name || 'Bot',
      text: { content },  // dmHandler 会从这里提取内容
      source: source,
      createAt: Date.now()
    };

    const message = await dmHandler.storeDM(messageData);
    
    if (message) {
      res.json({ success: true, message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to store DM' });
    }
  } catch (error) {
    console.error('[Server] 存储私聊消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送私聊消息（简化接口，供前端使用）
 * POST /api/dm/send
 */
app.post('/api/dm/send', auth.authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const sender = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    if (!receiverId) {
      return res.status(400).json({ success: false, error: 'receiverId is required' });
    }

    // 获取接收者信息
    const receiver = auth.getUserById(receiverId) || { id: receiverId, username: receiverId };

    const dmData = {
      sender_id: sender.id,
      sender_name: sender.nickname || sender.username,
      receiver_id: receiverId,
      receiver_name: receiver.nickname || receiver.username || receiverId,
      content: content.trim(),
      source: 'web'
    };

    const messageData = {
      ...dmData,
      text: { content: content.trim() },
      createAt: Date.now()
    };

    const message = await dmHandler.storeDM(messageData);
    
    if (message) {
      res.json({ success: true, message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send DM' });
    }
  } catch (error) {
    console.error('[Server] 发送私聊消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取与指定用户的私聊消息
 * GET /api/dm/messages
 */
app.get('/api/dm/messages', auth.authMiddleware, async (req, res) => {
  try {
    const { partnerId, limit: limitStr } = req.query;
    const currentUser = req.user;
    const limit = parseInt(limitStr) || 50;

    if (!partnerId) {
      return res.status(400).json({ success: false, error: 'partnerId is required' });
    }

    // 构造会话 ID（按字母序排列确保唯一性）
    const userIds = [currentUser.id, partnerId].sort();
    const conversationId = userIds.join('_');

    const messages = await dmHandler.getConversationMessages(conversationId, { limit });
    
    res.json({ 
      success: true, 
      count: messages.length,
      messages 
    });
  } catch (error) {
    console.error('[Server] 获取私聊消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取在线用户列表
 * GET /api/online-users
 */
app.get('/api/online-users', (req, res) => {
  try {
    // 获取所有已通过审核的用户
    const result = auth.getAllUsers({ status: 'approved', limit: 100 });
    const users = result.users || [];
    
    // 简化用户信息
    const onlineUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.nickname || u.username,
      nickname: u.nickname,
      type: u.type,
      role: u.role === 'admin' ? '管理员' : (u.type === 'bot' ? 'AI' : null)
    }));

    res.json({ success: true, users: onlineUsers });
  } catch (error) {
    console.error('[Server] 获取在线用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 启动服务器
 */
async function start() {
  const myBotName = config.bot?.name || '小琳';
  
  // 注册文件路由
  app.use('/api/files', fileRoutes);
  
  // 注册管理后台路由
  const adminRoutes = require('./routes/admin')(messageStore, messageStore.db);
  app.use('/api/admin', adminRoutes);

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

  // ============ SSE 实时推送 ============

  /**
   * SSE 连接端点
   * GET /api/sse/connect
   * Query: userId (必填)
   */
  app.get('/api/sse/connect', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    console.log(`[SSE] 收到连接请求: ${userId}`);
    sseManager.connect(userId, res);
  });

  /**
   * 获取在线用户列表
   * GET /api/sse/online
   */
  app.get('/api/sse/online', (req, res) => {
    const users = sseManager.getOnlineUsers();
    res.json({
      success: true,
      count: users.length,
      users,
    });
  });

  /**
   * 检查用户是否在线
   * GET /api/sse/status/:userId
   */
  app.get('/api/sse/status/:userId', (req, res) => {
    const { userId } = req.params;
    const isOnline = sseManager.isOnline(userId);
    res.json({
      success: true,
      userId,
      isOnline,
    });
  });

  // ============ 监控 API ============

  /**
   * 获取内存状态
   * GET /api/monitor/memory
   */
  app.get('/api/monitor/memory', (req, res) => {
    try {
      const MemoryGuard = require('./utils/memory-guard');
      const memoryGuard = new MemoryGuard();
      const status = memoryGuard.getStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 获取系统状态（综合）
   * GET /api/monitor/status
   */
  app.get('/api/monitor/status', async (req, res) => {
    try {
      const memory = process.memoryUsage();
      const uptime = process.uptime();
      const redisStatus = redisClient.getStatus();
      const onlineUsers = sseManager.getOnlineUsers();

      res.json({
        success: true,
        system: {
          uptime: Math.round(uptime),
          memory: {
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
            rss: Math.round(memory.rss / 1024 / 1024),
          },
          node: process.version,
          pid: process.pid,
        },
        redis: redisStatus,
        sse: {
          onlineCount: onlineUsers.length,
          users: onlineUsers,
        },
        messages: messageStore.getStats(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // SPA fallback - 所有未匹配的路由返回 index.html
  app.get('*', (req, res, next) => {
    // 跳过 API 和 webhook 路由
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });

  const port = config.server?.port || 3000;
  
  // 使用 http.createServer 以支持 WebSocket
  const http = require('http');
  const server = http.createServer(app);
  
  // 初始化 WebSocket
  const websocket = require('./websocket');
  websocket.init(server);
  
  server.listen(port, () => {
    const stats = messageStore.getStats();
    console.log(`[Server] 消息中转服务已启动: http://localhost:${port}`);
    console.log('[Server] WebSocket: ws://localhost:' + port + '/ws');
    console.log('[Server] 前端页面:', webDistPath);
    console.log('[Server] 存储目录:', messageStore.storeDir);
    console.log('[Server] 数据库:', messageStore.dbPath);
    console.log('[Server] 已加载消息:', stats.total, '条');
  });
  
  // 导出 websocket 用于消息推送
  module.exports.websocket = websocket;
}

module.exports = { app, start };
