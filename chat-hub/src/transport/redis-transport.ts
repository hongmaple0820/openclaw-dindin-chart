import Transport, { TransportConfig, TransportStatus, MessageHandler } from './base';

/**
 * Redis 连接配置
 */
interface RedisConfig extends TransportConfig {
  host?: string;
  port?: number;
  password?: string;
  enabled?: boolean;
}

/**
 * Redis 状态
 */
interface RedisStatus extends TransportStatus {
  mode: 'redis';
  host?: string;
  port?: number;
  subscribedChannels: string[];
}

/**
 * Redis 客户端接口（简化）
 */
interface RedisClientLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(channel: string, callback: (payload: string) => void): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  getStatus(): { connected: boolean; degraded: boolean; connecting: boolean };
}

/**
 * Redis Pub/Sub 传输实现
 */
class RedisTransport extends Transport {
  private redisClient: RedisClientLike | null = null;
  private subscriptions: Map<string, boolean>;
  private RedisClientClass: new (config: Record<string, unknown>) => RedisClientLike;

  constructor(config: RedisConfig, RedisClient?: new (config: Record<string, unknown>) => RedisClientLike) {
    super(config);
    this.subscriptions = new Map();
    // 动态导入的 Redis 客户端类
    this.RedisClientClass = RedisClient || require('../utils/resilient-redis');
  }

  async connect(): Promise<void> {
    try {
      console.log('[RedisTransport] 正在连接 Redis...');
      
      // 创建 Redis 客户端
      this.redisClient = new this.RedisClientClass({
        host: (this.config as RedisConfig).host || 'localhost',
        port: (this.config as RedisConfig).port || 6379,
        password: (this.config as RedisConfig).password || null
      });

      await this.redisClient.connect();
      
      this.connected = true;
      console.log('[RedisTransport] ✓ Redis 连接成功');
    } catch (error) {
      console.error('[RedisTransport] ✗ Redis 连接失败:', (error as Error).message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.disconnect();
        this.connected = false;
        console.log('[RedisTransport] 已断开连接');
      }
    } catch (error) {
      console.error('[RedisTransport] 断开连接失败:', error);
    }
  }

  async subscribe(channel: string): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis 未连接');
    }

    try {
      await this.redisClient.subscribe(channel, (payload: string) => {
        try {
          const message = JSON.parse(payload);
          // 添加频道信息，方便区分
          message._channel = channel;
          this._handleMessage(message);
        } catch (error) {
          console.error('[RedisTransport] 消息解析失败:', error);
        }
      });
      
      this.subscriptions.set(channel, true);
      console.log(`[RedisTransport] ✓ 已订阅频道: ${channel}`);
    } catch (error) {
      console.error(`[RedisTransport] ✗ 订阅频道失败 ${channel}:`, (error as Error).message);
      throw error;
    }
  }

  async send(message: Record<string, unknown>, channel: string = 'chat:replies'): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis 未连接');
    }

    try {
      if (!this.connected) {
        throw new Error('Redis 未连接');
      }

      // 移除内部字段
      const { _channel, ...cleanMessage } = message as Record<string, unknown> & { _channel?: string };

      await this.redisClient.publish(channel, JSON.stringify(cleanMessage));
      console.log(`[RedisTransport] 消息已发送到 ${channel}`);
    } catch (error) {
      console.error('[RedisTransport] 发送消息失败:', error);
      throw error;
    }
  }

  getStatus(): RedisStatus {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      mode: 'redis',
      host: (this.config as RedisConfig).host,
      port: (this.config as RedisConfig).port,
      subscribedChannels: Array.from(this.subscriptions.keys())
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.redisClient) return false;
      
      // 获取状态
      const status = this.redisClient.getStatus();
      
      // 如果已连接且未降级，则健康
      if (status.connected && !status.degraded) {
        return true;
      }
      
      // 如果正在重连，返回 false 但不记录错误
      if (status.connecting) {
        return false;
      }
      
      // 降级模式下返回 false
      return false;
    } catch (error) {
      console.error('[RedisTransport] 健康检查失败:', error);
      return false;
    }
  }
}

export default RedisTransport;
export type { RedisConfig, RedisStatus, RedisClientLike };