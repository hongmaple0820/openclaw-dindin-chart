/**
 * SSE 服务器
 * 
 * 功能：
 * - 处理 SSE 连接
 * - 心跳机制
 * - 断线重连
 * - 广播消息
 * 
 * 遵循 W3C SSE 规范
 */

const http = require('http');
const EventEmitter = require('events');

class SSEServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      port: options.port || 3010,
      host: options.host || '0.0.0.0',
      path: options.path || '/events',
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 秒
      connectionTimeout: options.connectionTimeout || 300000, // 5 分钟
      retryInterval: options.retryInterval || 3000, // 客户端重连间隔
      maxConnections: options.maxConnections || 1000,
      cors: options.cors || {
        origins: ['*'],
        methods: ['GET', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'X-Instance-Id']
      },
      ...options
    };

    // HTTP 服务器
    this.server = null;

    // 连接管理器（外部注入）
    this.connectionManager = null;

    // Token 认证（外部注入）
    this.tokenAuth = null;

    // 客户端连接: connectionId -> { res, instanceId, userId, metadata }
    this.clients = new Map();

    // 心跳定时器
    this.heartbeatTimer = null;

    // 统计
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      messagesSent: 0,
      messagesFailed: 0,
      bytesSent: 0
    };

    // 运行状态
    this.running = false;
  }

  /**
   * 设置依赖
   */
  setDependencies(connectionManager, tokenAuth) {
    this.connectionManager = connectionManager;
    this.tokenAuth = tokenAuth;
  }

  /**
   * 启动服务器
   */
  start() {
    if (this.running) {
      console.log('[SSE Server] 服务器已在运行');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.on('error', (error) => {
      console.error('[SSE Server] 服务器错误:', error);
      this.emit('error', error);
    });

    this.server.listen(this.config.port, this.config.host, () => {
      this.running = true;
      console.log(`[SSE Server] 服务器已启动: http://${this.config.host}:${this.config.port}${this.config.path}`);
      this.emit('start', { port: this.config.port, host: this.config.host });
    });

    this.startHeartbeat();
  }

  /**
   * 停止服务器
   */
  stop() {
    if (!this.running) {
      return;
    }

    console.log('[SSE Server] 正在停止服务器...');

    // 关闭所有客户端连接
    for (const [connectionId] of this.clients) {
      this.disconnectClient(connectionId, 'server-shutdown');
    }

    // 停止心跳
    this.stopHeartbeat();

    // 关闭服务器
    if (this.server) {
      this.server.close(() => {
        console.log('[SSE Server] 服务器已停止');
        this.emit('stop');
      });
    }

    this.running = false;
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req, res) {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      this.handleCORS(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    // 只处理 GET 请求
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // 检查路径
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith(this.config.path)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // 认证检查
    const authResult = await this.authenticate(req);
    if (!authResult.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: authResult.error }));
      return;
    }

    // 检查连接数限制
    if (this.clients.size >= this.config.maxConnections) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Maximum connections reached' }));
      return;
    }

    // 建立 SSE 连接
    this.handleSSE(req, res, authResult.tokenData, url);
  }

  /**
   * 处理 CORS
   */
  handleCORS(req, res) {
    const origin = req.headers.origin;
    
    if (this.config.cors.origins.includes('*') || this.config.cors.origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', this.config.cors.headers.join(', '));
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }

  /**
   * 认证请求
   */
  async authenticate(req) {
    // 从 URL 查询参数获取 token
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return { valid: false, error: 'Missing token' };
    }

    // 验证 token
    const tokenData = await this.tokenAuth?.validateToken(token);
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    // 检查权限
    if (!tokenData.permissions.includes('sync:pull')) {
      return { valid: false, error: 'Insufficient permissions' };
    }

    return { valid: true, tokenData };
  }

  /**
   * 处理 SSE 连接
   */
  handleSSE(req, res, tokenData, url) {
    const connectionId = this.generateConnectionId();
    const instanceId = tokenData.instanceId;
    const userId = url.searchParams.get('userId') || tokenData.instanceId;

    // 设置 SSE 响应头
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
      'Access-Control-Allow-Origin': req.headers.origin || '*'
    };

    // 发送 retry 建议
    res.writeHead(200, headers);

    // 创建客户端记录
    const clientData = {
      res,
      connectionId,
      instanceId,
      userId,
      tokenData,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      lastHeartbeat: Date.now(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      metadata: {
        userAgent: req.headers['user-agent'],
        lastEventId: req.headers['last-event-id']
      }
    };

    this.clients.set(connectionId, clientData);
    this.stats.totalConnections++;

    // 注册到连接管理器
    if (this.connectionManager) {
      this.connectionManager.addConnection(connectionId, instanceId, {
        userId,
        ip: clientData.ip
      });
    }

    // 发送初始连接消息
    this.send(connectionId, 'connected', {
      connectionId,
      instanceId,
      userId,
      timestamp: Date.now(),
      retryInterval: this.config.retryInterval,
      message: 'SSE connection established'
    });

    console.log(`[SSE Server] 客户端已连接: ${connectionId} (实例: ${instanceId}, 用户: ${userId})`);
    this.emit('connect', { connectionId, instanceId, userId, ip: clientData.ip });

    // 处理客户端断开
    res.on('close', () => {
      this.disconnectClient(connectionId, 'client-close');
    });

    res.on('error', (error) => {
      console.error(`[SSE Server] 连接错误: ${connectionId}`, error.message);
      this.disconnectClient(connectionId, 'error');
    });
  }

  /**
   * 断开客户端连接
   */
  disconnectClient(connectionId, reason = 'unknown') {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    try {
      // 尝试发送断开消息
      if (!client.res.writableEnded) {
        this.send(connectionId, 'disconnect', {
          reason,
          timestamp: Date.now()
        });
        client.res.end();
      }
    } catch (error) {
      // 忽略已关闭的连接
    }

    this.clients.delete(connectionId);
    this.stats.totalDisconnections++;

    // 从连接管理器移除
    if (this.connectionManager) {
      this.connectionManager.removeConnection(connectionId, reason);
    }

    console.log(`[SSE Server] 客户端已断开: ${connectionId} (原因: ${reason})`);
    this.emit('disconnect', { connectionId, reason, instanceId: client.instanceId });

    return true;
  }

  /**
   * 发送 SSE 消息（内部方法）
   */
  _sendRaw(res, event, data, id = null) {
    try {
      if (res.writableEnded) {
        return false;
      }

      let message = '';
      
      // 事件 ID（用于断线重连）
      if (id !== null) {
        message += `id: ${id}\n`;
      }
      
      // 事件类型
      if (event) {
        message += `event: ${event}\n`;
      }
      
      // 数据（支持多行）
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const lines = dataStr.split('\n');
      for (const line of lines) {
        message += `data: ${line}\n`;
      }
      
      message += '\n';

      res.write(message);
      this.stats.bytesSent += message.length;

      return true;
    } catch (error) {
      console.error('[SSE Server] 发送失败:', error.message);
      return false;
    }
  }

  /**
   * 发送消息到指定客户端
   */
  send(connectionId, event, data, id = null) {
    const client = this.clients.get(connectionId);
    if (!client) {
      return false;
    }

    const sent = this._sendRaw(client.res, event, data, id);

    if (sent) {
      client.lastActivity = Date.now();
      this.stats.messagesSent++;

      if (this.connectionManager) {
        this.connectionManager.incrementMessageCount(connectionId);
      }
    } else {
      this.stats.messagesFailed++;
      if (this.connectionManager) {
        this.connectionManager.incrementErrorCount(connectionId);
      }
    }

    return sent;
  }

  /**
   * 发送消息到指定用户的所有连接
   */
  sendToUser(userId, event, data) {
    let sentCount = 0;

    for (const [connectionId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.send(connectionId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * 发送消息到指定实例的所有连接
   */
  sendToInstance(instanceId, event, data) {
    let sentCount = 0;

    for (const [connectionId, client] of this.clients.entries()) {
      if (client.instanceId === instanceId) {
        if (this.send(connectionId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(event, data, excludeIds = []) {
    const excludeSet = new Set(Array.isArray(excludeIds) ? excludeIds : [excludeIds]);
    let sentCount = 0;

    for (const connectionId of this.clients.keys()) {
      if (!excludeSet.has(connectionId)) {
        if (this.send(connectionId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * 广播消息到特定频道
   */
  broadcastToChannel(channel, event, data) {
    let sentCount = 0;

    for (const [connectionId, client] of this.clients.entries()) {
      if (client.channels?.has(channel)) {
        if (this.send(connectionId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送心跳到所有客户端
   */
  sendHeartbeats() {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;

    for (const [connectionId, client] of this.clients.entries()) {
      try {
        // 检查超时
        const elapsed = now - client.lastActivity;
        if (elapsed > timeout) {
          console.log(`[SSE Server] 客户端超时: ${connectionId}`);
          this.disconnectClient(connectionId, 'timeout');
          continue;
        }

        // 发送心跳
        const sent = this.send(connectionId, 'heartbeat', {
          timestamp: now,
          serverTime: now
        });

        if (sent) {
          client.lastHeartbeat = now;
        } else {
          // 发送失败，断开连接
          this.disconnectClient(connectionId, 'heartbeat-failed');
        }
      } catch (error) {
        console.error(`[SSE Server] 心跳发送失败: ${connectionId}`, error.message);
        this.disconnectClient(connectionId, 'heartbeat-error');
      }
    }
  }

  /**
   * 更新客户端心跳时间
   */
  updateHeartbeat(connectionId) {
    const client = this.clients.get(connectionId);
    if (client) {
      client.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * 订阅频道
   */
  subscribeChannel(connectionId, channel) {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    if (!client.channels) {
      client.channels = new Set();
    }

    client.channels.add(channel);
    return true;
  }

  /**
   * 取消订阅频道
   */
  unsubscribeChannel(connectionId, channel) {
    const client = this.clients.get(connectionId);
    if (!client || !client.channels) return false;

    return client.channels.delete(channel);
  }

  // ==================== 工具方法 ====================

  /**
   * 生成连接 ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取在线客户端列表
   */
  getOnlineClients() {
    return Array.from(this.clients.entries()).map(([id, client]) => ({
      connectionId: id,
      instanceId: client.instanceId,
      userId: client.userId,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      ip: client.ip
    }));
  }

  /**
   * 获取客户端详情
   */
  getClient(connectionId) {
    const client = this.clients.get(connectionId);
    if (!client) return null;

    return {
      connectionId,
      instanceId: client.instanceId,
      userId: client.userId,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      ip: client.ip,
      channels: client.channels ? Array.from(client.channels) : []
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      running: this.running,
      currentConnections: this.clients.size,
      maxConnections: this.config.maxConnections,
      ...this.stats,
      config: {
        port: this.config.port,
        host: this.config.host,
        heartbeatInterval: this.config.heartbeatInterval,
        connectionTimeout: this.config.connectionTimeout
      }
    };
  }

  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: this.running ? 'healthy' : 'stopped',
      connections: this.clients.size,
      uptime: this.running ? process.uptime() : 0
    };
  }
}

module.exports = SSEServer;