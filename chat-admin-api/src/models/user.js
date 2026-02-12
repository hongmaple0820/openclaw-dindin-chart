/**
 * 用户模型 - SQLite 数据库操作
 */
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const path = require('path');
const fs = require('fs');

let db = null;

async function initDatabase() {
  const dataDir = path.dirname(config.database.path);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = await open({
    filename: config.database.path,
    driver: sqlite3.Database
  });

  await db.exec(`
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

    CREATE TABLE IF NOT EXISTS login_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes(target, type);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  `);

  console.log('[UserModel] 数据库初始化完成:', config.database.path);
  return db;
}

const dbPromise = initDatabase();

const UserModel = {
  create: async (userData) => {
    const { username, email, phone, password, nickname } = userData;
    const db = await dbPromise;
    
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      throw new Error('用户名已存在');
    }
    
    if (email) {
      const emailExists = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (emailExists) {
        throw new Error('邮箱已被使用');
      }
    }
    
    if (phone) {
      const phoneExists = await db.get('SELECT id FROM users WHERE phone = ?', [phone]);
      if (phoneExists) {
        throw new Error('手机号已被使用');
      }
    }
    
    const id = uuidv4();
    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, config.password.saltRounds);
    
    await db.run(`
      INSERT INTO users (id, username, email, phone, password_hash, nickname, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, username, email || null, phone || null, passwordHash, nickname || username, now, now]);
    
    return UserModel.findById(id);
  },
  
  findById: async (id) => {
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
    }
    return user;
  },
  
  findByUsername: async (username) => {
    const db = await dbPromise;
    return db.get('SELECT * FROM users WHERE username = ?', [username]);
  },
  
  findByEmail: async (email) => {
    const db = await dbPromise;
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  },
  
  findByPhone: async (phone) => {
    const db = await dbPromise;
    return db.get('SELECT * FROM users WHERE phone = ?', [phone]);
  },
  
  verifyPassword: async (user, password) => {
    return bcrypt.compare(password, user.password_hash);
  },
  
  updatePassword: async (userId, newPassword) => {
    const db = await dbPromise;
    const passwordHash = await bcrypt.hash(newPassword, config.password.saltRounds);
    const now = Date.now();
    await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, userId]);
  },
  
  update: async (userId, data) => {
    const db = await dbPromise;
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
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existing) {
        throw new Error('邮箱已被使用');
      }
      updates.push('email = ?');
      values.push(email);
      updates.push('email_verified = 0');
    }
    if (phone !== undefined) {
      const existing = await db.get('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, userId]);
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
    
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    
    return UserModel.findById(userId);
  },
  
  updateLastLogin: async (userId) => {
    const db = await dbPromise;
    const now = Date.now();
    await db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [now, userId]);
  },
  
  findAll: async (options = {}) => {
    const db = await dbPromise;
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
    
    const row = await db.get(`SELECT COUNT(*) as count FROM users WHERE ${where}`, params);
    const total = row.count;
    
    const users = await db.all(`
      SELECT id, username, email, phone, nickname, avatar, role, status, created_at, last_login_at
      FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    return { users, total, page, limit };
  },
  
  updateRole: async (userId, role) => {
    const db = await dbPromise;
    const now = Date.now();
    await db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, userId]);
    return UserModel.findById(userId);
  },
  
  updateStatus: async (userId, status) => {
    const db = await dbPromise;
    const now = Date.now();
    await db.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now, userId]);
    return UserModel.findById(userId);
  },
  
  delete: async (userId) => {
    const db = await dbPromise;
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM verification_codes WHERE user_id = ?', [userId]);
  }
};

const VerificationCodeModel = {
  create: async (data) => {
    const db = await dbPromise;
    const { userId, type, target } = data;
    const id = uuidv4();
    const code = Math.random().toString().slice(-config.verification.codeLength);
    const now = Date.now();
    const expiresAt = now + config.verification.expiresIn;
    
    await db.run('DELETE FROM verification_codes WHERE target = ? AND type = ? AND used = 0', [target, type]);
    
    await db.run(`
      INSERT INTO verification_codes (id, user_id, type, target, code, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId || null, type, target, code, expiresAt, now]);
    
    return { id, code, expiresAt };
  },
  
  verify: async (target, type, code) => {
    const db = await dbPromise;
    const now = Date.now();
    const record = await db.get(`
      SELECT * FROM verification_codes 
      WHERE target = ? AND type = ? AND code = ? AND used = 0 AND expires_at > ?
    `, [target, type, code, now]);
    
    if (!record) {
      return null;
    }
    
    await db.run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
    
    return record;
  }
};

const RefreshTokenModel = {
  create: async (userId, token, expiresAt) => {
    const db = await dbPromise;
    const id = uuidv4();
    const now = Date.now();
    
    await db.run(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, userId, token, expiresAt, now]);
    
    return { id, token, expiresAt };
  },
  
  findByToken: async (token) => {
    const db = await dbPromise;
    const now = Date.now();
    return db.get('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?', [token, now]);
  },
  
  delete: async (token) => {
    const db = await dbPromise;
    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  },
  
  deleteByUserId: async (userId) => {
    const db = await dbPromise;
    await db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  },
  
  cleanup: async () => {
    const db = await dbPromise;
    const now = Date.now();
    await db.run('DELETE FROM refresh_tokens WHERE expires_at < ?', [now]);
  }
};

const LoginLogModel = {
  create: async (data) => {
    const db = await dbPromise;
    const { userId, ip, userAgent, success } = data;
    const id = uuidv4();
    const now = Date.now();
    
    await db.run(`
      INSERT INTO login_logs (id, user_id, ip, user_agent, success, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, ip || null, userAgent || null, success ? 1 : 0, now]);
  },
  
  findByUserId: async (userId, limit = 10) => {
    const db = await dbPromise;
    return db.all(`
      SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `, [userId, limit]);
  }
};

module.exports = {
  UserModel,
  VerificationCodeModel,
  RefreshTokenModel,
  LoginLogModel,
  getDb: () => dbPromise
};
