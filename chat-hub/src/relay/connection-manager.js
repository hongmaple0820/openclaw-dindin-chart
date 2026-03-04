/**
 * 连接管理器
 * 
 * 功能：
 * - 连接池管理
 * - 实例注册/注销
 * - 连接状态追踪
 * - 负载均衡
 */

const EventEmitter = require('events');

class ConnectionManager extends EventEmitter {
  constructor(db, options = {}) {
    super();
    
    this.db = db;
    this.config = {
      maxConnectionsPerInstance: options.maxConnectionsPerInstance || 100,
      maxTotalConnections: options.maxTotalConnections || 10000,
      instanceTimeout: options.instanceTimeout || 60000, // 1 分钟无 ping 则离线
      cleanupInterval: options.cleanupInterval || 30000, // 30 秒清理一次
      ...options
    };

    // 实例连接池: instanceId -> Set<connectionId>
    this.instanceConnections = new Map();
    
    // 连接详情: connectionId -> connectionData
    this.connections = new Map();
    
    // 实例状态缓存
    this.instanceCache = new Map();
    
    // 清理定时器
    this.cleanupTimer = null;
    
    // 统计
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalMessages: 0,
      totalErrors: 0,
      peakConnections: 0
    };

    this.startCleanup();
    console.log('[ConnectionManager] 初始化完成');
  }

  // ==================== 实例管理 ====================

  /**
   * 注册实例
   * @param {string} instanceId 实例 ID
   * @param {Object} options 实例配置
   */
  async registerInstance(instanceId, options = {}) {
    try {
      const { name, relayUrl, token, maxConnections, heartbeatInterval } = options;
      const now = Date.now();

      // 检查是否已注册
      const existing = this.instanceCache.get(instanceId);
      if (existing) {
        // 更新 ping 时间
        await this.updateInstancePing(instanceId);
        return { registered: false, reason: 'Already registered', instance: existing };
      }

      // 存储到数据库
      const stmt = this.db.prepare(`
        INSERT INTO relay_instances (id, name, token, relay_url, last_ping, status, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          token = excluded.token,
          relay_url = excluded.relay_url,
          last_ping = excluded.last_ping,
          status = excluded.status,
          config = excluded.config,
          updated_at = excluded.updated_at
      `);

      const instanceConfig = {
        maxConnections: maxConnections || this.config.maxConnectionsPerInstance,
        heartbeatInterval: heartbeatInterval || 30000
      };

      stmt.run(
        instanceId,
        name || `instance-${instanceId.substring(0, 8)}`,
        token,
        relayUrl,
        now,
        'online',
        JSON.stringify(instanceConfig),
        now,
        now
      );

      // 缓存实例信息
      const instanceData = {
        instanceId,
        name: name || `instance-${instanceId.substring(0, 8)}`,
        relayUrl,
        status: 'online',
        lastPing: now,
        config: instanceConfig,
        createdAt: now
      };

      this.instanceCache.set(instanceId, instanceData);
      this.instanceConnections.set(instanceId, new Set());

      this.emit('instance:register', instanceData);
      console.log(`[ConnectionManager] 实例已注册: ${instanceId}`);

      return { registered: true, instance: instanceData };
    } catch (error) {
      console.error('[ConnectionManager] 注册实例失败:', error);
      throw error;
    }
  }

  /**
   * 注销实例
   * @param {string} instanceId 
   */
  async unregisterInstance(instanceId) {
    try {
      // 断开所有连接
      const connectionIds = this.instanceConnections.get(instanceId);
      if (connectionIds) {
        for (const connId of connectionIds) {
          this.removeConnection(connId, 'instance-unregister');
        }
      }

      // 更新数据库状态
      const stmt = this.db.prepare(`
        UPDATE relay_instances
        SET status = 'offline', updated_at = ?
        WHERE id = ?
      `);
      stmt.run(Date.now(), instanceId);

      // 清理缓存
      this.instanceCache.delete(instanceId);
      this.instanceConnections.delete(instanceId);

      this.emit('instance:unregister', { instanceId });
      console.log(`[ConnectionManager] 实例已注销: ${instanceId}`);

      return true;
    } catch (error) {
      console.error('[ConnectionManager] 注销实例失败:', error);
      return false;
    }
  }

  /**
   * 更新实例 ping 时间
   * @param {string} instanceId 
   */
  async updateInstancePing(instanceId) {
    const now = Date.now();

    // 更新缓存
    const instance = this.instanceCache.get(instanceId);
    if (instance) {
      instance.lastPing = now;
      instance.status = 'online';
    }

    // 更新数据库（异步）
    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET last_ping = ?, status = 'online', updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, now, instanceId);
  }

  /**
   * 获取实例列表
   */
  getInstances() {
    return Array.from(this.instanceCache.values());
  }

  /**
   * 获取实例详情
   */
  getInstance(instanceId) {
    const instance = this.instanceCache.get(instanceId);
    const connections = this.instanceConnections.get(instanceId);
    
    if (!instance) return null;

    return {
      ...instance,
      connectionCount: connections ? connections.size : 0,
      connections: connections ? Array.from(connections) : []
    };
  }

  // ==================== 连接管理 ====================

  /**
   * 添加连接
   * @param {string} connectionId 连接 ID
   * @param {string} instanceId 实例 ID
   * @param {Object} metadata 连接元数据
   */
  addConnection(connectionId, instanceId, metadata = {}) {
    // 检查总连接数限制
    if (this.connections.size >= this.config.maxTotalConnections) {
      console.warn('[ConnectionManager] 已达最大连接数限制');
      return { success: false, reason: 'Max connections reached' };
    }

    // 检查实例连接数限制
    const instanceConns = this.instanceConnections.get(instanceId);
    const instance = this.instanceCache.get(instanceId);
    const maxConns = instance?.config?.maxConnections || this.config.maxConnectionsPerInstance;

    if (instanceConns && instanceConns.size >= maxConns) {
      console.warn(`[ConnectionManager] 实例 ${instanceId} 已达最大连接数`);
      return { success: false, reason: 'Instance max connections reached' };
    }

    const now = Date.now();
    const connectionData = {
      connectionId,
      instanceId,
      metadata,
      connectedAt: now,
      lastActivity: now,
      status: 'active',
      messageCount: 0,
      errorCount: 0
    };

    // 存储连接
    this.connections.set(connectionId, connectionData);

    // 添加到实例连接池
    if (!instanceConns) {
      this.instanceConnections.set(instanceId, new Set([connectionId]));
    } else {
      instanceConns.add(connectionId);
    }

    // 更新统计
    this.stats.totalConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.connections.size);

    this.emit('connection:add', connectionData);
    console.log(`[ConnectionManager] 连接已添加: ${connectionId} (实例: ${instanceId})`);

    return { success: true, connection: connectionData };
  }

  /**
   * 移除连接
   * @param {string} connectionId 
   * @param {string} reason 移除原因
   */
  removeConnection(connectionId, reason = 'unknown') {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    // 从实例连接池移除
    const instanceConns = this.instanceConnections.get(connection.instanceId);
    if (instanceConns) {
      instanceConns.delete(connectionId);
    }

    // 从连接池移除
    this.connections.delete(connectionId);

    // 更新统计
    this.stats.totalDisconnections++;

    this.emit('connection:remove', { ...connection, reason });
    console.log(`[ConnectionManager] 连接已移除: ${connectionId} (原因: ${reason})`);

    return true;
  }

  /**
   * 获取连接
   * @param {string} connectionId 
   */
  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  /**
   * 获取实例的所有连接
   * @param {string} instanceId 
   */
  getInstanceConnections(instanceId) {
    const connectionIds = this.instanceConnections.get(instanceId);
    if (!connectionIds) return [];

    return Array.from(connectionIds).map(id => this.connections.get(id)).filter(Boolean);
  }

  /**
   * 更新连接活动时间
   * @param {string} connectionId 
   */
  updateConnectionActivity(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * 增加连接消息计数
   * @param {string} connectionId 
   */
  incrementMessageCount(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.messageCount++;
      this.stats.totalMessages++;
      return true;
    }
    return false;
  }

  /**
   * 增加连接错误计数
   * @param {string} connectionId 
   */
  incrementErrorCount(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.errorCount++;
      this.stats.totalErrors++;
      return true;
    }
    return false;
  }

  // ==================== 负载均衡 ====================

  /**
   * 获取最佳实例（负载均衡）
   * @param {string} strategy 负载均衡策略: least-connections, round-robin, random
   */
  getBestInstance(strategy = 'least-connections') {
    const onlineInstances = Array.from(this.instanceCache.values())
      .filter(inst => inst.status === 'online');

    if (onlineInstances.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'least-connections': {
        // 选择连接数最少的实例
        let minConns = Infinity;
        let bestInstance = null;

        for (const instance of onlineInstances) {
          const conns = this.instanceConnections.get(instance.instanceId);
          const connCount = conns ? conns.size : 0;
          
          if (connCount < minConns) {
            minConns = connCount;
            bestInstance = instance;
          }
        }

        return bestInstance;
      }

      case 'round-robin': {
        // 简单轮询
        const index = Math.floor(Math.random() * onlineInstances.length);
        return onlineInstances[index];
      }

      case 'random': {
        const index = Math.floor(Math.random() * onlineInstances.length);
        return onlineInstances[index];
      }

      default:
        return onlineInstances[0];
    }
  }

  /**
   * 获取负载统计
   */
  getLoadStats() {
    const instanceStats = [];

    for (const [instanceId, instance] of this.instanceCache.entries()) {
      const conns = this.instanceConnections.get(instanceId);
      instanceStats.push({
        instanceId,
        name: instance.name,
        status: instance.status,
        connectionCount: conns ? conns.size : 0,
        maxConnections: instance.config?.maxConnections || this.config.maxConnectionsPerInstance
      });
    }

    return {
      totalConnections: this.connections.size,
      maxConnections: this.config.maxTotalConnections,
      instances: instanceStats
    };
  }

  // ==================== 清理与维护 ====================

  /**
   * 启动清理定时器
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 停止清理定时器
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理过期连接和实例
   */
  cleanup() {
    const now = Date.now();
    const instanceTimeout = this.config.instanceTimeout;

    // 检查实例超时
    for (const [instanceId, instance] of this.instanceCache.entries()) {
      const elapsed = now - instance.lastPing;

      if (elapsed > instanceTimeout && instance.status === 'online') {
        instance.status = 'offline';
        this.emit('instance:timeout', { instanceId, elapsed });

        // 更新数据库
        const stmt = this.db.prepare(`
          UPDATE relay_instances
          SET status = 'offline', updated_at = ?
          WHERE id = ?
        `);
        stmt.run(now, instanceId);

        console.log(`[ConnectionManager] 实例超时: ${instanceId}`);
      }
    }

    // 清理无效连接
    for (const [connectionId, connection] of this.connections.entries()) {
      const instance = this.instanceCache.get(connection.instanceId);
      
      if (!instance || instance.status === 'offline') {
        this.removeConnection(connectionId, 'instance-offline');
      }
    }
  }

  // ==================== 统计与状态 ====================

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      currentConnections: this.connections.size,
      instanceCount: this.instanceCache.size,
      config: this.config
    };
  }

  /**
   * 获取健康状态
   */
  getHealth() {
    const onlineInstances = Array.from(this.instanceCache.values())
      .filter(inst => inst.status === 'online').length;

    return {
      status: onlineInstances > 0 ? 'healthy' : 'degraded',
      onlineInstances,
      totalInstances: this.instanceCache.size,
      currentConnections: this.connections.size,
      maxConnections: this.config.maxTotalConnections,
      utilizationRate: this.connections.size / this.config.maxTotalConnections
    };
  }

  /**
   * 关闭所有连接
   */
  closeAll() {
    console.log('[ConnectionManager] 关闭所有连接...');

    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId, 'server-shutdown');
    }

    this.stopCleanup();
    this.emit('shutdown');
  }
}

module.exports = ConnectionManager;