import Transport, { TransportConfig, TransportStatus } from './base';
import { EventSource } from 'eventsource';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// AxiosInstance type
type AxiosInstance = ReturnType<typeof axios.create>;

/**
 * SSE 云端传输配置
 */
interface SSECloudConfig extends TransportConfig {
  endpoint: string;
  apiKey: string;
  instanceId?: string;
  reconnect?: {
    maxRetries?: number;
  };
  enabled?: boolean;
}

/**
 * 用户绑定信息
 */
interface UserBinding {
  sessionId: string | null;
  connectedAt: number;
}

/**
 * SSE 云端传输状态
 */
interface SSECloudStatus extends TransportStatus {
  mode: 'sse-cloud';
  endpoint: string;
  instanceId: string;
  subscriptions: string[];
  connectedUsers: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

/**
 * SSE 云端传输实现
 * 
 * 架构：
 * - SSE 连接（GET /sse/connect）：接收消息
 * - HTTP POST（POST /sse/send）：发送消息
 * - 会话订阅：基于 conversationId 路由消息
 */
class SSECloudTransport extends Transport {
  private eventSource: EventSource | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number = 1000;
  private heartbeatInterval: number = 30000;
  private instanceId: string;
  private subscriptions: Set<string>;
  private userBindings: Map<string, UserBinding>;
  private httpClient: AxiosInstance;

  constructor(config: SSECloudConfig) {
    super(config);
    this.maxReconnectAttempts = config.reconnect?.maxRetries || 10;
    this.instanceId = config.instanceId || uuidv4();
    this.subscriptions = new Set();
    this.userBindings = new Map();
    this.httpClient = axios.create({
      timeout: 5000
    });
  }

  async connect(): Promise<void> {
    try {
      console.log('[SSECloudTransport] 正在连接到云端 SSE...');
      console.log(`[SSECloudTransport] 端点: ${(this.config as SSECloudConfig).endpoint}`);

      // 构建连接 URL（带 API Key）
      const connectUrl = `${(this.config as SSECloudConfig).endpoint}/sse/connect?apiKey=${(this.config as SSECloudConfig).apiKey}`;

      // 创建 SSE 连接
      this.eventSource = new EventSource(connectUrl);

      // 监听连接成功
      this.eventSource.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        console.log('[SSECloudTransport] ✓ SSE 连接成功');
        
        // 启动心跳
        this.startHeartbeat();
      };

      // 监听消息
      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // 心跳消息
          if (data.type === 'heartbeat') {
            console.log('[SSECloudTransport] ♥ 收到心跳');
            return;
          }

          // 普通消息
          if (data.type === 'message') {
            console.log(`[SSECloudTransport] 📨 收到消息: ${data.message.sender}`);
            this._handleMessage(data.message);
          }
        } catch (error) {
          console.error('[SSECloudTransport] 消息解析失败:', error);
        }
      };

      // 监听错误
      this.eventSource.onerror = (error: Event) => {
        const errorMessage = (error as ErrorEvent)?.message || 'Unknown error';
        console.error('[SSECloudTransport] ✗ SSE 连接错误:', errorMessage);
        this.connected = false;
        this.stopHeartbeat();
        
        // 自动重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('[SSECloudTransport] 已达最大重连次数，停止重连');
          throw new Error('SSE 连接失败，已达最大重连次数');
        }
      };

    } catch (error) {
      console.error('[SSECloudTransport] 连接失败:', (error as Error).message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      console.log('[SSECloudTransport] 断开连接...');
      
      this.stopHeartbeat();
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      this.connected = false;
      console.log('[SSECloudTransport] 已断开连接');
    } catch (error) {
      console.error('[SSECloudTransport] 断开连接失败:', error);
    }
  }

  async send(message: Record<string, unknown>, channel: string = 'default'): Promise<void> {
    if (!this.connected) {
      throw new Error('SSE 未连接');
    }

    try {
      // 通过 HTTP POST 发送消息
      const sendUrl = `${(this.config as SSECloudConfig).endpoint}/sse/send`;
      
      const response = await this.httpClient.post(sendUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        channel,
        message
      });

      if (response.data.success) {
        console.log(`[SSECloudTransport] 消息已发送`);
      } else {
        throw new Error(response.data.error || '发送失败');
      }
    } catch (error) {
      console.error('[SSECloudTransport] 发送消息失败:', (error as Error).message);
      throw error;
    }
  }

  /**
   * 计划重连（指数退避）
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`[SSECloudTransport] 计划重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${this.reconnectDelay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        await this.connect();
      } catch (error) {
        // 重连失败，继续计划下一次
      }
    }, this.reconnectDelay);

    // 指数退避（最大 30 秒）
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        // 发送心跳请求
        const pingUrl = `${(this.config as SSECloudConfig).endpoint}/sse/ping`;
        await this.httpClient.post(pingUrl, {
          apiKey: (this.config as SSECloudConfig).apiKey
        });
        console.log('[SSECloudTransport] ♥ 心跳发送成功');
      } catch (error) {
        console.error('[SSECloudTransport] ♥ 心跳失败:', (error as Error).message);
        // 心跳失败触发重连
        this.connected = false;
        this.scheduleReconnect();
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected) return false;
      
      return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
    } catch (error) {
      console.error('[SSECloudTransport] 健康检查失败:', error);
      return false;
    }
  }

  async subscribeConversation(conversationId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('SSE 未连接');
    }

    if (this.subscriptions.has(conversationId)) {
      return true;
    }

    try {
      const subscribeUrl = `${(this.config as SSECloudConfig).endpoint}/sse/subscribe`;
      
      const response = await this.httpClient.post(subscribeUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        instanceId: this.instanceId,
        conversationId
      });

      if (response.data.success) {
        this.subscriptions.add(conversationId);
        console.log(`[SSECloudTransport] 已订阅会话: ${conversationId}`);
        return true;
      } else {
        throw new Error(response.data.error || '订阅失败');
      }
    } catch (error) {
      console.error('[SSECloudTransport] 订阅会话失败:', (error as Error).message);
      throw error;
    }
  }

  async unsubscribeConversation(conversationId: string): Promise<boolean> {
    if (!this.subscriptions.has(conversationId)) {
      return true;
    }

    try {
      const unsubscribeUrl = `${(this.config as SSECloudConfig).endpoint}/sse/unsubscribe`;
      
      const response = await this.httpClient.post(unsubscribeUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        instanceId: this.instanceId,
        conversationId
      });

      if (response.data.success) {
        this.subscriptions.delete(conversationId);
        console.log(`[SSECloudTransport] 已取消订阅会话: ${conversationId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SSECloudTransport] 取消订阅失败:', (error as Error).message);
      return false;
    }
  }

  async sendToConversation(message: Record<string, unknown>, conversationId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('SSE 未连接');
    }

    try {
      const sendUrl = `${(this.config as SSECloudConfig).endpoint}/sse/send`;
      
      const response = await this.httpClient.post(sendUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        instanceId: this.instanceId,
        conversationId,
        message
      });

      if (response.data.success) {
        console.log(`[SSECloudTransport] 消息已发送到会话: ${conversationId}`);
        return true;
      } else {
        throw new Error(response.data.error || '发送失败');
      }
    } catch (error) {
      console.error('[SSECloudTransport] 发送消息到会话失败:', (error as Error).message);
      throw error;
    }
  }

  bindUser(userId: string, sessionId: string | null = null): void {
    this.userBindings.set(userId, {
      sessionId,
      connectedAt: Date.now()
    });
    console.log(`[SSECloudTransport] 用户绑定: ${userId}`);
  }

  unbindUser(userId: string): void {
    this.userBindings.delete(userId);
    console.log(`[SSECloudTransport] 用户解绑: ${userId}`);
  }

  getUserSession(userId: string): string | null {
    const binding = this.userBindings.get(userId);
    return binding ? binding.sessionId : null;
  }

  getConnectedUsers(): Array<{ userId: string; sessionId: string | null; connectedAt: number }> {
    return Array.from(this.userBindings.entries()).map(([userId, data]) => ({
      userId,
      sessionId: data.sessionId,
      connectedAt: data.connectedAt
    }));
  }

  async registerInstance(name: string, endpoint: string): Promise<boolean> {
    try {
      const registerUrl = `${(this.config as SSECloudConfig).endpoint}/sse/instance/register`;
      
      const response = await this.httpClient.post(registerUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        instanceId: this.instanceId,
        name,
        endpoint
      });

      if (response.data.success) {
        console.log(`[SSECloudTransport] 实例已注册: ${this.instanceId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SSECloudTransport] 实例注册失败:', (error as Error).message);
      return false;
    }
  }

  async unregisterInstance(): Promise<void> {
    try {
      const unregisterUrl = `${(this.config as SSECloudConfig).endpoint}/sse/instance/unregister`;
      
      await this.httpClient.post(unregisterUrl, {
        apiKey: (this.config as SSECloudConfig).apiKey,
        instanceId: this.instanceId
      });

      console.log(`[SSECloudTransport] 实例已注销: ${this.instanceId}`);
    } catch (error) {
      console.error('[SSECloudTransport] 实例注销失败:', (error as Error).message);
    }
  }

  getStatus(): SSECloudStatus {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      mode: 'sse-cloud',
      endpoint: (this.config as SSECloudConfig).endpoint,
      instanceId: this.instanceId,
      subscriptions: Array.from(this.subscriptions),
      connectedUsers: this.userBindings.size,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

export default SSECloudTransport;
export type { SSECloudConfig, SSECloudStatus, UserBinding };