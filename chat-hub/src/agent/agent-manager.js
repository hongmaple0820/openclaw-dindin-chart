/**
 * Agent 管理器
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class AgentManager {
  constructor(dbPath) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'agents.db');
    }
    this.db = new Database(dbPath);
    this.messageStreams = new Map(); // agentId -> EventEmitter
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        api_key_hash TEXT UNIQUE,
        permissions TEXT,
        subscribed_channels TEXT,
        config TEXT,
        status TEXT DEFAULT 'active',
        created_at INTEGER,
        last_active INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
      
      CREATE TABLE IF NOT EXISTS agent_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        permissions TEXT,
        created_at INTEGER,
        UNIQUE(agent_id, channel_id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_channels_agent ON agent_channels(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_channels_channel ON agent_channels(channel_id);
    `);
  }

  // ========== 基础 Agent 管理 ==========

  async registerAgent(data) {
    const { name, type = 'custom', permissions = [], metadata = {} } = data;
    const agentId = `agent_${uuidv4().slice(0, 8)}`;
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    this.db.prepare(`
      INSERT INTO agents (id, name, type, api_key_hash, permissions, config, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(agentId, name, type, apiKeyHash, JSON.stringify(permissions), JSON.stringify(metadata), Date.now());

    return { agentId, apiKey };
  }

  async getAgent(agentId) {
    const agent = this.db.prepare(`
      SELECT * FROM agents WHERE id = ?
    `).get(agentId);
    
    if (agent) {
      agent.permissions = JSON.parse(agent.permissions || '[]');
      agent.subscribedChannels = JSON.parse(agent.subscribed_channels || '[]');
      agent.config = JSON.parse(agent.config || '{}');
    }
    
    return agent;
  }

  async verifyAgent(apiKey) {
    const hash = this.hashApiKey(apiKey);
    const agent = this.db.prepare(`
      SELECT * FROM agents WHERE api_key_hash = ? AND status = ?
    `).get(hash, 'active');
    
    if (agent) {
      agent.permissions = JSON.parse(agent.permissions || '[]');
      agent.subscribedChannels = JSON.parse(agent.subscribed_channels || '[]');
      agent.config = JSON.parse(agent.config || '{}');
    }
    
    return agent;
  }

  async subscribeChannels(agentId, channels) {
    this.db.prepare(`
      UPDATE agents SET subscribed_channels = ? WHERE id = ?
    `).run(JSON.stringify(channels), agentId);
  }

  async updateLastActive(agentId) {
    this.db.prepare(`
      UPDATE agents SET last_active = ? WHERE id = ?
    `).run(Date.now(), agentId);
  }

  async unregisterAgent(agentId) {
    // 删除通道绑定
    this.db.prepare(`
      DELETE FROM agent_channels WHERE agent_id = ?
    `).run(agentId);
    
    // 标记为 inactive
    this.db.prepare(`
      UPDATE agents SET status = 'inactive' WHERE id = ?
    `).run(agentId);
    
    // 关闭消息流
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('close');
      this.messageStreams.delete(agentId);
    }
  }

  async listAgents(filter = {}) {
    let query = 'SELECT * FROM agents WHERE status = ?';
    const params = [filter.status || 'active'];
    
    if (filter.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    
    const agents = this.db.prepare(query).all(...params);
    return agents.map(a => ({
      ...a,
      permissions: JSON.parse(a.permissions || '[]'),
      subscribedChannels: JSON.parse(a.subscribed_channels || '[]'),
      config: JSON.parse(a.config || '{}')
    }));
  }

  generateApiKey() {
    return `sk_agent_${crypto.randomBytes(32).toString('base64url')}`;
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  // ========== 配置管理 ==========

  async getAgentConfig(agentId) {
    const agent = await this.getAgent(agentId);
    if (!agent) return null;
    return agent.config || {};
  }

  async updateAgentConfig(agentId, updates) {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    const newConfig = { ...agent.config, ...updates };
    
    this.db.prepare(`
      UPDATE agents SET config = ? WHERE id = ?
    `).run(JSON.stringify(newConfig), agentId);
    
    return newConfig;
  }

  // ========== 通道绑定 ==========

  async bindChannel(agentId, channelId, permissions = []) {
    // 检查 Agent 是否存在
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    // 插入或更新通道绑定
    this.db.prepare(`
      INSERT INTO agent_channels (agent_id, channel_id, permissions, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, channel_id) DO UPDATE SET permissions = excluded.permissions
    `).run(agentId, channelId, JSON.stringify(permissions), Date.now());
    
    // 更新 subscribed_channels（兼容旧字段）
    const channels = await this.getBoundChannels(agentId);
    await this.subscribeChannels(agentId, channels.map(c => c.channelId));
    
    return true;
  }

  async unbindChannel(agentId, channelId) {
    this.db.prepare(`
      DELETE FROM agent_channels WHERE agent_id = ? AND channel_id = ?
    `).run(agentId, channelId);
    
    // 更新 subscribed_channels
    const channels = await this.getBoundChannels(agentId);
    await this.subscribeChannels(agentId, channels.map(c => c.channelId));
    
    return true;
  }

  async getBoundChannels(agentId) {
    const rows = this.db.prepare(`
      SELECT channel_id, permissions, created_at FROM agent_channels WHERE agent_id = ?
    `).all(agentId);
    
    return rows.map(row => ({
      channelId: row.channel_id,
      permissions: JSON.parse(row.permissions || '[]'),
      createdAt: row.created_at
    }));
  }

  // ========== 消息发送 ==========

  async sendMessage(agentId, message) {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    // 获取绑定的通道
    const channels = await this.getBoundChannels(agentId);
    
    // 更新最后活跃时间
    await this.updateLastActive(agentId);
    
    // 这里可以集成实际的消息发送逻辑
    // 例如发送到 Redis、WebSocket 或钉钉等
    
    return {
      delivered: channels.length > 0,
      channels: channels.map(c => c.channelId),
      timestamp: message.timestamp
    };
  }

  // ========== SSE 消息流 ==========

  createMessageStream(agentId) {
    if (!this.messageStreams.has(agentId)) {
      const emitter = new EventEmitter();
      this.messageStreams.set(agentId, emitter);
    }
    
    return this.messageStreams.get(agentId);
  }

  // 向特定 Agent 推送消息
  pushToAgent(agentId, message) {
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('message', message);
      return true;
    }
    return false;
  }

  // 向所有活跃 Agent 广播消息
  broadcastToAgents(message, filter = {}) {
    let count = 0;
    for (const [agentId, stream] of this.messageStreams) {
      if (!filter.type || filter.type === 'all') {
        stream.emit('message', message);
        count++;
      }
    }
    return count;
  }

  // 关闭消息流
  closeMessageStream(agentId) {
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('close');
      this.messageStreams.delete(agentId);
      return true;
    }
    return false;
  }
}

module.exports = AgentManager;
