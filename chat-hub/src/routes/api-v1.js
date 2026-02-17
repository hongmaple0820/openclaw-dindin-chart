const express = require('express');
const router = express.Router();

const auth = require('../auth');
const messageStore = require('../message-store');
const dmHandler = require('../dm-handler');
const sessionManager = require('../session-manager');
const messageRouter = require('../message-router');
const sseManager = require('../sse-manager');
const botManager = require('../bot-manager');
const { v4: uuidv4 } = require('uuid');

function parseAtMentions(content) {
  if (!content) return [];
  const matches = content.match(/@[\w\u4e00-\u9fa5-]+/g) || [];
  return matches.map(m => m.substring(1));
}

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: '未授权', code: 'UNAUTHORIZED' });
  }
  req.userId = userId;
  next();
}

router.get('/health', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

router.post('/auth/register', (req, res) => {
  const { username, nickname, email, password, type } = req.body;
  const result = auth.register({ username, nickname, email, password, type });
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const result = auth.login(username, password);
  res.status(result.success ? 200 : (result.code === 'PENDING' ? 403 : 401)).json(result);
});

router.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const result = auth.refreshToken(refreshToken);
  res.status(result.success ? 200 : 401).json(result);
});

router.get('/auth/me', auth.authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post('/messages', async (req, res) => {
  try {
    const { content, sender = 'WebUser', atTargets } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required', code: 'BAD_REQUEST' });
    }

    const parsedAtTargets = atTargets || parseAtMentions(content);

    const message = {
      id: uuidv4(),
      type: 'human',
      sender,
      content,
      timestamp: Date.now(),
      source: 'api',
      atTargets: parsedAtTargets.length > 0 ? parsedAtTargets : null,
      replyTo: null
    };

    await messageStore.addMessage(message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = messageStore.getMessages(limit);
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/messages/search', (req, res) => {
  try {
    const { q, sender, startTime, endTime, limit, offset } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'q is required', code: 'BAD_REQUEST' });
    }

    const options = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sender: sender || null,
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null
    };

    const messages = messageStore.searchMessages(q, options);

    res.json({
      success: true,
      count: messages.length,
      messages,
      query: q
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/messages/reply', async (req, res) => {
  try {
    const { content, sender = 'Bot', atTargets, replyTo } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required', code: 'BAD_REQUEST' });
    }

    const message = {
      id: uuidv4(),
      type: 'bot',
      sender,
      content,
      timestamp: Date.now(),
      source: 'api',
      atTargets,
      replyTo
    };

    await messageStore.addMessage(message);

    sseManager.broadcast('message', message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/conversations', authMiddleware, (req, res) => {
  try {
    const { type, limit, offset } = req.query;
    const sessions = sessionManager.getUserSessions(req.userId, {
      type,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    const sessionsWithUnread = sessions.map(session => ({
      ...session,
      unreadCount: sessionManager.getUnreadCount(session.id, req.userId)
    }));

    res.json({ success: true, count: sessionsWithUnread.length, sessions: sessionsWithUnread });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { type = 'private', name, participants, ownerId, ownerName } = req.body;

    if (type === 'private') {
      if (!participants || participants.length !== 2) {
        return res.status(400).json({ success: false, message: '私聊需要两个参与者', code: 'BAD_REQUEST' });
      }

      const [user1, user2] = participants;
      const session = await sessionManager.createPrivateSession(
        user1.id, user1.name,
        user2.id, user2.name,
        req.userId
      );

      res.status(201).json({ success: true, session });
    } else if (type === 'group') {
      if (!name || !ownerId || !ownerName) {
        return res.status(400).json({ success: false, message: '群聊需要名称和群主信息', code: 'BAD_REQUEST' });
      }

      const otherParticipants = participants?.filter(p => p.id !== ownerId) || [];
      const session = await sessionManager.createGroupSession(
        name, ownerId, ownerName,
        otherParticipants,
        req.userId
      );

      res.status(201).json({ success: true, session });
    } else {
      res.status(400).json({ success: false, message: '无效的会话类型', code: 'BAD_REQUEST' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/dm/conversations', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required', code: 'BAD_REQUEST' });
    }

    const conversations = await dmHandler.getUserConversations(userId, { limit: 20 });
    res.json({ success: true, count: conversations.length, conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/dm/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await dmHandler.getConversationMessages(conversationId, { limit });
    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/dm/send', async (req, res) => {
  try {
    const { senderId, sender, receiverId, receiver, content } = req.body;

    if (!content || !senderId || !receiverId) {
      return res.status(400).json({ success: false, error: '缺少必填字段', code: 'BAD_REQUEST' });
    }

    const messageData = {
      senderId,
      senderNick: sender || senderId,
      receiverId,
      receiverName: receiver || receiverId,
      text: { content },
      createAt: Date.now()
    };

    const message = await dmHandler.storeDM(messageData);

    if (message) {
      res.status(201).json({ success: true, message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send DM', code: 'INTERNAL_ERROR' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/dm/read', async (req, res) => {
  try {
    const { userId, conversationId } = req.body;

    if (!userId || !conversationId) {
      return res.status(400).json({ success: false, error: '缺少必填字段', code: 'BAD_REQUEST' });
    }

    await dmHandler.markAsRead(conversationId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/sse/online', (req, res) => {
  const users = sseManager.getOnlineUsers();
  res.json({
    success: true,
    count: users.length,
    users
  });
});

router.get('/sse/status/:userId', (req, res) => {
  const { userId } = req.params;
  const isOnline = sseManager.isOnline(userId);
  res.json({
    success: true,
    userId,
    isOnline
  });
});

router.get('/stats', (req, res) => {
  try {
    const stats = messageStore.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/bots', (req, res) => {
  try {
    const bots = botManager.listBots();
    res.json({ success: true, bots });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/bots/:id', (req, res) => {
  try {
    const bot = botManager.getBot(req.params.id);
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot 不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, bot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/bots', async (req, res) => {
  try {
    const { username, displayName, webhookBase, webhookSecret, webhookToken, webhookEnabled, isDefault, replyEnabled } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, error: 'username 不能为空', code: 'INVALID_INPUT' });
    }
    
    const bot = botManager.createBot({
      username,
      displayName,
      webhookBase,
      webhookSecret,
      webhookToken,
      webhookEnabled,
      isDefault,
      replyEnabled
    });
    
    res.json({ success: true, bot });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ success: false, error: '用户名已存在', code: 'DUPLICATE' });
    }
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.put('/bots/:id', async (req, res) => {
  try {
    const bot = botManager.updateBot(req.params.id, req.body);
    res.json({ success: true, bot });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.delete('/bots/:id', (req, res) => {
  try {
    botManager.deleteBot(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/bots/:id/test', async (req, res) => {
  try {
    const result = await botManager.testBot(req.params.id);
    res.json({ success: true, result });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/bots/route-test', (req, res) => {
  try {
    const { content, context } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'content 不能为空', code: 'INVALID_INPUT' });
    }
    
    const result = botManager.resolveBot({ content }, context || {});
    
    if (!result) {
      return res.json({ success: true, matched: false, message: '无匹配的 Bot' });
    }
    
    res.json({
      success: true,
      matched: true,
      bot: {
        id: result.bot.id,
        username: result.bot.username,
        displayName: result.bot.displayName
      },
      reason: result.reason,
      confidence: result.confidence
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/bots/:id/send', async (req, res) => {
  try {
    const { content, sender, atTargets } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'content 不能为空', code: 'INVALID_INPUT' });
    }
    
    const result = await botManager.sendToBot(req.params.id, content, sender, atTargets);
    res.json({ success: true, result });
  } catch (error) {
    if (error.message.includes('不存在')) {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
