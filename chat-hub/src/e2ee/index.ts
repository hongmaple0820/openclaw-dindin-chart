/**
 * E2EE - 端到端加密模块
 * 
 * 使用 X25519 密钥交换 + AES-GCM 加密
 * 
 * 功能：
 * - 密钥生成
 * - 密钥交换
 * - 消息加密/解密
 * - 密钥管理
 */

import crypto from 'crypto';
import { Database } from 'better-sqlite3';

// X25519 曲线名称
const CURVE = 'x25519';

// AES-GCM 配置
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * E2EE 密钥对
 */
export class KeyPair {
  privateKey: Buffer;
  publicKey: Buffer;

  constructor(privateKey: Buffer | null = null, publicKey: Buffer | null = null) {
    this.privateKey = privateKey || Buffer.alloc(0);
    this.publicKey = publicKey || Buffer.alloc(0);
  }

  /**
   * 生成新的密钥对
   */
  static generate(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    return new KeyPair(
      privateKey.export({ type: 'pkcs8', format: 'der' }),
      publicKey.export({ type: 'spki', format: 'der' })
    );
  }

  /**
   * 从私钥恢复密钥对
   */
  static fromPrivateKey(privateKeyDer: Buffer): KeyPair {
    const privateKey = crypto.createPrivateKey({
      key: privateKeyDer,
      format: 'der',
      type: 'pkcs8'
    });
    const publicKey = crypto.createPublicKey(privateKey);
    return new KeyPair(
      privateKeyDer,
      publicKey.export({ type: 'spki', format: 'der' })
    );
  }

  /**
   * 导出为 Base64
   */
  export(): { privateKey: string; publicKey: string } {
    return {
      privateKey: this.privateKey.toString('base64'),
      publicKey: this.publicKey.toString('base64')
    };
  }

  /**
   * 从 Base64 导入
   */
  static import(data: { privateKey: string; publicKey: string }): KeyPair {
    return new KeyPair(
      Buffer.from(data.privateKey, 'base64'),
      Buffer.from(data.publicKey, 'base64')
    );
  }
}

export interface E2EEConfig {
  keyRotationDays?: number;
}

interface E2EEKeyRow {
  id: string;
  user_id: string;
  key_type: string;
  private_key: Buffer;
  public_key: Buffer;
  created_at: number;
  expires_at: number | null;
  is_active: number;
}

interface E2EESessionRow {
  id: string;
  user_id: string;
  peer_id: string;
  session_key: Buffer;
  peer_public_key: Buffer;
  created_at: number;
  last_used: number;
}

/**
 * E2EE 加密器
 */
export class E2EEncryptor {
  private db: Database;
  private config: E2EEConfig;
  
  // 内存中的密钥缓存
  private keyCache: Map<string, KeyPair> = new Map();

  constructor(db: Database, options: E2EEConfig = {}) {
    this.db = db;
    this.config = {
      keyRotationDays: options.keyRotationDays || 30,
      ...options
    };
    
    // 初始化数据库表
    this.initDB();
  }

  initDB(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS e2ee_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_type TEXT NOT NULL,  -- identity | session
        private_key BLOB NOT NULL,
        public_key BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        is_active INTEGER DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS e2ee_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        session_key BLOB,
        peer_public_key BLOB,
        created_at INTEGER NOT NULL,
        last_used INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_e2ee_keys_user ON e2ee_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_e2ee_sessions_user ON e2ee_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_e2ee_sessions_peer ON e2ee_sessions(peer_id);
    `);
  }

  // ==================== 密钥管理 ====================

  /**
   * 为用户生成身份密钥对
   */
  generateIdentityKey(userId: string): { id: string; publicKey: string } {
    const keyPair = KeyPair.generate();
    const now = Date.now();
    const id = `identity_${userId}_${now}`;
    
    // 停用旧的密钥
    this.db.prepare(`
      UPDATE e2ee_keys SET is_active = 0 
      WHERE user_id = ? AND key_type = 'identity'
    `).run(userId);
    
    // 保存新密钥
    this.db.prepare(`
      INSERT INTO e2ee_keys (id, user_id, key_type, private_key, public_key, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, userId, 'identity', keyPair.privateKey, keyPair.publicKey, now);
    
    return {
      id,
      publicKey: keyPair.publicKey.toString('base64')
    };
  }

  /**
   * 获取用户活跃的身份密钥
   */
  getIdentityKey(userId: string): KeyPair | null {
    const row = this.db.prepare(`
      SELECT * FROM e2ee_keys 
      WHERE user_id = ? AND key_type = 'identity' AND is_active = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(userId) as E2EEKeyRow | undefined;
    
    if (!row) return null;
    
    return KeyPair.fromPrivateKey(row.private_key);
  }

  /**
   * 获取用户公钥（用于交换）
   */
  getPublicKey(userId: string): string | null {
    const row = this.db.prepare(`
      SELECT public_key FROM e2ee_keys 
      WHERE user_id = ? AND key_type = 'identity' AND is_active = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(userId) as { public_key: Buffer } | undefined;
    
    return row ? row.public_key.toString('base64') : null;
  }

  // ==================== 会话管理 ====================

  /**
   * 建立加密会话（密钥交换）
   */
  async establishSession(userId: string, peerId: string, peerPublicKeyBase64: string): Promise<{ sessionId: string; established: boolean }> {
    const myKeyPair = this.getIdentityKey(userId);
    if (!myKeyPair) {
      throw new Error('User identity key not found');
    }
    
    const peerPublicKey = crypto.createPublicKey({
      key: Buffer.from(peerPublicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    
    // 使用 X25519 密钥交换
    const myPrivateKey = crypto.createPrivateKey({
      key: myKeyPair.privateKey,
      format: 'der',
      type: 'pkcs8'
    });
    
    const sharedSecret = crypto.diffieHellman({
      privateKey: myPrivateKey,
      publicKey: peerPublicKey
    });
    
    // 派生会话密钥
    const sessionKey = crypto.createHash('sha256')
      .update(sharedSecret)
      .update(userId)
      .update(peerId)
      .digest();
    
    // 保存会话
    const sessionId = `session_${userId}_${peerId}`;
    const now = Date.now();
    
    this.db.prepare(`
      INSERT OR REPLACE INTO e2ee_sessions (id, user_id, peer_id, session_key, peer_public_key, created_at, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, peerId, sessionKey, Buffer.from(peerPublicKeyBase64, 'base64'), now, now);
    
    return {
      sessionId,
      established: true
    };
  }

  /**
   * 获取会话密钥
   */
  getSessionKey(userId: string, peerId: string): Buffer | null {
    const row = this.db.prepare(`
      SELECT session_key FROM e2ee_sessions 
      WHERE user_id = ? AND peer_id = ?
    `).get(userId, peerId) as { session_key: Buffer } | undefined;
    
    return row ? row.session_key : null;
  }

  // ==================== 加密/解密 ====================

  /**
   * 加密消息
   */
  encrypt(plaintext: string, sessionKey: Buffer): string {
    // 生成随机 IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, sessionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // 加密
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // 获取认证标签
    const authTag = cipher.getAuthTag();
    
    // 组合: iv + authTag + encrypted
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return result.toString('base64');
  }

  /**
   * 解密消息
   */
  decrypt(ciphertextBase64: string, sessionKey: Buffer): string {
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');
    
    // 分离组件
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, sessionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // 设置认证标签
    decipher.setAuthTag(authTag);
    
    // 解密
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  /**
   * 加密消息给指定用户
   */
  encryptForPeer(userId: string, peerId: string, plaintext: string): string {
    const sessionKey = this.getSessionKey(userId, peerId);
    if (!sessionKey) {
      throw new Error('Session not established');
    }
    return this.encrypt(plaintext, sessionKey);
  }

  /**
   * 解密来自指定用户的消息
   */
  decryptFromPeer(userId: string, peerId: string, ciphertext: string): string {
    const sessionKey = this.getSessionKey(userId, peerId);
    if (!sessionKey) {
      throw new Error('Session not established');
    }
    return this.decrypt(ciphertext, sessionKey);
  }

  // ==================== 工具方法 ====================

  /**
   * 检查会话是否存在
   */
  hasSession(userId: string, peerId: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM e2ee_sessions WHERE user_id = ? AND peer_id = ?
    `).get(userId, peerId);
    return !!row;
  }

  /**
   * 删除会话
   */
  deleteSession(userId: string, peerId: string): void {
    this.db.prepare(`
      DELETE FROM e2ee_sessions WHERE user_id = ? AND peer_id = ?
    `).run(userId, peerId);
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(userId: string): E2EESessionRow[] {
    return this.db.prepare(`
      SELECT peer_id, created_at, last_used 
      FROM e2ee_sessions 
      WHERE user_id = ?
      ORDER BY last_used DESC
    `).all(userId) as E2EESessionRow[];
  }

  /**
   * 轮换密钥
   */
  rotateKeysIfNeeded(userId: string): { id: string; publicKey: string } | null {
    const row = this.db.prepare(`
      SELECT created_at FROM e2ee_keys 
      WHERE user_id = ? AND key_type = 'identity' AND is_active = 1
    `).get(userId) as { created_at: number } | undefined;
    
    if (!row) {
      return this.generateIdentityKey(userId);
    }
    
    const age = Date.now() - row.created_at;
    const rotationMs = this.config.keyRotationDays! * 24 * 60 * 60 * 1000;
    
    if (age > rotationMs) {
      return this.generateIdentityKey(userId);
    }
    
    return null;
  }
}