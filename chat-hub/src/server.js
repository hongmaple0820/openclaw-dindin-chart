const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const redisClient = require('./redis-client');
const messageStore = require('./message-store');
const dingtalk = require('./dingtalk');
const dmHandler = require('./dm-handler');
const fileRoutes = require('./routes/files');
const sseManager = require('./sse-manager');

const app = express();

// HTTP 压缩（gzip/brotli）
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // 大于 1KB 才压缩
}));

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

// ==================== 性能监控中间件 ====================
const performanceStats = {
  requests: 0,
  slowQueries: [],
  errors: 0
};

app.use((req, res, next) => {
  const start = Date.now();
  performanceStats.requests++;

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // 记录慢查询（超过 1 秒）
    if (duration > 1000) {
      const slowQuery = {
        method: req.method,
        path: req.path,
        duration,
        timestamp: Date.now()
      };
      
      performanceStats.slowQueries.push(slowQuery);
      
      // 只保留最近 10 条慢查询
      if (performanceStats.slowQueries.length > 10) {
        performanceStats.slowQueries.shift();
      }
      
      console.warn(`⚠️ 慢查询: ${req.method} ${req.path} 用时 ${duration}ms`);
    }
  });

  next();
});

// 错误计数
app.use((err, req, res, next) => {
  performanceStats.errors++;
  next(err);
});

// 缓存管理器
const cacheManager = require('./cache-manager');

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
    const { content, sender = 'Bot', atTargets = null, replyTo = null } = req.body;

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
      replyTo  // 支持引用回复
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
    
    console.log('[Server] 机器人回复:', sender, '->', content.substring(0, 50), replyTo ? `(回复: ${replyTo})` : '');
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
    const { content, sender, source = 'openclaw', timestamp, atTargets, replyTo } = req.body;

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
      replyTo: replyTo || null  // 支持引用回复
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
    
    console.log('[Server] 存储消息:', sender, '->', content.substring(0, 50), atTargets ? `(@${parsedAtTargets.join(', @')})` : '', replyTo ? `(回复: ${replyTo})` : '');
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

// ==================== 图片上传 API ====================

const imageUpload = require('./image-upload');
const upload = imageUpload.createUploadMiddleware();

/**
 * 上传图片
 * POST /api/upload/image
 * Form-data: image (file), sender (string), messageId (string, optional)
 */
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const { sender, messageId } = req.body;
    
    if (!sender) {
      // 删除已上传的文件
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, error: 'sender is required' });
    }

    // 如果没有提供 messageId，创建一个图片消息
    let finalMessageId = messageId;
    if (!finalMessageId) {
      const message = {
        id: uuidv4(),
        type: 'image',
        sender,
        content: `[图片] ${req.file.originalname}`,
        timestamp: Date.now(),
        source: 'upload',
        atTargets: null,
        replyTo: null
      };
      
      await messageStore.addMessage(message);
      finalMessageId = message.id;
      
      // 推送消息
      try {
        const websocket = require('./websocket');
        websocket.pushMessage(message);
      } catch (e) {}
      
      // 发布到 Redis
      await redisClient.publish(config.channels.messages, message);
    }

    // 处理上传的文件
    const imageData = await imageUpload.processUploadedFile(req.file, sender, finalMessageId);
    
    // 存储图片记录
    await messageStore.addImage(imageData);

    console.log('[Server] 图片上传成功:', imageData.originalName, '->', imageData.filename);
    
    res.json({
      success: true,
      image: {
        id: imageData.id,
        messageId: finalMessageId,
        filename: imageData.filename,
        originalName: imageData.originalName,
        url: `/api/images/${imageData.filename}`,
        thumbnailUrl: imageData.thumbnailPath ? `/api/images/thumb_${imageData.filename}` : null,
        mimeType: imageData.mimeType,
        fileSize: imageData.fileSize,
        width: imageData.width,
        height: imageData.height
      }
    });
  } catch (error) {
    console.error('[Server] 图片上传失败:', error);
    
    // 清理已上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取图片统计
 * GET /api/images/stats
 */
app.get('/api/images/stats', (req, res) => {
  try {
    const totalStmt = messageStore.db.prepare('SELECT COUNT(*) as count, SUM(file_size) as totalSize FROM images');
    const { count: total, totalSize } = totalStmt.get();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStmt = messageStore.db.prepare('SELECT COUNT(*) as count FROM images WHERE created_at >= ?');
    const { count: today } = todayStmt.get(todayStart.getTime());
    
    res.json({
      success: true,
      stats: {
        total: total || 0,
        totalSize: totalSize || 0,
        today: today || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有图片列表（分页）
 * GET /api/images/list?page=1&limit=24&sender=xxx&startTime=xxx
 */
app.get('/api/images/list', (req, res) => {
  try {
    const { page = 1, limit = 24, sender, startTime } = req.query;
    
    let sql = `
      SELECT i.*, m.sender, m.timestamp as message_time
      FROM images i
      JOIN messages m ON i.message_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (sender) {
      sql += ' AND m.sender = ?';
      params.push(sender);
    }
    
    if (startTime) {
      sql += ' AND i.created_at >= ?';
      params.push(parseInt(startTime));
    }
    
    // 计算总数
    const countSql = sql.replace('SELECT i.*, m.sender, m.timestamp as message_time', 'SELECT COUNT(*) as total');
    const countStmt = messageStore.db.prepare(countSql);
    const { total } = countStmt.get(...params);
    
    // 分页查询
    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const stmt = messageStore.db.prepare(sql);
    const images = stmt.all(...params);
    
    res.json({
      success: true,
      images,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Server] 获取图片列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取消息的图片列表
 * GET /api/images/message/:messageId
 */
app.get('/api/images/message/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    const images = messageStore.getMessageImages(messageId);
    
    const imagesWithUrls = images.map(img => ({
      ...img,
      url: `/api/images/${img.filename}`,
      thumbnailUrl: img.thumbnailPath ? `/api/images/thumb_${img.filename}` : null
    }));
    
    res.json({ success: true, count: images.length, images: imagesWithUrls });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取图片文件
 * GET /api/images/:filename
 */
app.get('/api/images/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // 判断是原图还是缩略图
    const isThumbnail = filename.startsWith('thumb_');
    const imageDir = isThumbnail ? imageUpload.thumbnailDir : imageUpload.imageDir;
    const filePath = path.join(imageDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '图片不存在' });
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除图片
 * DELETE /api/images/:imageId
 */
app.delete('/api/images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // 获取图片信息
    const image = messageStore.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ success: false, error: '图片不存在' });
    }

    // 删除文件
    imageUpload.deleteImageFiles(image.filePath, image.thumbnailPath);
    
    // 删除数据库记录
    const deleted = messageStore.deleteImage(imageId);
    
    if (deleted) {
      res.json({ success: true, message: '图片已删除' });
    } else {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 表情回应 API ====================

/**
 * 添加表情回应
 * POST /api/reactions
 * Body: { messageId, reactorId, emoji }
 */
app.post('/api/reactions', async (req, res) => {
  try {
    const { messageId, reactorId, emoji } = req.body;

    if (!messageId || !reactorId || !emoji) {
      return res.status(400).json({
        success: false,
        error: 'messageId, reactorId, and emoji are required'
      });
    }

    // 检查消息是否存在
    const message = messageStore.getMessageById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: '消息不存在' });
    }

    // 添加表情回应
    const added = await messageStore.addReaction(messageId, reactorId, emoji);

    if (added) {
      // 获取更新后的表情统计
      const stats = messageStore.getReactionStats(messageId);
      
      console.log('[Server] 表情回应已添加:', reactorId, '->', emoji, 'on', messageId);
      
      res.json({ success: true, reactions: stats });
    } else {
      // 已经存在相同的回应
      res.json({ success: true, message: '表情回应已存在' });
    }
  } catch (error) {
    console.error('[Server] 添加表情回应失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除表情回应
 * DELETE /api/reactions
 * Body: { messageId, reactorId, emoji }
 */
app.delete('/api/reactions', async (req, res) => {
  try {
    const { messageId, reactorId, emoji } = req.body;

    if (!messageId || !reactorId || !emoji) {
      return res.status(400).json({
        success: false,
        error: 'messageId, reactorId, and emoji are required'
      });
    }

    const removed = messageStore.removeReaction(messageId, reactorId, emoji);

    if (removed) {
      // 获取更新后的表情统计
      const stats = messageStore.getReactionStats(messageId);
      
      console.log('[Server] 表情回应已删除:', reactorId, '->', emoji, 'on', messageId);
      
      res.json({ success: true, reactions: stats });
    } else {
      res.status(404).json({ success: false, error: '表情回应不存在' });
    }
  } catch (error) {
    console.error('[Server] 删除表情回应失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取消息的表情统计
 * GET /api/reactions/:messageId
 */
app.get('/api/reactions/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    const stats = messageStore.getReactionStats(messageId);
    
    res.json({ success: true, reactions: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取消息的所有表情回应（包含回应者信息）
 * GET /api/reactions/:messageId/details
 */
app.get('/api/reactions/:messageId/details', (req, res) => {
  try {
    const { messageId } = req.params;
    const reactions = messageStore.getMessageReactions(messageId);
    
    res.json({ success: true, count: reactions.length, reactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 消息导出 API ====================

const exportService = require('./export-service');

/**
 * 导出消息
 * POST /api/export
 * Body: { format, sender, startTime, endTime, includeImages, includeReactions, includeChain }
 */
app.post('/api/export', async (req, res) => {
  try {
    const {
      format = 'json',
      sender = null,
      startTime = null,
      endTime = null,
      source = null,
      includeImages = false,
      includeReactions = false,
      includeChain = false,
      limit = 1000
    } = req.body;

    // 验证格式
    const validFormats = ['json', 'csv', 'markdown', 'html'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}`
      });
    }

    // 构建查询条件
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params = [];

    if (sender) {
      sql += ' AND sender = ?';
      params.push(sender);
    }

    if (startTime) {
      sql += ' AND timestamp >= ?';
      params.push(startTime);
    }

    if (endTime) {
      sql += ' AND timestamp <= ?';
      params.push(endTime);
    }

    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }

    sql += ' ORDER BY timestamp ASC LIMIT ?';
    params.push(limit);

    // 查询消息
    const stmt = messageStore.db.prepare(sql);
    let messages = stmt.all(...params);

    // 转换格式
    messages = messages.map(row => ({
      id: row.id,
      type: row.type,
      sender: row.sender,
      content: row.content,
      timestamp: row.timestamp,
      source: row.source,
      atTargets: row.at_targets ? JSON.parse(row.at_targets) : null,
      replyTo: row.reply_to
    }));

    // 附加引用链
    if (includeChain) {
      messages = messageStore.attachReplyToMessages(messages, true);
    }

    // 附加图片
    if (includeImages) {
      messages = messageStore.attachImages(messages);
    }

    // 附加表情
    if (includeReactions) {
      messages = messageStore.attachReactions(messages);
    }

    // 生成导出内容
    let content, contentType, filename;

    switch (format) {
      case 'json':
        content = exportService.exportJSON(messages, { includeImages, includeReactions });
        contentType = 'application/json';
        filename = `messages-${Date.now()}.json`;
        break;

      case 'csv':
        content = exportService.exportCSV(messages);
        contentType = 'text/csv';
        filename = `messages-${Date.now()}.csv`;
        break;

      case 'markdown':
        content = exportService.exportMarkdown(messages, { includeReactions });
        contentType = 'text/markdown';
        filename = `messages-${Date.now()}.md`;
        break;

      case 'html':
        content = exportService.exportHTML(messages, { includeReactions });
        contentType = 'text/html';
        filename = `messages-${Date.now()}.html`;
        break;
    }

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

    console.log('[Server] 导出完成:', format, messages.length, '条消息');
  } catch (error) {
    console.error('[Server] 导出失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 导出为 ZIP 压缩包（包含所有格式）
 * POST /api/export/zip
 */
app.post('/api/export/zip', async (req, res) => {
  try {
    const options = req.body;

    // 获取消息（同上）
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params = [];

    if (options.sender) {
      sql += ' AND sender = ?';
      params.push(options.sender);
    }

    if (options.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(options.startTime);
    }

    if (options.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(options.endTime);
    }

    sql += ' ORDER BY timestamp ASC LIMIT ?';
    params.push(options.limit || 1000);

    const stmt = messageStore.db.prepare(sql);
    let messages = stmt.all(...params);

    messages = messages.map(row => ({
      id: row.id,
      type: row.type,
      sender: row.sender,
      content: row.content,
      timestamp: row.timestamp,
      source: row.source,
      atTargets: row.at_targets ? JSON.parse(row.at_targets) : null,
      replyTo: row.reply_to
    }));

    if (options.includeChain) {
      messages = messageStore.attachReplyToMessages(messages, true);
    }

    if (options.includeImages) {
      messages = messageStore.attachImages(messages);
    }

    if (options.includeReactions) {
      messages = messageStore.attachReactions(messages);
    }

    // 生成所有格式
    const files = [
      {
        name: 'messages.json',
        content: exportService.exportJSON(messages, options)
      },
      {
        name: 'messages.csv',
        content: exportService.exportCSV(messages)
      },
      {
        name: 'messages.md',
        content: exportService.exportMarkdown(messages, options)
      },
      {
        name: 'messages.html',
        content: exportService.exportHTML(messages, options)
      }
    ];

    // 创建 ZIP
    const zipPath = path.join(exportService.exportDir, `export-${Date.now()}.zip`);
    await exportService.createZip(files, zipPath);

    // 发送文件
    res.download(zipPath, `messages-${Date.now()}.zip`, (err) => {
      if (err) {
        console.error('[Server] ZIP 下载失败:', err);
      }
      // 下载完成后删除文件
      setTimeout(() => {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
      }, 5000);
    });

    console.log('[Server] ZIP 导出完成:', messages.length, '条消息');
  } catch (error) {
    console.error('[Server] ZIP 导出失败:', error);
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
    const includeChain = req.query.includeChain === 'true'; // 是否包含完整引用链

    const messages = messageStore.getUnreadMessages(readerId, limit);
    
    // 附加引用消息内容
    const messagesWithReply = messageStore.attachReplyToMessages(messages, includeChain);
    
    const count = messageStore.getUnreadCount(readerId);

    res.json({ 
      success: true, 
      count,
      messages: messagesWithReply
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
/**
 * 健康检查（增强版）
 * GET /health
 */
app.get('/health', async (req, res) => {
  const stats = messageStore.getStats();
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Redis 健康检查
  let redisStatus = 'unknown';
  let redisLatency = null;
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    redisLatency = Date.now() - redisStart;
    redisStatus = 'connected';
  } catch (error) {
    redisStatus = 'disconnected';
  }
  
  // 缓存统计
  const cacheStats = cacheManager.getStats();
  
  res.json({ 
    status: 'ok',
    version: '1.0.0',
    timestamp: Date.now(),
    uptime: Math.floor(uptime),
    
    // 数据库统计
    database: {
      messages: stats.total,
      today: stats.today,
      images: messageStore.db.prepare('SELECT COUNT(*) as count FROM images').get().count,
      reactions: messageStore.db.prepare('SELECT COUNT(*) as count FROM reactions').get().count
    },
    
    // Redis 状态
    redis: {
      status: redisStatus,
      latency: redisLatency
    },
    
    // 缓存统计
    cache: cacheStats,
    
    // 性能统计
    performance: {
      totalRequests: performanceStats.requests,
      slowQueries: performanceStats.slowQueries.length,
      errors: performanceStats.errors,
      avgMemory: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`
    },
    
    // 内存使用
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    
    // 配置信息
    config: {
      bot: config.bot?.name,
      storeDir: messageStore.storeDir,
      dbPath: messageStore.dbPath
    }
  });
});

/**
 * 性能统计详情
 * GET /api/performance
 */
app.get('/api/performance', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalRequests: performanceStats.requests,
      slowQueries: performanceStats.slowQueries,
      errors: performanceStats.errors,
      cache: cacheManager.getStats()
    }
  });
});

/**
 * 搜索消息
 * GET /api/search?q=关键词&limit=50
 */
/**
 * 搜索消息（增强版）
 * GET /api/search?q=关键词&sender=发送者&startTime=开始时间&endTime=结束时间&source=来源&limit=50&offset=0&highlight=true&includeChain=false
 */
app.get('/api/search', (req, res) => {
  try {
    const { 
      q, 
      sender, 
      startTime, 
      endTime, 
      source, 
      limit, 
      offset, 
      highlight, 
      includeChain 
    } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: 'q is required' });
    }

    // 构建搜索选项
    const options = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sender: sender || null,
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null,
      source: source || null,
      highlight: highlight === 'true'
    };

    const messages = messageStore.searchMessages(q, options);
    
    // 附加引用消息内容
    const messagesWithReply = messageStore.attachReplyToMessages(messages, includeChain === 'true');
    
    res.json({ 
      success: true, 
      count: messagesWithReply.length, 
      messages: messagesWithReply,
      query: q,
      options 
    });
  } catch (error) {
    console.error('[Server] 搜索失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取统计信息
 * GET /api/stats
 */
/**
 * 获取统计数据（带缓存）
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const cacheKey = 'chat:stats:overview';
    
    // 尝试从缓存获取
    let stats = await cacheManager.get(cacheKey);
    
    if (!stats) {
      // 缓存未命中，查询数据库
      stats = messageStore.getStats();
      
      // 缓存 60 秒
      await cacheManager.set(cacheKey, stats, 60);
    }
    
    res.json({ success: true, stats, cached: !!stats });
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

  // 注册 Webhook 路由（接收 OpenClaw 钉钉消息）
  const webhookRoutes = require('./routes/webhook');
  app.set('messageStore', messageStore); // 让 webhook 能访问 messageStore
  app.use('/api/webhook', webhookRoutes);

  // 订阅消息频道（自动同步其他 AI 的消息到本地数据库）
  await redisClient.subscribe(config.channels.messages, async (message) => {
    // 检查消息去重（基于 message.id）
    if (messageStore.isDuplicate(message.id)) {
      console.log(`[Server] 跳过重复消息: ${message.id}`);
      return;
    }

    // 保存到本地数据库
    const saved = await messageStore.addMessage(message);
    if (saved) {
      console.log(`[Server] 同步消息: ${message.sender} -> ${message.content?.substring(0, 30)}... [source: ${message.source}]`);
      
      // 通知 WebSocket 客户端
      try {
        const websocket = require('./websocket');
        websocket.pushMessage(message);
      } catch (e) {
        // WebSocket 可能未初始化
      }
      
      // 通知 SSE 客户端
      sseManager.broadcast('message', message);
    }
  });

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

// ==================== 用户管理 API ====================
const userManager = require('./user-manager');

/**
 * 注册新用户
 * POST /api/users/register
 */
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, displayName, phone, email, avatar } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: 'username is required' });
    }

    // 检查用户名是否已存在
    const existing = userManager.getUser(username);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }

    const result = userManager.registerUser({
      username,
      displayName,
      phone,
      email,
      avatar
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('[Server] 注册用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户信息
 * PUT /api/users/:userId
 */
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const result = userManager.updateUser(userId, updates);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('[Server] 更新用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户信息
 * GET /api/users/:identifier
 */
app.get('/api/users/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = userManager.getUser(identifier);

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    console.error('[Server] 获取用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有用户
 * GET /api/users
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = userManager.getAllUsers();
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('[Server] 获取用户列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取钉钉手机号映射
 * GET /api/users/dingtalk/phone-map
 */
app.get('/api/users/dingtalk/phone-map', async (req, res) => {
  try {
    const phoneMap = userManager.getDingtalkPhoneMap();
    res.json({ success: true, phoneMap });
  } catch (error) {
    console.error('[Server] 获取手机号映射失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

