/**
 * 连接管理器
 * 
 * 功能：
 * - 连接池管理
 * - 实例注册/注销
 * - 连接状态追踪
 * - 负载均衡
 */

import { EventEmitter } from 'events';

interface ConnectionManagerConfig {
  maxConnectionsPerInstance?: number;
  maxTotalConnections?: number;
  instanceTimeout?: number;
  cleanupInterval?: number;
}

interface InstanceData {
  instanceId: string;
  name: string;
  relayUrl?: string;
  status: string;
  lastPing: number;
  config: {
    maxConnections: number;
    heartbeatInterval: number;
  };
  createdAt: number;
}

interface ConnectionData {
  connectionId: string;
  instanceId: string;
  metadata: Record<string, any>;
  connectedAt: number;
  lastActivity: number;
  status: string;
  messageCount: number;
  errorCount: number;
}

interface Stats {
  totalConnections: number;
  totalDisconnections: number;
  totalMessages: number;
  totalErrors: number;
  peakConnections: number;
}

class ConnectionManager extends EventEmitter {
  private db: any;
  private config: {
    maxConnectionsPerInstance: number;
    maxTotalConnections: number;
    instanceTimeout: number;
    cleanupInterval: number;
  };
  private instanceConnections: Map<string, Set<string>>;
  private connections: Map<string, ConnectionData>;
  private instanceCache: Map<string, InstanceData>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: Stats;

  constructor(db: any, options: ConnectionManagerConfig = {}) {
    super();
    
    this.db = db;
    this.config = {
      maxConnectionsPerInstance: options.maxConnectionsPerInstance || 100,
      maxTotalConnections: options.maxTotalConnections || 10000,
      instanceTimeout: options.instanceTimeout || 60000,
      cleanupInterval: options.cleanupInterval || 30000,
      ...options
    };

    this.instanceConnections = new Map();
    this.connections = new Map();
    this.instanceCache = new Map();
    
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

  async registerInstance(instanceId: string, options: { name?: string; relayUrl?: string; token?: string; maxConnections?: number; heartbeatInterval?: number } = {}): Promise<{ registered: boolean; reason?: string; instance?: InstanceData }> {
    try {
      const { name, relayUrl, token, maxConnections, heartbeatInterval } = options;
      const now = Date.now();

      const existing = this.instanceCache.get(instanceId);
      if (existing) {
        await this.updateInstancePing(instanceId);
        return { registered: false, reason: 'Already registered', instance: existing };
      }

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

      const instanceData: InstanceData = {
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

  async unregisterInstance(instanceId: string): Promise<boolean> {
    try {
      const connectionIds = this.instanceConnections.get(instanceId);
      if (connectionIds) {
        for (const connId of connectionIds) {
          this.removeConnection(connId, 'instance-unregister');
        }
      }

      const stmt = this.db.prepare(`
        UPDATE relay_instances
        SET status = 'offline', updated_at = ?
        WHERE id = ?
      `);
      stmt.run(Date.now(), instanceId);

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

  async updateInstancePing(instanceId: string): Promise<void> {
    const now = Date.now();

    const instance = this.instanceCache.get(instanceId);
    if (instance) {
      instance.lastPing = now;
      instance.status = 'online';
    }

    const stmt = this.db.prepare(`
      UPDATE relay_instances
      SET last_ping = ?, status = 'online', updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, now, instanceId);
  }

  getInstances(): InstanceData[] {
    return Array.from(this.instanceCache.values());
  }

  getInstance(instanceId: string): (InstanceData & { connectionCount: number; connections: string[] }) | null {
    const instance = this.instanceCache.get(instanceId);
    const connections = this.instanceConnections.get(instanceId);
    
    if (!instance) return null;

    return {
      ...instance,
      connectionCount: connections ? connections.size : 0,
      connections: connections ? Array.from(connections) : []
    };
  }

  addConnection(connectionId: string, instanceId: string, metadata: Record<string, any> = {}): { success: boolean; reason?: string; connection?: ConnectionData } {
    if (this.connections.size >= this.config.maxTotalConnections) {
      console.warn('[ConnectionManager] 已达最大连接数限制');
      return { success: false, reason: 'Max connections reached' };
    }

    const instanceConns = this.instanceConnections.get(instanceId);
    const instance = this.instanceCache.get(instanceId);
    const maxConns = instance?.config?.maxConnections || this.config.maxConnectionsPerInstance;

    if (instanceConns && instanceConns.size >= maxConns) {
      console.warn(`[ConnectionManager] 实例 ${instanceId} 已达最大连接数`);
      return { success: false, reason: 'Instance max connections reached' };
    }

    const now = Date.now();
    const connectionData: ConnectionData = {
      connectionId,
      instanceId,
      metadata,
      connectedAt: now,
      lastActivity: now,
      status: 'active',
      messageCount: 0,
      errorCount: 0
    };

    this.connections.set(connectionId, connectionData);

    if (!instanceConns) {
      this.instanceConnections.set(instanceId, new Set([connectionId]));
    } else {
      instanceConns.add(connectionId);
    }

    this.stats.totalConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.connections.size);

    this.emit('connection:add', connectionData);
    console.log(`[ConnectionManager] 连接已添加: ${connectionId} (实例: ${instanceId})`);

    return { success: true, connection: connectionData };
  }

  removeConnection(connectionId: string, reason = 'unknown'): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const instanceConns = this.instanceConnections.get(connection.instanceId);
    if (instanceConns) {
      instanceConns.delete(connectionId);
    }

    this.connections.delete(connectionId);
    this.stats.totalDisconnections++;

    this.emit('connection:remove', { ...connection, reason });
    console.log(`[ConnectionManager] 连接已移除: ${connectionId} (原因: ${reason})`);

    return true;
  }

  getConnection(connectionId: string): ConnectionData | undefined {
    return this.connections.get(connectionId);
  }

  getInstanceConnections(instanceId: string): ConnectionData[] {
    const connectionIds = this.instanceConnections.get(instanceId);
    if (!connectionIds) return [];

    return Array.from(connectionIds).map(id => this.connections.get(id)!).filter(Boolean);
  }

  updateConnectionActivity(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  incrementMessageCount(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.messageCount++;
      this.stats.totalMessages++;
      return true;
    }
    return false;
  }

  incrementErrorCount(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.errorCount++;
      this.stats.totalErrors++;
      return true;
    }
    return false;
  }

  getBestInstance(strategy: 'least-connections' | 'round-robin' | 'random' = 'least-connections'): InstanceData | null {
    const onlineInstances = Array.from(this.instanceCache.values())
      .filter(inst => inst.status === 'online');

    if (onlineInstances.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'least-connections': {
        let minConns = Infinity;
        let bestInstance: InstanceData | null = null;

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

      case 'round-robin':
      case 'random': {
        const index = Math.floor(Math.random() * onlineInstances.length);
        return onlineInstances[index];
      }

      default:
        return onlineInstances[0];
    }
  }

  getLoadStats(): { totalConnections: number; maxConnections: number; instances: any[] } {
    const instanceStats: any[] = [];

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

  startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  cleanup(): void {
    const now = Date.now();
    const instanceTimeout = this.config.instanceTimeout;

    for (const [instanceId, instance] of this.instanceCache.entries()) {
      const elapsed = now - instance.lastPing;

      if (elapsed > instanceTimeout && instance.status === 'online') {
        instance.status = 'offline';
        this.emit('instance:timeout', { instanceId, elapsed });

        const stmt = this.db.prepare(`
          UPDATE relay_instances
          SET status = 'offline', updated_at = ?
          WHERE id = ?
        `);
        stmt.run(now, instanceId);

        console.log(`[ConnectionManager] 实例超时: ${instanceId}`);
      }
    }

    for (const [connectionId, connection] of this.connections.entries()) {
      const instance = this.instanceCache.get(connection.instanceId);
      
      if (!instance || instance.status === 'offline') {
        this.removeConnection(connectionId, 'instance-offline');
      }
    }
  }

  getStats(): Stats & { currentConnections: number; instanceCount: number; config: typeof this.config } {
    return {
      ...this.stats,
      currentConnections: this.connections.size,
      instanceCount: this.instanceCache.size,
      config: this.config
    };
  }

  getHealth(): { status: string; onlineInstances: number; totalInstances: number; currentConnections: number; maxConnections: number; utilizationRate: number } {
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

  closeAll(): void {
    console.log('[ConnectionManager] 关闭所有连接...');

    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId, 'server-shutdown');
    }

    this.stopCleanup();
    this.emit('shutdown');
  }

  broadcast(channel: string, message: any): void {
    this.emit('broadcast', { channel, message });
  }

  subscribe(channel: string, callback: (message: any) => void): void {
    this.on(`broadcast:${channel}`, callback);
  }
}

export default ConnectionManager;