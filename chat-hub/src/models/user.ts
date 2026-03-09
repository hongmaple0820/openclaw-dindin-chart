/**
 * 用户模型 - 基于 better-sqlite3 的用户数据库操作
 */
import BetterSqlite3Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const DbWrapper = require('../db-wrapper');

// 配置类型定义
interface AppConfig {
  database: { path: string };
  password: { minLength: number; saltRounds: number };
  verification: { codeLength: number; expiresIn: number };
  jwt: { secret: string; expiresIn: string; refreshExpiresIn: string };
  server: { port: number };
  email: { host: string; port: number; secure: boolean; auth: { user: string; pass: string }; from: string };
}

// 动态导入配置
const config: AppConfig = require('../config-jwt');

interface DbClient {
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): void;
}

let db: DbClient | null = null;

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
  status: string;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  email_verified: number;
  phone_verified: number;
}

interface CreateUserData {
  username: string;
  email?: string;
  phone?: string;
  password: string;
  nickname?: string;
}

interface UpdateUserData {
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

interface FindAllOptions {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
}

interface VerificationCodeData {
  userId?: string;
  type: string;
  target: string;
}

interface LoginLogData {
  userId: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
}

async function initDatabase(): Promise<DbClient> {
  const dataDir = path.dirname(config.database.path);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = BetterSqlite3Database(config.database.path) as unknown as {
    pragma: (sql: string) => void;
  };
  sqlite.pragma('journal_mode = WAL');
  // Keep the existing async call sites intact while standardizing on better-sqlite3.
  db = new DbWrapper(sqlite) as DbClient;

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
  create: async (userData: CreateUserData): Promise<Omit<UserRow, 'password_hash'>> => {
    const { username, email, phone, password, nickname } = userData;
    const database = await dbPromise;
    
    const existing = await database.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      throw new Error('用户名已存在');
    }
    
    if (email) {
      const emailExists = await database.get('SELECT id FROM users WHERE email = ?', [email]);
      if (emailExists) {
        throw new Error('邮箱已被使用');
      }
    }
    
    if (phone) {
      const phoneExists = await database.get('SELECT id FROM users WHERE phone = ?', [phone]);
      if (phoneExists) {
        throw new Error('手机号已被使用');
      }
    }
    
    const id = uuidv4();
    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, config.password.saltRounds);
    
    await database.run(`
      INSERT INTO users (id, username, email, phone, password_hash, nickname, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, username, email || null, phone || null, passwordHash, nickname || username, now, now]);
    
    return UserModel.findById(id) as Promise<Omit<UserRow, 'password_hash'>>;
  },
  
  findById: async (id: string): Promise<Omit<UserRow, 'password_hash'> | undefined> => {
    const database = await dbPromise;
    const user = await database.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
    }
    return user || undefined;
  },
  
  findByUsername: async (username: string): Promise<UserRow | undefined> => {
    const database = await dbPromise;
    return (await database.get<UserRow>('SELECT * FROM users WHERE username = ?', [username])) || undefined;
  },
  
  findByEmail: async (email: string): Promise<UserRow | undefined> => {
    const database = await dbPromise;
    return (await database.get<UserRow>('SELECT * FROM users WHERE email = ?', [email])) || undefined;
  },
  
  findByPhone: async (phone: string): Promise<UserRow | undefined> => {
    const database = await dbPromise;
    return (await database.get<UserRow>('SELECT * FROM users WHERE phone = ?', [phone])) || undefined;
  },
  
  verifyPassword: async (user: UserRow, password: string): Promise<boolean> => {
    return bcrypt.compare(password, user.password_hash);
  },
  
  updatePassword: async (userId: string, newPassword: string): Promise<void> => {
    const database = await dbPromise;
    const passwordHash = await bcrypt.hash(newPassword, config.password.saltRounds);
    const now = Date.now();
    await database.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, userId]);
  },
  
  update: async (userId: string, data: UpdateUserData): Promise<Omit<UserRow, 'password_hash'> | undefined> => {
    const database = await dbPromise;
    const { nickname, avatar, email, phone } = data;
    const now = Date.now();
    
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (nickname !== undefined) {
      updates.push('nickname = ?');
      values.push(nickname);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (email !== undefined) {
      const existing = await database.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existing) {
        throw new Error('邮箱已被使用');
      }
      updates.push('email = ?');
      values.push(email);
      updates.push('email_verified = 0');
    }
    if (phone !== undefined) {
      const existing = await database.get('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, userId]);
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
    
    await database.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    
    return UserModel.findById(userId);
  },
  
  updateLastLogin: async (userId: string): Promise<void> => {
    const database = await dbPromise;
    const now = Date.now();
    await database.run('UPDATE users SET last_login_at = ? WHERE id = ?', [now, userId]);
  },
  
  findAll: async (options: FindAllOptions = {}): Promise<{ users: Omit<UserRow, 'password_hash'>[]; total: number; page: number; limit: number }> => {
    const database = await dbPromise;
    const { page = 1, limit = 20, role, status } = options;
    const offset = (page - 1) * limit;
    
    let where = '1=1';
    const params: (string | number)[] = [];
    
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    
    const row = await database.get(`SELECT COUNT(*) as count FROM users WHERE ${where}`, params) as { count: number };
    const total = row.count;
    
    const users = await database.all<Omit<UserRow, 'password_hash'>>(`
      SELECT id, username, email, phone, nickname, avatar, role, status, created_at, last_login_at
      FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    return { users, total, page, limit };
  },
  
  updateRole: async (userId: string, role: string): Promise<Omit<UserRow, 'password_hash'> | undefined> => {
    const database = await dbPromise;
    const now = Date.now();
    await database.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, userId]);
    return UserModel.findById(userId);
  },
  
  updateStatus: async (userId: string, status: string): Promise<Omit<UserRow, 'password_hash'> | undefined> => {
    const database = await dbPromise;
    const now = Date.now();
    await database.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now, userId]);
    return UserModel.findById(userId);
  },
  
  delete: async (userId: string): Promise<void> => {
    const database = await dbPromise;
    await database.run('DELETE FROM users WHERE id = ?', [userId]);
    await database.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    await database.run('DELETE FROM verification_codes WHERE user_id = ?', [userId]);
  }
};

interface VerificationCodeResult {
  id: string;
  code: string;
  expiresAt: number;
}

const VerificationCodeModel = {
  create: async (data: VerificationCodeData): Promise<VerificationCodeResult> => {
    const database = await dbPromise;
    const { userId, type, target } = data;
    const id = uuidv4();
    const code = Math.random().toString().slice(-config.verification.codeLength);
    const now = Date.now();
    const expiresAt = now + config.verification.expiresIn;
    
    await database.run('DELETE FROM verification_codes WHERE target = ? AND type = ? AND used = 0', [target, type]);
    
    await database.run(`
      INSERT INTO verification_codes (id, user_id, type, target, code, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId || null, type, target, code, expiresAt, now]);
    
    return { id, code, expiresAt };
  },
  
  verify: async (target: string, type: string, code: string): Promise<{ id: string; user_id: string } | null> => {
    const database = await dbPromise;
    const now = Date.now();
    const record = await database.get(`
      SELECT * FROM verification_codes 
      WHERE target = ? AND type = ? AND code = ? AND used = 0 AND expires_at > ?
    `, [target, type, code, now]) as { id: string; user_id: string } | undefined;
    
    if (!record) {
      return null;
    }
    
    await database.run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
    
    return record;
  }
};

interface RefreshTokenResult {
  id: string;
  token: string;
  expiresAt: number;
}

const RefreshTokenModel = {
  create: async (userId: string, token: string, expiresAt: number): Promise<RefreshTokenResult> => {
    const database = await dbPromise;
    const id = uuidv4();
    const now = Date.now();
    
    await database.run(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, userId, token, expiresAt, now]);
    
    return { id, token, expiresAt };
  },
  
  findByToken: async (token: string): Promise<{ id: string; user_id: string; token: string; expires_at: number } | undefined> => {
    const database = await dbPromise;
    const now = Date.now();
    return database.get('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?', [token, now]);
  },
  
  delete: async (token: string): Promise<void> => {
    const database = await dbPromise;
    await database.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  },
  
  deleteByUserId: async (userId: string): Promise<void> => {
    const database = await dbPromise;
    await database.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  },
  
  cleanup: async (): Promise<void> => {
    const database = await dbPromise;
    const now = Date.now();
    await database.run('DELETE FROM refresh_tokens WHERE expires_at < ?', [now]);
  }
};

const LoginLogModel = {
  create: async (data: LoginLogData): Promise<void> => {
    const database = await dbPromise;
    const { userId, ip, userAgent, success } = data;
    const id = uuidv4();
    const now = Date.now();
    
    await database.run(`
      INSERT INTO login_logs (id, user_id, ip, user_agent, success, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, ip || null, userAgent || null, success ? 1 : 0, now]);
  },
  
  findByUserId: async (userId: string, limit: number = 10): Promise<unknown[]> => {
    const database = await dbPromise;
    return database.all(`
      SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `, [userId, limit]);
  }
};

const getDb = () => dbPromise;

export {
  UserModel,
  VerificationCodeModel,
  RefreshTokenModel,
  LoginLogModel,
  getDb
};
