import BasePlugin, { PluginConfig, ExecuteResult, PluginInfo } from './base-plugin';

export interface ChannelCapabilities {
  channelTypes: string[];
  features: {
    send: boolean;
    receive: boolean;
    reply: boolean;
    edit: boolean;
    delete: boolean;
    reactions: boolean;
  };
}

export type MessageCallback = (message: unknown) => void;

/**
 * 通道插件基类
 * 用于消息通道（如钉钉、Discord、微信等）
 */
class ChannelPlugin extends BasePlugin {
  protected channelTypes: string[];
  protected _messageCallbacks: Set<MessageCallback>;

  constructor(config: PluginConfig = {}) {
    super(config);
    this.type = 'channel';
    this.channelTypes = config.channelTypes || ['unknown'];
    this.capabilities = ['send', 'receive', ...this.capabilities];
    this._messageCallbacks = new Set();
  }

  /**
   * 发送消息
   * 子类必须实现
   * @param target - 目标（群ID、用户ID等）
   * @param message - 消息内容
   */
  async sendMessage(target: string, message: unknown): Promise<ExecuteResult> {
    throw new Error('sendMessage must be implemented by subclass');
  }

  /**
   * 注册消息回调
   * @param callback - 回调函数 (message) => void
   */
  onMessage(callback: MessageCallback): () => boolean {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    this._messageCallbacks.add(callback);

    // 返回取消订阅函数
    return () => this._messageCallbacks.delete(callback);
  }

  /**
   * 触发消息事件
   * @param message - 接收到的消息
   */
  protected _emitMessage(message: unknown): void {
    this._messageCallbacks.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`[ChannelPlugin] Message callback error:`, error);
      }
    });
  }

  /**
   * 获取支持的通道类型
   */
  getChannelTypes(): string[] {
    return this.channelTypes;
  }

  /**
   * 获取通道信息
   */
  async getChannelInfo(target: string): Promise<ExecuteResult> {
    return {
      success: false,
      error: 'getChannelInfo not implemented'
    };
  }

  /**
   * 获取通道成员列表
   */
  async getMembers(target: string): Promise<ExecuteResult> {
    return {
      success: false,
      error: 'getMembers not implemented'
    };
  }

  /**
   * 获取插件能力
   */
  getCapabilities(): ChannelCapabilities & Record<string, unknown> {
    return {
      channelTypes: this.channelTypes,
      features: {
        send: true,
        receive: true,
        reply: this.capabilities.includes('reply'),
        edit: this.capabilities.includes('edit'),
        delete: this.capabilities.includes('delete'),
        reactions: this.capabilities.includes('reactions')
      }
    };
  }

  /**
   * 执行功能
   */
  async execute(action: string, params: Record<string, unknown> = {}): Promise<ExecuteResult> {
    switch (action) {
      case 'send':
        return this.sendMessage(params.target as string, params.message);
      case 'getInfo':
        return this.getChannelInfo(params.target as string);
      case 'getMembers':
        return this.getMembers(params.target as string);
      default:
        return super.execute(action, params);
    }
  }
}

export default ChannelPlugin;