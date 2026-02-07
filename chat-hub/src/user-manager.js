/**
 * 用户管理 API
 * 用于管理用户信息和钉钉手机号映射
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// 数据库连接
const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
const db = new Database(dbPath);

// 创建用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    phone TEXT,
    email TEXT,
    avatar TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  );
`);

// 创建索引
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);

class UserManager {
  /**
   * 注册新用户
   */
  registerUser(userData) {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, username, display_name, phone, email, avatar, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const userId = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      stmt.run(
        userId,
        userData.username,
        userData.displayName || userData.username,
        userData.phone || null,
        userData.email || null,
        userData.avatar || null,
        Date.now()
      );
      
      console.log('[用户] 注册成功:', userData.username);
      return { success: true, userId };
      
    } catch (error) {
      console.error('[用户] 注册失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新用户信息
   */
  updateUser(userId, updates) {
    try {
      const fields = [];
      const values = [];
      
      if (updates.displayName !== undefined) {
        fields.push('display_name = ?');
        values.push(updates.displayName);
      }
      if (updates.phone !== undefined) {
        fields.push('phone = ?');
        values.push(updates.phone);
      }
      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.avatar !== undefined) {
        fields.push('avatar = ?');
        values.push(updates.avatar);
      }
      
      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(userId);
      
      const stmt = db.prepare(`
        UPDATE users SET ${fields.join(', ')} WHERE id = ?
      `);
      
      stmt.run(...values);
      console.log('[用户] 更新成功:', userId);
      return { success: true };
      
    } catch (error) {
      console.error('[用户] 更新失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户信息
   */
  getUser(identifier) {
    try {
      // 可以通过 id、username 或 phone 查询
      const stmt = db.prepare(`
        SELECT * FROM users 
        WHERE id = ? OR username = ? OR phone = ?
        LIMIT 1
      `);
      
      const user = stmt.get(identifier, identifier, identifier);
      return user || null;
      
    } catch (error) {
      console.error('[用户] 查询失败:', error.message);
      return null;
    }
  }

  /**
   * 获取所有用户（用于生成钉钉手机号映射）
   */
  getAllUsers() {
    try {
      const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
      return stmt.all();
    } catch (error) {
      console.error('[用户] 获取用户列表失败:', error.message);
      return [];
    }
  }

  /**
   * 生成钉钉手机号映射
   */
  getDingtalkPhoneMap() {
    try {
      const users = this.getAllUsers();
      const phoneMap = {};
      
      for (const user of users) {
        if (user.phone) {
          phoneMap[user.username] = user.phone;
          if (user.display_name && user.display_name !== user.username) {
            phoneMap[user.display_name] = user.phone;
          }
        }
      }
      
      return phoneMap;
      
    } catch (error) {
      console.error('[用户] 生成手机号映射失败:', error.message);
      return {};
    }
  }

  /**
   * 删除用户
   */
  deleteUser(userId) {
    try {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      stmt.run(userId);
      console.log('[用户] 删除成功:', userId);
      return { success: true };
    } catch (error) {
      console.error('[用户] 删除失败:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// 创建单例
const userManager = new UserManager();

module.exports = userManager;
