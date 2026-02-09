const RedisTransport = require('./redis-transport')

/**
 * 传输管理器
 * 负责传输方式的创建、连接和故障切换
 */
class TransportManager {
  constructor(config) {
    this.config = config
    this.currentTransport = null
    this.mode = config.transport?.mode || 'auto'
    this.fallbackOrder = config.fallback?.order || ['redis']
    this.messageHandlers = []
  }

  /**
   * 连接传输层（支持自动降级）
   */
  async connect() {
    // 如果指定了固定模式，只尝试该模式
    if (this.mode !== 'auto') {
      return this._connectMode(this.mode)
    }

    // 自动模式：按降级顺序尝试
    for (const mode of this.fallbackOrder) {
      try {
        console.log(`[TransportManager] 尝试连接: ${mode}`)
        await this._connectMode(mode)
        console.log(`[TransportManager] ✓ 使用传输方式: ${mode}`)
        return
      } catch (error) {
        console.warn(`[TransportManager] ✗ ${mode} 连接失败: ${error.message}`)
      }
    }

    throw new Error('所有传输方式均不可用')
  }

  /**
   * 连接指定模式
   */
  async _connectMode(mode) {
    const transport = this._createTransport(mode)
    await transport.connect()

    // 设置消息处理器
    transport.onMessage((message) => {
      this.messageHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('[TransportManager] 消息处理器错误:', error)
        }
      })
    })

    this.currentTransport = transport
    this.mode = mode
  }

  /**
   * 创建传输实例
   */
  _createTransport(mode) {
    switch (mode) {
      case 'redis':
        if (!this.config.transport?.redis?.enabled) {
          throw new Error('Redis 未启用')
        }
        return new RedisTransport(this.config.transport.redis)

      // 后续添加更多传输方式
      // case 'sse-local':
      //   return new SSELocalTransport(this.config.transport.sse.local)
      
      default:
        throw new Error(`未知传输方式: ${mode}`)
    }
  }

  /**
   * 订阅频道（Redis 专用）
   */
  async subscribe(channel) {
    if (this.currentTransport instanceof RedisTransport) {
      return this.currentTransport.subscribe(channel)
    } else {
      console.warn('[TransportManager] 当前传输方式不支持 subscribe()')
    }
  }

  /**
   * 发送消息
   */
  async send(message, channel) {
    if (!this.currentTransport) {
      throw new Error('传输层未连接')
    }
    return this.currentTransport.send(message, channel)
  }

  /**
   * 注册消息处理器
   */
  onMessage(callback) {
    this.messageHandlers.push(callback)
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.currentTransport) {
      await this.currentTransport.disconnect()
      this.currentTransport = null
    }
  }

  /**
   * 获取传输状态
   */
  getStatus() {
    if (!this.currentTransport) {
      return { connected: false, mode: null }
    }
    return this.currentTransport.getStatus()
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.currentTransport) return false
    return this.currentTransport.healthCheck()
  }
}

module.exports = TransportManager
