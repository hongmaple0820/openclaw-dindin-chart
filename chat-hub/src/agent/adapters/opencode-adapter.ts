/**
 * OpenCode Agent 适配器
 * OpenCode 是以项目为主体的 Agent
 */

const axios = require('axios');

interface OpenCodeConfig {
  chatHubUrl: string;
  adminToken: string;
}

interface AgentInfo {
  agentId: string;
  apiKey: string;
  name: string;
  registered: boolean;
}

interface Message {
  content: string;
  type?: string;
}

class OpenCodeAdapter {
  private config: OpenCodeConfig;
  private agents: Map<string, AgentInfo>;

  constructor(config: OpenCodeConfig) {
    this.config = config;
    this.agents = new Map();
  }

  /**
   * 注册项目 Agent
   */
  async registerProject(projectPath: string, options: { name?: string; description?: string } = {}): Promise<{ agentId: string; apiKey: string }> {
    const { name, description } = options;
    
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
  async sendMessage(projectPath: string, message: Message): Promise<void> {
    const agent = this.agents.get(projectPath);
    if (!agent) {
      throw new Error(`Project not registered: ${projectPath}`);
    }

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
  async subscribe(projectPath: string, callback: (data: unknown) => void): Promise<void> {
    const agent = this.agents.get(projectPath);
    if (!agent) {
      throw new Error(`Project not registered: ${projectPath}`);
    }

    const response = await fetch(`${this.config.chatHubUrl}/api/v2/agents/${agent.agentId}/stream`, {
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
          const data = JSON.parse(line.slice(6));
          callback(data);
        }
      }
    }
  }

  /**
   * 获取项目名称
   */
  getProjectName(projectPath: string): string {
    return projectPath.split('/').pop() || 'unknown';
  }

  /**
   * 获取已注册的项目列表
   */
  getRegisteredProjects(): { path: string; agentId: string; apiKey: string; name: string; registered: boolean }[] {
    return Array.from(this.agents.entries()).map(([path, info]) => ({
      path,
      ...info
    }));
  }
}

export = OpenCodeAdapter;