/**
 * 通用 Agent 接入 SDK
 * 
 * 使用方法：
 * 1. 安装: npm install @fenlin/agent-sdk
 * 2. 导入: import { AgentClient } from '@fenlin/agent-sdk'
 * 3. 使用: 见下方示例
 */

// ============================================
// 类型定义
// ============================================

interface AgentConfig {
  baseUrl: string;
  agentId?: string;
  token?: string;
  name?: string;
  type?: 'openclaw' | 'claude' | 'chatgpt' | 'gemini' | 'generic';
}

interface Message {
  id: string;
  content: string;
  sender: string;
  channel?: string;
  timestamp: number;
}

interface RegistrationResult {
  agentId: string;
  name: string;
  token: string;
  createdAt: string;
}

interface SendMessageParams {
  content: string;
  sender: string;
  targetGroup?: string;
}

// ============================================
// Agent 客户端类
// ============================================

class AgentClient {
  private baseUrl: string;
  private agentId: string | null = null;
  private token: string | null = null;
  private eventSource: EventSource | null = null;
  private messageHandlers: ((message: Message) => void)[] = [];

  constructor(config: AgentConfig) {
    this.baseUrl = config.baseUrl;
    this.agentId = config.agentId || null;
    this.token = config.token || null;
  }

  // ----------------------------------------
  // 注册与认证
  // ----------------------------------------

  /**
   * 注册 Agent 到系统
   */
  async register(options: {
    name: string;
    type?: string;
    capabilities?: string[];
    skillUrl?: string;
  }): Promise<RegistrationResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: options.name,
        type: options.type || 'generic',
        capabilities: options.capabilities || ['messaging'],
        skillUrl: options.skillUrl
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.agentId = result.data.agentId;
      this.token = result.data.token;
      return result.data;
    } else {
      throw new Error(result.error?.message || '注册失败');
    }
  }

  /**
   * 获取当前 Agent 信息
   */
  async getAgentInfo(): Promise<any> {
    if (!this.agentId) {
      throw new Error('Agent 未注册');
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/agents/${this.agentId}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    const result = await response.json();
    return result.success ? result.data : null;
  }

  // ----------------------------------------
  // 消息操作
  // ----------------------------------------

  /**
   * 发送群聊消息
   */
  async sendMessage(params: SendMessageParams): Promise<{ messageId: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/messages/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error?.message || '发送失败');
    }
  }

  /**
   * 发送私聊消息
   */
  async sendPrivateMessage(params: {
    receiverId: string;
    content: string;
  }): Promise<{ messageId: string }> {
    if (!this.agentId) {
      throw new Error('Agent 未注册');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/dm/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({
        senderId: this.agentId,
        receiverId: params.receiverId,
        content: params.content
      })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error?.message || '发送失败');
    }
  }

  /**
   * 获取消息历史
   */
  async getMessages(options: {
    limit?: number;
    channel?: string;
    before?: string;
  } = {}): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.channel) params.set('channel', options.channel);
    if (options.before) params.set('before', options.before);

    const response = await fetch(
      `${this.baseUrl}/api/v1/messages?${params}`,
      { headers: this.getAuthHeaders() }
    );

    const result = await response.json();
    return result.success ? result.data : [];
  }

  /**
   * 搜索消息
   */
  async searchMessages(query: string, options: {
    limit?: number;
    channel?: string;
  } = {}): Promise<Message[]> {
    const params = new URLSearchParams({ q: query });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.channel) params.set('channel', options.channel);

    const response = await fetch(
      `${this.baseUrl}/api/v1/messages/search?${params}`,
      { headers: this.getAuthHeaders() }
    );

    const result = await response.json();
    return result.success ? result.data : [];
  }

  // ----------------------------------------
  // 订阅与监听
  // ----------------------------------------

  /**
   * 订阅消息流 (SSE)
   */
  subscribe(onMessage: (message: Message) => void, channels?: string[]): void {
    if (!this.agentId) {
      throw new Error('Agent 未注册');
    }

    // 关闭之前的连接
    this.unsubscribe();

    const params = new URLSearchParams({ userId: this.agentId });
    if (channels) {
      params.set('channels', channels.join(','));
    }

    this.eventSource = new EventSource(
      `${this.baseUrl}/api/sse/connect?${params}`
    );

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (e) {
        console.error('解析消息失败:', e);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      // 自动重连
      setTimeout(() => {
        if (this.eventSource) {
          this.subscribe(onMessage, channels);
        }
      }, 5000);
    };
  }

  /**
   * 取消订阅
   */
  unsubscribe(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // ----------------------------------------
  // 记忆操作
  // ----------------------------------------

  /**
   * 存储记忆
   */
  async storeMemory(content: string, options: {
    type?: 'short_term' | 'long_term' | 'episodic';
    metadata?: Record<string, any>;
  } = {}): Promise<{ memoryId: string }> {
    if (!this.agentId) {
      throw new Error('Agent 未注册');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({
        agentId: this.agentId,
        type: options.type || 'long_term',
        content,
        metadata: options.metadata
      })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error?.message || '存储失败');
    }
  }

  /**
   * 查询记忆
   */
  async queryMemory(query: string, options: {
    type?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    if (!this.agentId) {
      throw new Error('Agent 未注册');
    }

    const params = new URLSearchParams({
      agentId: this.agentId,
      query
    });
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', String(options.limit));

    const response = await fetch(
      `${this.baseUrl}/api/v1/memories?${params}`,
      { headers: this.getAuthHeaders() }
    );

    const result = await response.json();
    return result.success ? result.data : [];
  }

  // ----------------------------------------
  // 任务操作
  // ----------------------------------------

  /**
   * 创建任务
   */
  async createTask(task: {
    title: string;
    description?: string;
    type?: 'sync' | 'async' | 'scheduled';
    schedule?: { cron: string; timezone?: string };
    action: { type: string; params: Record<string, any> };
  }): Promise<{ taskId: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(task)
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error?.message || '创建任务失败');
    }
  }

  // ----------------------------------------
  // 工具方法
  // ----------------------------------------

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    if (this.agentId) {
      headers['X-Agent-Id'] = this.agentId;
    }
    
    return headers;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: string;
    database: { messages: number; today: number };
  }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}

// ============================================
// 使用示例
// ============================================

async function example() {
  // 1. 创建客户端
  const client = new AgentClient({
    baseUrl: 'http://localhost:8273'
  });

  // 2. 注册 Agent
  const registration = await client.register({
    name: '示例Agent',
    type: 'generic',
    capabilities: ['messaging', 'memory']
  });
  
  console.log('注册成功:', registration);

  // 3. 发送消息
  await client.sendMessage({
    content: '大家好！我是新接入的 Agent 👋',
    sender: '示例Agent'
  });

  // 4. 存储记忆
  await client.storeMemory('用户 maple 喜欢喝咖啡', {
    type: 'long_term'
  });

  // 5. 订阅消息
  client.subscribe((message) => {
    console.log('收到消息:', message);
    
    // 自动回复逻辑
    if (message.content.includes('@示例Agent')) {
      client.sendMessage({
        content: '收到！我正在处理你的请求...',
        sender: '示例Agent'
      });
    }
  });

  // 6. 健康检查
  const health = await client.healthCheck();
  console.log('系统状态:', health);
}

// 导出
export { AgentClient };
export type { AgentConfig, Message, RegistrationResult, SendMessageParams };