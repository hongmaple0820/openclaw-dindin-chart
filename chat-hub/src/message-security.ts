const crypto = require('crypto');
const config = require('./config');

class MessageSecurity {
  secretKey: string;
  algorithm: string;
  keyLength: number;
  ivLength: number;
  authTagLength: number;
  maxMessageAge: number;
  encryptionKey: Buffer;

  constructor() {
    this.secretKey = config.security?.secretKey || process.env.MESSAGE_SECRET || 'default-secret-key';
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.authTagLength = 16;
    this.maxMessageAge = 60000;
    this.encryptionKey = Buffer.alloc(0);
    this._deriveKey();
  }

  _deriveKey() {
    this.encryptionKey = crypto.createHash('sha256')
      .update(this.secretKey)
      .digest();
  }

  signMessage(message) {
    const timestamp = Date.now();
    const payload = this._createSignaturePayload(message, timestamp);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    return {
      ...message,
      signature,
      timestamp
    };
  }

  verifyMessage(message) {
    if (!message.signature || !message.timestamp) {
      return { valid: false, error: '缺少签名或时间戳' };
    }

    const now = Date.now();
    const messageAge = now - message.timestamp;

    if (messageAge > this.maxMessageAge) {
      return { valid: false, error: '消息已过期' };
    }

    if (messageAge < -5000) {
      return { valid: false, error: '消息时间戳异常' };
    }

    const payload = this._createSignaturePayload(message, message.timestamp);
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    if (message.signature !== expectedSignature) {
      return { valid: false, error: '签名验证失败' };
    }

    return { valid: true };
  }

  _createSignaturePayload(message, timestamp) {
    const fields = [
      message.id || '',
      message.conversationId || message.sessionId || '',
      message.senderId || message.sender || '',
      message.content || '',
      timestamp.toString()
    ];
    return fields.join('|');
  }

  encrypt(content) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return { success: true, content: decrypted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  encryptMessage(message) {
    if (typeof message.content !== 'string') {
      return message;
    }

    const encrypted = this.encrypt(message.content);
    return {
      ...message,
      content: JSON.stringify(encrypted),
      encrypted: true
    };
  }

  decryptMessage(message) {
    if (!message.encrypted) {
      return message;
    }

    try {
      const encryptedData = JSON.parse(message.content);
      const result = this.decrypt(encryptedData);

      if (result.success) {
        return {
          ...message,
          content: result.content,
          encrypted: false
        };
      }

      return message;
    } catch (error: any) {
      return message;
    }
  }

  hashContent(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  generateMessageId() {
    return `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  createMessageFingerprint(message) {
    const data = JSON.stringify({
      id: message.id,
      sender: message.senderId || message.sender,
      content: message.content,
      timestamp: message.timestamp
    });
    return this.hashContent(data);
  }

  sanitizeMessage(message) {
    const sanitized = { ...message };

    if (typeof sanitized.content === 'string') {
      sanitized.content = sanitized.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }

    return sanitized;
  }

  validateMessageStructure(message) {
    const errors = [];

    if (!message.id) {
      errors.push('缺少消息ID');
    }

    if (!message.senderId && !message.sender) {
      errors.push('缺少发送者ID');
    }

    if (message.content === undefined && message.content !== '') {
      errors.push('缺少消息内容');
    }

    if (!message.timestamp) {
      errors.push('缺少时间戳');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  setSecretKey(newKey) {
    this.secretKey = newKey;
    this._deriveKey();
  }

  setMaxMessageAge(ageMs) {
    this.maxMessageAge = ageMs;
  }
}

module.exports = new MessageSecurity();

export {};
