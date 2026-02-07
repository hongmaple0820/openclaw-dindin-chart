const EventEmitter = require('events');

/**
 * SSE 服务端推送
 * 实现实时消息推送，替代轮询
 */
class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // 在线客户端：userId -> response
    this.heartbeatInterval = 30000; // 30s 心跳
    
    // 启动心跳
    this.startHeartbeat();
  }

  /**
   * 客户端连接
   */
  connect(userId, res) {
    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    });

    // 发送初始连接消息
    this.send(res, 'connected', {
      userId,
      timestamp: Date.now(),
      message: 'SSE 连接已建立',
    });

    // 保存客户端
    this.clients.set(userId, res);
    
    console.log(`[SSE] 客户端已连接: ${userId} (在线: ${this.clients.size})`);
    
    // 通知其他客户端
    this.broadcast('user-online', { userId }, userId);

    // 客户端断开时清理
    res.on('close', () => {
      this.disconnect(userId);
    });
  }

  /**
   * 客户端断开
   */
  disconnect(userId) {
    if (this.clients.has(userId)) {
      this.clients.delete(userId);
      console.log(`[SSE] 客户端已断开: ${userId} (在线: ${this.clients.size})`);
      
      // 通知其他客户端
      this.broadcast('user-offline', { userId });
    }
  }

  /**
   * 发送消息到指定客户端
   */
  send(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('[SSE] 发送失败:', error.message);
    }
  }

  /**
   * 推送新消息
   */
  pushMessage(userId, message) {
    const client = this.clients.get(userId);
    if (client) {
      this.send(client, 'message', message);
      console.log(`[SSE] 推送消息到 ${userId}:`, message.content?.substring(0, 30));
    }
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(event, data, excludeUserId = null) {
    for (const [userId, res] of this.clients.entries()) {
      if (userId !== excludeUserId) {
        this.send(res, event, data);
      }
    }
  }

  /**
   * 心跳检测
   */
  startHeartbeat() {
    setInterval(() => {
      for (const [userId, res] of this.clients.entries()) {
        try {
          this.send(res, 'ping', { timestamp: Date.now() });
        } catch (error) {
          // 客户端已断开
          this.disconnect(userId);
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers() {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查用户是否在线
   */
  isOnline(userId) {
    return this.clients.has(userId);
  }

  /**
   * 获取在线人数
   */
  getOnlineCount() {
    return this.clients.size;
  }
}

module.exports = new SSEManager();
