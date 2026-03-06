/**
 * Session Manager V2 - 会话管理优化版
 * 
 * 功能：
 * - Session ID 规范化: {user_id}_{agent_id}_{timestamp}
 * - 会话切片存储
 * - 上下文压缩
 * - 会话隔离
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class SessionManagerV2 {
  constructor(db, options = {}) {
    this.db = db;
    this.config = {
      sliceSize: options.sliceSize || 50,           // 每片消息数
      compressionThreshold: options.compressionThreshold || 100, // 压缩阈值
      keepRecentMessages: options.keepRecentMessages || 20,       // 保留最近消息
      sessionTTL: options.sessionTTL || 86400000,   // 会话过期时间 24小时
      ...options
    };
  }

  // ==================== Session ID 规范化 ====================

  /**
   * 生成规范化 Session ID
   * 格式: {user_id}_{agent_id}_{timestamp}
   */
  generateSessionId(userId, agentId) {
    const timestamp = Date.now();
    return `${userId}_${agentId}_${timestamp}`;
  }

  /**
   * 解析 Session ID
   */
  parseSessionId(sessionId) {
    const parts = sessionId.split('_');
    if (parts.length < 3) {
      return null;
    }
    const timestamp = parseInt(parts[parts.length - 1]);
    const agentId = parts[parts.length - 2];
    const userId = parts.slice(0, -2).join('_');
    return { userId, agentId, timestamp };
  }

  /**
   * 验证 Session ID 格式
   */
  isValidSessionId(sessionId) {
    return this.parseSessionId(sessionId) !== null;
  }

  // ==================== 会话管理 ====================

  /**
   * 创建会话
   */
  async createSession(userId, agentId, options = {}) {
    const sessionId = this.generateSessionId(userId, agentId);
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO agent_sessions (id, agent_id, user_id, session_type, context, created_at, last_active, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      agentId,
      userId,
      options.sessionType || 'chat',
      JSON.stringify({ messages: [] }),
      now,
      now,
      now + this.config.sessionTTL
    );

    // 创建第一个切片
    await this.createSlice(sessionId, 0);

    return {
      id: sessionId,
      agentId,
      userId,
      createdAt: now
    };
  }

  /**
   * 获取或创建会话
   */
  async getOrCreateSession(userId, agentId) {
    // 查找最近的活跃会话
    const existing = this.db.prepare(`
      SELECT * FROM agent_sessions 
      WHERE user_id = ? AND agent_id = ? AND expires_at > ?
      ORDER BY last_active DESC
      LIMIT 1
    `).get(userId, agentId, Date.now());

    if (existing) {
      // 更新活跃时间
      this.db.prepare('UPDATE agent_sessions SET last_active = ? WHERE id = ?')
        .run(Date.now(), existing.id);
      return existing;
    }

    // 创建新会话
    return this.createSession(userId, agentId);
  }

  /**
   * 获取会话
   */
  getSession(sessionId) {
    return this.db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(sessionId);
  }

  // ==================== 会话切片 ====================

  /**
   * 创建切片
   */
  async createSlice(sessionId, sliceIndex) {
    const sliceId = `${sessionId}_slice_${sliceIndex}`;
    
    this.db.prepare(`
      INSERT INTO session_messages (id, session_id, slice_index, messages, token_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sliceId, sessionId, sliceIndex, JSON.stringify([]), 0, Date.now());

    return {
      id: sliceId,
      sessionId,
      sliceIndex,
      messages: [],
      tokenCount: 0
    };
  }

  /**
   * 获取当前切片
   */
  async getCurrentSlice(sessionId) {
    const result = this.db.prepare(`
      SELECT * FROM session_messages 
      WHERE session_id = ? 
      ORDER BY slice_index DESC 
      LIMIT 1
    `).get(sessionId);

    if (!result) {
      return this.createSlice(sessionId, 0);
    }

    return {
      ...result,
      messages: JSON.parse(result.messages || '[]')
    };
  }

  /**
   * 添加消息
   */
  async addMessage(sessionId, message) {
    let currentSlice = await this.getCurrentSlice(sessionId);
    
    // 检查是否需要新切片
    if (currentSlice.messages.length >= this.config.sliceSize) {
      currentSlice = await this.createSlice(sessionId, currentSlice.slice_index + 1);
    }

    // 添加消息
    currentSlice.messages.push({
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    });

    // 保存切片
    this.db.prepare(`
      UPDATE session_messages 
      SET messages = ?, token_count = ? 
      WHERE id = ?
    `).run(
      JSON.stringify(currentSlice.messages),
      this.estimateTokens(currentSlice.messages),
      currentSlice.id
    );

    // 更新会话统计
    this.db.prepare(`
      UPDATE agent_sessions 
      SET message_count = message_count + 1, 
          last_active = ?,
          context_tokens = context_tokens + ?
      WHERE id = ?
    `).run(Date.now(), this.estimateTokens([message]), sessionId);

    // 检查是否需要压缩
    const session = this.getSession(sessionId);
    if (session.message_count >= this.config.compressionThreshold) {
      await this.compressContext(sessionId);
    }

    return message;
  }

  /**
   * 获取所有消息
   */
  async getMessages(sessionId, options = {}) {
    const { limit, offset, includeSummary } = options;

    let query = 'SELECT * FROM session_messages WHERE session_id = ? ORDER BY slice_index ASC';
    const slices = this.db.prepare(query).all(sessionId);

    let messages = [];
    for (const slice of slices) {
      messages = messages.concat(JSON.parse(slice.messages || '[]'));
    }

    // 如果有压缩摘要，添加到开头
    if (includeSummary) {
      const summary = this.db.prepare(`
        SELECT * FROM context_compressions 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(sessionId);
      
      if (summary) {
        messages.unshift({
          role: 'system',
          content: `[历史摘要] ${summary.summary}`,
          isSummary: true
        });
      }
    }

    // 分页
    if (offset !== undefined) {
      messages = messages.slice(offset);
    }
    if (limit !== undefined) {
      messages = messages.slice(0, limit);
    }

    return messages;
  }

  // ==================== 上下文压缩 ====================

  /**
   * 压缩上下文
   */
  async compressContext(sessionId) {
    const messages = await this.getMessages(sessionId);
    
    if (messages.length < this.config.compressionThreshold) {
      return null;
    }

    // 保留最近消息
    const recentMessages = messages.slice(-this.config.keepRecentMessages);
    const oldMessages = messages.slice(0, -this.config.keepRecentMessages);

    // 生成摘要（简化版，实际应调用 LLM）
    const summary = this.generateSummary(oldMessages);

    // 保存压缩记录
    const compressionId = uuidv4();
    this.db.prepare(`
      INSERT INTO context_compressions (
        id, session_id, summary, original_message_count, 
        original_token_count, compressed_token_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      compressionId,
      sessionId,
      summary,
      oldMessages.length,
      this.estimateTokens(oldMessages),
      this.estimateTokens([{ content: summary }]),
      Date.now()
    );

    // 删除旧切片（保留最近的）
    const slices = this.db.prepare(`
      SELECT id FROM session_messages 
      WHERE session_id = ? 
      ORDER BY slice_index ASC
    `).all(sessionId);

    const slicesToDelete = slices.slice(0, -2); // 保留最后 2 个切片
    for (const slice of slicesToDelete) {
      this.db.prepare('DELETE FROM session_messages WHERE id = ?').run(slice.id);
    }

    // 更新会话
    this.db.prepare(`
      UPDATE agent_sessions 
      SET message_count = ?, context_tokens = ?
      WHERE id = ?
    `).run(
      recentMessages.length,
      this.estimateTokens(recentMessages),
      sessionId
    );

    return {
      compressionId,
      summary,
      messagesRemoved: oldMessages.length
    };
  }

  /**
   * 生成摘要（简化版）
   */
  generateSummary(messages) {
    // 简化版：实际应调用 LLM
    const roles = {};
    for (const msg of messages) {
      roles[msg.role] = (roles[msg.role] || 0) + 1;
    }
    return `对话包含 ${messages.length} 条消息（用户: ${roles.user || 0}, 助手: ${roles.assistant || 0}）`;
  }

  // ==================== 工具方法 ====================

  /**
   * 估算 Token 数
   */
  estimateTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      if (msg.content) {
        // 简化估算：中文约 1.5 字/token，英文约 4 字/token
        total += Math.ceil(msg.content.length / 2);
      }
    }
    return total;
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    const expired = this.db.prepare(`
      SELECT id FROM agent_sessions WHERE expires_at < ?
    `).all(now);

    for (const session of expired) {
      // 删除切片
      this.db.prepare('DELETE FROM session_messages WHERE session_id = ?').run(session.id);
      // 删除压缩记录
      this.db.prepare('DELETE FROM context_compressions WHERE session_id = ?').run(session.id);
      // 删除会话
      this.db.prepare('DELETE FROM agent_sessions WHERE id = ?').run(session.id);
    }

    return expired.length;
  }

  /**
   * 获取会话统计
   */
  getStats(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const slices = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(token_count) as tokens
      FROM session_messages WHERE session_id = ?
    `).get(sessionId);

    const compressions = this.db.prepare(`
      SELECT COUNT(*) as count FROM context_compressions WHERE session_id = ?
    `).get(sessionId);

    return {
      sessionId,
      messageCount: session.message_count,
      tokenCount: session.context_tokens || slices.tokens || 0,
      sliceCount: slices.count,
      compressionCount: compressions.count,
      createdAt: session.created_at,
      lastActive: session.last_active
    };
  }
}

module.exports = { SessionManagerV2 };