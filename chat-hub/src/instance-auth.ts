const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class InstanceAuth {
  storeDir: string;
  dbPath: string;
  db: any;
  initialized: boolean;
  instanceId: string;
  instanceName: string;
  sharedSecret: string;
  heartbeatInterval: number;
  heartbeatTimer: NodeJS.Timeout | null;
  registeredInstances: Map<string, any>;

  constructor() {
    this.storeDir = config.store?.dir || path.join(process.env.HOME, '.openclaw', 'chat-data');
    this.dbPath = path.join(this.storeDir, 'messages.db');
    this.db = null;
    this.initialized = false;
    this.instanceId = config.instance?.id || uuidv4();
    this.instanceName = config.instance?.name || `instance-${Date.now()}`;
    this.sharedSecret = config.instance?.sharedSecret || process.env.INSTANCE_SECRET || 'default-shared-secret';
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.registeredInstances = new Map();
  }

  init() {
    if (this.initialized) return;

    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }

    this.db = new Database(this.dbPath, { timeout: 10000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');

    this._createTables();
    this.initialized = true;
    console.log(`[InstanceAuth] 实例认证模块已初始化: ${this.instanceId}`);
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        endpoint TEXT,
        api_key TEXT,
        status TEXT DEFAULT 'active',
        last_heartbeat INTEGER,
        created_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
      CREATE INDEX IF NOT EXISTS idx_instances_heartbeat ON instances(last_heartbeat);

      CREATE TABLE IF NOT EXISTS user_instance_bindings (
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        session_id TEXT,
        connected_at INTEGER NOT NULL,
        disconnected_at INTEGER,
        PRIMARY KEY (user_id, instance_id),
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_uib_user ON user_instance_bindings(user_id);
      CREATE INDEX IF NOT EXISTS idx_uib_instance ON user_instance_bindings(instance_id);
    `);
  }

  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateInstanceToken(instanceId) {
    const timestamp = Date.now();
    const payload = `${instanceId}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.sharedSecret)
      .update(payload)
      .digest('hex');

    return {
      token: Buffer.from(`${payload}|${signature}`).toString('base64'),
      expiresAt: timestamp + 3600000
    };
  }

  verifyInstanceToken(token) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const parts = decoded.split('|');

      if (parts.length !== 3) {
        return { valid: false, error: 'Token 格式无效' };
      }

      const [instanceId, timestamp, signature] = parts;
      const tokenTime = parseInt(timestamp, 10);
      const now = Date.now();

      if (now - tokenTime > 3600000) {
        return { valid: false, error: 'Token 已过期' };
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.sharedSecret)
        .update(`${instanceId}|${timestamp}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { valid: false, error: '签名验证失败' };
      }

      return { valid: true, instanceId };
    } catch (error: any) {
      return { valid: false, error: 'Token 解析失败' };
    }
  }

  registerInstance(instanceData) {
    this.init();

    const { id, name, endpoint, apiKey, metadata } = instanceData;
    const instanceId = id || uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO instances (id, name, endpoint, api_key, status, last_heartbeat, created_at, metadata)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        endpoint = excluded.endpoint,
        api_key = excluded.api_key,
        status = 'active',
        last_heartbeat = excluded.last_heartbeat,
        metadata = excluded.metadata
    `);

    stmt.run(
      instanceId,
      name,
      endpoint || null,
      apiKey || null,
      now,
      now,
      metadata ? JSON.stringify(metadata) : null
    );

    this.registeredInstances.set(instanceId, {
      id: instanceId,
      name,
      endpoint,
      status: 'active',
      lastHeartbeat: now
    });

    console.log(`[InstanceAuth] 实例已注册: ${instanceId} (${name})`);
    return { id: instanceId, apiKey: apiKey || this.generateApiKey() };
  }

  unregisterInstance(instanceId) {
    this.init();

    this.db.prepare('DELETE FROM instances WHERE id = ?').run(instanceId);
    this.db.prepare('DELETE FROM user_instance_bindings WHERE instance_id = ?').run(instanceId);
    this.registeredInstances.delete(instanceId);

    console.log(`[InstanceAuth] 实例已注销: ${instanceId}`);
    return true;
  }

  updateHeartbeat(instanceId) {
    this.init();

    const now = Date.now();
    this.db.prepare(`
      UPDATE instances SET last_heartbeat = ?, status = 'active'
      WHERE id = ?
    `).run(now, instanceId);

    if (this.registeredInstances.has(instanceId)) {
      this.registeredInstances.get(instanceId).lastHeartbeat = now;
    }
  }

  getInstance(instanceId) {
    this.init();

    const row = this.db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId);
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      endpoint: row.endpoint,
      status: row.status,
      lastHeartbeat: row.last_heartbeat,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  getActiveInstances() {
    this.init();

    const timeout = Date.now() - 90000;
    const rows = this.db.prepare(`
      SELECT * FROM instances 
      WHERE status = 'active' AND last_heartbeat > ?
      ORDER BY last_heartbeat DESC
    `).all(timeout);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      endpoint: row.endpoint,
      status: row.status,
      lastHeartbeat: row.last_heartbeat,
      createdAt: row.created_at
    }));
  }

  bindUserToInstance(userId, instanceId, sessionId = null) {
    this.init();

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO user_instance_bindings (user_id, instance_id, session_id, connected_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, instance_id) DO UPDATE SET
        session_id = excluded.session_id,
        connected_at = excluded.connected_at,
        disconnected_at = NULL
    `);

    stmt.run(userId, instanceId, sessionId, now);
    console.log(`[InstanceAuth] 用户绑定实例: ${userId} -> ${instanceId}`);
    return true;
  }

  unbindUserFromInstance(userId, instanceId) {
    this.init();

    const now = Date.now();
    this.db.prepare(`
      UPDATE user_instance_bindings 
      SET disconnected_at = ?
      WHERE user_id = ? AND instance_id = ?
    `).run(now, userId, instanceId);

    console.log(`[InstanceAuth] 用户解绑实例: ${userId} -> ${instanceId}`);
    return true;
  }

  getUserInstance(userId) {
    this.init();

    const row = this.db.prepare(`
      SELECT * FROM user_instance_bindings
      WHERE user_id = ? AND disconnected_at IS NULL
      ORDER BY connected_at DESC
      LIMIT 1
    `).get(userId);

    if (!row) return null;

    return {
      instanceId: row.instance_id,
      sessionId: row.session_id,
      connectedAt: row.connected_at
    };
  }

  getInstanceUsers(instanceId) {
    this.init();

    const rows = this.db.prepare(`
      SELECT * FROM user_instance_bindings
      WHERE instance_id = ? AND disconnected_at IS NULL
      ORDER BY connected_at DESC
    `).all(instanceId);

    return rows.map(row => ({
      userId: row.user_id,
      sessionId: row.session_id,
      connectedAt: row.connected_at
    }));
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat(this.instanceId);
      this._checkStaleInstances();
    }, this.heartbeatInterval);

    console.log('[InstanceAuth] 心跳已启动');
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[InstanceAuth] 心跳已停止');
    }
  }

  _checkStaleInstances() {
    this.init();

    const timeout = Date.now() - 90000;
    const staleInstances = this.db.prepare(`
      SELECT id FROM instances 
      WHERE status = 'active' AND last_heartbeat < ?
    `).all(timeout);

    for (const instance of staleInstances) {
      this.db.prepare(`
        UPDATE instances SET status = 'inactive' WHERE id = ?
      `).run(instance.id);

      this.registeredInstances.delete(instance.id);
      console.log(`[InstanceAuth] 实例已标记为不活跃: ${instance.id}`);
    }
  }

  createAuthHeader(instanceId) {
    const { token } = this.generateInstanceToken(instanceId);
    return `Bearer ${token}`;
  }

  verifyAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: '无效的认证头' };
    }

    const token = authHeader.substring(7);
    return this.verifyInstanceToken(token);
  }

  getStatus() {
    return {
      instanceId: this.instanceId,
      instanceName: this.instanceName,
      registeredInstances: this.registeredInstances.size,
      activeInstances: this.getActiveInstances().length
    };
  }

  close() {
    this.stopHeartbeat();
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

module.exports = new InstanceAuth();

export {};
