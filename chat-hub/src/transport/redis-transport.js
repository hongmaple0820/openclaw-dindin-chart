const Transport = require('./base')
const ResilientRedis = require('../utils/resilient-redis')

/**
 * Redis Pub/Sub 传输实现
 */
class RedisTransport extends Transport {
  constructor(config) {
    super(config)
    this.redisClient = null
    this.subscriptions = new Map() // channel -> handler
  }

  async connect() {
    try {
      console.log('[RedisTransport] 正在连接 Redis...')
      
      // 创建 Redis 客户端
      this.redisClient = new ResilientRedis({
        host: this.config.host || 'localhost',
        port: this.config.port || 6379,
        password: this.config.password || null
      })

      await this.redisClient.connect()
      
      this.connected = true
      console.log('[RedisTransport] ✓ Redis 连接成功')
    } catch (error) {
      console.error('[RedisTransport] ✗ Redis 连接失败:', error.message)
      throw error
    }
  }

  async disconnect() {
    try {
      if (this.redisClient) {
        await this.redisClient.disconnect()
        this.connected = false
        console.log('[RedisTransport] 已断开连接')
      }
    } catch (error) {
      console.error('[RedisTransport] 断开连接失败:', error)
    }
  }

  async subscribe(channel) {
    try {
      await this.redisClient.subscribe(channel, (payload) => {
        try {
          const message = JSON.parse(payload)
          // 添加频道信息，方便区分
          message._channel = channel
          this._handleMessage(message)
        } catch (error) {
          console.error('[RedisTransport] 消息解析失败:', error)
        }
      })
      
      this.subscriptions.set(channel, true)
      console.log(`[RedisTransport] ✓ 已订阅频道: ${channel}`)
    } catch (error) {
      console.error(`[RedisTransport] ✗ 订阅频道失败 ${channel}:`, error.message)
      throw error
    }
  }

  async send(message, channel = 'chat:replies') {
    try {
      if (!this.connected) {
        throw new Error('Redis 未连接')
      }

      // 移除内部字段
      const { _channel, ...cleanMessage } = message

      await this.redisClient.publish(channel, JSON.stringify(cleanMessage))
      console.log(`[RedisTransport] 消息已发送到 ${channel}`)
    } catch (error) {
      console.error('[RedisTransport] 发送消息失败:', error)
      throw error
    }
  }

  getStatus() {
    const baseStatus = super.getStatus()
    return {
      ...baseStatus,
      mode: 'redis',
      host: this.config.host,
      port: this.config.port,
      subscribedChannels: Array.from(this.subscriptions.keys())
    }
  }

  async healthCheck() {
    try {
      if (!this.redisClient) return false
      
      // 获取状态
      const status = this.redisClient.getStatus()
      
      // 如果已连接且未降级，则健康
      if (status.connected && !status.degraded) {
        return true
      }
      
      // 如果正在重连，返回 false 但不记录错误
      if (status.connecting) {
        return false
      }
      
      // 降级模式下返回 false
      return false
    } catch (error) {
      console.error('[RedisTransport] 健康检查失败:', error)
      return false
    }
  }
}

module.exports = RedisTransport
