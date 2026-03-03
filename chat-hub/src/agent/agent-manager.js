/**
 * Agent 管理器
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

class AgentManager {
  constructor(dbPath) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'agents.db');
    }
    this.db = new Database(dbPath);
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
        status TEXT DEFAULT 'active',
        created_at INTEGER,
        last_active INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
    `);
  }

  async registerAgent(data) {
    const { name, type = 'custom', permissions = [] } = data;
    const agentId = `agent_${uuidv4().slice(0, 8)}`;
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    this.db.prepare(`
      INSERT INTO agents (id, name, type, api_key_hash, permissions, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(agentId, name, type, apiKeyHash, JSON.stringify(permissions), Date.now());

    return { agentId, apiKey };
  }

  async verifyAgent(apiKey) {
    const hash = this.hashApiKey(apiKey);
    const agent = this.db.prepare(`
      SELECT * FROM agents WHERE api_key_hash = ? AND status = ?
    `).get(hash, 'active');
    
    if (agent) {
      agent.permissions = JSON.parse(agent.permissions || '[]');
      agent.subscribedChannels = JSON.parse(agent.subscribed_channels || '[]');
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
    this.db.prepare(`
      UPDATE agents SET status = 'inactive' WHERE id = ?
    `).run(agentId);
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
      subscribedChannels: JSON.parse(a.subscribed_channels || '[]')
    }));
  }

  generateApiKey() {
    return `sk_agent_${crypto.randomBytes(32).toString('base64url')}`;
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}

module.exports = AgentManager;
