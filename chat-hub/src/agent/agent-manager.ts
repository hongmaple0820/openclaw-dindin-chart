/**
 * Agent 管理器
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

interface AgentData {
  name: string;
  type?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  api_key_hash: string;
  permissions: string[];
  subscribedChannels: string[];
  config: Record<string, unknown>;
  status: string;
  created_at: number;
  last_active: number | null;
}

interface Message {
  content: string;
  type?: string;
  replyTo?: string;
  timestamp?: number;
}

class AgentManager {
  private db: Database.Database;
  private messageStreams: Map<string, EventEmitter>;

  constructor(dbPath?: string) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'agents.db');
    }
    this.db = new Database(dbPath);
    this.messageStreams = new Map();
    this.initTables();
  }

  initTables(): void {
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

  async registerAgent(data: AgentData): Promise<{ agentId: string; apiKey: string }> {
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

  async getAgent(agentId: string): Promise<Agent | null> {
    const agent = this.db.prepare(`
      SELECT * FROM agents WHERE id = ?
    `).get(agentId) as any;
    
    if (agent) {
      agent.permissions = JSON.parse(agent.permissions || '[]');
      agent.subscribedChannels = JSON.parse(agent.subscribed_channels || '[]');
      agent.config = JSON.parse(agent.config || '{}');
    }
    
    return agent;
  }

  async verifyAgent(apiKey: string): Promise<Agent | null> {
    const hash = this.hashApiKey(apiKey);
    const agent = this.db.prepare(`
      SELECT * FROM agents WHERE api_key_hash = ? AND status = ?
    `).get(hash, 'active') as any;
    
    if (agent) {
      agent.permissions = JSON.parse(agent.permissions || '[]');
      agent.subscribedChannels = JSON.parse(agent.subscribed_channels || '[]');
      agent.config = JSON.parse(agent.config || '{}');
    }
    
    return agent;
  }

  async subscribeChannels(agentId: string, channels: string[]): Promise<void> {
    this.db.prepare(`
      UPDATE agents SET subscribed_channels = ? WHERE id = ?
    `).run(JSON.stringify(channels), agentId);
  }

  async updateLastActive(agentId: string): Promise<void> {
    this.db.prepare(`
      UPDATE agents SET last_active = ? WHERE id = ?
    `).run(Date.now(), agentId);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM agent_channels WHERE agent_id = ?
    `).run(agentId);
    
    this.db.prepare(`
      UPDATE agents SET status = 'inactive' WHERE id = ?
    `).run(agentId);
    
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('close');
      this.messageStreams.delete(agentId);
    }
  }

  async listAgents(filter: { status?: string; type?: string } = {}): Promise<Agent[]> {
    let query = 'SELECT * FROM agents WHERE status = ?';
    const params: string[] = [filter.status || 'active'];
    
    if (filter.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    
    const agents = this.db.prepare(query).all(...params) as any[];
    return agents.map(a => ({
      ...a,
      permissions: JSON.parse(a.permissions || '[]'),
      subscribedChannels: JSON.parse(a.subscribed_channels || '[]'),
      config: JSON.parse(a.config || '{}')
    }));
  }

  generateApiKey(): string {
    return `sk_agent_${crypto.randomBytes(32).toString('base64url')}`;
  }

  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  // ========== 配置管理 ==========

  async getAgentConfig(agentId: string): Promise<Record<string, unknown> | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) return null;
    return agent.config || {};
  }

  async updateAgentConfig(agentId: string, updates: Record<string, unknown>): Promise<Record<string, unknown>> {
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

  async bindChannel(agentId: string, channelId: string, permissions: string[] = []): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    this.db.prepare(`
      INSERT INTO agent_channels (agent_id, channel_id, permissions, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, channel_id) DO UPDATE SET permissions = excluded.permissions
    `).run(agentId, channelId, JSON.stringify(permissions), Date.now());
    
    const channels = await this.getBoundChannels(agentId);
    await this.subscribeChannels(agentId, channels.map(c => c.channelId));
    
    return true;
  }

  async unbindChannel(agentId: string, channelId: string): Promise<boolean> {
    this.db.prepare(`
      DELETE FROM agent_channels WHERE agent_id = ? AND channel_id = ?
    `).run(agentId, channelId);
    
    const channels = await this.getBoundChannels(agentId);
    await this.subscribeChannels(agentId, channels.map(c => c.channelId));
    
    return true;
  }

  async getBoundChannels(agentId: string): Promise<{ channelId: string; permissions: string[]; createdAt: number }[]> {
    const rows = this.db.prepare(`
      SELECT channel_id, permissions, created_at FROM agent_channels WHERE agent_id = ?
    `).all(agentId) as any[];
    
    return rows.map(row => ({
      channelId: row.channel_id,
      permissions: JSON.parse(row.permissions || '[]'),
      createdAt: row.created_at
    }));
  }

  // ========== 消息发送 ==========

  async sendMessage(agentId: string, message: Message): Promise<{ delivered: boolean; channels: string[]; timestamp?: number }> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    const channels = await this.getBoundChannels(agentId);
    await this.updateLastActive(agentId);
    
    return {
      delivered: channels.length > 0,
      channels: channels.map(c => c.channelId),
      timestamp: message.timestamp
    };
  }

  // ========== SSE 消息流 ==========

  createMessageStream(agentId: string): EventEmitter {
    if (!this.messageStreams.has(agentId)) {
      const emitter = new EventEmitter();
      this.messageStreams.set(agentId, emitter);
    }
    
    return this.messageStreams.get(agentId)!;
  }

  pushToAgent(agentId: string, message: unknown): boolean {
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('message', message);
      return true;
    }
    return false;
  }

  broadcastToAgents(message: unknown, filter: { type?: string } = {}): number {
    let count = 0;
    for (const [agentId, stream] of this.messageStreams) {
      if (!filter.type || filter.type === 'all') {
        stream.emit('message', message);
        count++;
      }
    }
    return count;
  }

  closeMessageStream(agentId: string): boolean {
    const stream = this.messageStreams.get(agentId);
    if (stream) {
      stream.emit('close');
      this.messageStreams.delete(agentId);
      return true;
    }
    return false;
  }
}

export = AgentManager;