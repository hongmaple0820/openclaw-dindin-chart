const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const Redis = require('ioredis');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库连接
const dbPath = process.env.DB_PATH || path.join(process.env.HOME, '.openclaw', 'chat-data', 'messages.db');
const db = new Database(dbPath);

// Redis 连接（用于获取在线状态）
const redis = new Redis({
  host: process.env.REDIS_HOST || '47.96.248.176',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
  lazyConnect: true
});

// 用户在线状态追踪
const userStatus = new Map();

// ============== 消息相关 API ==============

/**
 * 获取消息列表（分页）
 * GET /api/messages?page=1&limit=50&sender=&keyword=
 */
app.get('/api/messages', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const sender = req.query.sender;
    const keyword = req.query.keyword;
    const source = req.query.source;
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;

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
    if (startTime) {
      where.push('timestamp >= ?');
      params.push(parseInt(startTime));
    }
    if (endTime) {
      where.push('timestamp <= ?');
      params.push(parseInt(endTime));
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // 获取总数
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM messages ${whereClause}`);
    const { total } = countStmt.get(...params);

    // 获取数据
    const dataStmt = db.prepare(`
      SELECT * FROM messages ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const messages = dataStmt.all(...params, limit, offset);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除消息
 * DELETE /api/messages/:id
 */
app.delete('/api/messages/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(req.params.id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量删除消息
 * POST /api/messages/batch-delete
 */
app.post('/api/messages/batch-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids required' });
    }
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 统计相关 API ==============

/**
 * 获取统计概览
 * GET /api/stats/overview
 */
app.get('/api/stats/overview', (req, res) => {
  try {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const total = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const today = db.prepare('SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?').get(todayStart.getTime()).count;
    const week = db.prepare('SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?').get(weekStart.getTime()).count;
    const humanCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'human'").get().count;
    const botCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'bot'").get().count;

    res.json({
      success: true,
      data: {
        total,
        today,
        week,
        humanCount,
        botCount,
        humanRatio: total > 0 ? (humanCount / total * 100).toFixed(1) : 0,
        botRatio: total > 0 ? (botCount / total * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 按发送者统计
 * GET /api/stats/by-sender
 */
app.get('/api/stats/by-sender', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT sender, type, COUNT(*) as count, 
             MIN(timestamp) as firstMessage, 
             MAX(timestamp) as lastMessage
      FROM messages 
      GROUP BY sender 
      ORDER BY count DESC
    `);
    const data = stmt.all();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 按来源统计
 * GET /api/stats/by-source
 */
app.get('/api/stats/by-source', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM messages 
      GROUP BY source 
      ORDER BY count DESC
    `);
    const data = stmt.all();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 按时间统计（每小时/每天）
 * GET /api/stats/by-time?interval=hour|day&days=7
 */
app.get('/api/stats/by-time', (req, res) => {
  try {
    const interval = req.query.interval || 'day';
    const days = parseInt(req.query.days) || 7;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    let groupBy, format;
    if (interval === 'hour') {
      groupBy = "strftime('%Y-%m-%d %H:00', datetime(timestamp/1000, 'unixepoch', 'localtime'))";
    } else {
      groupBy = "strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime'))";
    }

    const stmt = db.prepare(`
      SELECT ${groupBy} as time, COUNT(*) as count
      FROM messages 
      WHERE timestamp >= ?
      GROUP BY ${groupBy}
      ORDER BY time ASC
    `);
    const data = stmt.all(startTime);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 用户相关 API ==============

/**
 * 获取用户列表
 * GET /api/users
 */
app.get('/api/users', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        sender as name,
        type,
        COUNT(*) as messageCount,
        MIN(timestamp) as firstSeen,
        MAX(timestamp) as lastSeen
      FROM messages 
      GROUP BY sender 
      ORDER BY lastSeen DESC
    `);
    const users = stmt.all();

    // 添加在线状态
    const now = Date.now();
    const usersWithStatus = users.map(user => ({
      ...user,
      online: userStatus.has(user.name) && (now - userStatus.get(user.name) < 5 * 60 * 1000),
      lastActivity: userStatus.get(user.name) || user.lastSeen
    }));

    res.json({ success: true, data: usersWithStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户活动状态（心跳）
 * POST /api/users/:name/heartbeat
 */
app.post('/api/users/:name/heartbeat', (req, res) => {
  userStatus.set(req.params.name, Date.now());
  res.json({ success: true });
});

/**
 * 获取在线用户
 * GET /api/users/online
 */
app.get('/api/users/online', (req, res) => {
  const now = Date.now();
  const onlineUsers = [];
  userStatus.forEach((lastSeen, name) => {
    if (now - lastSeen < 5 * 60 * 1000) {
      onlineUsers.push({ name, lastSeen });
    }
  });
  res.json({ success: true, data: onlineUsers });
});

// ============== 同步状态 API ==============

/**
 * 获取所有参与者同步状态
 * GET /api/sync-status
 */
app.get('/api/sync-status', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM sync_state');
    const data = stmt.all();
    
    const status = data.map(row => {
      const unsynced = db.prepare('SELECT COUNT(*) as count FROM messages WHERE timestamp > ?').get(row.last_sync).count;
      return {
        participantId: row.participant_id,
        lastSync: row.last_sync,
        lastSyncTime: new Date(row.last_sync).toISOString(),
        unsyncedCount: unsynced
      };
    });

    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 健康检查 ==============

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: dbPath,
    uptime: process.uptime()
  });
});

// 启动服务
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[Admin API] 服务已启动: http://localhost:${port}`);
  console.log(`[Admin API] 数据库: ${dbPath}`);
});
