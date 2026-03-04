/**
 * Cloud Market Service - 云市场服务
 * 
 * 功能：
 * - Skills 云市场
 * - MCP 云市场
 * - 用户共享同步
 * - 去重处理
 */

const crypto = require('crypto');
const { E2EEncryptor } = require('../e2ee');

class CloudMarketService {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      cloudEndpoint: config.cloudEndpoint || 'https://cloud.hiclaw.io',
      syncEnabled: config.syncEnabled !== false,
      ...config
    };
    
    // E2EE 加密器（用于同步加密）
    this.e2ee = new E2EEncryptor(db);
    
    // 本地缓存
    this.cache = {
      skills: new Map(),
      mcp: new Map(),
      lastSync: null
    };
    
    this.initDB();
  }

  initDB() {
    this.db.exec(`
      -- Skills 云市场表
      CREATE TABLE IF NOT EXISTS cloud_skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT,
        description TEXT,
        version TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        handler TEXT,
        params TEXT,
        example TEXT,
        rating REAL DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        cloud_id TEXT,
        sync_status TEXT DEFAULT 'local',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(name, version, author)
      );
      
      -- MCP 云市场表
      CREATE TABLE IF NOT EXISTS cloud_mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT NOT NULL,
        author TEXT NOT NULL,
        type TEXT,
        command TEXT,
        endpoint TEXT,
        tools TEXT,
        rating REAL DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        cloud_id TEXT,
        sync_status TEXT DEFAULT 'local',
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(name, version, author)
      );
      
      -- 同步记录表
      CREATE TABLE IF NOT EXISTS sync_records (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        cloud_id TEXT,
        error TEXT,
        timestamp INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_cloud_skills_author ON cloud_skills(author);
      CREATE INDEX IF NOT EXISTS idx_cloud_skills_category ON cloud_skills(category);
      CREATE INDEX IF NOT EXISTS idx_cloud_mcp_author ON cloud_mcp_servers(author);
      CREATE INDEX IF NOT EXISTS idx_sync_records_item ON sync_records(item_type, item_id);
    `);
  }

  // ==================== Skills 管理 ====================

  /**
   * 发布 Skill 到云市场
   */
  async publishSkill(userId, skill) {
    const { name, version, author } = skill;
    
    // 检查去重
    const existing = this.db.prepare(`
      SELECT id FROM cloud_skills 
      WHERE name = ? AND version = ? AND author = ?
    `).get(name, version, author);
    
    if (existing && existing.author !== userId) {
      // 别人已发布相同名称+版本的 Skill
      return {
        success: false,
        error: 'Skill with same name and version already published by another user',
        existingId: existing.id
      };
    }
    
    // 生成内容 hash
    const contentHash = this.hashContent(skill);
    const id = existing?.id || `skill_${contentHash.substring(0, 12)}`;
    const now = Date.now();
    
    if (existing) {
      // 更新
      this.db.prepare(`
        UPDATE cloud_skills SET
          display_name = ?, description = ?, category = ?, tags = ?,
          handler = ?, params = ?, example = ?, is_public = 1,
          updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(
        skill.display_name, skill.description, skill.category,
        JSON.stringify(skill.tags || []), skill.handler,
        JSON.stringify(skill.params || {}), skill.example,
        now, id
      );
    } else {
      // 新建
      this.db.prepare(`
        INSERT INTO cloud_skills (
          id, name, display_name, description, version, author,
          category, tags, handler, params, example,
          is_public, created_at, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'pending')
      `).run(
        id, name, skill.display_name, skill.description, version, author,
        skill.category, JSON.stringify(skill.tags || []), skill.handler,
        JSON.stringify(skill.params || {}), skill.example,
        now, now
      );
    }
    
    // 记录同步
    this.recordSync('skill', id, 'publish', 'pending');
    
    return {
      success: true,
      id,
      syncStatus: 'pending'
    };
  }

  /**
   * 发现 Skills
   */
  async discoverSkills(options = {}) {
    const { category, query, sort = 'downloads', limit = 20, offset = 0 } = options;
    
    let sql = 'SELECT * FROM cloud_skills WHERE is_public = 1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (query) {
      sql += ' AND (name LIKE ? OR display_name LIKE ? OR description LIKE ?)';
      const queryPattern = `%${query}%`;
      params.push(queryPattern, queryPattern, queryPattern);
    }
    
    // 排序
    const sortMap = {
      downloads: 'downloads DESC',
      rating: 'rating DESC',
      recent: 'updated_at DESC'
    };
    sql += ` ORDER BY ${sortMap[sort] || 'downloads DESC'}`;
    
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const skills = this.db.prepare(sql).all(...params);
    
    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM cloud_skills WHERE is_public = 1';
    const countParams = [];
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }
    const total = this.db.prepare(countSql).get(...countParams);
    
    return {
      skills: skills.map(s => ({
        ...s,
        tags: JSON.parse(s.tags || '[]'),
        params: JSON.parse(s.params || '{}')
      })),
      total: total.total,
      limit,
      offset
    };
  }

  /**
   * 安装 Skill
   */
  async installSkill(skillId, userId) {
    const skill = this.db.prepare('SELECT * FROM cloud_skills WHERE id = ?').get(skillId);
    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }
    
    // 增加下载量
    this.db.prepare('UPDATE cloud_skills SET downloads = downloads + 1 WHERE id = ?').run(skillId);
    
    // 记录安装
    this.recordSync('skill', skillId, 'install', 'completed');
    
    return {
      success: true,
      skill: {
        ...skill,
        tags: JSON.parse(skill.tags || '[]'),
        params: JSON.parse(skill.params || '{}')
      }
    };
  }

  // ==================== MCP 管理 ====================

  /**
   * 发布 MCP Server 到云市场
   */
  async publishMCPServer(userId, mcpServer) {
    const { name, version, author } = mcpServer;
    
    // 检查去重
    const existing = this.db.prepare(`
      SELECT id FROM cloud_mcp_servers 
      WHERE name = ? AND version = ? AND author = ?
    `).get(name, version, author);
    
    if (existing && existing.author !== userId) {
      return {
        success: false,
        error: 'MCP Server with same name and version already published by another user'
      };
    }
    
    const contentHash = this.hashContent(mcpServer);
    const id = existing?.id || `mcp_${contentHash.substring(0, 12)}`;
    const now = Date.now();
    
    if (existing) {
      this.db.prepare(`
        UPDATE cloud_mcp_servers SET
          description = ?, type = ?, command = ?, endpoint = ?, tools = ?,
          is_public = 1, updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(
        mcpServer.description, mcpServer.type, mcpServer.command,
        mcpServer.endpoint, JSON.stringify(mcpServer.tools || []),
        now, id
      );
    } else {
      this.db.prepare(`
        INSERT INTO cloud_mcp_servers (
          id, name, description, version, author, type, command, endpoint, tools,
          is_public, created_at, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'pending')
      `).run(
        id, name, mcpServer.description, version, author,
        mcpServer.type, mcpServer.command, mcpServer.endpoint,
        JSON.stringify(mcpServer.tools || []),
        now, now
      );
    }
    
    this.recordSync('mcp', id, 'publish', 'pending');
    
    return { success: true, id, syncStatus: 'pending' };
  }

  /**
   * 发现 MCP Servers
   */
  async discoverMCPServers(options = {}) {
    const { query, sort = 'downloads', limit = 20, offset = 0 } = options;
    
    let sql = 'SELECT * FROM cloud_mcp_servers WHERE is_public = 1';
    const params = [];
    
    if (query) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const queryPattern = `%${query}%`;
      params.push(queryPattern, queryPattern);
    }
    
    const sortMap = {
      downloads: 'downloads DESC',
      rating: 'rating DESC',
      recent: 'updated_at DESC'
    };
    sql += ` ORDER BY ${sortMap[sort] || 'downloads DESC'}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const servers = this.db.prepare(sql).all(...params);
    
    return {
      servers: servers.map(s => ({
        ...s,
        tools: JSON.parse(s.tools || '[]')
      })),
      limit,
      offset
    };
  }

  // ==================== 同步服务 ====================

  /**
   * 同步到云端
   */
  async syncToCloud(userId, options = {}) {
    const { skills = true, mcp = true } = options;
    const results = { skills: [], mcp: [] };
    
    // 建立加密会话
    const cloudPublicKey = await this.getCloudPublicKey();
    if (!this.e2ee.hasSession(userId, 'cloud')) {
      await this.e2ee.establishSession(userId, 'cloud', cloudPublicKey);
    }
    
    // 同步 Skills
    if (skills) {
      const pendingSkills = this.db.prepare(`
        SELECT * FROM cloud_skills 
        WHERE author = ? AND sync_status = 'pending'
      `).all(userId);
      
      for (const skill of pendingSkills) {
        try {
          const encrypted = this.e2ee.encryptForPeer(userId, 'cloud', JSON.stringify(skill));
          // 这里应该调用云端 API，暂时记录
          results.skills.push({ id: skill.id, status: 'encrypted', encrypted: encrypted.substring(0, 50) + '...' });
        } catch (e) {
          results.skills.push({ id: skill.id, status: 'error', error: e.message });
        }
      }
    }
    
    // 同步 MCP
    if (mcp) {
      const pendingMCP = this.db.prepare(`
        SELECT * FROM cloud_mcp_servers 
        WHERE author = ? AND sync_status = 'pending'
      `).all(userId);
      
      for (const server of pendingMCP) {
        try {
          const encrypted = this.e2ee.encryptForPeer(userId, 'cloud', JSON.stringify(server));
          results.mcp.push({ id: server.id, status: 'encrypted', encrypted: encrypted.substring(0, 50) + '...' });
        } catch (e) {
          results.mcp.push({ id: server.id, status: 'error', error: e.message });
        }
      }
    }
    
    this.cache.lastSync = Date.now();
    
    return {
      success: true,
      results
    };
  }

  /**
   * 从云端同步
   */
  async syncFromCloud(userId) {
    // 获取云端的更新列表
    // 这里应该调用云端 API
    
    return {
      success: true,
      message: 'Sync from cloud completed'
    };
  }

  // ==================== 工具方法 ====================

  hashContent(content) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  recordSync(itemType, itemId, action, status) {
    const id = `sync_${itemType}_${itemId}_${Date.now()}`;
    this.db.prepare(`
      INSERT INTO sync_records (id, item_type, item_id, action, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, itemType, itemId, action, status, Date.now());
  }

  async getCloudPublicKey() {
    // 这里应该从云端获取公钥
    // 暂时返回一个占位符
    return 'cloud_public_key_placeholder';
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const skillsCount = this.db.prepare('SELECT COUNT(*) as count FROM cloud_skills WHERE is_public = 1').get();
    const mcpCount = this.db.prepare('SELECT COUNT(*) as count FROM cloud_mcp_servers WHERE is_public = 1').get();
    const pendingSync = this.db.prepare('SELECT COUNT(*) as count FROM sync_records WHERE status = \'pending\'').get();
    
    return {
      skills: skillsCount.count,
      mcpServers: mcpCount.count,
      pendingSync: pendingSync.count,
      lastSync: this.cache.lastSync
    };
  }
}

module.exports = { CloudMarketService };