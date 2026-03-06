/**
 * 豆包 Agent 适配器
 * 豆包使用 OpenClaw 兼容协议
 */

const axios = require('axios');

interface DoubaoConfig {
  chatHubUrl: string;
  adminToken: string;
}

interface AgentInfo {
  agentId: string;
  apiKey: string;
  name: string;
  registered: boolean;
  createdAt?: number;
}

class DoubaoAdapter {
  private config: DoubaoConfig;
  private agents: Map<string, AgentInfo>;

  constructor(config: DoubaoConfig) {
    this.config = config;
    this.agents = new Map();
  }

  /**
   * 注册豆包 Agent
   */
  async register(options: { name?: string; permissions?: string[] } = {}): Promise<{ agentId: string; apiKey: string }> {
    const { name = 'Doubao', permissions = ['message:send', 'message:read'] } = options;

    const response = await axios.post(`${this.config.chatHubUrl}/api/v2/agents/register`, {
      name,
      type: 'doubao',
      permissions
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.adminToken}`
      }
    });

    const { agentId, apiKey } = response.data;

    this.agents.set(agentId, {
      agentId,
      apiKey,
      name,
      registered: true,
      createdAt: Date.now()
    });

    return { agentId, apiKey };
  }

  /**
   * 发送消息
   */
  async sendMessage(agentId: string, message: { content: string; type?: string; replyTo?: string }): Promise<unknown> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const response = await axios.post(`${this.config.chatHubUrl}/api/v2/messages`, {
      content: message.content,
      type: message.type || 'text',
      replyTo: message.replyTo
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.adminToken}`,
        'x-agent-api-key': agent.apiKey
      }
    });

    return response.data;
  }

  /**
   * 订阅消息流 (SSE)
   */
  async subscribe(agentId: string, callback: (data: unknown) => void): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const response = await fetch(`${this.config.chatHubUrl}/api/v2/agents/${agentId}/stream`, {
      headers: {
        'x-agent-api-key': agent.apiKey
      }
    });

    const reader = response.body?.getReader();
    if (!reader) return;
    
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            callback(data);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /**
   * OpenClaw 兼容接口：接收消息
   */
  async onMessage(agentId: string, callback: (data: unknown) => void): Promise<void> {
    return this.subscribe(agentId, callback);
  }

  /**
   * OpenClaw 兼容接口：回复消息
   */
  async reply(agentId: string, messageId: string, content: string): Promise<unknown> {
    return this.sendMessage(agentId, {
      content,
      replyTo: messageId
    });
  }

  /**
   * 获取已注册的 Agent 列表
   */
  getRegisteredAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }
}

export = DoubaoAdapter;
