/**
 * Token 认证模块
 * 
 * 功能：
 * - Token 生成/验证
 * - 权限检查
 * - Token 刷新/撤销
 */

import * as crypto from 'crypto';

interface TokenAuthConfig {
  tokenLength?: number;
  tokenExpiry?: number;
  refreshExpiry?: number;
  algorithm?: string;
}

interface TokenData {
  instanceId: string;
  name: string;
  role: string;
  permissions: string[];
  tokenExpiry: number;
  refreshExpiry: number;
  tokenHash?: string;
  revoked?: boolean;
  createdAt?: number;
  lastUsed?: number;
}

interface CachedToken extends TokenData {
  cachedAt: number;
}

interface GenerateTokenResult {
  token: string;
  refreshToken: string;
  tokenExpiry: number;
  refreshExpiry: number;
  role: string;
  permissions: string[];
}

type RoleKey = 'client' | 'instance' | 'admin';

class TokenAuth {
  private db: any;
  private config: {
    tokenLength: number;
    tokenExpiry: number;
    refreshExpiry: number;
    algorithm: string;
  };
  private tokenCache: Map<string, CachedToken>;
  private cacheExpiry: number;

  private permissions: Record<string, Record<string, string>>;
  private roles: Record<RoleKey, string[]>;

  constructor(db: any, options: TokenAuthConfig = {}) {
    this.db = db;
    this.config = {
      tokenLength: options.tokenLength || 32,
      tokenExpiry: options.tokenExpiry || 7 * 24 * 60 * 60 * 1000,
      refreshExpiry: options.refreshExpiry || 30 * 24 * 60 * 60 * 1000,
      algorithm: options.algorithm || 'sha256',
      ...options
    };

    this.tokenCache = new Map();
    this.cacheExpiry = 60000;

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

  async generateToken(instanceId: string, name: string, role: RoleKey = 'client', options: { tokenExpiry?: number; refreshExpiry?: number } = {}): Promise<GenerateTokenResult> {
    try {
      if (!this.roles[role]) {
        throw new Error(`Invalid role: ${role}`);
      }

      const rawToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const tokenHash = this._hashToken(rawToken);
      
      const refreshToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const refreshTokenHash = this._hashToken(refreshToken);

      const now = Date.now();
      const tokenExpiry = now + (options.tokenExpiry || this.config.tokenExpiry);
      const refreshExpiry = now + (options.refreshExpiry || this.config.refreshExpiry);

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

  async validateToken(rawToken: string): Promise<(TokenData & { valid: boolean }) | null> {
    try {
      if (!rawToken) {
        return null;
      }

      const tokenHash = this._hashToken(rawToken);
      const now = Date.now();

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

      const tokenData = await this._getTokenFromDb(tokenHash);
      if (!tokenData) {
        return null;
      }

      if (now > tokenData.tokenExpiry) {
        return null;
      }

      if (tokenData.revoked) {
        return null;
      }

      await this._updateLastUsed(tokenHash);

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

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string; tokenExpiry: number; refreshExpiry: number }> {
    try {
      const refreshTokenHash = this._hashToken(refreshToken);
      const now = Date.now();

      const tokenData = await this._getTokenByRefreshToken(refreshTokenHash);
      if (!tokenData) {
        throw new Error('Invalid refresh token');
      }

      if (now > tokenData.refreshExpiry) {
        throw new Error('Refresh token expired');
      }

      if (tokenData.revoked) {
        throw new Error('Token has been revoked');
      }

      const newRawToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const newTokenHash = this._hashToken(newRawToken);
      const newRefreshToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
      const newRefreshTokenHash = this._hashToken(newRefreshToken);

      const newTokenExpiry = now + this.config.tokenExpiry;
      const newRefreshExpiry = now + this.config.refreshExpiry;

      await this._updateToken(tokenData.tokenHash!, {
        tokenHash: newTokenHash,
        refreshTokenHash: newRefreshTokenHash,
        tokenExpiry: newTokenExpiry,
        refreshExpiry: newRefreshExpiry,
        lastUsed: now
      });

      this._removeCachedToken(tokenData.tokenHash!);

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

  async revokeToken(token: string): Promise<boolean> {
    try {
      const tokenHash = token.length === 64 ? token : this._hashToken(token);

      await this._revokeTokenInDb(tokenHash);
      this._removeCachedToken(tokenHash);

      return true;
    } catch (error) {
      console.error('[TokenAuth] 撤销 Token 失败:', error);
      return false;
    }
  }

  async checkPermission(token: string, permissions: string | string[]): Promise<{ valid: boolean; reason?: string; tokenData?: TokenData; missing?: string[] }> {
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
    } catch (error: any) {
      console.error('[TokenAuth] 检查权限失败:', error);
      return { valid: false, reason: error.message };
    }
  }

  async getTokenInfo(instanceId: string): Promise<any> {
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

  async listTokens(): Promise<any[]> {
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

  _hashToken(token: string): string {
    return crypto
      .createHash(this.config.algorithm)
      .update(token)
      .digest('hex');
  }

  _cacheToken(tokenHash: string, data: Omit<TokenData, 'cachedAt'>): void {
    this.tokenCache.set(tokenHash, {
      ...data,
      cachedAt: Date.now()
    });

    this._cleanExpiredCache();
  }

  _getCachedToken(tokenHash: string): CachedToken | null {
    const cached = this.tokenCache.get(tokenHash);
    if (!cached) return null;

    if (Date.now() - cached.cachedAt > this.cacheExpiry) {
      this.tokenCache.delete(tokenHash);
      return null;
    }

    return cached;
  }

  _removeCachedToken(tokenHash: string): void {
    this.tokenCache.delete(tokenHash);
  }

  _cleanExpiredCache(): void {
    const now = Date.now();
    for (const [hash, data] of this.tokenCache.entries()) {
      if (now - data.cachedAt > this.cacheExpiry) {
        this.tokenCache.delete(hash);
      }
    }
  }

  async _storeToken(data: any): Promise<void> {
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

  async _getTokenFromDb(tokenHash: string): Promise<TokenData | null> {
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

  async _getTokenByRefreshToken(refreshTokenHash: string): Promise<TokenData | null> {
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

  async _getTokenByInstance(instanceId: string): Promise<TokenData | null> {
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

  async _updateLastUsed(tokenHash: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET config = json_set(config, '$.lastUsed', ?)
      WHERE token = ?
    `);

    stmt.run(Date.now(), tokenHash);
  }

  async _updateToken(oldTokenHash: string, newData: any): Promise<void> {
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

  async _revokeTokenInDb(tokenHash: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET config = json_set(config, '$.revoked', 1),
          updated_at = ?
      WHERE token = ?
    `);

    stmt.run(Date.now(), tokenHash);
  }

  async _listAllTokens(): Promise<TokenData[]> {
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

  async cleanExpiredTokens(): Promise<number> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM relay_instances
      WHERE json_extract(config, '$.refreshExpiry') < ?
    `);

    const result = stmt.run(now);
    console.log(`[TokenAuth] 清理过期 Token: ${result.changes} 个`);
    return result.changes;
  }

  getStats(): { cacheSize: number; cacheExpiry: number; tokenExpiry: number; refreshExpiry: number } {
    return {
      cacheSize: this.tokenCache.size,
      cacheExpiry: this.cacheExpiry,
      tokenExpiry: this.config.tokenExpiry,
      refreshExpiry: this.config.refreshExpiry
    };
  }
}

export default TokenAuth;