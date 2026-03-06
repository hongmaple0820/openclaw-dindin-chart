/**
 * Session Manager V2 - 会话管理优化版
 * 
 * 功能：
 * - Session ID 规范化: {user_id}_{agent_id}_{timestamp}
 * - 会话切片存储
 * - 上下文压缩
 * - 会话隔离
 */

import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';

// Type alias for the database instance
type SqliteDatabase = ReturnType<typeof Database>;

interface SessionManagerConfig {
  sliceSize?: number;
  compressionThreshold?: number;
  keepRecentMessages?: number;
  sessionTTL?: number;
}

interface SessionMessage {
  id: string;
  timestamp: number;
  role: string;
  content: string;
  isSummary?: boolean;
}

interface SessionSlice {
  id: string;
  sessionId: string;
  sliceIndex: number;
  messages: SessionMessage[];
  tokenCount: number;
}

interface SessionInfo {
  id: string;
  agentId: string;
  userId: string;
  sessionType?: string;
  createdAt: number;
  lastActive?: number;
  expiresAt?: number;
  messageCount?: number;
  contextTokens?: number;
}

interface SessionStats {
  sessionId: string;
  messageCount: number;
  tokenCount: number;
  sliceCount: number;
  compressionCount: number;
  createdAt: number;
  lastActive: number;
}

interface CompressionResult {
  compressionId: string;
  summary: string;
  messagesRemoved: number;
}

interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  includeSummary?: boolean;
}

interface CreateSessionOptions {
  sessionType?: string;
}

class SessionManagerV2 {
  private db: SqliteDatabase;
  private config: Required<SessionManagerConfig>;

  constructor(db: SqliteDatabase, options: SessionManagerConfig = {}) {
    this.db = db;
    this.config = {
      sliceSize: options.sliceSize || 50,
      compressionThreshold: options.compressionThreshold || 100,
      keepRecentMessages: options.keepRecentMessages || 20,
      sessionTTL: options.sessionTTL || 86400000,
    };
  }

  // ==================== Session ID 规范化 ====================

  /**
   * 生成规范化 Session ID
   * 格式: {user_id}_{agent_id}_{timestamp}
   */
  generateSessionId(userId: string, agentId: string): string {
    const timestamp = Date.now();
    return `${userId}_${agentId}_${timestamp}`;
  }

  /**
   * 解析 Session ID
   */
  parseSessionId(sessionId: string): { userId: string; agentId: string; timestamp: number } | null {
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
  isValidSessionId(sessionId: string): boolean {
    return this.parseSessionId(sessionId) !== null;
  }

  // ==================== 会话管理 ====================

  /**
   * 创建会话
   */
  async createSession(userId: string, agentId: string, options: CreateSessionOptions = {}): Promise<SessionInfo> {
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
  async getOrCreateSession(userId: string, agentId: string): Promise<any> {
    // 查找最近的活跃会话
    const existing = this.db.prepare(`
      SELECT * FROM agent_sessions 
      WHERE user_id = ? AND agent_id = ? AND expires_at > ?
      ORDER BY last_active DESC
      LIMIT 1
    `).get(userId, agentId, Date.now()) as any;

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
  getSession(sessionId: string): any {
    return this.db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(sessionId);
  }

  // ==================== 会话切片 ====================

  /**
   * 创建切片
   */
  async createSlice(sessionId: string, sliceIndex: number): Promise<SessionSlice> {
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
  async getCurrentSlice(sessionId: string): Promise<SessionSlice> {
    const result = this.db.prepare(`
      SELECT * FROM session_messages 
      WHERE session_id = ? 
      ORDER BY slice_index DESC 
      LIMIT 1
    `).get(sessionId) as any;

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
  async addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<SessionMessage> {
    let currentSlice = await this.getCurrentSlice(sessionId);
    
    // 检查是否需要新切片
    if (currentSlice.messages.length >= this.config.sliceSize) {
      currentSlice = await this.createSlice(sessionId, currentSlice.sliceIndex + 1);
    }

    // 添加消息
    const newMessage: SessionMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    };
    currentSlice.messages.push(newMessage);

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
    `).run(Date.now(), this.estimateTokens([newMessage]), sessionId);

    // 检查是否需要压缩
    const session = this.getSession(sessionId) as any;
    if (session && session.message_count >= this.config.compressionThreshold) {
      await this.compressContext(sessionId);
    }

    return newMessage;
  }

  /**
   * 获取所有消息
   */
  async getMessages(sessionId: string, options: GetMessagesOptions = {}): Promise<SessionMessage[]> {
    const { limit, offset, includeSummary } = options;

    const query = 'SELECT * FROM session_messages WHERE session_id = ? ORDER BY slice_index ASC';
    const slices = this.db.prepare(query).all(sessionId) as any[];

    let messages: SessionMessage[] = [];
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
      `).get(sessionId) as any;
      
      if (summary) {
        messages.unshift({
          role: 'system',
          content: `[历史摘要] ${summary.summary}`,
          isSummary: true,
          id: 'summary',
          timestamp: summary.created_at
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
  async compressContext(sessionId: string): Promise<CompressionResult | null> {
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
      this.estimateTokens([{ content: summary } as SessionMessage]),
      Date.now()
    );

    // 删除旧切片（保留最近的）
    const slices = this.db.prepare(`
      SELECT id FROM session_messages 
      WHERE session_id = ? 
      ORDER BY slice_index ASC
    `).all(sessionId) as any[];

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
  generateSummary(messages: SessionMessage[]): string {
    // 简化版：实际应调用 LLM
    const roles: Record<string, number> = {};
    for (const msg of messages) {
      roles[msg.role] = (roles[msg.role] || 0) + 1;
    }
    return `对话包含 ${messages.length} 条消息（用户: ${roles.user || 0}, 助手: ${roles.assistant || 0}）`;
  }

  // ==================== 工具方法 ====================

  /**
   * 估算 Token 数
   */
  estimateTokens(messages: SessionMessage[]): number {
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
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const expired = this.db.prepare(`
      SELECT id FROM agent_sessions WHERE expires_at < ?
    `).all(now) as any[];

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
  getStats(sessionId: string): SessionStats | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const slices = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(token_count) as tokens
      FROM session_messages WHERE session_id = ?
    `).get(sessionId) as any;

    const compressions = this.db.prepare(`
      SELECT COUNT(*) as count FROM context_compressions WHERE session_id = ?
    `).get(sessionId) as any;

    return {
      sessionId,
      messageCount: (session as any).message_count || 0,
      tokenCount: (session as any).context_tokens || slices.tokens || 0,
      sliceCount: slices.count,
      compressionCount: compressions.count,
      createdAt: (session as any).created_at,
      lastActive: (session as any).last_active
    };
  }
}

export { SessionManagerV2 };