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
const JWT_REFRESH_EXPIRES = '30d';
const REFRESH_TOKEN_EXPIRES = 30 * 24 * 60 * 60 * 1000;

const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'users.db');
const db = new Database(dbPath);

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

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

  CREATE TABLE IF NOT EXISTS token_blacklist (
    token TEXT PRIMARY KEY,
    revoked_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN webhook_base TEXT`);
  db.exec(`ALTER TABLE users ADD COLUMN webhook_secret TEXT`);
  db.exec(`ALTER TABLE users ADD COLUMN webhook_token TEXT`);
  db.exec(`ALTER TABLE users ADD COLUMN webhook_enabled INTEGER DEFAULT 1`);
  db.exec(`ALTER TABLE users ADD COLUMN is_default INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE users ADD COLUMN reply_enabled INTEGER DEFAULT 1`);
  console.log('[Auth] users 表已扩展 webhook 字段');
} catch (e: any) {
  if (e.message.includes('duplicate column')) {
    console.log('[Auth] users 表 webhook 字段已存在');
  } else {
    console.log('[Auth] 扩展字段:', e.message);
  }
}

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
  } catch (error: any) {
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
  
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  const refreshTokenValue = jwt.sign(
    { userId: user.id, username: user.username, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES }
  );

  const refreshTokenId = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(refreshTokenId, user.id, refreshTokenValue, now + REFRESH_TOKEN_EXPIRES, now);
  
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
    accessToken,
    refreshToken: refreshTokenValue,
    expiresIn: JWT_EXPIRES
  };
}

function refreshToken(refreshTokenValue) {
  if (!refreshTokenValue) {
    return { success: false, error: '缺少 refresh token' };
  }

  const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE token = ?').get(refreshTokenValue);
  if (blacklisted) {
    return { success: false, error: 'Token 已失效' };
  }

  const storedToken = db.prepare(`
    SELECT * FROM refresh_tokens 
    WHERE token = ? AND revoked = 0 AND expires_at > ?
  `).get(refreshTokenValue, Date.now());

  if (!storedToken) {
    return { success: false, error: '无效或已过期的 refresh token' };
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshTokenValue, JWT_SECRET);
  } catch (error: any) {
    return { success: false, error: 'Token 验证失败' };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user || user.status !== UserStatus.APPROVED) {
    return { success: false, error: '用户状态异常' };
  }

  const newAccessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  const newRefreshTokenValue = jwt.sign(
    { userId: user.id, username: user.username, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES }
  );

  const now = Date.now();
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(storedToken.id);

  const newRefreshTokenId = uuidv4();
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(newRefreshTokenId, user.id, newRefreshTokenValue, now + REFRESH_TOKEN_EXPIRES, now);

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshTokenValue,
    expiresIn: JWT_EXPIRES
  };
}

function logout(refreshTokenValue, accessToken) {
  const now = Date.now();

  if (refreshTokenValue) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(refreshTokenValue);
  }

  if (accessToken) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded && decoded.exp) {
        db.prepare(`
          INSERT OR IGNORE INTO token_blacklist (token, revoked_at, expires_at)
          VALUES (?, ?, ?)
        `).run(accessToken, now, decoded.exp * 1000);
      }
    } catch (e: any) {
    }
  }

  return { success: true };
}

function cleanExpiredTokens() {
  const now = Date.now();
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1').run(now);
  db.prepare('DELETE FROM token_blacklist WHERE expires_at < ?').run(now);
}

/**
 * 验证 Token
 */
function verifyToken(token) {
  try {
    const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE token = ?').get(token);
    if (blacklisted) {
      return { success: false, error: 'Token 已失效', code: 'TOKEN_REVOKED' };
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type === 'refresh') {
      return { success: false, error: '请使用 access token', code: 'WRONG_TOKEN_TYPE' };
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return { success: false, error: '用户不存在' };
    }
    
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
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return { success: false, error: 'Token 已过期', code: 'TOKEN_EXPIRED' };
    }
    return { success: false, error: 'Token 无效或已过期', code: 'TOKEN_INVALID' };
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
function getAllUsers(options: any = {}) {
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
  logout,
  refreshToken,
  verifyToken,
  cleanExpiredTokens,
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

export {};
