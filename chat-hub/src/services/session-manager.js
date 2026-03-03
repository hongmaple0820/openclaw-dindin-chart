/**
 * 会话管理服务
 * 
 * 会话ID格式：
 * - 群聊: group_{群聊ID}_{时间戳}
 * - 私聊: dm_{用户AID}_{用户BID}__{时间戳}
 */
const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor(db) {
    this.db = db;
    this.defaultConfig = {
      maxContextSize: 50,
      compressionThreshold: 40,
      summaryMaxLength: 500
    };
  }

  /**
   * 生成群聊会话ID
   */
  generateGroupSessionId(groupId) {
    return `group_${groupId}_${Date.now()}`;
  }

  /**
   * 生成私聊会话ID
   */
  generateDMSessionId(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}__${Date.now()}`;
  }

  /**
   * 解析会话ID
   */
  parseSessionId(sessionId) {
    if (sessionId.startsWith('group_')) {
      const parts = sessionId.split('_');
      return {
        type: 'group',
        groupId: parts[1],
        timestamp: parseInt(parts[2])
      };
    } else if (sessionId.startsWith('dm_')) {
      const parts = sessionId.split('__');
      const userParts = parts[0].split('_');
      return {
        type: 'dm',
        userId1: userParts[1],
        userId2: userParts[2],
        timestamp: parseInt(parts[1])
      };
    }
    return null;
  }

  /**
   * 创建新会话
   */
  async createSession(options) {
    const { type, groupId, userId1, userId2 } = options;
    
    let sessionId;
    if (type === 'group') {
      sessionId = this.generateGroupSessionId(groupId);
    } else {
      sessionId = this.generateDMSessionId(userId1, userId2);
    }

    // 创建会话配置
    await this.db.run(`
      INSERT INTO session_configs (id, session_id, max_context_size, compression_threshold, summary_max_length)
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), sessionId, this.defaultConfig.maxContextSize, 
        this.defaultConfig.compressionThreshold, this.defaultConfig.summaryMaxLength]);

    return { success: true, sessionId };
  }

  /**
   * 获取会话配置
   */
  async getConfig(sessionId) {
    const config = await this.db.get(`
      SELECT * FROM session_configs WHERE session_id = ?
    `, [sessionId]);

    return config || this.defaultConfig;
  }

  /**
   * 更新会话配置
   */
  async updateConfig(sessionId, config) {
    const fields = [];
    const values = [];

    if (config.maxContextSize !== undefined) {
      fields.push('max_context_size = ?');
      values.push(config.maxContextSize);
    }
    if (config.compressionThreshold !== undefined) {
      fields.push('compression_threshold = ?');
      values.push(config.compressionThreshold);
    }
    if (config.summaryMaxLength !== undefined) {
      fields.push('summary_max_length = ?');
      values.push(config.summaryMaxLength);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(sessionId);

      await this.db.run(`
        UPDATE session_configs SET ${fields.join(', ')} WHERE session_id = ?
      `, values);
    }

    return { success: true };
  }

  /**
   * 获取会话上下文
   */
  async getContext(sessionId, limit = 50) {
    const messages = await this.db.all(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [sessionId, limit]);

    return messages.reverse();
  }

  /**
   * 添加消息到上下文
   */
  async addMessage(sessionId, message) {
    const id = uuidv4();
    
    await this.db.run(`
      INSERT INTO messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `, [id, sessionId, message.role, message.content, Date.now()]);

    // 检查是否需要压缩
    const count = await this.getMessageCount(sessionId);
    const config = await this.getConfig(sessionId);

    if (count >= config.compression_threshold) {
      await this.compressContext(sessionId);
    }

    return { success: true, messageId: id };
  }

  /**
   * 获取消息数量
   */
  async getMessageCount(sessionId) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count FROM messages WHERE session_id = ?
    `, [sessionId]);

    return result?.count || 0;
  }

  /**
   * 压缩上下文
   */
  async compressContext(sessionId) {
    const config = await this.getConfig(sessionId);
    const messages = await this.getContext(sessionId, config.maxContextSize);

    if (messages.length < config.compression_threshold) {
      return { success: true, compressed: false };
    }

    // 提取关键信息
    const keyInfo = this.extractKeyInfo(messages);

    // 保留最新 10 条消息
    const keepMessages = messages.slice(-10);

    // 删除旧消息
    const oldestToKeep = keepMessages[0]?.timestamp || Date.now();
    await this.db.run(`
      DELETE FROM messages 
      WHERE session_id = ? AND timestamp < ?
    `, [sessionId, oldestToKeep]);

    // 存储摘要（如果有摘要表）
    // TODO: 存储到 session_summaries 表

    return { 
      success: true, 
      compressed: true,
      keyInfo,
      remainingCount: keepMessages.length
    };
  }

  /**
   * 提取关键信息
   */
  extractKeyInfo(messages) {
    const decisions = [];
    const preferences = {};
    const timeline = [];

    for (const msg of messages) {
      // 简单提取：包含特定关键词的消息
      const content = msg.content.toLowerCase();
      
      if (content.includes('决定') || content.includes('确定') || content.includes('选择')) {
        decisions.push({
          timestamp: msg.timestamp,
          content: msg.content.substring(0, 200)
        });
      }

      // 提取时间线
      timeline.push({
        timestamp: msg.timestamp,
        role: msg.role,
        preview: msg.content.substring(0, 100)
      });
    }

    return {
      sessionId: messages[0]?.session_id,
      decisions,
      preferences,
      timeline: timeline.slice(-10) // 只保留最近10条
    };
  }

  /**
   * 获取群聊的所有会话
   */
  async getGroupSessions(groupId, limit = 10) {
    const sessions = await this.db.all(`
      SELECT * FROM session_configs 
      WHERE session_id LIKE ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [`group_${groupId}_%`, limit]);

    return sessions;
  }

  /**
   * 获取私聊的所有会话
   */
  async getDMSessions(userId, limit = 10) {
    const sessions = await this.db.all(`
      SELECT * FROM session_configs 
      WHERE session_id LIKE ? OR session_id LIKE ?
      ORDER BY created_at DESC 
      LIMIT ?
    `, [`dm_${userId}_%`, `dm_%_${userId}__%`, limit]);

    return sessions;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    await this.db.run('DELETE FROM messages WHERE session_id = ?', [sessionId]);
    await this.db.run('DELETE FROM session_configs WHERE session_id = ?', [sessionId]);

    return { success: true };
  }
}

module.exports = SessionManager;
