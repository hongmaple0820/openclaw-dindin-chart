/**
 * Skills Registry - 技能注册表
 * 
 * 功能：
 * - 技能注册/注销
 * - 技能发现
 * - 版本管理
 * - 依赖解析
 */

const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');

class SkillRegistry {
  constructor(db, options = {}) {
    this.db = db;
    this.options = {
      skillsDir: options.skillsDir || './skills',
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 60000, // 1 minute
      ...options
    };
    
    // 内存缓存
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // 技能定义缓存（用于依赖解析）
    this.definitions = new Map();
  }

  /**
   * 注册技能
   * @param {Object} skill - 技能定义
   * @returns {Promise<Object>} 注册结果
   */
  async register(skill) {
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
      throw new Error(`Failed to register skill: ${error.message}`);
    }
  }

  /**
   * 注销技能
   * @param {string} skillId - 技能ID
   * @returns {Promise<boolean>}
   */
  async unregister(skillId) {
    try {
      const result = await this.db.run('DELETE FROM skills WHERE id = ?', [skillId]);
      
      this.definitions.delete(skillId);
      this._invalidateCache(`skill:${skillId}`);
      this._invalidateCache('skills:all');

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to unregister skill: ${error.message}`);
    }
  }

  /**
   * 获取技能
   * @param {string} identifier - 技能ID或名称
   * @returns {Promise<Object|null>}
   */
  async get(identifier) {
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
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const { category, source, enabled, search } = filters;
    
    let sql = 'SELECT * FROM skills WHERE 1=1';
    const params = [];

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
   * @param {Object} criteria - 发现条件
   * @returns {Promise<Array>}
   */
  async discover(criteria = {}) {
    const { tags, category, permissions, mcp_compatible } = criteria;
    
    let sql = 'SELECT * FROM skills WHERE enabled = 1';
    const params = [];

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
        tags.some(tag => skill.tags.includes(tag))
      );
    }

    // 内存过滤权限
    if (permissions && permissions.length > 0) {
      skills = skills.filter(skill =>
        permissions.every(perm => skill.permissions.includes(perm))
      );
    }

    return skills;
  }

  /**
   * 更新技能版本
   * @param {string} skillId - 技能ID
   * @param {string} newVersion - 新版本号
   * @param {Object} updates - 其他更新
   * @returns {Promise<Object>}
   */
  async updateVersion(skillId, newVersion, updates = {}) {
    const now = Date.now();
    
    const fields = ['version = ?', 'updated_at = ?'];
    const params = [newVersion, now];

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
   * @param {string} skillId - 技能ID
   * @returns {Promise<Object>} 依赖图
   */
  async resolveDependencies(skillId) {
    const visited = new Set();
    const dependencies = [];
    const conflicts = [];

    const resolve = async (id, path = []) => {
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
        version: skill.version,
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
   * @param {string} version - 当前版本
   * @param {string} constraint - 版本约束 (semver)
   * @returns {boolean}
   */
  checkVersion(version, constraint) {
    // 简化版 semver 检查
    const parseVersion = (v) => v.split('.').map(Number);
    const parseConstraint = (c) => {
      const match = c.match(/^([=<>~^]*)(\d+\.\d+\.\d+)$/);
      if (!match) return { op: '=', version: parseVersion(c) };
      return { op: match[1] || '=', version: parseVersion(match[2]) };
    };

    const v = parseVersion(version);
    const { op, version: c } = parseConstraint(constraint);

    const compare = (a, b) => {
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
   * @param {string} userId - 用户ID
   * @param {string} skillId - 技能ID
   * @returns {Promise<Object|null>}
   */
  async getUserSkill(userId, skillId) {
    const row = await this.db.get(`
      SELECT * FROM user_skills 
      WHERE user_id = ? AND skill_id = ?
    `, [userId, skillId]);

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      enabled: row.enabled === 1,
      pinned: row.pinned === 1
    };
  }

  /**
   * 绑定用户技能
   * @param {string} userId - 用户ID
   * @param {string} skillId - 技能ID
   * @param {Object} config - 用户配置
   * @returns {Promise<Object>}
   */
  async bindUserSkill(userId, skillId, config = null) {
    const id = `us_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await this.db.run(`
      INSERT OR REPLACE INTO user_skills (
        id, user_id, skill_id, config, enabled, pinned, created_at
      ) VALUES (?, ?, ?, ?, 1, 0, ?)
    `, [id, userId, skillId, config ? JSON.stringify(config) : null, now]);

    return this.getUserSkill(userId, skillId);
  }

  /**
   * 解绑用户技能
   * @param {string} userId - 用户ID
   * @param {string} skillId - 技能ID
   * @returns {Promise<boolean>}
   */
  async unbindUserSkill(userId, skillId) {
    const result = await this.db.run(`
      DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?
    `, [userId, skillId]);

    return result.changes > 0;
  }

  /**
   * 获取用户所有技能
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>}
   */
  async getUserSkills(userId) {
    const rows = await this.db.all(`
      SELECT us.*, s.name, s.display_name, s.description, s.category, s.version
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      WHERE us.user_id = ? AND us.enabled = 1 AND s.enabled = 1
      ORDER BY us.pinned DESC, us.usage_count DESC
    `, [userId]);

    return rows.map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      enabled: row.enabled === 1,
      pinned: row.pinned === 1
    }));
  }

  /**
   * 记录技能使用
   * @param {string} userId - 用户ID
   * @param {string} skillId - 技能ID
   */
  async recordUsage(userId, skillId) {
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
   * @private
   */
  _rowToSkill(row) {
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      description: row.description,
      version: row.version,
      author: row.author,
      category: row.category,
      tags: row.tags ? JSON.parse(row.tags) : [],
      source: row.source,
      skill_path: row.skill_path,
      config_schema: row.config_schema ? JSON.parse(row.config_schema) : null,
      default_config: row.default_config ? JSON.parse(row.default_config) : null,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      mcp_compatible: row.mcp_compatible === 1,
      mcp_tools: row.mcp_tools ? JSON.parse(row.mcp_tools) : [],
      enabled: row.enabled === 1,
      is_public: row.is_public === 1,
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * 从缓存获取
   * @private
   */
  _getFromCache(key) {
    if (!this.options.cacheEnabled) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * 设置缓存
   * @private
   */
  _setCache(key, value) {
    if (!this.options.cacheEnabled) return;

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 使缓存失效
   * @private
   */
  _invalidateCache(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }
}

module.exports = { SkillRegistry };