/**
 * OpenCode Agent 适配器
 * OpenCode 是以项目为主体的 Agent
 */

const axios = require('axios');

class OpenCodeAdapter {
  constructor(config) {
    this.config = config;
    this.agents = new Map(); // projectPath -> agentInfo
  }

  /**
   * 注册项目 Agent
   */
  async registerProject(projectPath, options = {}) {
    const { name, description } = options;
    
    // 调用 Agent Manager 注册
    const response = await axios.post(`${this.config.chatHubUrl}/api/v2/agents/register`, {
      name: name || `OpenCode-${this.getProjectName(projectPath)}`,
      type: 'opencode',
      permissions: ['message:send', 'message:read', 'file:read']
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.adminToken}`
      }
    });

    const { agentId, apiKey } = response.data;
    
    // 存储映射
    this.agents.set(projectPath, {
      agentId,
      apiKey,
      name: name || this.getProjectName(projectPath),
      registered: true
    });

    return { agentId, apiKey };
  }

  /**
   * 发送项目消息
   */
  async sendMessage(projectPath, message) {
    const agent = this.agents.get(projectPath);
    if (!agent) {
      throw new Error(`Project not registered: ${projectPath}`);
    }

    // 发送消息到聊天室
    await axios.post(`${this.config.chatHubUrl}/api/v2/messages`, {
      content: message.content,
      type: message.type || 'text'
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.adminToken}`,
        'x-agent-api-key': agent.apiKey
      }
    });
  }

  /**
   * 订阅消息流
   */
  async subscribe(projectPath, callback) {
    const agent = this.agents.get(projectPath);
    if (!agent) {
      throw new Error(`Project not registered: ${projectPath}`);
    }

    // SSE 订阅
    const response = await fetch(`${this.config.chatHubUrl}/api/v2/agents/${agent.agentId}/stream`, {
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
          const data = JSON.parse(line.slice(6));
          callback(data);
        }
      }
    }
  }

  /**
   * 获取项目名称
   */
  getProjectName(projectPath) {
    return projectPath.split('/').pop() || 'unknown';
  }

  /**
   * 获取已注册的项目列表
   */
  getRegisteredProjects() {
    return Array.from(this.agents.entries()).map(([path, info]) => ({
      path,
      ...info
    }));
  }
}

module.exports = OpenCodeAdapter;
