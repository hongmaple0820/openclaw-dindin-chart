/**
 * 用户模型 - SQLite 数据库操作
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.database.path);

// 初始化数据库表
db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login_at INTEGER,
    email_verified INTEGER DEFAULT 0,
    phone_verified INTEGER DEFAULT 0
  );

  -- 验证码表（用于密码重置、邮箱验证等）
  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  -- 登录日志表
  CREATE TABLE IF NOT EXISTS login_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- 刷新令牌表
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- 创建索引
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes(target, type);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
`);

console.log('[UserModel] 数据库初始化完成:', config.database.path);

/**
 * 用户模型
 */
const UserModel = {
  /**
   * 创建用户
   */
  create: async (userData) => {
    const { username, email, phone, password, nickname } = userData;
    
    // 检查用户名是否存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      throw new Error('用户名已存在');
    }
    
    // 检查邮箱是否存在
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (emailExists) {
        throw new Error('邮箱已被使用');
      }
    }
    
    // 检查手机是否存在
    if (phone) {
      const phoneExists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (phoneExists) {
        throw new Error('手机号已被使用');
      }
    }
    
    const id = uuidv4();
    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, config.password.saltRounds);
    
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, nickname, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, username, email || null, phone || null, passwordHash, nickname || username, now, now);
    
    return UserModel.findById(id);
  },
  
  /**
   * 通过 ID 查找用户
   */
  findById: (id) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (user) {
      delete user.password_hash;
    }
    return user;
  },
  
  /**
   * 通过用户名查找用户（包含密码哈希，用于登录验证）
   */
  findByUsername: (username) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },
  
  /**
   * 通过邮箱查找用户
   */
  findByEmail: (email) => {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },
  
  /**
   * 通过手机查找用户
   */
  findByPhone: (phone) => {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  },
  
  /**
   * 验证密码
   */
  verifyPassword: async (user, password) => {
    return bcrypt.compare(password, user.password_hash);
  },
  
  /**
   * 更新密码
   */
  updatePassword: async (userId, newPassword) => {
    const passwordHash = await bcrypt.hash(newPassword, config.password.saltRounds);
    const now = Date.now();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, now, userId);
  },
  
  /**
   * 更新用户信息
   */
  update: (userId, data) => {
    const { nickname, avatar, email, phone } = data;
    const now = Date.now();
    
    const updates = [];
    const values = [];
    
    if (nickname !== undefined) {
      updates.push('nickname = ?');
      values.push(nickname);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (email !== undefined) {
      // 检查邮箱是否被其他用户使用
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (existing) {
        throw new Error('邮箱已被使用');
      }
      updates.push('email = ?');
      values.push(email);
      updates.push('email_verified = 0');
    }
    if (phone !== undefined) {
      const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, userId);
      if (existing) {
        throw new Error('手机号已被使用');
      }
      updates.push('phone = ?');
      values.push(phone);
      updates.push('phone_verified = 0');
    }
    
    if (updates.length === 0) {
      return UserModel.findById(userId);
    }
    
    updates.push('updated_at = ?');
    values.push(now);
    values.push(userId);
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    return UserModel.findById(userId);
  },
  
  /**
   * 更新最后登录时间
   */
  updateLastLogin: (userId) => {
    const now = Date.now();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userId);
  },
  
  /**
   * 获取所有用户（分页）
   */
  findAll: (options = {}) => {
    const { page = 1, limit = 20, role, status } = options;
    const offset = (page - 1) * limit;
    
    let where = '1=1';
    const params = [];
    
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${where}`).get(...params).count;
    const users = db.prepare(`
      SELECT id, username, email, phone, nickname, avatar, role, status, created_at, last_login_at
      FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    return { users, total, page, limit };
  },
  
  /**
   * 更新用户角色
   */
  updateRole: (userId, role) => {
    const now = Date.now();
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, now, userId);
    return UserModel.findById(userId);
  },
  
  /**
   * 更新用户状态
   */
  updateStatus: (userId, status) => {
    const now = Date.now();
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, userId);
    return UserModel.findById(userId);
  },
  
  /**
   * 删除用户
   */
  delete: (userId) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);
  }
};

/**
 * 验证码模型
 */
const VerificationCodeModel = {
  /**
   * 创建验证码
   */
  create: (data) => {
    const { userId, type, target } = data;
    const id = uuidv4();
    const code = Math.random().toString().slice(-config.verification.codeLength);
    const now = Date.now();
    const expiresAt = now + config.verification.expiresIn;
    
    // 删除旧的未使用验证码
    db.prepare('DELETE FROM verification_codes WHERE target = ? AND type = ? AND used = 0')
      .run(target, type);
    
    db.prepare(`
      INSERT INTO verification_codes (id, user_id, type, target, code, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId || null, type, target, code, expiresAt, now);
    
    return { id, code, expiresAt };
  },
  
  /**
   * 验证验证码
   */
  verify: (target, type, code) => {
    const now = Date.now();
    const record = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE target = ? AND type = ? AND code = ? AND used = 0 AND expires_at > ?
    `).get(target, type, code, now);
    
    if (!record) {
      return null;
    }
    
    // 标记为已使用
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);
    
    return record;
  }
};

/**
 * 刷新令牌模型
 */
const RefreshTokenModel = {
  /**
   * 创建刷新令牌
   */
  create: (userId, token, expiresAt) => {
    const id = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, token, expiresAt, now);
    
    return { id, token, expiresAt };
  },
  
  /**
   * 查找刷新令牌
   */
  findByToken: (token) => {
    const now = Date.now();
    return db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?')
      .get(token, now);
  },
  
  /**
   * 删除刷新令牌
   */
  delete: (token) => {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
  },
  
  /**
   * 删除用户的所有刷新令牌（登出所有设备）
   */
  deleteByUserId: (userId) => {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  },
  
  /**
   * 清理过期令牌
   */
  cleanup: () => {
    const now = Date.now();
    db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
  }
};

/**
 * 登录日志模型
 */
const LoginLogModel = {
  create: (data) => {
    const { userId, ip, userAgent, success } = data;
    const id = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO login_logs (id, user_id, ip, user_agent, success, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, ip || null, userAgent || null, success ? 1 : 0, now);
  },
  
  findByUserId: (userId, limit = 10) => {
    return db.prepare(`
      SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit);
  }
};

module.exports = {
  UserModel,
  VerificationCodeModel,
  RefreshTokenModel,
  LoginLogModel,
  db
};
