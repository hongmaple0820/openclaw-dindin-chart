const Transport = require('./base')
const { EventSource } = require('eventsource')
const axios = require('axios')

/**
 * SSE 云端传输实现
 * 
 * 架构：
 * - SSE 连接（GET /sse/connect）：接收消息
 * - HTTP POST（POST /sse/send）：发送消息
 */
class SSECloudTransport extends Transport {
  constructor(config) {
    super(config)
    this.eventSource = null
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = config.reconnect?.maxRetries || 10
    this.reconnectDelay = 1000 // 初始重连延迟 1 秒
    this.heartbeatInterval = 30000 // 30 秒心跳
  }

  async connect() {
    try {
      console.log('[SSECloudTransport] 正在连接到云端 SSE...')
      console.log(`[SSECloudTransport] 端点: ${this.config.endpoint}`)

      // 构建连接 URL（带 API Key）
      const connectUrl = `${this.config.endpoint}/sse/connect?apiKey=${this.config.apiKey}`

      // 创建 SSE 连接
      this.eventSource = new EventSource(connectUrl)

      // 监听连接成功
      this.eventSource.onopen = () => {
        this.connected = true
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        console.log('[SSECloudTransport] ✓ SSE 连接成功')
        
        // 启动心跳
        this.startHeartbeat()
      }

      // 监听消息
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // 心跳消息
          if (data.type === 'heartbeat') {
            console.log('[SSECloudTransport] ♥ 收到心跳')
            return
          }

          // 普通消息
          if (data.type === 'message') {
            console.log(`[SSECloudTransport] 📨 收到消息: ${data.message.sender}`)
            this._handleMessage(data.message)
          }
        } catch (error) {
          console.error('[SSECloudTransport] 消息解析失败:', error)
        }
      }

      // 监听错误
      this.eventSource.onerror = (error) => {
        console.error('[SSECloudTransport] ✗ SSE 连接错误:', error.message || 'Unknown error')
        this.connected = false
        this.stopHeartbeat()
        
        // 自动重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect()
        } else {
          console.error('[SSECloudTransport] 已达最大重连次数，停止重连')
          throw new Error('SSE 连接失败，已达最大重连次数')
        }
      }

    } catch (error) {
      console.error('[SSECloudTransport] 连接失败:', error.message)
      throw error
    }
  }

  async disconnect() {
    try {
      console.log('[SSECloudTransport] 断开连接...')
      
      this.stopHeartbeat()
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      if (this.eventSource) {
        this.eventSource.close()
        this.eventSource = null
      }

      this.connected = false
      console.log('[SSECloudTransport] 已断开连接')
    } catch (error) {
      console.error('[SSECloudTransport] 断开连接失败:', error)
    }
  }

  async send(message, channel = 'default') {
    try {
      if (!this.connected) {
        throw new Error('SSE 未连接')
      }

      // 通过 HTTP POST 发送消息
      const sendUrl = `${this.config.endpoint}/sse/send`
      
      const response = await axios.post(sendUrl, {
        apiKey: this.config.apiKey,
        channel,
        message
      }, {
        timeout: 5000
      })

      if (response.data.success) {
        console.log(`[SSECloudTransport] 消息已发送`)
      } else {
        throw new Error(response.data.error || '发送失败')
      }
    } catch (error) {
      console.error('[SSECloudTransport] 发送消息失败:', error.message)
      throw error
    }
  }

  /**
   * 计划重连（指数退避）
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return
    }

    this.reconnectAttempts++
    console.log(`[SSECloudTransport] 计划重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${this.reconnectDelay}ms`)

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      
      try {
        await this.connect()
      } catch (error) {
        // 重连失败，继续计划下一次
      }
    }, this.reconnectDelay)

    // 指数退避（最大 30 秒）
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        // 发送心跳请求
        const pingUrl = `${this.config.endpoint}/sse/ping`
        await axios.post(pingUrl, {
          apiKey: this.config.apiKey
        }, {
          timeout: 3000
        })
        console.log('[SSECloudTransport] ♥ 心跳发送成功')
      } catch (error) {
        console.error('[SSECloudTransport] ♥ 心跳失败:', error.message)
        // 心跳失败触发重连
        this.connected = false
        this.scheduleReconnect()
      }
    }, this.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  getStatus() {
    const baseStatus = super.getStatus()
    return {
      ...baseStatus,
      mode: 'sse-cloud',
      endpoint: this.config.endpoint,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    }
  }

  async healthCheck() {
    try {
      if (!this.connected) return false
      
      // 简单检查连接状态
      return this.eventSource && this.eventSource.readyState === EventSource.OPEN
    } catch (error) {
      console.error('[SSECloudTransport] 健康检查失败:', error)
      return false
    }
  }
}

module.exports = SSECloudTransport
