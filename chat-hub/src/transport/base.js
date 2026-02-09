/**
 * Transport 基类
 * 定义所有传输方式的统一接口
 */
class Transport {
  constructor(config) {
    this.config = config
    this.messageHandlers = []
    this.connected = false
  }

  /**
   * 连接传输层
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented')
  }

  /**
   * 断开连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented')
  }

  /**
   * 发送消息
   * @param {Object} message - 消息对象
   * @returns {Promise<void>}
   */
  async send(message) {
    throw new Error('send() must be implemented')
  }

  /**
   * 注册消息处理器
   * @param {Function} callback - 消息处理回调
   */
  onMessage(callback) {
    this.messageHandlers.push(callback)
  }

  /**
   * 触发消息处理器
   * @param {Object} message - 消息对象
   */
  _handleMessage(message) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('[Transport] 消息处理器错误:', error)
      }
    })
  }

  /**
   * 获取传输状态
   * @returns {Object} 状态对象
   */
  getStatus() {
    return {
      connected: this.connected,
      mode: this.constructor.name.replace('Transport', '').toLowerCase(),
      timestamp: Date.now()
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return this.connected
  }
}

module.exports = Transport
