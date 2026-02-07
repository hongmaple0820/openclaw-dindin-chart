/**
 * 管理后台 API 路由
 * @author 小琳
 * @date 2026-02-06
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');

// Token 认证中间件
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  const adminToken = process.env.ADMIN_TOKEN || 'admin123';
  
  if (token !== adminToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

module.exports = function(messageStore, db) {
  
  // 所有管理接口需要认证
  router.use(adminAuth);

  // ============== 统计概览 ==============
  
  /**
   * GET /api/admin/stats
   */
  router.get('/stats', (req, res) => {
    try {
      const stats = messageStore.getStats();
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const week = db.prepare('SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?').get(weekStart.getTime()).count;
      const humanCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'human'").get().count;
      const botCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'bot'").get().count;
      
      // 用户统计
      const pendingUsers = auth.db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get().count;
      const totalUsers = auth.db.prepare("SELECT COUNT(*) as count FROM users").get().count;

      res.json({
        success: true,
        data: {
          total: stats.total,
          today: stats.today,
          week,
          humanCount,
          botCount,
          bySender: stats.bySender,
          pendingUsers,
          totalUsers
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== 用户审核 ==============
  
  /**
   * GET /api/admin/users/pending - 获取待审核用户
   */
  router.get('/users/pending', (req, res) => {
    try {
      const users = auth.getPendingUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  /**
   * GET /api/admin/users - 获取所有用户
   */
  router.get('/users', (req, res) => {
    try {
      const { status, type, page, limit } = req.query;
      const result = auth.getAllUsers({ 
        status, 
        type, 
        page: parseInt(page) || 1, 
        limit: parseInt(limit) || 20 
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  /**
   * POST /api/admin/users/:id/approve - 审核通过
   */
  router.post('/users/:id/approve', (req, res) => {
    try {
      const result = auth.approveUser(req.params.id, 'admin');
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  /**
   * POST /api/admin/users/:id/reject - 审核拒绝
   */
  router.post('/users/:id/reject', (req, res) => {
    try {
      const { reason } = req.body;
      const result = auth.rejectUser(req.params.id, 'admin', reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  /**
   * POST /api/admin/users/:id/ban - 封禁用户
   */
  router.post('/users/:id/ban', (req, res) => {
    try {
      const { reason } = req.body;
      const result = auth.banUser(req.params.id, 'admin', reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  /**
   * POST /api/admin/users/:id/unban - 解封用户
   */
  router.post('/users/:id/unban', (req, res) => {
    try {
      const result = auth.unbanUser(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== 消息管理 ==============
  
  /**
   * GET /api/admin/messages
   */
  router.get('/messages', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const sender = req.query.sender;
      const keyword = req.query.keyword;
      const source = req.query.source;

      let where = [];
      let params = [];

      if (sender) {
        where.push('sender = ?');
        params.push(sender);
      }
      if (keyword) {
        where.push('content LIKE ?');
        params.push(`%${keyword}%`);
      }
      if (source) {
        where.push('source = ?');
        params.push(source);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const total = db.prepare(`SELECT COUNT(*) as count FROM messages ${whereClause}`).get(...params).count;
      const messages = db.prepare(`
        SELECT * FROM messages ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        success: true,
        data: messages,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/admin/messages/:id
   */
  router.delete('/messages/:id', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
      res.json({ success: result.changes > 0 });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/messages/batch-delete
   */
  router.post('/messages/batch-delete', (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: 'ids required' });
      }
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids);
      res.json({ success: true, deleted: result.changes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== 用户管理 ==============
  
  /**
   * GET /api/admin/users
   */
  router.get('/users', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT 
          sender as name,
          type,
          COUNT(*) as messageCount,
          MIN(timestamp) as firstSeen,
          MAX(timestamp) as lastSeen
        FROM messages 
        GROUP BY sender 
        ORDER BY lastSeen DESC
      `).all();

      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== 图表数据 ==============
  
  /**
   * GET /api/admin/charts/messages-trend
   */
  router.get('/charts/messages-trend', (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

      const data = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime')) as date,
          COUNT(*) as count
        FROM messages 
        WHERE timestamp >= ?
        GROUP BY date
        ORDER BY date ASC
      `).all(startTime);

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/charts/sender-distribution
   */
  router.get('/charts/sender-distribution', (req, res) => {
    try {
      const data = db.prepare(`
        SELECT sender as name, COUNT(*) as value
        FROM messages 
        GROUP BY sender 
        ORDER BY value DESC
        LIMIT 10
      `).all();

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== 文件管理 ==============
  
  /**
   * GET /api/admin/files
   */
  router.get('/files', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const total = db.prepare('SELECT COUNT(*) as count FROM files').get()?.count || 0;
      const files = db.prepare(`
        SELECT * FROM files 
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      res.json({
        success: true,
        data: files,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/admin/files/:id
   */
  router.delete('/files/:id', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
      res.json({ success: result.changes > 0 });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};
