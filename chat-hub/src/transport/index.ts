import Transport, { TransportStatus, MessageHandler } from './base';
import RedisTransport, { RedisConfig } from './redis-transport';
import SSECloudTransport, { SSECloudConfig } from './sse-cloud-transport';

/**
 * 传输管理器配置
 */
interface TransportManagerConfig {
  transport?: {
    mode?: 'auto' | 'redis' | 'sse-cloud';
    redis?: RedisConfig;
    sse?: {
      cloud?: SSECloudConfig;
    };
  };
  fallback?: {
    order?: Array<'redis' | 'sse-cloud'>;
  };
}

type TransportMode = 'redis' | 'sse-cloud' | 'auto';

/**
 * 传输管理器状态
 */
interface TransportManagerStatus extends TransportStatus {
  connected: boolean;
  mode: TransportMode | null;
}

/**
 * 传输管理器
 * 负责传输方式的创建、连接和故障切换
 */
class TransportManager {
  private config: TransportManagerConfig;
  private currentTransport: Transport | null = null;
  private mode: TransportMode;
  private fallbackOrder: Array<'redis' | 'sse-cloud'>;
  private messageHandlers: MessageHandler[];

  constructor(config: TransportManagerConfig) {
    this.config = config;
    this.mode = config.transport?.mode || 'auto';
    this.fallbackOrder = config.fallback?.order || ['sse-cloud', 'redis'];
    this.messageHandlers = [];
  }

  /**
   * 连接传输层（支持自动降级）
   */
  async connect(): Promise<void> {
    // 如果指定了固定模式，只尝试该模式
    if (this.mode !== 'auto') {
      return this._connectMode(this.mode as 'redis' | 'sse-cloud');
    }

    // 自动模式：按降级顺序尝试
    for (const mode of this.fallbackOrder) {
      try {
        console.log(`[TransportManager] 尝试连接: ${mode}`);
        await this._connectMode(mode);
        console.log(`[TransportManager] ✓ 使用传输方式: ${mode}`);
        return;
      } catch (error) {
        console.warn(`[TransportManager] ✗ ${mode} 连接失败: ${(error as Error).message}`);
      }
    }

    throw new Error('所有传输方式均不可用');
  }

  /**
   * 连接指定模式
   */
  private async _connectMode(mode: 'redis' | 'sse-cloud'): Promise<void> {
    const transport = this._createTransport(mode);
    await transport.connect();

    // 设置消息处理器
    transport.onMessage((message) => {
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[TransportManager] 消息处理器错误:', error);
        }
      });
    });

    this.currentTransport = transport;
    this.mode = mode;
  }

  /**
   * 创建传输实例
   */
  private _createTransport(mode: 'redis' | 'sse-cloud'): Transport {
    switch (mode) {
      case 'redis':
        if (!this.config.transport?.redis?.enabled) {
          throw new Error('Redis 未启用');
        }
        return new RedisTransport(this.config.transport.redis);

      case 'sse-cloud':
        if (!this.config.transport?.sse?.cloud?.enabled) {
          throw new Error('SSE Cloud 未启用');
        }
        return new SSECloudTransport(this.config.transport.sse.cloud);

      default:
        throw new Error(`未知传输方式: ${mode}`);
    }
  }

  /**
   * 订阅频道（Redis 专用，SSE 自动推送无需订阅）
   */
  async subscribe(channel: string): Promise<void> {
    if (this.currentTransport instanceof RedisTransport) {
      return this.currentTransport.subscribe(channel);
    } else {
      // SSE 等其他传输方式不需要订阅
      console.log(`[TransportManager] ${this.mode} 模式无需手动订阅（自动推送）`);
    }
  }

  /**
   * 发送消息
   */
  async send(message: Record<string, unknown>, channel?: string): Promise<void> {
    if (!this.currentTransport) {
      throw new Error('传输层未连接');
    }
    return this.currentTransport.send(message, channel);
  }

  /**
   * 注册消息处理器
   */
  onMessage(callback: MessageHandler): void {
    this.messageHandlers.push(callback);
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.currentTransport) {
      await this.currentTransport.disconnect();
      this.currentTransport = null;
    }
  }

  /**
   * 获取传输状态
   */
  getStatus(): TransportManagerStatus {
    if (!this.currentTransport) {
      return { connected: false, mode: null, timestamp: Date.now() };
    }
    return {
      ...this.currentTransport.getStatus(),
      mode: this.mode as TransportMode
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.currentTransport) return false;
    return this.currentTransport.healthCheck();
  }
}

export default TransportManager;
export type { TransportManagerConfig, TransportManagerStatus, TransportMode };