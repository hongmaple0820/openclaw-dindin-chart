/**
 * 通知系统路由
 *
 * API 端点：
 * - GET    /api/notifications           - 获取通知列表
 * - PUT    /api/notifications/:id/read  - 标记单条已读
 * - PUT    /api/notifications/read-all  - 全部标记已读
 * - GET    /api/notifications/settings  - 获取通知设置
 * - PUT    /api/notifications/settings  - 更新通知设置
 * - POST   /api/pinned                  - 置顶聊天
 * - DELETE /api/pinned/:id              - 取消置顶
 * - GET    /api/pinned                  - 获取置顶列表
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const sseManager = require('../sse-manager');

// 数据库路径
const dbPath = path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
const db = new Database(dbPath);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: '未授权' });
  }
  req.userId = userId;
  next();
}

// ==================== 通知 API ====================

/**
 * 获取通知列表
 * GET /api/notifications?userId=xxx&type=xxx&isRead=0&limit=20&offset=0
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const { type, isRead, limit = 20, offset = 0 } = req.query;
    const userId = req.userId;

    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (isRead !== undefined) {
      sql += ' AND is_read = ?';
      params.push(parseInt(isRead));
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const notifications = db.prepare(sql).all(...params);

    // 获取未读数量
    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId);

    // 解析 data 字段
    const parsedNotifications = notifications.map(n => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null
    }));

    res.json({
      success: true,
      notifications: parsedNotifications,
      unreadCount: unreadCount.count
    });
  } catch (error) {
    console.error('[Notifications] 获取通知列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 创建通知（内部使用）
 * @param {Object} notification - 通知对象
 */
function createNotification(notification) {
  const { userId, type, title, content, data } = notification;
  const id = uuidv4();
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, data, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, type, title, content, data ? JSON.stringify(data) : null, createdAt);

  const newNotification = {
    id,
    userId,
    type,
    title,
    content,
    data,
    isRead: false,
    createdAt
  };

  // 通过 SSE 推送通知
  if (sseManager.isOnline(userId)) {
    sseManager.sendNotification(userId, newNotification);
  }

  return newNotification;
}

/**
 * 创建通知 API（供其他模块调用）
 * POST /api/notifications/create
 */
router.post('/create', authMiddleware, (req, res) => {
  try {
    const { userId, type, title, content, data } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const notification = createNotification({ userId, type, title, content, data });

    res.json({ success: true, notification });
  } catch (error) {
    console.error('[Notifications] 创建通知失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: (error as Error).message });
  }
});

/**
 * 标记单条通知已读
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] 标记已读失败:', error);
    res.status(500).json({ success: false, message: '标记失败', error: (error as Error).message });
  }
});

/**
 * 全部标记已读
 * PUT /api/notifications/read-all
 */
router.put('/read-all', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).run(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] 全部已读失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: (error as Error).message });
  }
});

/**
 * 删除通知
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = db.prepare(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] 删除通知失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: (error as Error).message });
  }
});

// ==================== 通知设置 API ====================

/**
 * 获取通知设置
 * GET /api/notifications/settings
 */
router.get('/settings', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    let settings = db.prepare(
      'SELECT * FROM notification_settings WHERE user_id = ?'
    ).get(userId);

    // 如果没有设置，创建默认设置
    if (!settings) {
      db.prepare(`
        INSERT INTO notification_settings (user_id)
        VALUES (?)
      `).run(userId);

      settings = {
        user_id: userId,
        message_sound: 1,
        message_vibrate: 1,
        group_sound: 1,
        dm_sound: 1,
        mention_sound: 1,
        quiet_hours_start: null,
        quiet_hours_end: null
      };
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('[Notifications] 获取设置失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 更新通知设置
 * PUT /api/notifications/settings
 */
router.put('/settings', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const {
      message_sound,
      message_vibrate,
      group_sound,
      dm_sound,
      mention_sound,
      quiet_hours_start,
      quiet_hours_end
    } = req.body;

    // 构建更新语句
    const updates = [];
    const params = [];

    if (message_sound !== undefined) {
      updates.push('message_sound = ?');
      params.push(message_sound ? 1 : 0);
    }
    if (message_vibrate !== undefined) {
      updates.push('message_vibrate = ?');
      params.push(message_vibrate ? 1 : 0);
    }
    if (group_sound !== undefined) {
      updates.push('group_sound = ?');
      params.push(group_sound ? 1 : 0);
    }
    if (dm_sound !== undefined) {
      updates.push('dm_sound = ?');
      params.push(dm_sound ? 1 : 0);
    }
    if (mention_sound !== undefined) {
      updates.push('mention_sound = ?');
      params.push(mention_sound ? 1 : 0);
    }
    if (quiet_hours_start !== undefined) {
      updates.push('quiet_hours_start = ?');
      params.push(quiet_hours_start);
    }
    if (quiet_hours_end !== undefined) {
      updates.push('quiet_hours_end = ?');
      params.push(quiet_hours_end);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    params.push(userId);

    db.prepare(`
      UPDATE notification_settings
      SET ${updates.join(', ')}
      WHERE user_id = ?
    `).run(...params);

    // 获取更新后的设置
    const settings = db.prepare(
      'SELECT * FROM notification_settings WHERE user_id = ?'
    ).get(userId);

    res.json({ success: true, settings });
  } catch (error) {
    console.error('[Notifications] 更新设置失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: (error as Error).message });
  }
});

// ==================== 置顶聊天 API ====================

/**
 * 置顶聊天
 * POST /api/pinned
 */
router.post('/pinned', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { chatType, chatId } = req.body;

    if (!chatType || !chatId) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const id = uuidv4();
    const pinnedAt = Date.now();

    try {
      db.prepare(`
        INSERT INTO pinned_chats (id, user_id, chat_type, chat_id, pinned_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, chatType, chatId, pinnedAt);

      res.json({
        success: true,
        pinned: {
          id,
          userId,
          chatType,
          chatId,
          pinnedAt
        }
      });
    } catch (error) {
      if ((error as any).code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ success: false, message: '该聊天已置顶' });
      }
      throw error;
    }
  } catch (error) {
    console.error('[Notifications] 置顶失败:', error);
    res.status(500).json({ success: false, message: '置顶失败', error: (error as Error).message });
  }
});

/**
 * 取消置顶
 * DELETE /api/pinned/:id
 */
router.delete('/pinned/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const result = db.prepare(
      'DELETE FROM pinned_chats WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '置顶记录不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] 取消置顶失败:', error);
    res.status(500).json({ success: false, message: '取消失败', error: (error as Error).message });
  }
});

/**
 * 取消置顶（通过聊天信息）
 * DELETE /api/pinned/by-chat?chatType=group&chatId=xxx
 */
router.delete('/pinned/by-chat', authMiddleware, (req, res) => {
  try {
    const { chatType, chatId } = req.query;
    const userId = req.userId;

    if (!chatType || !chatId) {
      return res.status(400).json({ success: false, message: '缺少必填参数' });
    }

    const result = db.prepare(
      'DELETE FROM pinned_chats WHERE user_id = ? AND chat_type = ? AND chat_id = ?'
    ).run(userId, chatType, chatId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '置顶记录不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] 取消置顶失败:', error);
    res.status(500).json({ success: false, message: '取消失败', error: (error as Error).message });
  }
});

/**
 * 获取置顶列表
 * GET /api/pinned
 */
router.get('/pinned', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    const pinnedList = db.prepare(`
      SELECT * FROM pinned_chats
      WHERE user_id = ?
      ORDER BY pinned_at DESC
    `).all(userId);

    res.json({ success: true, pinned: pinnedList });
  } catch (error) {
    console.error('[Notifications] 获取置顶列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

// 导出路由和工具函数
module.exports = router;
module.exports.createNotification = createNotification;
// Make this a module
export {};
