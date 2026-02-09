#!/usr/bin/env node
/**
 * SSE 云端服务器 Demo
 * 
 * 用于测试 SSE Cloud Transport
 * 生产环境需要更完善的实现（负载均衡、持久化等）
 */

const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 4000

// 中间件
app.use(cors())
app.use(express.json())

// 存储客户端连接
const clients = new Map() // apiKey -> response object
const apiKeys = new Set(['test-key-xiaolin', 'test-key-xiaozhu']) // 测试用的 API Key

/**
 * SSE 连接端点
 * GET /sse/connect?apiKey=xxx
 */
app.get('/sse/connect', (req, res) => {
  const { apiKey } = req.query

  // 验证 API Key
  if (!apiKey || !apiKeys.has(apiKey)) {
    return res.status(401).json({ success: false, error: '无效的 API Key' })
  }

  console.log(`[SSE Server] 新客户端连接: ${apiKey}`)

  // 设置 SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // 禁用 nginx 缓冲
  })

  // 发送初始连接消息
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Welcome to ChatHub SSE Cloud' })}\n\n`)

  // 保存客户端连接
  clients.set(apiKey, res)

  // 定期发送心跳（每 25 秒）
  const heartbeatInterval = setInterval(() => {
    if (clients.has(apiKey)) {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
    } else {
      clearInterval(heartbeatInterval)
    }
  }, 25000)

  // 客户端断开连接
  req.on('close', () => {
    console.log(`[SSE Server] 客户端断开: ${apiKey}`)
    clients.delete(apiKey)
    clearInterval(heartbeatInterval)
  })
})

/**
 * 发送消息端点
 * POST /sse/send
 * Body: { apiKey, channel, message }
 */
app.post('/sse/send', (req, res) => {
  const { apiKey, channel, message } = req.body

  // 验证 API Key
  if (!apiKey || !apiKeys.has(apiKey)) {
    return res.status(401).json({ success: false, error: '无效的 API Key' })
  }

  if (!message) {
    return res.status(400).json({ success: false, error: '缺少 message' })
  }

  console.log(`[SSE Server] 收到消息: ${message.sender} -> ${message.content?.substring(0, 30)}...`)

  // 广播给所有连接的客户端（除了发送者）
  let sentCount = 0
  for (const [clientKey, clientRes] of clients.entries()) {
    if (clientKey !== apiKey) {
      try {
        clientRes.write(`data: ${JSON.stringify({ type: 'message', message })}\n\n`)
        sentCount++
      } catch (error) {
        console.error(`[SSE Server] 发送失败到 ${clientKey}:`, error.message)
        clients.delete(clientKey)
      }
    }
  }

  console.log(`[SSE Server] 已广播到 ${sentCount} 个客户端`)
  res.json({ success: true, sentTo: sentCount })
})

/**
 * 心跳检测端点
 * POST /sse/ping
 * Body: { apiKey }
 */
app.post('/sse/ping', (req, res) => {
  const { apiKey } = req.body

  // 验证 API Key
  if (!apiKey || !apiKeys.has(apiKey)) {
    return res.status(401).json({ success: false, error: '无效的 API Key' })
  }

  // 检查客户端是否连接
  const connected = clients.has(apiKey)
  
  res.json({ 
    success: true, 
    connected,
    timestamp: Date.now()
  })
})

/**
 * 健康检查
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: clients.size,
    uptime: process.uptime()
  })
})

/**
 * 获取连接状态
 * GET /status
 */
app.get('/status', (req, res) => {
  const clientList = Array.from(clients.keys())
  res.json({
    server: 'ChatHub SSE Cloud Demo',
    clients: clientList.length,
    connectedClients: clientList,
    uptime: process.uptime()
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 SSE 云端服务器已启动！`)
  console.log(`📡 端点: http://localhost:${PORT}`)
  console.log(`✅ 健康检查: http://localhost:${PORT}/health`)
  console.log(`📊 状态查询: http://localhost:${PORT}/status`)
  console.log(`\n🔑 测试 API Keys:`)
  apiKeys.forEach(key => console.log(`   - ${key}`))
})
