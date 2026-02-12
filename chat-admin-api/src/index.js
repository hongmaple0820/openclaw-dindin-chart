const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const Redis = require('ioredis');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库连接
const dbPath = process.env.DB_PATH || path.join(process.env.HOME, '.openclaw', 'chat-data', 'messages.db');
const db = new sqlite3.Database(dbPath);

// Redis 连接（用于获取在线状态）
// 从环境变量读取配置，保护隐���
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
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
    db.get(`SELECT COUNT(*) as total FROM messages ${whereClause}`, params, (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      const total = row.total;
      
      // 获取数据
      const sql = `
        SELECT * FROM messages ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      });
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
    db.run('DELETE FROM messages WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: this.changes > 0 });
    });
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
    const sql = `DELETE FROM messages WHERE id IN (${placeholders})`;
    
    db.run(sql, ids, function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, deleted: this.changes });
    });
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

    db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const total = row.count;
      
      db.get('SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?', [todayStart.getTime()], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const today = row.count;
        
        db.get('SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?', [weekStart.getTime()], (err, row) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          const week = row.count;
          
          db.get("SELECT COUNT(*) as count FROM messages WHERE type = 'human'", (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const humanCount = row.count;
            
            db.get("SELECT COUNT(*) as count FROM messages WHERE type = 'bot'", (err, row) => {
              if (err) return res.status(500).json({ success: false, error: err.message });
              const botCount = row.count;
              
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
            });
          });
        });
      });
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
    db.all(`
      SELECT sender, type, COUNT(*) as count, 
             MIN(timestamp) as firstMessage, 
             MAX(timestamp) as lastMessage
      FROM messages 
      GROUP BY sender 
      ORDER BY count DESC
    `, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: rows });
    });
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
    db.all(`
      SELECT source, COUNT(*) as count
      FROM messages 
      GROUP BY source 
      ORDER BY count DESC
    `, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: rows });
    });
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

    let groupBy;
    if (interval === 'hour') {
      groupBy = "strftime('%Y-%m-%d %H:00', datetime(timestamp/1000, 'unixepoch', 'localtime'))";
    } else {
      groupBy = "strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime'))";
    }

    const sql = `
      SELECT ${groupBy} as time, COUNT(*) as count
      FROM messages 
      WHERE timestamp >= ?
      GROUP BY ${groupBy}
      ORDER BY time ASC
    `;
    
    db.all(sql, [startTime], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: rows });
    });
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
    db.all(`
      SELECT 
        sender as name,
        type,
        COUNT(*) as messageCount,
        MIN(timestamp) as firstSeen,
        MAX(timestamp) as lastSeen
      FROM messages 
      GROUP BY sender 
      ORDER BY lastSeen DESC
    `, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // 添加在线状态
      const now = Date.now();
      const usersWithStatus = rows.map(user => ({
        ...user,
        online: userStatus.has(user.name) && (now - userStatus.get(user.name) < 5 * 60 * 1000),
        lastActivity: userStatus.get(user.name) || user.lastSeen
      }));
      
      res.json({ success: true, data: usersWithStatus });
    });
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
    db.all('SELECT * FROM sync_state', (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      const statusPromises = rows.map(row => {
        return new Promise((resolve) => {
          db.get('SELECT COUNT(*) as count FROM messages WHERE timestamp > ?', [row.last_sync], (err, countRow) => {
            if (err) {
              resolve({
                participantId: row.participant_id,
                lastSync: row.last_sync,
                lastSyncTime: new Date(row.last_sync).toISOString(),
                unsyncedCount: 0
              });
            } else {
              resolve({
                participantId: row.participant_id,
                lastSync: row.last_sync,
                lastSyncTime: new Date(row.last_sync).toISOString(),
                unsyncedCount: countRow.count
              });
            }
          });
        });
      });
      
      Promise.all(statusPromises).then(status => {
        res.json({ success: true, data: status });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 用户认证路由 ==============

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const dmRoutes = require('./routes/dm');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dm', dmRoutes);

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
  console.log(`[Admin API] 认证接口: /api/auth/*`);
  console.log(`[Admin API] 用户接口: /api/user/*`);
  console.log(`[Admin API] 私信接口: /api/dm/*`);
});