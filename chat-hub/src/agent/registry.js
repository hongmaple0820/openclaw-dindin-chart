/**
 * Agent Registry - Agent 注册表
 * 
 * 功能：
 * - Agent 注册/注销
 * - API 配置管理
 * - 能力定义
 * - 公开/私密权限
 */

const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

class AgentRegistry {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/chat-hub.db');
    this.db = null;
    this.agents = new Map(); // 内存缓存
    this.initialized = false;
  }

  /**
   * 初始化数据库连接
   */
  init() {
    if (this.initialized) return;
    
    // 确保数据目录存在
    const dataDir = path.dirname(this.dbPath);
    require('fs').mkdirSync(dataDir, { recursive: true });
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialized = true;
    
    console.log('[AgentRegistry] 初始化完成');
  }

  /**
   * 生成唯一 ID
   */
  generateId() {
    return `agent_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 加密 API Key
   */
  encryptApiKey(apiKey, secret = process.env.AGENT_SECRET || 'default-secret-key') {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secret, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密 API Key
   */
  decryptApiKey(encryptedKey, secret = process.env.AGENT_SECRET || 'default-secret-key') {
    try {
      const [ivHex, encrypted] = encryptedKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(secret, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('[AgentRegistry] 解密失败:', e.message);
      return null;
    }
  }

  /**
   * 注册 Agent
   */
  register(agentData) {
    this.init();
    
    const {
      nickname,
      avatar,
      description,
      type = 'user-added',
      isPublic = false,
      ownerId = null,
      apiEndpoint,
      apiKey,
      model,
      params = {},
      capabilities = {},
      memoryEnabled = true,
      memoryConfig = {},
      skills = []
    } = agentData;

    if (!nickname) {
      throw new Error('nickname is required');
    }

    const id = this.generateId();
    const now = Date.now();

    // 加密 API Key
    const apiKeyEncrypted = apiKey ? this.encryptApiKey(apiKey) : null;

    const stmt = this.db.prepare(`
      INSERT INTO agents (
        id, nickname, avatar, description, type,
        is_public, owner_id,
        api_endpoint, api_key_encrypted, model, params,
        capabilities, memory_enabled, memory_config, skills,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, nickname, avatar, description, type,
      isPublic ? 1 : 0, ownerId,
      apiEndpoint, apiKeyEncrypted, model, JSON.stringify(params),
      JSON.stringify(capabilities), memoryEnabled ? 1 : 0, JSON.stringify(memoryConfig), JSON.stringify(skills),
      'offline', now, now
    );

    const agent = this.getAgent(id);
    console.log(`[AgentRegistry] 注册 Agent: ${nickname} (${id})`);
    
    return agent;
  }

  /**
   * 注销 Agent
   */
  unregister(agentId) {
    this.init();
    
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // 删除相关数据
    this.db.prepare('DELETE FROM agent_memories WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agent_sessions WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agent_api_logs WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agent_api_tokens WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);

    this.agents.delete(agentId);
    console.log(`[AgentRegistry] 注销 Agent: ${agent.nickname} (${agentId})`);
    
    return true;
  }

  /**
   * 获取 Agent
   */
  getAgent(agentId) {
    this.init();
    
    // 检查缓存
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId);
    }

    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!row) return null;

    const agent = this.parseAgent(row);
    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * 获取 Agent（包含解密后的 API Key）
   */
  getAgentWithCredentials(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent) return null;

    return {
      ...agent,
      apiKey: agent.apiKeyEncrypted ? this.decryptApiKey(agent.apiKeyEncrypted) : null
    };
  }

  /**
   * 解析 Agent 数据
   */
  parseAgent(row) {
    return {
      id: row.id,
      nickname: row.nickname,
      avatar: row.avatar,
      description: row.description,
      type: row.type,
      isPublic: row.is_public === 1,
      ownerId: row.owner_id,
      apiEndpoint: row.api_endpoint,
      apiKeyEncrypted: row.api_key_encrypted,
      model: row.model,
      params: this.parseJSON(row.params, {}),
      capabilities: this.parseJSON(row.capabilities, {}),
      memoryEnabled: row.memory_enabled === 1,
      memoryConfig: this.parseJSON(row.memory_config, {}),
      skills: this.parseJSON(row.skills, []),
      status: row.status,
      lastActive: row.last_active,
      totalRequests: row.total_requests,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 安全解析 JSON
   */
  parseJSON(str, defaultValue) {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }

  /**
   * 列出 Agents
   */
  listAgents(options = {}) {
    this.init();
    
    const { type, ownerId, isPublic, status, limit = 100, offset = 0 } = options;
    
    let sql = 'SELECT * FROM agents WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (ownerId) {
      sql += ' AND owner_id = ?';
      params.push(ownerId);
    }
    if (isPublic !== undefined) {
      sql += ' AND is_public = ?';
      params.push(isPublic ? 1 : 0);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => this.parseAgent(row));
  }

  /**
   * 更新 Agent
   */
  updateAgent(agentId, updates) {
    this.init();
    
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const allowedFields = [
      'nickname', 'avatar', 'description', 'type',
      'is_public', 'owner_id',
      'api_endpoint', 'model', 'params',
      'capabilities', 'memory_enabled', 'memory_config', 'skills',
      'status'
    ];

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (!allowedFields.includes(snakeKey)) continue;

      if (key === 'isPublic') {
        setClause.push('is_public = ?');
        values.push(value ? 1 : 0);
      } else if (['params', 'capabilities', 'memoryConfig', 'skills'].includes(key)) {
        setClause.push(`${snakeKey} = ?`);
        values.push(JSON.stringify(value));
      } else {
        setClause.push(`${snakeKey} = ?`);
        values.push(value);
      }
    }

    if (setClause.length === 0) return agent;

    setClause.push('updated_at = ?');
    values.push(Date.now());
    values.push(agentId);

    const sql = `UPDATE agents SET ${setClause.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    // 清除缓存
    this.agents.delete(agentId);
    
    return this.getAgent(agentId);
  }

  /**
   * 更新 API 配置
   */
  updateApiConfig(agentId, config) {
    const updates = {};
    
    if (config.apiEndpoint) updates.apiEndpoint = config.apiEndpoint;
    if (config.apiKey) {
      updates.apiKeyEncrypted = this.encryptApiKey(config.apiKey);
    }
    if (config.model) updates.model = config.model;
    if (config.params) updates.params = config.params;

    return this.updateAgent(agentId, updates);
  }

  /**
   * 更新能力
   */
  updateCapabilities(agentId, capabilities) {
    return this.updateAgent(agentId, { capabilities });
  }

  /**
   * 更新状态
   */
  updateStatus(agentId, status) {
    this.init();
    
    const validStatuses = ['offline', 'online', 'busy', 'error'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    this.db.prepare(`
      UPDATE agents SET status = ?, last_active = ?, updated_at = ? WHERE id = ?
    `).run(status, Date.now(), Date.now(), agentId);

    this.agents.delete(agentId);
    return this.getAgent(agentId);
  }

  /**
   * 增加请求计数
   */
  incrementRequestCount(agentId) {
    this.init();
    this.db.prepare(`
      UPDATE agents SET total_requests = total_requests + 1, last_active = ? WHERE id = ?
    `).run(Date.now(), agentId);
  }

  /**
   * 根据 ID 获取 Agent（支持公开/私有权限检查）
   */
  getAgentWithPermission(agentId, userId = null) {
    const agent = this.getAgent(agentId);
    if (!agent) return null;

    // 公开的 Agent 任何人都可以访问
    if (agent.isPublic) return agent;

    // 私有 Agent 只有拥有者可以访问
    if (userId && agent.ownerId === userId) return agent;

    return null;
  }

  /**
   * 搜索 Agents（按能力）
   */
  findByCapability(capability) {
    this.init();
    
    const rows = this.db.prepare(`
      SELECT * FROM agents 
      WHERE is_public = 1 
      AND capabilities LIKE ?
      AND status != 'offline'
    `).all(`%"${capability}":true%`);

    return rows.map(row => this.parseAgent(row));
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

module.exports = AgentRegistry;