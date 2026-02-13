const Transport = require('./base')
const { EventSource } = require('eventsource')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

/**
 * SSE 云端传输实现
 * 
 * 架构：
 * - SSE 连接（GET /sse/connect）：接收消息
 * - HTTP POST（POST /sse/send）：发送消息
 * - 会话订阅：基于 conversationId 路由消息
 */
class SSECloudTransport extends Transport {
  constructor(config) {
    super(config)
    this.eventSource = null
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = config.reconnect?.maxRetries || 10
    this.reconnectDelay = 1000
    this.heartbeatInterval = 30000
    this.instanceId = config.instanceId || uuidv4()
    this.subscriptions = new Set()
    this.userBindings = new Map()
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

  async healthCheck() {
    try {
      if (!this.connected) return false
      
      return this.eventSource && this.eventSource.readyState === EventSource.OPEN
    } catch (error) {
      console.error('[SSECloudTransport] 健康检查失败:', error)
      return false
    }
  }

  async subscribeConversation(conversationId) {
    if (!this.connected) {
      throw new Error('SSE 未连接')
    }

    if (this.subscriptions.has(conversationId)) {
      return true
    }

    try {
      const subscribeUrl = `${this.config.endpoint}/sse/subscribe`
      
      const response = await axios.post(subscribeUrl, {
        apiKey: this.config.apiKey,
        instanceId: this.instanceId,
        conversationId
      }, {
        timeout: 5000
      })

      if (response.data.success) {
        this.subscriptions.add(conversationId)
        console.log(`[SSECloudTransport] 已订阅会话: ${conversationId}`)
        return true
      } else {
        throw new Error(response.data.error || '订阅失败')
      }
    } catch (error) {
      console.error('[SSECloudTransport] 订阅会话失败:', error.message)
      throw error
    }
  }

  async unsubscribeConversation(conversationId) {
    if (!this.subscriptions.has(conversationId)) {
      return true
    }

    try {
      const unsubscribeUrl = `${this.config.endpoint}/sse/unsubscribe`
      
      const response = await axios.post(unsubscribeUrl, {
        apiKey: this.config.apiKey,
        instanceId: this.instanceId,
        conversationId
      }, {
        timeout: 5000
      })

      if (response.data.success) {
        this.subscriptions.delete(conversationId)
        console.log(`[SSECloudTransport] 已取消订阅会话: ${conversationId}`)
        return true
      }
      return false
    } catch (error) {
      console.error('[SSECloudTransport] 取消订阅失败:', error.message)
      return false
    }
  }

  async sendToConversation(message, conversationId) {
    if (!this.connected) {
      throw new Error('SSE 未连接')
    }

    try {
      const sendUrl = `${this.config.endpoint}/sse/send`
      
      const response = await axios.post(sendUrl, {
        apiKey: this.config.apiKey,
        instanceId: this.instanceId,
        conversationId,
        message
      }, {
        timeout: 5000
      })

      if (response.data.success) {
        console.log(`[SSECloudTransport] 消息已发送到会话: ${conversationId}`)
        return true
      } else {
        throw new Error(response.data.error || '发送失败')
      }
    } catch (error) {
      console.error('[SSECloudTransport] 发送消息到会话失败:', error.message)
      throw error
    }
  }

  bindUser(userId, sessionId = null) {
    this.userBindings.set(userId, {
      sessionId,
      connectedAt: Date.now()
    })
    console.log(`[SSECloudTransport] 用户绑定: ${userId}`)
  }

  unbindUser(userId) {
    this.userBindings.delete(userId)
    console.log(`[SSECloudTransport] 用户解绑: ${userId}`)
  }

  getUserSession(userId) {
    const binding = this.userBindings.get(userId)
    return binding ? binding.sessionId : null
  }

  getConnectedUsers() {
    return Array.from(this.userBindings.entries()).map(([userId, data]) => ({
      userId,
      sessionId: data.sessionId,
      connectedAt: data.connectedAt
    }))
  }

  async registerInstance(name, endpoint) {
    try {
      const registerUrl = `${this.config.endpoint}/sse/instance/register`
      
      const response = await axios.post(registerUrl, {
        apiKey: this.config.apiKey,
        instanceId: this.instanceId,
        name,
        endpoint
      }, {
        timeout: 5000
      })

      if (response.data.success) {
        console.log(`[SSECloudTransport] 实例已注册: ${this.instanceId}`)
        return true
      }
      return false
    } catch (error) {
      console.error('[SSECloudTransport] 实例注册失败:', error.message)
      return false
    }
  }

  async unregisterInstance() {
    try {
      const unregisterUrl = `${this.config.endpoint}/sse/instance/unregister`
      
      await axios.post(unregisterUrl, {
        apiKey: this.config.apiKey,
        instanceId: this.instanceId
      }, {
        timeout: 5000
      })

      console.log(`[SSECloudTransport] 实例已注销: ${this.instanceId}`)
    } catch (error) {
      console.error('[SSECloudTransport] 实例注销失败:', error.message)
    }
  }

  getStatus() {
    const baseStatus = super.getStatus()
    return {
      ...baseStatus,
      mode: 'sse-cloud',
      endpoint: this.config.endpoint,
      instanceId: this.instanceId,
      subscriptions: Array.from(this.subscriptions),
      connectedUsers: this.userBindings.size,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    }
  }
}

module.exports = SSECloudTransport
