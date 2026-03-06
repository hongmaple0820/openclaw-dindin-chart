/**
 * Skills Registry - 技能注册表
 * 
 * 功能：
 * - 技能注册/注销
 * - 技能发现
 * - 版本管理
 * - 依赖解析
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

/**
 * 技能定义接口
 */
export interface SkillDefinition {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  tags?: string[];
  source?: string;
  skill_path?: string;
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  permissions?: string[];
  mcp_compatible?: boolean;
  mcp_tools?: string[];
  enabled?: boolean;
  is_public?: boolean;
  priority?: number;
  dependencies?: string[];
  created_at?: number;
  updated_at?: number;
}

/**
 * 注册表选项接口
 */
interface RegistryOptions {
  skillsDir?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  [key: string]: unknown;
}

/**
 * 用户技能绑定接口
 */
interface UserSkillBinding {
  id: string;
  user_id: string;
  skill_id: string;
  config: Record<string, unknown> | null;
  enabled: boolean;
  pinned: boolean;
  name?: string;
  display_name?: string;
  description?: string;
  category?: string;
  version?: string;
  usage_count?: number;
  last_used_at?: number;
}

/**
 * 数据库接口
 */
interface Database {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  get(sql: string, params?: unknown[]): Promise<Record<string, unknown> | undefined>;
  all(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class SkillRegistry {
  db: Database;
  options: {
    skillsDir: string;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  
  // 内存缓存
  private cache: Map<string, SkillDefinition> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  
  // 技能定义缓存（用于依赖解析）
  definitions: Map<string, SkillDefinition> = new Map();

  constructor(db: Database, options: RegistryOptions = {}) {
    this.db = db;
    this.options = {
      skillsDir: options.skillsDir || './skills',
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 60000, // 1 minute
      ...options
    };
  }

  /**
   * 初始化（占位方法）
   */
  async init(): Promise<void> {
    // 由具体实现填充
  }

  /**
   * 注册技能
   */
  async register(skill: SkillDefinition): Promise<{ id: string; name: string; version: string; registered: boolean }> {
    const {
      id,
      name,
      display_name,
      description,
      version = '1.0.0',
      author,
      category = 'general',
      tags = [],
      source = 'custom',
      skill_path,
      config_schema,
      default_config,
      permissions = [],
      mcp_compatible = false,
      mcp_tools = [],
      enabled = true,
      is_public = false,
      priority = 0
    } = skill;

    if (!id || !name) {
      throw new Error('Skill id and name are required');
    }

    const now = Date.now();
    
    try {
      await this.db.run(`
        INSERT OR REPLACE INTO skills (
          id, name, display_name, description, version, author,
          category, tags, source, skill_path,
          config_schema, default_config, permissions,
          mcp_compatible, mcp_tools,
          enabled, is_public, priority,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, name, display_name || name, description, version, author,
        category, JSON.stringify(tags), source, skill_path,
        JSON.stringify(config_schema), JSON.stringify(default_config), JSON.stringify(permissions),
        mcp_compatible ? 1 : 0, JSON.stringify(mcp_tools),
        enabled ? 1 : 0, is_public ? 1 : 0, priority,
        now, now
      ]);

      // 更新内存缓存
      this.definitions.set(id, skill);
      this._invalidateCache(`skill:${id}`);
      this._invalidateCache('skills:all');

      return { id, name, version, registered: true };
    } catch (error) {
      throw new Error(`Failed to register skill: ${(error as Error).message}`);
    }
  }

  /**
   * 注销技能
   */
  async unregister(skillId: string): Promise<boolean> {
    try {
      const result = await this.db.run('DELETE FROM skills WHERE id = ?', [skillId]);
      
      this.definitions.delete(skillId);
      this._invalidateCache(`skill:${skillId}`);
      this._invalidateCache('skills:all');

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to unregister skill: ${(error as Error).message}`);
    }
  }

  /**
   * 获取技能
   */
  async get(identifier: string): Promise<SkillDefinition | null> {
    const cacheKey = `skill:${identifier}`;
    
    // 检查缓存
    if (this.options.cacheEnabled) {
      const cached = this._getFromCache(cacheKey);
      if (cached) return cached;
    }

    const skill = await this.db.get(`
      SELECT * FROM skills 
      WHERE id = ? OR name = ?
      AND enabled = 1
    `, [identifier, identifier]);

    if (!skill) return null;

    const result = this._rowToSkill(skill);
    
    // 缓存结果
    if (this.options.cacheEnabled) {
      this._setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * 列出所有技能
   */
  async list(filters: {
    category?: string;
    source?: string;
    enabled?: boolean;
    search?: string;
  } = {}): Promise<SkillDefinition[]> {
    const { category, source, enabled, search } = filters;
    
    let sql = 'SELECT * FROM skills WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    if (enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR display_name LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY priority DESC, name ASC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this._rowToSkill(row));
  }

  /**
   * 发现技能（按标签、类别等）
   */
  async discover(criteria: {
    tags?: string[];
    category?: string;
    permissions?: string[];
    mcp_compatible?: boolean;
  } = {}): Promise<SkillDefinition[]> {
    const { tags, category, permissions, mcp_compatible } = criteria;
    
    let sql = 'SELECT * FROM skills WHERE enabled = 1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (mcp_compatible) {
      sql += ' AND mcp_compatible = 1';
    }

    const rows = await this.db.all(sql, params);
    let skills = rows.map(row => this._rowToSkill(row));

    // 内存过滤标签
    if (tags && tags.length > 0) {
      skills = skills.filter(skill => 
        tags.some(tag => skill.tags?.includes(tag))
      );
    }

    // 内存过滤权限
    if (permissions && permissions.length > 0) {
      skills = skills.filter(skill =>
        permissions.every(perm => skill.permissions?.includes(perm))
      );
    }

    return skills;
  }

  /**
   * 更新技能版本
   */
  async updateVersion(
    skillId: string, 
    newVersion: string, 
    updates: Record<string, unknown> = {}
  ): Promise<SkillDefinition | null> {
    const now = Date.now();
    
    const fields = ['version = ?', 'updated_at = ?'];
    const params: unknown[] = [newVersion, now];

    for (const [key, value] of Object.entries(updates)) {
      if (['description', 'config_schema', 'default_config', 'permissions', 'mcp_tools', 'tags'].includes(key)) {
        fields.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    params.push(skillId);

    await this.db.run(`
      UPDATE skills SET ${fields.join(', ')} WHERE id = ?
    `, params);

    this._invalidateCache(`skill:${skillId}`);
    this._invalidateCache('skills:all');

    return this.get(skillId);
  }

  /**
   * 解析技能依赖
   */
  async resolveDependencies(skillId: string): Promise<{
    skillId: string;
    dependencies: Array<{ id: string; name: string; version: string; level: number }>;
    conflicts: Array<{ type: string; skill: string; path: string[] }>;
    resolved: boolean;
  }> {
    const visited = new Set<string>();
    const dependencies: Array<{ id: string; name: string; version: string; level: number }> = [];
    const conflicts: Array<{ type: string; skill: string; path: string[] }> = [];

    const resolve = async (id: string, path: string[] = []): Promise<void> => {
      if (visited.has(id)) {
        return; // 已处理
      }

      if (path.includes(id)) {
        conflicts.push({
          type: 'circular',
          skill: id,
          path: [...path, id]
        });
        return;
      }

      const skill = await this.get(id);
      if (!skill) {
        conflicts.push({
          type: 'not_found',
          skill: id,
          path
        });
        return;
      }

      visited.add(id);
      dependencies.push({
        id: skill.id,
        name: skill.name,
        version: skill.version || '0.0.0',
        level: path.length
      });

      // 解析依赖（如果有）
      if (skill.dependencies && skill.dependencies.length > 0) {
        for (const dep of skill.dependencies) {
          await resolve(dep, [...path, id]);
        }
      }
    };

    await resolve(skillId);

    return {
      skillId,
      dependencies: dependencies.sort((a, b) => a.level - b.level),
      conflicts,
      resolved: conflicts.length === 0
    };
  }

  /**
   * 检查版本兼容性
   */
  checkVersion(version: string, constraint: string): boolean {
    // 简化版 semver 检查
    const parseVersion = (v: string): number[] => v.split('.').map(Number);
    const parseConstraint = (c: string): { op: string; version: number[] } => {
      const match = c.match(/^([=<>~^]*)(\d+\.\d+\.\d+)$/);
      if (!match) return { op: '=', version: parseVersion(c) };
      return { op: match[1] || '=', version: parseVersion(match[2]) };
    };

    const v = parseVersion(version);
    const { op, version: c } = parseConstraint(constraint);

    const compare = (a: number[], b: number[]): number => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const ai = a[i] || 0;
        const bi = b[i] || 0;
        if (ai < bi) return -1;
        if (ai > bi) return 1;
      }
      return 0;
    };

    const cmp = compare(v, c);

    switch (op) {
      case '=': return cmp === 0;
      case '>': return cmp > 0;
      case '>=': return cmp >= 0;
      case '<': return cmp < 0;
      case '<=': return cmp <= 0;
      case '~': return v[0] === c[0] && v[1] === c[1] && cmp >= 0;
      case '^': return v[0] === c[0] && cmp >= 0;
      default: return cmp === 0;
    }
  }

  /**
   * 获取用户技能绑定
   */
  async getUserSkill(userId: string, skillId: string): Promise<UserSkillBinding | null> {
    const row = await this.db.get(`
      SELECT * FROM user_skills 
      WHERE user_id = ? AND skill_id = ?
    `, [userId, skillId]);

    if (!row) return null;

    return {
      id: row.id as string,
      user_id: row.user_id as string,
      skill_id: row.skill_id as string,
      config: row.config ? JSON.parse(row.config as string) : null,
      enabled: row.enabled === 1,
      pinned: row.pinned === 1
    };
  }

  /**
   * 绑定用户技能
   */
  async bindUserSkill(
    userId: string, 
    skillId: string, 
    config: Record<string, unknown> | null = null
  ): Promise<UserSkillBinding> {
    const id = `us_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await this.db.run(`
      INSERT OR REPLACE INTO user_skills (
        id, user_id, skill_id, config, enabled, pinned, created_at
      ) VALUES (?, ?, ?, ?, 1, 0, ?)
    `, [id, userId, skillId, config ? JSON.stringify(config) : null, now]);

    return this.getUserSkill(userId, skillId)!;
  }

  /**
   * 解绑用户技能
   */
  async unbindUserSkill(userId: string, skillId: string): Promise<boolean> {
    const result = await this.db.run(`
      DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?
    `, [userId, skillId]);

    return result.changes > 0;
  }

  /**
   * 获取用户所有技能
   */
  async getUserSkills(userId: string): Promise<UserSkillBinding[]> {
    const rows = await this.db.all(`
      SELECT us.*, s.name, s.display_name, s.description, s.category, s.version
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      WHERE us.user_id = ? AND us.enabled = 1 AND s.enabled = 1
      ORDER BY us.pinned DESC, us.usage_count DESC
    `, [userId]);

    return rows.map(row => ({
      id: row.id as string,
      user_id: row.user_id as string,
      skill_id: row.skill_id as string,
      config: row.config ? JSON.parse(row.config as string) : null,
      enabled: row.enabled === 1,
      pinned: row.pinned === 1,
      name: row.name as string,
      display_name: row.display_name as string,
      description: row.description as string,
      category: row.category as string,
      version: row.version as string
    }));
  }

  /**
   * 记录技能使用
   */
  async recordUsage(userId: string, skillId: string): Promise<void> {
    const now = Date.now();
    await this.db.run(`
      UPDATE user_skills 
      SET usage_count = usage_count + 1, last_used_at = ?
      WHERE user_id = ? AND skill_id = ?
    `, [now, userId, skillId]);
  }

  // ==================== 私有方法 ====================

  /**
   * 数据库行转技能对象
   */
  private _rowToSkill(row: Record<string, unknown>): SkillDefinition {
    return {
      id: row.id as string,
      name: row.name as string,
      display_name: row.display_name as string | undefined,
      description: row.description as string | undefined,
      version: row.version as string | undefined,
      author: row.author as string | undefined,
      category: row.category as string | undefined,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      source: row.source as string | undefined,
      skill_path: row.skill_path as string | undefined,
      config_schema: row.config_schema ? JSON.parse(row.config_schema as string) : undefined,
      default_config: row.default_config ? JSON.parse(row.default_config as string) : undefined,
      permissions: row.permissions ? JSON.parse(row.permissions as string) : [],
      mcp_compatible: row.mcp_compatible === 1,
      mcp_tools: row.mcp_tools ? JSON.parse(row.mcp_tools as string) : [],
      enabled: row.enabled === 1,
      is_public: row.is_public === 1,
      priority: row.priority as number | undefined,
      created_at: row.created_at as number | undefined,
      updated_at: row.updated_at as number | undefined
    };
  }

  /**
   * 从缓存获取
   */
  private _getFromCache(key: string): SkillDefinition | null {
    if (!this.options.cacheEnabled) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  /**
   * 设置缓存
   */
  private _setCache(key: string, value: SkillDefinition): void {
    if (!this.options.cacheEnabled) return;

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 使缓存失效
   */
  private _invalidateCache(key: string): void {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }
}