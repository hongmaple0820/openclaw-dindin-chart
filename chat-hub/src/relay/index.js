/**
 * Relay Service - 数据中转服务入口
 */

const { SSEServer } = require('./sse-server');
const { ConnectionManager } = require('./connection-manager');
const { TokenAuth } = require('./token-auth');

class RelayService {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      port: config.relayPort || 8274,
      heartbeatInterval: 30000,
      ...config
    };
    
    this.tokenAuth = new TokenAuth(db, this.config);
    this.connectionManager = new ConnectionManager(db, this.config);
    this.sseServer = new SSEServer(db, this.config, this.connectionManager, this.tokenAuth);
  }

  async init() {
    await this.tokenAuth.init();
    await this.connectionManager.init();
    console.log('[RelayService] 初始化完成');
  }

  async start() {
    await this.sseServer.start();
    console.log(`[RelayService] 服务已启动，端口: ${this.config.port}`);
  }

  async stop() {
    await this.sseServer.stop();
    console.log('[RelayService] 服务已停止');
  }

  // 向后兼容 Redis API
  async publish(channel, message) {
    return this.connectionManager.broadcast(channel, message);
  }

  async subscribe(channel, callback) {
    return this.connectionManager.subscribe(channel, callback);
  }
}

module.exports = { RelayService, SSEServer, ConnectionManager, TokenAuth };