/**
 * 用户认证模块（SQLite 版本 + 审核系统）
 * @author 小琳
 * @date 2026-02-06
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'maple-chatroom-secret-2026';
const JWT_EXPIRES = '7d';

// 数据库路径
const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'users.db');
const db = new Database(dbPath);

// 初始化用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nickname TEXT,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    type TEXT DEFAULT 'human',
    status TEXT DEFAULT 'pending',
    reject_reason TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    approved_at INTEGER,
    approved_by TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
`);

// 确保有管理员账号
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (id, username, nickname, email, password, role, type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'admin',
    '管理员',
    'admin@chatroom.com',
    bcrypt.hashSync('admin123', 10),
    'admin',
    'human',
    'approved',
    Date.now()
  );
  console.log('[Auth] 已创建管理员账号: admin / admin123');
}

// 确保测试账号存在且已审核
const testExists = db.prepare('SELECT id FROM users WHERE username = ?').get('test');
if (!testExists) {
  db.prepare(`
    INSERT INTO users (id, username, nickname, email, password, role, type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'test',
    '测试用户',
    'test@test.com',
    bcrypt.hashSync('123456', 10),
    'user',
    'human',
    'approved',
    Date.now()
  );
  console.log('[Auth] 已创建测试账号: test / 123456');
}

/**
 * 用户状态枚举
 */
const UserStatus = {
  PENDING: 'pending',     // 待审核
  APPROVED: 'approved',   // 已通过
  REJECTED: 'rejected',   // 已拒绝
  BANNED: 'banned'        // 已封禁
};

/**
 * 用户类型枚举
 */
const UserType = {
  HUMAN: 'human',         // 人类用户
  BOT: 'bot'              // 机器人
};

/**
 * 注册用户
 */
function register(userData) {
  const { username, nickname, email, password, type = 'human' } = userData;
  
  if (!username || !password) {
    return { success: false, error: '用户名和密码不能为空' };
  }
  
  if (username.length < 2 || username.length > 20) {
    return { success: false, error: '用户名长度需要 2-20 位' };
  }
  
  if (password.length < 6) {
    return { success: false, error: '密码至少 6 位' };
  }
  
  // 检查用户名是否存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return { success: false, error: '用户名已存在' };
  }
  
  const userId = uuidv4();
  const now = Date.now();
  
  try {
    db.prepare(`
      INSERT INTO users (id, username, nickname, email, password, role, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      username,
      nickname || username,
      email || '',
      bcrypt.hashSync(password, 10),
      'user',
      type,
      UserStatus.PENDING,  // 新注册用户默认待审核
      now,
      now
    );
    
    return {
      success: true,
      message: '注册成功，请等待管理员审核',
      user: {
        id: userId,
        username,
        nickname: nickname || username,
        email: email || '',
        type,
        status: UserStatus.PENDING
      }
    };
  } catch (error) {
    console.error('[Auth] 注册失败:', error);
    return { success: false, error: '注册失败: ' + error.message };
  }
}

/**
 * 登录
 */
function login(username, password) {
  if (!username || !password) {
    return { success: false, error: '用户名和密码不能为空' };
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }
  
  if (!bcrypt.compareSync(password, user.password)) {
    return { success: false, error: '密码错误' };
  }
  
  // 检查用户状态
  if (user.status === UserStatus.PENDING) {
    return { success: false, error: '账号正在审核中，请耐心等待', code: 'PENDING' };
  }
  
  if (user.status === UserStatus.REJECTED) {
    return { 
      success: false, 
      error: '账号审核未通过' + (user.reject_reason ? `：${user.reject_reason}` : ''),
      code: 'REJECTED'
    };
  }
  
  if (user.status === UserStatus.BANNED) {
    return { success: false, error: '账号已被封禁', code: 'BANNED' };
  }
  
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  
  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      type: user.type,
      status: user.status
    },
    accessToken: token,
    refreshToken: token  // 简化处理，实际应分开
  };
}

/**
 * 验证 Token
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return { success: false, error: '用户不存在' };
    }
    
    // 检查用户状态
    if (user.status !== UserStatus.APPROVED) {
      return { success: false, error: '账号状态异常', code: user.status };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        type: user.type,
        status: user.status
      }
    };
  } catch (error) {
    return { success: false, error: 'Token 无效或已过期' };
  }
}

/**
 * 获取用户信息
 */
function getUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    type: user.type,
    status: user.status,
    createdAt: user.created_at
  };
}

/**
 * 获取待审核用户列表
 */
function getPendingUsers() {
  return db.prepare(`
    SELECT id, username, nickname, email, type, status, created_at
    FROM users 
    WHERE status = ?
    ORDER BY created_at DESC
  `).all(UserStatus.PENDING);
}

/**
 * 根据 ID 获取用户
 */
function getUserById(userId) {
  return db.prepare(`
    SELECT id, username, nickname, email, role, type, status, created_at
    FROM users WHERE id = ?
  `).get(userId);
}

/**
 * 根据用户名获取用户
 */
function getUserByUsername(username) {
  return db.prepare(`
    SELECT id, username, nickname, email, role, type, status, created_at
    FROM users WHERE username = ?
  `).get(username);
}

/**
 * 获取所有用户列表（管理员用）
 */
function getAllUsers(options = {}) {
  const { status, type, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;
  
  let where = [];
  let params = [];
  
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params).count;
  const users = db.prepare(`
    SELECT id, username, nickname, email, role, type, status, created_at, approved_at, approved_by, reject_reason
    FROM users ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
}

/**
 * 审核用户 - 通过
 */
function approveUser(userId, adminId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }
  
  if (user.status === UserStatus.APPROVED) {
    return { success: false, error: '用户已通过审核' };
  }
  
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET status = ?, approved_at = ?, approved_by = ?, updated_at = ?, reject_reason = NULL
    WHERE id = ?
  `).run(UserStatus.APPROVED, now, adminId, now, userId);
  
  return { success: true, message: '审核通过' };
}

/**
 * 审核用户 - 拒绝
 */
function rejectUser(userId, adminId, reason = '') {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }
  
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET status = ?, approved_by = ?, updated_at = ?, reject_reason = ?
    WHERE id = ?
  `).run(UserStatus.REJECTED, adminId, now, reason, userId);
  
  return { success: true, message: '已拒绝' };
}

/**
 * 封禁用户
 */
function banUser(userId, adminId, reason = '') {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }
  
  if (user.role === 'admin') {
    return { success: false, error: '不能封禁管理员' };
  }
  
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET status = ?, updated_at = ?, reject_reason = ?
    WHERE id = ?
  `).run(UserStatus.BANNED, now, reason, userId);
  
  return { success: true, message: '已封禁' };
}

/**
 * 解封用户
 */
function unbanUser(userId) {
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET status = ?, updated_at = ?, reject_reason = NULL
    WHERE id = ?
  `).run(UserStatus.APPROVED, now, userId);
  
  return { success: true, message: '已解封' };
}

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' });
  }
  
  const token = authHeader.substring(7);
  const result = verifyToken(token);
  
  if (!result.success) {
    return res.status(401).json(result);
  }
  
  req.user = result.user;
  next();
}

/**
 * 管理员权限中间件
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
}

module.exports = {
  register,
  login,
  verifyToken,
  getUser,
  getUserById,
  getUserByUsername,
  getPendingUsers,
  getAllUsers,
  approveUser,
  rejectUser,
  banUser,
  unbanUser,
  authMiddleware,
  adminMiddleware,
  UserStatus,
  UserType,
  db
};
