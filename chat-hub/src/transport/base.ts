/**
 * Transport 基类
 * 定义所有传输方式的统一接口
 */

interface TransportConfig {
  [key: string]: unknown;
}

interface TransportStatus {
  connected: boolean;
  mode: string;
  timestamp: number;
}

type MessageHandler = (message: Record<string, unknown>) => void;

abstract class Transport {
  protected config: TransportConfig;
  protected messageHandlers: MessageHandler[];
  protected connected: boolean;

  constructor(config: TransportConfig) {
    this.config = config;
    this.messageHandlers = [];
    this.connected = false;
  }

  /**
   * 连接传输层
   */
  abstract connect(): Promise<void>;

  /**
   * 断开连接
   */
  abstract disconnect(): Promise<void>;

  /**
   * 发送消息
   */
  abstract send(message: Record<string, unknown>, channel?: string): Promise<void>;

  /**
   * 注册消息处理器
   */
  onMessage(callback: MessageHandler): void {
    this.messageHandlers.push(callback);
  }

  /**
   * 触发消息处理器
   */
  protected _handleMessage(message: Record<string, unknown>): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[Transport] 消息处理器错误:', error);
      }
    });
  }

  /**
   * 获取传输状态
   */
  getStatus(): TransportStatus {
    return {
      connected: this.connected,
      mode: this.constructor.name.replace('Transport', '').toLowerCase(),
      timestamp: Date.now()
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    return this.connected;
  }
}

export default Transport;
export type { TransportConfig, TransportStatus, MessageHandler };