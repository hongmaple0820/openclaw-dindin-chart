const express = require('express');
const router = express.Router();
const sessionManager = require('../session-manager');
const messageRouter = require('../message-router');
const messageSecurity = require('../message-security');
const { v4: uuidv4 } = require('uuid');

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: '未授权' });
  }
  req.userId = userId;
  next();
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type = 'private', name, participants, ownerId, ownerName } = req.body;

    if (type === 'private') {
      if (!participants || participants.length !== 2) {
        return res.status(400).json({ success: false, message: '私聊需要两个参与者' });
      }

      const [user1, user2] = participants;
      const session = await sessionManager.createPrivateSession(
        user1.id, user1.name,
        user2.id, user2.name,
        req.userId
      );

      res.json({ success: true, session });
    } else if (type === 'group') {
      if (!name || !ownerId || !ownerName) {
        return res.status(400).json({ success: false, message: '群聊需要名称和群主信息' });
      }

      const otherParticipants = participants?.filter(p => p.id !== ownerId) || [];
      const session = await sessionManager.createGroupSession(
        name, ownerId, ownerName,
        otherParticipants,
        req.userId
      );

      res.json({ success: true, session });
    } else {
      res.status(400).json({ success: false, message: '无效的会话类型' });
    }
  } catch (error) {
    console.error('[SessionAPI] 创建会话失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

router.get('/', authMiddleware, (req, res) => {
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

    res.json({ success: true, sessions: sessionsWithUnread });
  } catch (error) {
    console.error('[SessionAPI] 获取会话列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

router.get('/:sessionId', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionManager.isParticipant(sessionId, req.userId)) {
      return res.status(403).json({ success: false, message: '无权访问此会话' });
    }

    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    const participants = sessionManager.getSessionParticipants(sessionId);
    const unreadCount = sessionManager.getUnreadCount(sessionId, req.userId);

    res.json({
      success: true,
      session: {
        ...session,
        participants,
        unreadCount
      }
    });
  } catch (error) {
    console.error('[SessionAPI] 获取会话详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

router.put('/:sessionId', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, avatar, metadata } = req.body;

    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    if (session.type === 'group') {
      const role = sessionManager.getParticipantRole(sessionId, req.userId);
      if (role !== 'owner' && role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权修改此会话' });
      }
    } else {
      return res.status(400).json({ success: false, message: '私聊会话不支持修改' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;
    if (metadata) updates.metadata = metadata;

    sessionManager.updateSession(sessionId, updates);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('[SessionAPI] 更新会话失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  }
});

router.delete('/:sessionId', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    if (session.type === 'group') {
      const role = sessionManager.getParticipantRole(sessionId, req.userId);
      if (role !== 'owner') {
        return res.status(403).json({ success: false, message: '只有群主可以解散群聊' });
      }
      sessionManager.deleteSession(sessionId);
    } else {
      sessionManager.removeParticipant(sessionId, req.userId);
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('[SessionAPI] 删除会话失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: error.message });
  }
});

router.post('/:sessionId/participants', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, userName, role = 'member' } = req.body;

    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    if (session.type !== 'group') {
      return res.status(400).json({ success: false, message: '私聊会话不支持添加成员' });
    }

    const currentRole = sessionManager.getParticipantRole(sessionId, req.userId);
    if (currentRole !== 'owner' && currentRole !== 'admin') {
      return res.status(403).json({ success: false, message: '无权添加成员' });
    }

    sessionManager.addParticipant(sessionId, userId, userName, role);

    res.json({ success: true, message: '添加成功' });
  } catch (error) {
    console.error('[SessionAPI] 添加成员失败:', error);
    res.status(500).json({ success: false, message: '添加失败', error: error.message });
  }
});

router.delete('/:sessionId/participants/:userId', authMiddleware, (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    if (session.type !== 'group') {
      return res.status(400).json({ success: false, message: '私聊会话不支持移除成员' });
    }

    const currentRole = sessionManager.getParticipantRole(sessionId, req.userId);
    const targetRole = sessionManager.getParticipantRole(sessionId, userId);

    if (req.userId === userId) {
      sessionManager.removeParticipant(sessionId, userId);
    } else if (currentRole === 'owner' || (currentRole === 'admin' && targetRole === 'member')) {
      sessionManager.removeParticipant(sessionId, userId);
    } else {
      return res.status(403).json({ success: false, message: '无权移除此成员' });
    }

    res.json({ success: true, message: '移除成功' });
  } catch (error) {
    console.error('[SessionAPI] 移除成员失败:', error);
    res.status(500).json({ success: false, message: '移除失败', error: error.message });
  }
});

router.post('/:sessionId/read', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionManager.isParticipant(sessionId, req.userId)) {
      return res.status(403).json({ success: false, message: '无权访问此会话' });
    }

    sessionManager.markAsRead(sessionId, req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[SessionAPI] 标记已读失败:', error);
    res.status(500).json({ success: false, message: '标记失败', error: error.message });
  }
});

router.get('/unread/total', authMiddleware, (req, res) => {
  try {
    const total = sessionManager.getTotalUnreadCount(req.userId);
    res.json({ success: true, count: total });
  } catch (error) {
    console.error('[SessionAPI] 获取未读数失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

router.post('/:sessionId/subscribe', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionManager.isParticipant(sessionId, req.userId)) {
      return res.status(403).json({ success: false, message: '无权订阅此会话' });
    }

    await messageRouter.subscribeToConversation(req.userId, sessionId);

    res.json({ success: true, message: '订阅成功' });
  } catch (error) {
    console.error('[SessionAPI] 订阅会话失败:', error);
    res.status(500).json({ success: false, message: '订阅失败', error: error.message });
  }
});

router.post('/:sessionId/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await messageRouter.unsubscribeFromConversation(req.userId, sessionId);

    res.json({ success: true, message: '取消订阅成功' });
  } catch (error) {
    console.error('[SessionAPI] 取消订阅失败:', error);
    res.status(500).json({ success: false, message: '取消订阅失败', error: error.message });
  }
});

module.exports = router;
