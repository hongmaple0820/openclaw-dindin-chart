/**
 * Relay Service - 数据中转服务入口
 */

import SSEServer from './sse-server';
import ConnectionManager from './connection-manager';
import TokenAuth from './token-auth';

interface RelayServiceConfig {
  relayPort?: number;
  heartbeatInterval?: number;
}

class RelayService {
  private db: any;
  private config: { port: number; heartbeatInterval: number };
  private tokenAuth: TokenAuth;
  private connectionManager: ConnectionManager;
  private sseServer: SSEServer;

  constructor(db: any, config: RelayServiceConfig = {}) {
    this.db = db;
    this.config = {
      port: config.relayPort || 8274,
      heartbeatInterval: 30000,
      ...config
    };
    
    this.tokenAuth = new TokenAuth(db);
    this.connectionManager = new ConnectionManager(db);
    this.sseServer = new SSEServer(db, this.config, this.connectionManager, this.tokenAuth);
  }

  async init(): Promise<void> {
    console.log('[RelayService] 初始化完成');
  }

  async start(): Promise<void> {
    await this.sseServer.start();
    console.log(`[RelayService] 服务已启动，端口: ${this.config.port}`);
  }

  async stop(): Promise<void> {
    await this.sseServer.stop();
    console.log('[RelayService] 服务已停止');
  }

  async publish(channel: string, message: any): Promise<void> {
    this.connectionManager.broadcast(channel, message);
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    this.connectionManager.subscribe(channel, callback);
  }
}

export { RelayService, SSEServer, ConnectionManager, TokenAuth };