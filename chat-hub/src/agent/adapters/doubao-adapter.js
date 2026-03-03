/**
 * 豆包 Agent 适配器
 * 豆包使用 OpenClaw 兼容协议
 */

const axios = require('axios');

class DoubaoAdapter {
  constructor(config) {
    this.config = config;
    this.agents = new Map(); // agentId -> agentInfo
  }

  /**
   * 注册豆包 Agent
   */
  async register(options = {}) {
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

    // 存储映射
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
  async sendMessage(agentId, message) {
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
  async subscribe(agentId, callback) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const response = await fetch(`${this.config.chatHubUrl}/api/v2/agents/${agentId}/stream`, {
      headers: {
        'x-agent-api-key': agent.apiKey
      }
    });

    const reader = response.body.getReader();
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
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /**
   * OpenClaw 兼容接口：接收消息
   */
  async onMessage(agentId, callback) {
    return this.subscribe(agentId, callback);
  }

  /**
   * OpenClaw 兼容接口：回复消息
   */
  async reply(agentId, messageId, content) {
    return this.sendMessage(agentId, {
      content,
      replyTo: messageId
    });
  }

  /**
   * 获取已注册的 Agent 列表
   */
  getRegisteredAgents() {
    return Array.from(this.agents.values());
  }
}

module.exports = DoubaoAdapter;
