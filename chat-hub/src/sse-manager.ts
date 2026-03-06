const EventEmitter = require('events');

/**
 * SSE 服务端推送管理器
 * 
 * 功能：
 * - 实时消息推送，替代轮询
 * - 心跳检测
 * - 连接状态追踪
 * - 用户上线/下线通知
 */
class SSEManager extends EventEmitter {
  config: any;
  clients: Map<string, any>;
  heartbeatTimer: NodeJS.Timeout | null;
  stats: { totalConnections: number; totalDisconnections: number; messagesSent: number; messagesFailed: number };

  constructor(options = {}) {
    super();
    
    // 配置
    this.config = {
      heartbeatInterval: options.heartbeatInterval || 30000, // 30s
      maxConnections: options.maxConnections || 1000,
      timeout: options.timeout || 300000, // 5 分钟无响应断开
      ...options
    };
    
    // 在线客户端：userId -> { response, connectedAt, lastHeartbeat, metadata }
    this.clients = new Map();
    
    // 心跳定时器
    this.heartbeatTimer = null;
    
    // 统计信息
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      messagesSent: 0,
      messagesFailed: 0
    };
    
    // 启动心跳
    this.startHeartbeat();
    
    console.log('[SSE Manager] 初始化完成，心跳间隔:', this.config.heartbeatInterval, 'ms');
  }

  /**
   * 客户端连接
   * @param {string} userId 用户 ID
   * @param {Response} res Express response 对象
   * @param {Object} metadata 可选的元数据
   */
  connect(userId, res, metadata = {}) {
    // 检查最大连接数
    if (this.clients.size >= this.config.maxConnections) {
      console.warn('[SSE Manager] 已达最大连接数，拒绝连接:', userId);
      res.status(503).json({
        success: false,
        error: 'Maximum connections reached'
      });
      return false;
    }
    
    // 如果用户已连接，先断开旧连接
    if (this.clients.has(userId)) {
      console.log(`[SSE Manager] 用户重连，断开旧连接: ${userId}`);
      this._disconnectClient(userId, 'reconnect');
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
      'Access-Control-Allow-Origin': '*',
    });

    // 创建客户端记录
    const clientData = {
      response: res,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      metadata,
      ip: res.req?.ip || res.req?.connection?.remoteAddress
    };
    
    this.clients.set(userId, clientData);
    this.stats.totalConnections++;

    // 发送初始连接消息
    this._send(res, 'connected', {
      userId,
      timestamp: Date.now(),
      message: 'SSE 连接已建立',
      heartbeatInterval: this.config.heartbeatInterval
    });

    console.log(`[SSE Manager] 客户端已连接: ${userId} (在线: ${this.clients.size})`);
    
    // 发出连接事件
    this.emit('connect', { userId, metadata, ip: clientData.ip });
    
    // 通知其他客户端
    this.broadcast('user-online', { 
      userId, 
      timestamp: Date.now(),
      metadata
    }, userId);

    // 客户端断开时清理
    res.on('close', () => {
      this._disconnectClient(userId, 'client-close');
    });
    
    res.on('error', (error) => {
      console.error(`[SSE Manager] 客户端连接错误: ${userId}`, error.message);
      this._disconnectClient(userId, 'error');
    });
    
    return true;
  }

  /**
   * 内部断开客户端连接
   */
  _disconnectClient(userId, reason = 'unknown') {
    if (!this.clients.has(userId)) return;
    
    const clientData = this.clients.get(userId);
    
    try {
      // 尝试结束响应
      if (clientData.response && !clientData.response.writableEnded) {
        clientData.response.end();
      }
    } catch (error: any) {
      // 忽略已关闭的响应
    }
    
    this.clients.delete(userId);
    this.stats.totalDisconnections++;
    
    console.log(`[SSE Manager] 客户端已断开: ${userId} (原因: ${reason}, 在线: ${this.clients.size})`);
    
    // 发出断开事件
    this.emit('disconnect', { userId, reason });
    
    // 通知其他客户端
    this.broadcast('user-offline', { 
      userId, 
      timestamp: Date.now(),
      reason 
    });
  }

  /**
   * 主动断开客户端连接
   */
  disconnect(userId) {
    this._disconnectClient(userId, 'server-disconnect');
  }

  /**
   * 内部发送 SSE 消息
   */
  _send(res, event, data) {
    try {
      if (res.writableEnded) {
        return false;
      }
      
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error: any) {
      console.error('[SSE Manager] 发送失败:', error.message);
      return false;
    }
  }

  /**
   * 发送消息到指定客户端
   * @param {string} userId 用户 ID
   * @param {string} event 事件名称
   * @param {any} data 数据
   */
  sendToUser(userId, event, data) {
    const clientData = this.clients.get(userId);
    if (!clientData) {
      return false;
    }
    
    const sent = this._send(clientData.response, event, data);
    
    if (sent) {
      this.stats.messagesSent++;
    } else {
      this.stats.messagesFailed++;
      // 发送失败，断开连接
      this._disconnectClient(userId, 'send-failed');
    }
    
    return sent;
  }

  /**
   * 推送新消息（简化接口）
   */
  pushMessage(userId, message) {
    return this.sendToUser(userId, 'message', message);
  }

  /**
   * 发送通知
   */
  sendNotification(userId, notification) {
    return this.sendToUser(userId, 'notification', notification);
  }

  /**
   * 广播消息到所有客户端
   * @param {string} event 事件名称
   * @param {any} data 数据
   * @param {string|string[]} excludeUsers 排除的用户
   */
  broadcast(event, data, excludeUsers = []) {
    const excludeSet = new Set(Array.isArray(excludeUsers) ? excludeUsers : [excludeUsers]);
    let sentCount = 0;
    
    for (const [userId, clientData] of this.clients.entries()) {
      if (!excludeSet.has(userId)) {
        const sent = this._send(clientData.response, event, data);
        if (sent) {
          sentCount++;
          this.stats.messagesSent++;
        } else {
          this.stats.messagesFailed++;
        }
      }
    }
    
    return sentCount;
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [userId, clientData] of this.clients.entries()) {
        try {
          // 检查超时
          const elapsed = now - clientData.lastHeartbeat;
          if (elapsed > this.config.timeout) {
            console.log(`[SSE Manager] 客户端超时，断开连接: ${userId}`);
            this._disconnectClient(userId, 'timeout');
            continue;
          }
          
          // 发送心跳
          const sent = this._send(clientData.response, 'heartbeat', { 
            timestamp: now 
          });
          
          if (sent) {
            clientData.lastHeartbeat = now;
          } else {
            // 发送失败，断开连接
            this._disconnectClient(userId, 'heartbeat-failed');
          }
        } catch (error: any) {
          console.error(`[SSE Manager] 心跳发送失败: ${userId}`, error.message);
          this._disconnectClient(userId, 'heartbeat-error');
        }
      }
    }, this.config.heartbeatInterval);
    
    // 防止定时器阻止进程退出
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 更新客户端心跳时间（客户端收到心跳后可调用）
   */
  updateHeartbeat(userId) {
    const clientData = this.clients.get(userId);
    if (clientData) {
      clientData.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  /**
   * 获取在线用户列表（仅用户 ID）
   */
  getOnlineUsers() {
    return Array.from(this.clients.keys());
  }

  /**
   * 获取在线用户详情
   */
  getOnlineUsersDetails() {
    const users = [];
    for (const [userId, data] of this.clients.entries()) {
      users.push({
        userId,
        connectedAt: data.connectedAt,
        lastHeartbeat: data.lastHeartbeat,
        metadata: data.metadata,
        ip: data.ip
      });
    }
    return users;
  }

  /**
   * 获取单个用户详情
   */
  getUserDetails(userId) {
    const data = this.clients.get(userId);
    if (!data) return null;
    
    return {
      userId,
      connectedAt: data.connectedAt,
      lastHeartbeat: data.lastHeartbeat,
      metadata: data.metadata,
      ip: data.ip
    };
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

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      online: this.clients.size,
      maxConnections: this.config.maxConnections,
      totalConnections: this.stats.totalConnections,
      totalDisconnections: this.stats.totalDisconnections,
      messagesSent: this.stats.messagesSent,
      messagesFailed: this.stats.messagesFailed,
      config: {
        heartbeatInterval: this.config.heartbeatInterval,
        timeout: this.config.timeout
      }
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // 如果心跳间隔变更，重启心跳
    if (newConfig.heartbeatInterval) {
      this.startHeartbeat();
    }
    
    console.log('[SSE Manager] 配置已更新:', this.config);
  }

  /**
   * 关闭所有连接
   */
  closeAll() {
    console.log('[SSE Manager] 关闭所有连接...');
    
    for (const userId of this.clients.keys()) {
      this._disconnectClient(userId, 'server-shutdown');
    }
    
    this.stopHeartbeat();
  }
}

// 单例导出
const sseManager = new SSEManager();

module.exports = sseManager;
module.exports.SSEManager = SSEManager; // 也导出类，支持测试
export {};
