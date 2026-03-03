const BasePlugin = require('./base-plugin');

/**
 * 通道插件基类
 * 用于消息通道（如钉钉、Discord、微信等）
 */
class ChannelPlugin extends BasePlugin {
  constructor(config = {}) {
    super(config);
    this.type = 'channel';
    this.channelTypes = config.channelTypes || ['unknown'];
    this.capabilities = ['send', 'receive', ...this.capabilities];
    this._messageCallbacks = new Set();
  }

  /**
   * 发送消息
   * 子类必须实现
   * @param {string} target - 目标（群ID、用户ID等）
   * @param {object} message - 消息内容
   */
  async sendMessage(target, message) {
    throw new Error('sendMessage must be implemented by subclass');
  }

  /**
   * 注册消息回调
   * @param {function} callback - 回调函数 (message) => void
   */
  onMessage(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    this._messageCallbacks.add(callback);
    
    // 返回取消订阅函数
    return () => this._messageCallbacks.delete(callback);
  }

  /**
   * 触发消息事件
   * @param {object} message - 接收到的消息
   */
  _emitMessage(message) {
    for (const callback of this._messageCallbacks) {
      try {
        callback(message);
      } catch (error) {
        console.error(`[ChannelPlugin] Message callback error:`, error);
      }
    }
  }

  /**
   * 获取支持的通道类型
   */
  getChannelTypes() {
    return this.channelTypes;
  }

  /**
   * 获取通道信息
   */
  async getChannelInfo(target) {
    return { 
      success: false, 
      error: 'getChannelInfo not implemented' 
    };
  }

  /**
   * 获取通道成员列表
   */
  async getMembers(target) {
    return { 
      success: false, 
      error: 'getMembers not implemented' 
    };
  }

  /**
   * 获取插件能力
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
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
  async execute(action, params = {}) {
    switch (action) {
      case 'send':
        return this.sendMessage(params.target, params.message);
      case 'getInfo':
        return this.getChannelInfo(params.target);
      case 'getMembers':
        return this.getMembers(params.target);
      default:
        return super.execute(action, params);
    }
  }
}

module.exports = ChannelPlugin;
