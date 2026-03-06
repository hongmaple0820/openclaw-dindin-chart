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

import * as http from 'http';
import { EventEmitter } from 'events';

interface SSEServerConfig {
  port?: number;
  host?: string;
  path?: string;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  retryInterval?: number;
  maxConnections?: number;
  cors?: {
    origins: string[];
    methods: string[];
    headers: string[];
  };
}

interface ClientData {
  res: http.ServerResponse;
  connectionId: string;
  instanceId: string;
  userId: string;
  tokenData: any;
  connectedAt: number;
  lastActivity: number;
  lastHeartbeat: number;
  ip: string;
  metadata: {
    userAgent?: string;
    lastEventId?: string;
  };
  channels?: Set<string>;
}

interface TokenData {
  instanceId: string;
  permissions: string[];
}

interface Stats {
  totalConnections: number;
  totalDisconnections: number;
  messagesSent: number;
  messagesFailed: number;
  bytesSent: number;
}

class SSEServer extends EventEmitter {
  private config: Required<SSEServerConfig>;
  private server: http.Server | null = null;
  private connectionManager: any = null;
  private tokenAuth: any = null;
  private clients: Map<string, ClientData>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stats: Stats;
  private running: boolean = false;

  constructor(db: any, options: SSEServerConfig = {}, connectionManager?: any, tokenAuth?: any) {
    super();

    this.config = {
      port: options.port || 3010,
      host: options.host || '0.0.0.0',
      path: options.path || '/events',
      heartbeatInterval: options.heartbeatInterval || 30000,
      connectionTimeout: options.connectionTimeout || 300000,
      retryInterval: options.retryInterval || 3000,
      maxConnections: options.maxConnections || 1000,
      cors: options.cors || {
        origins: ['*'],
        methods: ['GET', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'X-Instance-Id']
      }
    };

    this.connectionManager = connectionManager;
    this.tokenAuth = tokenAuth;
    this.clients = new Map();
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      messagesSent: 0,
      messagesFailed: 0,
      bytesSent: 0
    };
  }

  setDependencies(connectionManager: any, tokenAuth: any): void {
    this.connectionManager = connectionManager;
    this.tokenAuth = tokenAuth;
  }

  start(): void {
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

  stop(): void {
    if (!this.running) {
      return;
    }

    console.log('[SSE Server] 正在停止服务器...');

    for (const [connectionId] of this.clients) {
      this.disconnectClient(connectionId, 'server-shutdown');
    }

    this.stopHeartbeat();

    if (this.server) {
      this.server.close(() => {
        console.log('[SSE Server] 服务器已停止');
        this.emit('stop');
      });
    }

    this.running = false;
  }

  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      this.handleCORS(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!url.pathname.startsWith(this.config.path)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const authResult = await this.authenticate(req);
    if (!authResult.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: authResult.error }));
      return;
    }

    if (this.clients.size >= this.config.maxConnections) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Maximum connections reached' }));
      return;
    }

    this.handleSSE(req, res, authResult.tokenData, url);
  }

  handleCORS(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin;
    
    if (this.config.cors.origins.includes('*') || this.config.cors.origins.includes(origin || '')) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', this.config.cors.headers.join(', '));
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }

  async authenticate(req: http.IncomingMessage): Promise<{ valid: boolean; error?: string; tokenData?: TokenData }> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return { valid: false, error: 'Missing token' };
    }

    const tokenData = await this.tokenAuth?.validateToken(token);
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    if (!tokenData.permissions.includes('sync:pull')) {
      return { valid: false, error: 'Insufficient permissions' };
    }

    return { valid: true, tokenData };
  }

  handleSSE(req: http.IncomingMessage, res: http.ServerResponse, tokenData: TokenData, url: URL): void {
    const connectionId = this.generateConnectionId();
    const instanceId = tokenData.instanceId;
    const userId = url.searchParams.get('userId') || tokenData.instanceId;

    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin || '*'
    };

    res.writeHead(200, headers);

    const clientData: ClientData = {
      res,
      connectionId,
      instanceId,
      userId,
      tokenData,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      lastHeartbeat: Date.now(),
      ip: (req.headers['x-forwarded-for'] as string) || (req.socket.remoteAddress || 'unknown'),
      metadata: {
        userAgent: req.headers['user-agent'],
        lastEventId: req.headers['last-event-id'] as string
      }
    };

    this.clients.set(connectionId, clientData);
    this.stats.totalConnections++;

    if (this.connectionManager) {
      this.connectionManager.addConnection(connectionId, instanceId, {
        userId,
        ip: clientData.ip
      });
    }

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

    res.on('close', () => {
      this.disconnectClient(connectionId, 'client-close');
    });

    res.on('error', (error) => {
      console.error(`[SSE Server] 连接错误: ${connectionId}`, error.message);
      this.disconnectClient(connectionId, 'error');
    });
  }

  disconnectClient(connectionId: string, reason = 'unknown'): boolean {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    try {
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

    if (this.connectionManager) {
      this.connectionManager.removeConnection(connectionId, reason);
    }

    console.log(`[SSE Server] 客户端已断开: ${connectionId} (原因: ${reason})`);
    this.emit('disconnect', { connectionId, reason, instanceId: client.instanceId });

    return true;
  }

  _sendRaw(res: http.ServerResponse, event: string, data: any, id: string | null = null): boolean {
    try {
      if (res.writableEnded) {
        return false;
      }

      let message = '';
      
      if (id !== null) {
        message += `id: ${id}\n`;
      }
      
      if (event) {
        message += `event: ${event}\n`;
      }
      
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const lines = dataStr.split('\n');
      for (const line of lines) {
        message += `data: ${line}\n`;
      }
      
      message += '\n';

      res.write(message);
      this.stats.bytesSent += message.length;

      return true;
    } catch (error: any) {
      console.error('[SSE Server] 发送失败:', error.message);
      return false;
    }
  }

  send(connectionId: string, event: string, data: any, id: string | null = null): boolean {
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

  sendToUser(userId: string, event: string, data: any): number {
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

  sendToInstance(instanceId: string, event: string, data: any): number {
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

  broadcast(event: string, data: any, excludeIds: string | string[] = []): number {
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

  broadcastToChannel(channel: string, event: string, data: any): number {
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

  startHeartbeat(): void {
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

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendHeartbeats(): void {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;

    for (const [connectionId, client] of this.clients.entries()) {
      try {
        const elapsed = now - client.lastActivity;
        if (elapsed > timeout) {
          console.log(`[SSE Server] 客户端超时: ${connectionId}`);
          this.disconnectClient(connectionId, 'timeout');
          continue;
        }

        const sent = this.send(connectionId, 'heartbeat', {
          timestamp: now,
          serverTime: now
        });

        if (sent) {
          client.lastHeartbeat = now;
        } else {
          this.disconnectClient(connectionId, 'heartbeat-failed');
        }
      } catch (error: any) {
        console.error(`[SSE Server] 心跳发送失败: ${connectionId}`, error.message);
        this.disconnectClient(connectionId, 'heartbeat-error');
      }
    }
  }

  updateHeartbeat(connectionId: string): boolean {
    const client = this.clients.get(connectionId);
    if (client) {
      client.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  subscribeChannel(connectionId: string, channel: string): boolean {
    const client = this.clients.get(connectionId);
    if (!client) return false;

    if (!client.channels) {
      client.channels = new Set();
    }

    client.channels.add(channel);
    return true;
  }

  unsubscribeChannel(connectionId: string, channel: string): boolean {
    const client = this.clients.get(connectionId);
    if (!client || !client.channels) return false;

    return client.channels.delete(channel);
  }

  generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getOnlineClients(): any[] {
    return Array.from(this.clients.entries()).map(([id, client]) => ({
      connectionId: id,
      instanceId: client.instanceId,
      userId: client.userId,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      ip: client.ip
    }));
  }

  getClient(connectionId: string): any {
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

  getStats(): Stats & { running: boolean; currentConnections: number; maxConnections: number; config: any } {
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

  healthCheck(): { status: string; connections: number; uptime: number } {
    return {
      status: this.running ? 'healthy' : 'stopped',
      connections: this.clients.size,
      uptime: this.running ? process.uptime() : 0
    };
  }
}

export default SSEServer;