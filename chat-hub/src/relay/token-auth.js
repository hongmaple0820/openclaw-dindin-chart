/**
 * Token 认证模块
 * 
 * 功能：
 * - Token 生成/验证
 * - 权限检查
 * - Token 刷新/撤销
 */

const crypto = require('crypto');

class TokenAuth {
  constructor(db, options = {}) {
    this.db = db;
    this.config = {
      tokenLength: options.tokenLength || 32,
      tokenExpiry: options.tokenExpiry || 7 * 24 * 60 * 60 * 1000, // 7 天
      refreshExpiry: options.refreshExpiry || 30 * 24 * 60 * 60 * 1000, // 30 天
      algorithm: options.algorithm || 'sha256',
      ...options
    };

    // Token 缓存（减少数据库查询）
    this.tokenCache = new Map();
    this.cacheExpiry = 60000; // 1 分钟缓存

    // 权限定义
    this.permissions = {
      message: {
        read: 'message:read',
        write: 'message:write',
        broadcast: 'message:broadcast'
      },
      file: {
        read: 'file:read',
        write: 'file:write',
        delete: 'file:delete'
      },
      sync: {
        push: 'sync:push',
        pull: 'sync:pull',
        full: 'sync:full'
      },
      admin: {
        manage: 'admin:manage',
        token: 'admin:token'
      }
    };

    // 默认角色权限
    this.roles = {
      client: [
        'message:read', 'message:write',
        'file:read', 'file:write',
        'sync:pull'
      ],
      instance: [
        'message:read', 'message:write', 'message:broadcast',
        'file:read', 'file:write', 'file:delete',
        'sync:push', 'sync:pull', 'sync:full'
      ],
      admin: [
        'message:read', 'message:write', 'message:broadcast',
        'file:read', 'file:write', 'file:delete',
        'sync:push', 'sync:pull', 'sync:full',
        'admin:manage', 'admin:token'
      ]
    };
  }

  /**
   * 生成 Token
   * @param {string} instanceId 实例 ID
   * @param {string} name 实例名称
   * @param {string} role 角色: client/instance/admin
   * @param {Object} options 可选配置
   */
  async generateToken(instanceId, name, role = 'client', options = {}) {
    try {
      // 验证角色
      if (!this.roles[role]) {
        throw new Error(`Invalid role: ${role}`);
      }

      // 生成原始 token
      const rawToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      
      // 生成 token hash（存储用）
      const tokenHash = this._hashToken(rawToken);
      
      // 生成 refresh token
      const refreshToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const refreshTokenHash = this._hashToken(refreshToken);

      // 计算过期时间
      const now = Date.now();
      const tokenExpiry = now + (options.tokenExpiry || this.config.tokenExpiry);
      const refreshExpiry = now + (options.refreshExpiry || this.config.refreshExpiry);

      // 存储到数据库
      await this._storeToken({
        instanceId,
        name,
        tokenHash,
        refreshTokenHash,
        role,
        permissions: this.roles[role],
        tokenExpiry,
        refreshExpiry,
        createdAt: now,
        lastUsed: now
      });

      // 缓存 token
      this._cacheToken(tokenHash, {
        instanceId,
        name,
        role,
        permissions: this.roles[role],
        tokenExpiry,
        refreshExpiry
      });

      return {
        token: rawToken,
        refreshToken,
        tokenExpiry,
        refreshExpiry,
        role,
        permissions: this.roles[role]
      };
    } catch (error) {
      console.error('[TokenAuth] 生成 Token 失败:', error);
      throw error;
    }
  }

  /**
   * 验证 Token
   * @param {string} rawToken 原始 token
   * @returns {Object|null} 验证结果
   */
  async validateToken(rawToken) {
    try {
      if (!rawToken) {
        return null;
      }

      const tokenHash = this._hashToken(rawToken);
      const now = Date.now();

      // 先检查缓存
      const cached = this._getCachedToken(tokenHash);
      if (cached) {
        if (now > cached.tokenExpiry) {
          this._removeCachedToken(tokenHash);
          return null;
        }
        return {
          valid: true,
          ...cached,
          tokenHash
        };
      }

      // 查询数据库
      const tokenData = await this._getTokenFromDb(tokenHash);
      if (!tokenData) {
        return null;
      }

      // 检查过期
      if (now > tokenData.tokenExpiry) {
        return null;
      }

      // 检查是否被撤销
      if (tokenData.revoked) {
        return null;
      }

      // 更新最后使用时间
      await this._updateLastUsed(tokenHash);

      // 缓存
      this._cacheToken(tokenHash, {
        instanceId: tokenData.instanceId,
        name: tokenData.name,
        role: tokenData.role,
        permissions: tokenData.permissions,
        tokenExpiry: tokenData.tokenExpiry,
        refreshExpiry: tokenData.refreshExpiry
      });

      return {
        valid: true,
        instanceId: tokenData.instanceId,
        name: tokenData.name,
        role: tokenData.role,
        permissions: tokenData.permissions,
        tokenExpiry: tokenData.tokenExpiry,
        refreshExpiry: tokenData.refreshExpiry,
        tokenHash
      };
    } catch (error) {
      console.error('[TokenAuth] 验证 Token 失败:', error);
      return null;
    }
  }

  /**
   * 刷新 Token
   * @param {string} refreshToken 刷新 token
   */
  async refreshToken(refreshToken) {
    try {
      const refreshTokenHash = this._hashToken(refreshToken);
      const now = Date.now();

      // 查询 refresh token
      const tokenData = await this._getTokenByRefreshToken(refreshTokenHash);
      if (!tokenData) {
        throw new Error('Invalid refresh token');
      }

      // 检查是否过期
      if (now > tokenData.refreshExpiry) {
        throw new Error('Refresh token expired');
      }

      // 检查是否被撤销
      if (tokenData.revoked) {
        throw new Error('Token has been revoked');
      }

      // 生成新的 token
      const newRawToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const newTokenHash = this._hashToken(newRawToken);
      const newRefreshToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const newRefreshTokenHash = this._hashToken(newRefreshToken);

      // 更新数据库
      const newTokenExpiry = now + this.config.tokenExpiry;
      const newRefreshExpiry = now + this.config.refreshExpiry;

      await this._updateToken(tokenData.tokenHash, {
        tokenHash: newTokenHash,
        refreshTokenHash: newRefreshTokenHash,
        tokenExpiry: newTokenExpiry,
        refreshExpiry: newRefreshExpiry,
        lastUsed: now
      });

      // 移除旧缓存
      this._removeCachedToken(tokenData.tokenHash);

      // 缓存新 token
      this._cacheToken(newTokenHash, {
        instanceId: tokenData.instanceId,
        name: tokenData.name,
        role: tokenData.role,
        permissions: tokenData.permissions,
        tokenExpiry: newTokenExpiry,
        refreshExpiry: newRefreshExpiry
      });

      return {
        token: newRawToken,
        refreshToken: newRefreshToken,
        tokenExpiry: newTokenExpiry,
        refreshExpiry: newRefreshExpiry
      };
    } catch (error) {
      console.error('[TokenAuth] 刷新 Token 失败:', error);
      throw error;
    }
  }

  /**
   * 撤销 Token
   * @param {string} tokenHash token hash 或原始 token
   */
  async revokeToken(token) {
    try {
      const tokenHash = token.length === 64 ? token : this._hashToken(token);

      // 标记为已撤销
      await this._revokeTokenInDb(tokenHash);

      // 移除缓存
      this._removeCachedToken(tokenHash);

      return true;
    } catch (error) {
      console.error('[TokenAuth] 撤销 Token 失败:', error);
      return false;
    }
  }

  /**
   * 检查权限
   * @param {string} token 
   * @param {string|string[]} permissions 
   */
  async checkPermission(token, permissions) {
    try {
      const tokenData = await this.validateToken(token);
      if (!tokenData) {
        return { valid: false, reason: 'Invalid token' };
      }

      const requiredPerms = Array.isArray(permissions) ? permissions : [permissions];
      const hasAll = requiredPerms.every(perm => 
        tokenData.permissions.includes(perm)
      );

      return {
        valid: hasAll,
        tokenData,
        missing: hasAll ? [] : requiredPerms.filter(p => !tokenData.permissions.includes(p))
      };
    } catch (error) {
      console.error('[TokenAuth] 检查权限失败:', error);
      return { valid: false, reason: error.message };
    }
  }

  /**
   * 获取实例的 Token 信息
   * @param {string} instanceId 
   */
  async getTokenInfo(instanceId) {
    try {
      const tokenData = await this._getTokenByInstance(instanceId);
      if (!tokenData) {
        return null;
      }

      return {
        instanceId: tokenData.instanceId,
        name: tokenData.name,
        role: tokenData.role,
        permissions: tokenData.permissions,
        tokenExpiry: tokenData.tokenExpiry,
        refreshExpiry: tokenData.refreshExpiry,
        createdAt: tokenData.createdAt,
        lastUsed: tokenData.lastUsed
      };
    } catch (error) {
      console.error('[TokenAuth] 获取 Token 信息失败:', error);
      return null;
    }
  }

  /**
   * 列出所有实例的 Token
   */
  async listTokens() {
    try {
      const tokens = await this._listAllTokens();
      return tokens.map(t => ({
        instanceId: t.instanceId,
        name: t.name,
        role: t.role,
        tokenExpiry: t.tokenExpiry,
        refreshExpiry: t.refreshExpiry,
        createdAt: t.createdAt,
        lastUsed: t.lastUsed,
        revoked: t.revoked
      }));
    } catch (error) {
      console.error('[TokenAuth] 列出 Token 失败:', error);
      return [];
    }
  }

  // ==================== 内部方法 ====================

  /**
   * Hash Token
   */
  _hashToken(token) {
    return crypto
      .createHash(this.config.algorithm)
      .update(token)
      .digest('hex');
  }

  /**
   * 缓存 Token
   */
  _cacheToken(tokenHash, data) {
    this.tokenCache.set(tokenHash, {
      ...data,
      cachedAt: Date.now()
    });

    // 清理过期缓存
    this._cleanExpiredCache();
  }

  /**
   * 获取缓存的 Token
   */
  _getCachedToken(tokenHash) {
    const cached = this.tokenCache.get(tokenHash);
    if (!cached) return null;

    // 检查缓存是否过期
    if (Date.now() - cached.cachedAt > this.cacheExpiry) {
      this.tokenCache.delete(tokenHash);
      return null;
    }

    return cached;
  }

  /**
   * 移除缓存的 Token
   */
  _removeCachedToken(tokenHash) {
    this.tokenCache.delete(tokenHash);
  }

  /**
   * 清理过期缓存
   */
  _cleanExpiredCache() {
    const now = Date.now();
    for (const [hash, data] of this.tokenCache.entries()) {
      if (now - data.cachedAt > this.cacheExpiry) {
        this.tokenCache.delete(hash);
      }
    }
  }

  /**
   * 存储到数据库
   */
  async _storeToken(data) {
    const stmt = this.db.prepare(`
      INSERT INTO relay_instances (id, name, token, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.instanceId,
      data.name,
      data.tokenHash,
      JSON.stringify({
        refreshTokenHash: data.refreshTokenHash,
        role: data.role,
        permissions: data.permissions,
        tokenExpiry: data.tokenExpiry,
        refreshExpiry: data.refreshExpiry,
        lastUsed: data.lastUsed
      }),
      data.createdAt,
      data.createdAt
    );
  }

  /**
   * 从数据库获取 Token
   */
  async _getTokenFromDb(tokenHash) {
    const stmt = this.db.prepare(`
      SELECT id, name, token, config, created_at, updated_at
      FROM relay_instances
      WHERE token = ?
    `);

    const row = stmt.get(tokenHash);
    if (!row) return null;

    const config = JSON.parse(row.config || '{}');
    return {
      instanceId: row.id,
      name: row.name,
      tokenHash: row.token,
      ...config
    };
  }

  /**
   * 通过 Refresh Token 获取 Token
   */
  async _getTokenByRefreshToken(refreshTokenHash) {
    const stmt = this.db.prepare(`
      SELECT id, name, token, config, created_at, updated_at
      FROM relay_instances
      WHERE json_extract(config, '$.refreshTokenHash') = ?
    `);

    const row = stmt.get(refreshTokenHash);
    if (!row) return null;

    const config = JSON.parse(row.config || '{}');
    return {
      instanceId: row.id,
      name: row.name,
      tokenHash: row.token,
      ...config
    };
  }

  /**
   * 通过实例 ID 获取 Token
   */
  async _getTokenByInstance(instanceId) {
    const stmt = this.db.prepare(`
      SELECT id, name, token, config, created_at, updated_at
      FROM relay_instances
      WHERE id = ?
    `);

    const row = stmt.get(instanceId);
    if (!row) return null;

    const config = JSON.parse(row.config || '{}');
    return {
      instanceId: row.id,
      name: row.name,
      tokenHash: row.token,
      ...config
    };
  }

  /**
   * 更新最后使用时间
   */
  async _updateLastUsed(tokenHash) {
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET config = json_set(config, '$.lastUsed', ?)
      WHERE token = ?
    `);

    stmt.run(Date.now(), tokenHash);
  }

  /**
   * 更新 Token
   */
  async _updateToken(oldTokenHash, newData) {
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET token = ?,
          config = json_set(
            config,
            '$.refreshTokenHash', ?,
            '$.tokenExpiry', ?,
            '$.refreshExpiry', ?,
            '$.lastUsed', ?
          ),
          updated_at = ?
      WHERE token = ?
    `);

    stmt.run(
      newData.tokenHash,
      newData.refreshTokenHash,
      newData.tokenExpiry,
      newData.refreshExpiry,
      newData.lastUsed,
      newData.lastUsed,
      oldTokenHash
    );
  }

  /**
   * 撤销 Token
   */
  async _revokeTokenInDb(tokenHash) {
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET config = json_set(config, '$.revoked', 1),
          updated_at = ?
      WHERE token = ?
    `);

    stmt.run(Date.now(), tokenHash);
  }

  /**
   * 列出所有 Token
   */
  async _listAllTokens() {
    const stmt = this.db.prepare(`
      SELECT id, name, token, config, created_at, updated_at
      FROM relay_instances
      ORDER BY created_at DESC
    `);

    const rows = stmt.all();
    return rows.map(row => {
      const config = JSON.parse(row.config || '{}');
      return {
        instanceId: row.id,
        name: row.name,
        tokenHash: row.token,
        ...config
      };
    });
  }

  /**
   * 清理过期 Token
   */
  async cleanExpiredTokens() {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM relay_instances
      WHERE json_extract(config, '$.refreshExpiry') < ?
    `);

    const result = stmt.run(now);
    console.log(`[TokenAuth] 清理过期 Token: ${result.changes} 个`);
    return result.changes;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      cacheSize: this.tokenCache.size,
      cacheExpiry: this.cacheExpiry,
      tokenExpiry: this.config.tokenExpiry,
      refreshExpiry: this.config.refreshExpiry
    };
  }
}

module.exports = TokenAuth;