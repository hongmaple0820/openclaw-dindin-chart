/**
 * 超级管理员 API 路由
 * @author 小琳
 * @date 2026-03-03
 * 
 * 功能：
 * - 超级管理员登录（JWT 认证）
 * - 密码修改
 * - 会话管理（列表、详情、配置、压缩、删除）
 * - 系统统计
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'maple-chatroom-secret-2026';
const JWT_EXPIRES = '24h';

// 超级管理员数据库路径
const ADMIN_DB_PATH = path.join(os.homedir(), '.openclaw', 'chat-data', 'super_admin.db');

// 初始化超级管理员数据库
let adminDb = null;

function initAdminDb() {
  if (adminDb) return adminDb;
  
  const storeDir = path.dirname(ADMIN_DB_PATH);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  adminDb = new Database(ADMIN_DB_PATH);
  adminDb.pragma('journal_mode = WAL');

  // 创建超级管理员表
  adminDb.exec(`
    CREATE TABLE IF NOT EXISTS super_admin (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 确保默认管理员存在
  const existing = adminDb.prepare('SELECT id FROM super_admin WHERE username = ?').get('admin');
  if (!existing) {
    const now = Date.now();
    adminDb.prepare(`
      INSERT INTO super_admin (id, username, password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('super_admin_001', 'admin', bcrypt.hashSync('admin123', 10), now, now);
    console.log('[SuperAdmin] 已创建默认超级管理员账号: admin / admin123');
  }

  return adminDb;
}

// 初始化数据库
initAdminDb();

/**
 * 验证超级管理员 Token
 */
function verifyToken(token) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 验证是否为超级管理员
    if (decoded.role !== 'super_admin') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 超级管理员认证中间件
 */
function requireSuperAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, error: '未登录' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  req.admin = decoded;
  next();
}

/**
 * POST /api/super-admin/login
 * 超级管理员登录
 * 
 * Body: { username, password }
 * Response: { success, token }
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    
    // 用户名必须为 admin
    if (username !== 'admin') {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    // 查询管理员
    const db = initAdminDb();
    const admin = db.prepare('SELECT * FROM super_admin WHERE username = ?').get('admin');
    if (!admin) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    // 验证密码
    if (!bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    // 生成 JWT Token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: 'super_admin' 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    
    console.log('[SuperAdmin] 登录成功:', username);
    
    res.json({ 
      success: true, 
      token,
      expiresIn: JWT_EXPIRES
    });
  } catch (error) {
    console.error('[SuperAdmin] 登录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/super-admin/password
 * 修改超级管理员密码
 * 
 * Body: { oldPassword, newPassword }
 * Headers: Authorization: Bearer <token>
 */
router.put('/password', requireSuperAdmin, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码不能为空' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少 6 位' });
    }
    
    // 查询管理员
    const db = initAdminDb();
    const admin = db.prepare('SELECT * FROM super_admin WHERE username = ?').get('admin');
    if (!admin) {
      return res.status(500).json({ success: false, error: '管理员账号不存在' });
    }
    
    // 验证旧密码
    if (!bcrypt.compareSync(oldPassword, admin.password)) {
      return res.status(400).json({ success: false, error: '旧密码错误' });
    }
    
    // 更新密码
    const now = Date.now();
    db.prepare(`
      UPDATE super_admin SET password = ?, updated_at = ? WHERE username = ?
    `).run(bcrypt.hashSync(newPassword, 10), now, 'admin');
    
    console.log('[SuperAdmin] 密码已修改');
    
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('[SuperAdmin] 修改密码失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/super-admin/sessions
 * 获取所有会话列表
 * 
 * Query: { limit, offset, type }
 * Response: { success, data: [...] }
 */
router.get('/sessions', requireSuperAdmin, (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    const sessionManager = req.app?.locals?.sessionManager;
    
    // 从 sessionManager 获取会话
    let sessions = [];
    if (sessionManager && sessionManager.db) {
      let sql = 'SELECT * FROM sessions WHERE 1=1';
      const params = [];
      
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      
      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      sessions = sessionManager.db.prepare(sql).all(...params);
      
      // 格式化会话数据
      sessions = sessions.map(s => ({
        id: s.id,
        type: s.type,
        name: s.name,
        ownerId: s.owner_id,
        createdBy: s.created_by,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        lastMessage: s.last_message,
        lastMessageTime: s.last_message_time,
        participants: JSON.parse(s.participants || '[]')
      }));
    }
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[SuperAdmin] 获取会话列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/super-admin/sessions/:sessionId
 * 获取会话详情
 * 
 * Response: { success, data: {...} }
 */
router.get('/sessions/:sessionId', requireSuperAdmin, (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionManager = req.app?.locals?.sessionManager;
    const messageStore = req.app?.locals?.messageStore;
    
    // 获取会话信息
    let session = null;
    if (sessionManager) {
      session = sessionManager.getSessionById(sessionId);
    }
    
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    // 获取会话配置（从 metadata 中读取）
    const config = {
      maxContextSize: session.metadata?.maxContextSize || 100,
      compressionThreshold: session.metadata?.compressionThreshold || 80,
      summaryMaxLength: session.metadata?.summaryMaxLength || 500
    };
    
    // 获取消息统计
    let messageCount = 0;
    if (messageStore && messageStore.db) {
      const result = messageStore.db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE sender = ? OR content LIKE ?
      `).get(sessionId, '%'+sessionId+'%');
      messageCount = result?.count || 0;
    }
    
    res.json({ 
      success: true, 
      data: {
        ...session,
        config,
        messageCount
      }
    });
  } catch (error) {
    console.error('[SuperAdmin] 获取会话详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/super-admin/sessions/:sessionId/config
 * 修改会话配置
 * 
 * Body: { maxContextSize, compressionThreshold, summaryMaxLength }
 * Response: { success }
 */
router.put('/sessions/:sessionId/config', requireSuperAdmin, (req, res) => {
  try {
    const { sessionId } = req.params;
    const { maxContextSize, compressionThreshold, summaryMaxLength } = req.body;
    const sessionManager = req.app?.locals?.sessionManager;
    
    if (!sessionManager) {
      return res.status(500).json({ success: false, error: '会话管理器未初始化' });
    }
    
    // 获取现有会话
    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    // 更新 metadata
    const metadata = {
      ...session.metadata,
      maxContextSize: maxContextSize || session.metadata?.maxContextSize || 100,
      compressionThreshold: compressionThreshold || session.metadata?.compressionThreshold || 80,
      summaryMaxLength: summaryMaxLength || session.metadata?.summaryMaxLength || 500
    };
    
    sessionManager.updateSession(sessionId, { metadata });
    
    console.log('[SuperAdmin] 更新会话配置:', sessionId, metadata);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[SuperAdmin] 修改会话配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/super-admin/sessions/:sessionId/compress
 * 压缩会话上下文
 * 
 * Response: { success, summary }
 */
router.post('/sessions/:sessionId/compress', requireSuperAdmin, (req, res) => {
  try {
    const { sessionId } = req.params;
    const messageStore = req.app?.locals?.messageStore;
    const sessionManager = req.app?.locals?.sessionManager;
    
    if (!messageStore || !messageStore.db) {
      return res.status(500).json({ success: false, error: '消息存储未初始化' });
    }
    
    // 获取会话
    const session = sessionManager?.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    // 获取会话的最近消息
    const messages = messageStore.db.prepare(`
      SELECT * FROM messages 
      WHERE sender = ? OR content LIKE ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).all(sessionId, '%'+sessionId+'%');
    
    if (messages.length === 0) {
      return res.json({ success: true, summary: '无消息需要压缩' });
    }
    
    // 生成摘要（简单实现：取最近 N 条消息的关键信息）
    const summaryLines = messages.slice(0, 20).map(m => {
      const time = new Date(m.timestamp).toLocaleString('zh-CN');
      const content = m.content || '';
      return '['+time+'] '+m.sender+': '+content.substring(0, 100)+'...';
    });
    
    const summary = '会话 '+sessionId+' 压缩摘要 ('+messages.length+' 条消息):\n' + summaryLines.join('\n');
    
    // 更新会话 metadata，标记压缩时间
    if (sessionManager) {
      const metadata = {
        ...session.metadata,
        lastCompressed: Date.now(),
        compressedMessageCount: messages.length
      };
      sessionManager.updateSession(sessionId, { metadata });
    }
    
    console.log('[SuperAdmin] 压缩会话:', sessionId, messages.length, '条消息');
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error('[SuperAdmin] 压缩会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/super-admin/sessions/:sessionId
 * 删除会话
 * 
 * Response: { success }
 */
router.delete('/sessions/:sessionId', requireSuperAdmin, (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionManager = req.app?.locals?.sessionManager;
    
    if (!sessionManager) {
      return res.status(500).json({ success: false, error: '会话管理器未初始化' });
    }
    
    // 检查会话是否存在
    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    // 删除会话
    sessionManager.deleteSession(sessionId);
    
    console.log('[SuperAdmin] 删除会话:', sessionId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[SuperAdmin] 删除会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/super-admin/stats
 * 获取系统统计
 * 
 * Response: { success, data: { totalSessions, totalMessages, totalGroups, totalUsers, activePlugins } }
 */
router.get('/stats', requireSuperAdmin, (req, res) => {
  try {
    const messageStore = req.app?.locals?.messageStore;
    const sessionManager = req.app?.locals?.sessionManager;
    
    // 统计消息数量
    let totalMessages = 0;
    let totalGroups = 0;
    let totalUsers = 0;
    let totalSessions = 0;
    
    if (messageStore && messageStore.db) {
      const msgResult = messageStore.db.prepare('SELECT COUNT(*) as count FROM messages').get();
      totalMessages = msgResult?.count || 0;
      
      // 统计不同发送者数量（作为用户数近似）
      const userResult = messageStore.db.prepare('SELECT COUNT(DISTINCT sender) as count FROM messages').get();
      totalUsers = userResult?.count || 0;
    }
    
    if (sessionManager && sessionManager.db) {
      const sessionResult = sessionManager.db.prepare('SELECT COUNT(*) as count FROM sessions').get();
      totalSessions = sessionResult?.count || 0;
      
      const groupResult = sessionManager.db.prepare("SELECT COUNT(*) as count FROM sessions WHERE type = 'group'").get();
      totalGroups = groupResult?.count || 0;
    }
    
    // 活跃插件数量（从配置或插件管理器获取）
    let activePlugins = 0;
    try {
      const pluginManager = req.app?.locals?.pluginManager;
      if (pluginManager && pluginManager.getPlugins) {
        activePlugins = pluginManager.getPlugins().filter(p => p.enabled).length;
      }
    } catch (e) {
      // 插件管理器未初始化，跳过
    }
    
    res.json({
      success: true,
      data: {
        totalSessions,
        totalMessages,
        totalGroups,
        totalUsers,
        activePlugins
      }
    });
  } catch (error) {
    console.error('[SuperAdmin] 获取系统统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出
module.exports = router;
module.exports.requireSuperAdmin = requireSuperAdmin;
module.exports.initAdminDb = initAdminDb;
