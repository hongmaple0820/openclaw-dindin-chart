/**
 * Agent V2 API Routes
 * 
 * 功能：
 * - Agent CRUD 管理（含公开/私有）
 * - OpenAI 协议兼容对话
 * - 流式响应支持
 * - 记忆管理 API
 * - 会话和统计
 * - API Token 管理
 * - 会话持久化和消息存储
 * - Token 计费统计
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// 导入 Agent 模块
const { 
  AgentRegistry, 
  OpenAIAdapter, 
  StreamingHandler,
  MemoryStore 
} = require('../agent');

// 导入会话管理
const { SessionManagerV2 } = require('../agent/session-manager-v2');

// 导入数据库
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// 初始化
const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'chat-hub.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const registry = new AgentRegistry(dbPath);
const streamingHandler = new StreamingHandler();
const sessionManager = new SessionManagerV2(db);

// 会话缓存（用于断线重连）
const sessionCache = new Map();

// ============================================================
// Agent CRUD
// ============================================================

/**
 * GET /api/agents
 * 获取 Agent 列表（含公开/私有）
 * 
 * Query:
 * - type: 类型过滤 (user-added/system/client)
 * - isPublic: 公开状态 (true/false)
 * - ownerId: 拥有者 ID
 * - status: 状态过滤 (offline/online/busy/error)
 * - limit: 返回数量 (默认 100)
 * - offset: 偏移量 (默认 0)
 */
router.get('/', async (req, res) => {
  try {
    const { type, isPublic, ownerId, status, limit = 100, offset = 0 } = req.query;
    
    const options = {
      type,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      ownerId,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    const agents = registry.listAgents(options);
    
    // 隐藏敏感信息
    const safeAgents = agents.map(agent => ({
      id: agent.id,
      nickname: agent.nickname,
      avatar: agent.avatar,
      description: agent.description,
      type: agent.type,
      isPublic: agent.isPublic,
      model: agent.model,
      capabilities: agent.capabilities,
      status: agent.status,
      lastActive: agent.lastActive,
      totalRequests: agent.totalRequests,
      createdAt: agent.createdAt
    }));
    
    res.json({
      success: true,
      count: safeAgents.length,
      agents: safeAgents
    });
  } catch (error) {
    console.error('[Agents V2] 获取列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/:id
 * 获取 Agent 详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id']; // 可选：用户认证
    
    // 检查权限
    const agent = registry.getAgentWithPermission(id, userId);
    
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found or access denied' 
      });
    }
    
    // 隐藏敏感信息
    const safeAgent = {
      id: agent.id,
      nickname: agent.nickname,
      avatar: agent.avatar,
      description: agent.description,
      type: agent.type,
      isPublic: agent.isPublic,
      ownerId: agent.ownerId,
      model: agent.model,
      params: agent.params,
      capabilities: agent.capabilities,
      memoryEnabled: agent.memoryEnabled,
      memoryConfig: agent.memoryConfig,
      skills: agent.skills,
      status: agent.status,
      lastActive: agent.lastActive,
      totalRequests: agent.totalRequests,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
    
    res.json({
      success: true,
      agent: safeAgent
    });
  } catch (error) {
    console.error('[Agents V2] 获取详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents
 * 注册新 Agent
 * 
 * Body:
 * - nickname: 名称 (必填)
 * - avatar: 头像 URL
 * - description: 描述
 * - type: 类型 (user-added/system/client)
 * - isPublic: 是否公开
 * - apiEndpoint: API 端点
 * - apiKey: API 密钥
 * - model: 模型名称
 * - params: 模型参数
 * - capabilities: 能力定义
 * - memoryEnabled: 是否启用记忆
 * - memoryConfig: 记忆配置
 * - skills: 技能列表
 */
router.post('/', async (req, res) => {
  try {
    const {
      nickname,
      avatar,
      description,
      type = 'user-added',
      isPublic = false,
      ownerId = null,
      apiEndpoint,
      apiKey,
      model,
      params = {},
      capabilities = {},
      memoryEnabled = true,
      memoryConfig = {},
      skills = []
    } = req.body;
    
    if (!nickname) {
      return res.status(400).json({ 
        success: false, 
        error: 'nickname is required' 
      });
    }
    
    // 从请求头获取用户 ID（如果已认证）
    const userId = req.headers['x-user-id'] || ownerId;
    
    const agent = registry.register({
      nickname,
      avatar,
      description,
      type,
      isPublic,
      ownerId: userId,
      apiEndpoint,
      apiKey,
      model,
      params,
      capabilities,
      memoryEnabled,
      memoryConfig,
      skills
    });
    
    console.log('[Agents V2] 注册 Agent: ' + nickname + ' (' + agent.id + ')');
    
    // 返回不含敏感信息的 Agent
    const { apiKeyEncrypted, ...safeAgent } = agent;
    
    res.status(201).json({
      success: true,
      agent: safeAgent
    });
  } catch (error) {
    console.error('[Agents V2] 注册失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agents/:id
 * 更新 Agent
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
    // 检查权限
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证所有权
    if (userId && agent.ownerId && agent.ownerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Permission denied' 
      });
    }
    
    const updates = req.body;
    const updatedAgent = registry.updateAgent(id, updates);
    
    console.log('[Agents V2] 更新 Agent: ' + updatedAgent.nickname + ' (' + id + ')');
    
    // 隐藏敏感信息
    const { apiKeyEncrypted, ...safeAgent } = updatedAgent;
    
    res.json({
      success: true,
      agent: safeAgent
    });
  } catch (error) {
    console.error('[Agents V2] 更新失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agents/:id
 * 删除 Agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
    // 检查权限
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证所有权
    if (userId && agent.ownerId && agent.ownerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Permission denied' 
      });
    }
    
    registry.unregister(id);
    
    console.log('[Agents V2] 删除 Agent: ' + agent.nickname + ' (' + id + ')');
    
    res.json({
      success: true,
      message: 'Agent ' + agent.nickname + ' has been deleted'
    });
  } catch (error) {
    console.error('[Agents V2] 删除失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 公开/私密切换
// ============================================================

/**
 * POST /api/agents/:id/toggle-public
 * 切换公开/私密
 */
router.post('/:id/toggle-public', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证所有权
    if (userId && agent.ownerId && agent.ownerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Permission denied' 
      });
    }
    
    const updatedAgent = registry.updateAgent(id, { 
      isPublic: !agent.isPublic 
    });
    
    console.log('[Agents V2] 切换公开状态: ' + agent.nickname + ' -> ' + (updatedAgent.isPublic ? 'public' : 'private'));
    
    res.json({
      success: true,
      isPublic: updatedAgent.isPublic,
      message: 'Agent is now ' + (updatedAgent.isPublic ? 'public' : 'private')
    });
  } catch (error) {
    console.error('[Agents V2] 切换公开状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 对话 API (OpenAI 协议兼容)
// ============================================================

/**
 * POST /api/agents/:id/chat
 * 与 Agent 对话 (非流式)
 * 
 * Body (OpenAI 格式):
 * - messages: 消息数组 [{role, content}]
 * - model: 模型名称 (可选，使用 Agent 默认)
 * - temperature: 温度参数
 * - max_tokens: 最大 token
 * - stream: false (非流式)
 * - sessionId: 会话 ID (可选，用于持久化会话)
 */
router.post('/:id/chat', async (req, res) => {
  const startTime = Date.now();
  let sessionId = req.body.sessionId;
  let logId = null;
  
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    // 检查权限
    const agentBase = registry.getAgentWithPermission(id, userId);
    if (!agentBase) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found or access denied' 
      });
    }
    
    // 获取完整 Agent（含 API 凭证）
    const agent = registry.getAgentWithCredentials(id);
    if (!agent || !agent.apiKey || !agent.apiEndpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agent API not configured' 
      });
    }
    
    const { messages, model, temperature, max_tokens, ...restParams } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'messages is required and must be a non-empty array' 
      });
    }
    
    // 获取或创建会话（会话持久化）
    let session;
    if (sessionId) {
      session = sessionManager.getSession(sessionId);
    }
    if (!session) {
      session = await sessionManager.createSession(userId, id, { sessionType: 'chat' });
      sessionId = session.id;
    }
    
    // 创建 API 日志记录
    logId = 'log_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    
    // 创建 OpenAI 适配器
    const adapter = new OpenAIAdapter(agent);
    
    // 估算输入 tokens
    const inputTokens = sessionManager.estimateTokens(messages);
    
    // 调用 API
    const response = await adapter.chatCompletion({
      messages,
      model: model || agent.model,
      temperature: temperature ?? agent.params?.temperature,
      max_tokens: max_tokens ?? agent.params?.max_tokens,
      stream: false,
      ...restParams
    });
    
    const latency = Date.now() - startTime;
    
    // 保存用户消息
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      await sessionManager.addMessage(sessionId, {
        role: 'user',
        content: typeof lastUserMessage.content === 'string' 
          ? lastUserMessage.content 
          : JSON.stringify(lastUserMessage.content)
      });
    }
    
    // 保存助手响应
    const assistantContent = response.choices?.[0]?.message?.content || '';
    if (assistantContent) {
      await sessionManager.addMessage(sessionId, {
        role: 'assistant',
        content: assistantContent
      });
    }
    
    // 记录 API 日志（Token 计费统计）
    const outputTokens = response.usage?.completion_tokens || sessionManager.estimateTokens([{ content: assistantContent }]);
    const totalTokens = response.usage?.total_tokens || (inputTokens + outputTokens);
    
    db.prepare(`
      INSERT INTO agent_api_logs (
        id, agent_id, session_id, user_id, request_type,
        request_tokens, response_tokens, is_streaming, latency_ms, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, id, sessionId, userId, 'chat',
      inputTokens, outputTokens, 0, latency, 'success', Date.now()
    );
    
    // 更新 Agent 统计
    registry.incrementRequestCount(id);
    
    // 更新会话 token 统计
    db.prepare(`
      UPDATE agent_sessions 
      SET total_tokens = total_tokens + ?, last_active = ?
      WHERE id = ?
    `).run(totalTokens, Date.now(), sessionId);
    
    console.log('[Agents V2] 对话: ' + agent.nickname + ' (' + id + '), tokens: ' + totalTokens + ', latency: ' + latency + 'ms');
    
    // 返回响应（包含会话信息）
    res.json({
      ...response,
      session_id: sessionId
    });
  } catch (error) {
    console.error('[Agents V2] 对话失败:', error);
    
    // 记录错误日志
    if (logId) {
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_api_logs (
          id, agent_id, session_id, user_id, request_type,
          latency_ms, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId, req.params.id, sessionId, req.headers['x-user-id'] || 'anonymous', 'chat',
        latency, 'error', error.message, Date.now()
      );
    }
    
    // OpenAI 格式错误响应
    res.status(error.status || 500).json({
      error: {
        message: error.message,
        type: error.type || 'api_error',
        code: error.code || 'internal_error'
      }
    });
  }
});

/**
 * POST /api/agents/:id/chat/stream
 * 流式对话
 * 
 * Body (OpenAI 格式):
 * - messages: 消息数组
 * - model: 模型名称 (可选)
 * - stream: true (流式)
 * - sessionId: 会话 ID (可选，用于持久化会话)
 */
router.post('/:id/chat/stream', async (req, res) => {
  const startTime = Date.now();
  let sessionId = req.body.sessionId;
  let logId = null;
  let totalContent = '';
  
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    // 检查权限
    const agentBase = registry.getAgentWithPermission(id, userId);
    if (!agentBase) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found or access denied' 
      });
    }
    
    // 获取完整 Agent
    const agent = registry.getAgentWithCredentials(id);
    if (!agent || !agent.apiKey || !agent.apiEndpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agent API not configured' 
      });
    }
    
    const { messages, model, temperature, max_tokens, ...restParams } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'messages is required' 
      });
    }
    
    // 获取或创建会话（会话持久化）
    let session;
    if (sessionId) {
      session = sessionManager.getSession(sessionId);
    }
    if (!session) {
      session = await sessionManager.createSession(userId, id, { sessionType: 'chat' });
      sessionId = session.id;
    }
    
    // 缓存会话（用于断线重连）
    sessionCache.set(sessionId, {
      agentId: id,
      userId,
      messages,
      createdAt: Date.now()
    });
    
    // 创建 API 日志记录
    logId = 'log_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    
    // 估算输入 tokens
    const inputTokens = sessionManager.estimateTokens(messages);
    
    // 设置 SSE 响应头
    streamingHandler.createSSE(res);
    
    // 发送会话信息
    streamingHandler.sendEvent(res, 'session', {
      session_id: sessionId,
      agent_id: id
    });
    
    // 创建 OpenAI 适配器
    const adapter = new OpenAIAdapter(agent);
    
    // 生成流 ID
    const streamId = uuidv4().replace(/-/g, '').slice(0, 24);
    
    // 启动心跳
    const stopHeartbeat = streamingHandler.startHeartbeat(res);
    
    // 保存用户消息
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      await sessionManager.addMessage(sessionId, {
        role: 'user',
        content: typeof lastUserMessage.content === 'string' 
          ? lastUserMessage.content 
          : JSON.stringify(lastUserMessage.content)
      });
    }
    
    // 调用流式 API
    const iterator = await adapter.chatCompletion({
      messages,
      model: model || agent.model,
      temperature: temperature ?? agent.params?.temperature,
      max_tokens: max_tokens ?? agent.params?.max_tokens,
      stream: true,
      ...restParams
    });
    
    // 流式输出
    for await (const chunk of iterator) {
      const content = streamingHandler.extractContent(chunk);
      if (content) {
        totalContent += content;
      }
      
      // 发送 SSE 事件
      const formatted = streamingHandler.formatOpenAIStream(content || '', model || agent.model, streamId);
      streamingHandler.sendEvent(res, 'message', formatted);
    }
    
    // 发送结束标记
    const endChunk = streamingHandler.formatOpenAIStreamEnd(model || agent.model, streamId);
    streamingHandler.sendEvent(res, 'message', endChunk);
    res.write('data: [DONE]\n\n');
    
    // 停止心跳
    stopHeartbeat();
    
    const latency = Date.now() - startTime;
    
    // 保存助手响应
    if (totalContent) {
      await sessionManager.addMessage(sessionId, {
        role: 'assistant',
        content: totalContent
      });
    }
    
    // 记录 API 日志（Token 计费统计）
    const outputTokens = sessionManager.estimateTokens([{ content: totalContent }]);
    
    db.prepare(`
      INSERT INTO agent_api_logs (
        id, agent_id, session_id, user_id, request_type,
        request_tokens, response_tokens, is_streaming, latency_ms, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, id, sessionId, userId, 'chat',
      inputTokens, outputTokens, 1, latency, 'success', Date.now()
    );
    
    // 更新 Agent 统计
    registry.incrementRequestCount(id);
    
    // 更新会话 token 统计
    db.prepare(`
      UPDATE agent_sessions 
      SET total_tokens = total_tokens + ?, last_active = ?
      WHERE id = ?
    `).run(inputTokens + outputTokens, Date.now(), sessionId);
    
    // 清理会话缓存
    sessionCache.delete(sessionId);
    
    console.log('[Agents V2] 流式对话完成: ' + agent.nickname + ' (' + id + '), tokens: ' + (inputTokens + outputTokens) + ', latency: ' + latency + 'ms');
    
    res.end();
  } catch (error) {
    console.error('[Agents V2] 流式对话失败:', error);
    
    // 记录错误日志
    if (logId) {
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_api_logs (
          id, agent_id, session_id, user_id, request_type,
          latency_ms, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId, req.params.id, sessionId, req.headers['x-user-id'] || 'anonymous', 'chat',
        latency, 'error', error.message, Date.now()
      );
    }
    
    // 尝试发送错误事件
    streamingHandler.sendEvent(res, 'error', {
      error: {
        message: error.message,
        type: error.type || 'api_error',
        code: error.code || 'internal_error'
      }
    });
    
    res.end();
  }
});

// ============================================================
// 记忆管理 API
// ============================================================

/**
 * GET /api/agents/:id/memories
 * 获取记忆列表
 * 
 * Query:
 * - type: 记忆类型 (short-term/long-term/episodic)
 * - limit: 返回数量 (默认 10)
 * - minImportance: 最小重要性 (0-1)
 */
router.get('/:id/memories', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit = 10, minImportance = 0 } = req.query;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 创建记忆存储
    const memoryStore = new MemoryStore(db, { agentId: id });
    
    const memories = memoryStore.retrieve({
      type: type || null,
      limit: parseInt(limit),
      minImportance: parseFloat(minImportance)
    });
    
    res.json({
      success: true,
      count: memories.length,
      memories
    });
  } catch (error) {
    console.error('[Agents V2] 获取记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/:id/memories
 * 添加记忆
 * 
 * Body:
 * - content: 记忆内容
 * - type: 类型 (short-term/long-term/episodic)
 * - importance: 重要性 (0-1)
 * - metadata: 元数据
 */
router.post('/:id/memories', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'short-term', importance = 0.5, metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'content is required' 
      });
    }
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 创建记忆存储
    const memoryStore = new MemoryStore(db, { agentId: id });
    
    const memory = memoryStore.add(content, {
      type,
      importance: parseFloat(importance),
      metadata
    });
    
    console.log('[Agents V2] 添加记忆: ' + agent.nickname + ' (' + id + '), type: ' + type);
    
    res.status(201).json({
      success: true,
      memory
    });
  } catch (error) {
    console.error('[Agents V2] 添加记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agents/:id/memories/:memoryId
 * 删除记忆
 */
router.delete('/:id/memories/:memoryId', async (req, res) => {
  try {
    const { id, memoryId } = req.params;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 创建记忆存储
    const memoryStore = new MemoryStore(db, { agentId: id });
    
    const deleted = memoryStore.delete(memoryId);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: 'Memory not found' 
      });
    }
    
    console.log('[Agents V2] 删除记忆: ' + agent.nickname + ' (' + id + '), memory: ' + memoryId);
    
    res.json({
      success: true,
      message: 'Memory deleted'
    });
  } catch (error) {
    console.error('[Agents V2] 删除记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 会话管理
// ============================================================

/**
 * GET /api/agents/:id/sessions
 * 获取会话列表
 * 
 * Query:
 * - limit: 返回数量
 * - status: 状态过滤
 */
router.get('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, status } = req.query;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 查询会话
    let sql = 'SELECT * FROM agent_sessions WHERE agent_id = ?';
    const params = [id];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY last_active DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const sessions = db.prepare(sql).all(...params);
    
    // 解析 JSON 字段
    const parsedSessions = sessions.map(s => ({
      ...s,
      context: s.context ? JSON.parse(s.context) : null
    }));
    
    res.json({
      success: true,
      count: parsedSessions.length,
      sessions: parsedSessions
    });
  } catch (error) {
    console.error('[Agents V2] 获取会话列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 统计 API
// ============================================================

/**
 * GET /api/agents/:id/stats
 * 获取统计信息
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 获取记忆统计
    const memoryStore = new MemoryStore(db, { agentId: id });
    const memoryStats = memoryStore.getStats();
    
    // 获取会话统计
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM agent_sessions WHERE agent_id = ?').get(id);
    
    // 获取 API 调用统计
    const apiStats = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(latency_ms) as avg_latency,
        SUM(request_tokens) as total_input_tokens,
        SUM(response_tokens) as total_output_tokens,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM agent_api_logs 
      WHERE agent_id = ?
    `).get(id);
    
    // 获取最近 7 天的调用统计
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dailyStats = db.prepare(`
      SELECT 
        date(created_at / 1000, 'unixepoch') as date,
        COUNT(*) as requests,
        AVG(latency_ms) as avg_latency
      FROM agent_api_logs 
      WHERE agent_id = ? AND created_at > ?
      GROUP BY date
      ORDER BY date DESC
    `).all(id, sevenDaysAgo);
    
    res.json({
      success: true,
      stats: {
        agent: {
          id: agent.id,
          nickname: agent.nickname,
          status: agent.status,
          totalRequests: agent.totalRequests,
          lastActive: agent.lastActive
        },
        memory: memoryStats,
        sessions: {
          total: sessionCount.count
        },
        api: {
          totalRequests: apiStats.total_requests || 0,
          avgLatency: Math.round(apiStats.avg_latency || 0),
          totalInputTokens: apiStats.total_input_tokens || 0,
          totalOutputTokens: apiStats.total_output_tokens || 0,
          errorRate: apiStats.total_requests > 0 
            ? ((apiStats.error_count || 0) / apiStats.total_requests * 100).toFixed(2)
            : 0
        },
        daily: dailyStats
      }
    });
  } catch (error) {
    console.error('[Agents V2] 获取统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// API Token 管理
// ============================================================

/**
 * POST /api/agents/:id/api-token
 * 创建 API Token
 * 
 * Body:
 * - name: Token 名称
 * - scope: 权限范围 ["chat", "task", "skill"]
 * - rateLimit: 速率限制 (requests per minute)
 * - dailyLimit: 每日限制
 * - expiresAt: 过期时间 (时间戳)
 */
router.post('/:id/api-token', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, scope = ['chat'], rateLimit = 60, dailyLimit, expiresAt } = req.body;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 生成 Token
    const tokenId = 'tok_' + uuidv4().slice(0, 8);
    const token = 'sk_agent_' + crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    
    // 插入数据库
    db.prepare(`
      INSERT INTO agent_api_tokens (
        id, agent_id, token, name, scope, 
        rate_limit, daily_limit, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tokenId,
      id,
      token,
      name || 'Token ' + tokenId.slice(-4),
      JSON.stringify(scope),
      rateLimit,
      dailyLimit,
      expiresAt,
      now
    );
    
    console.log('[Agents V2] 创建 Token: ' + agent.nickname + ' (' + id + '), name: ' + (name || 'unnamed'));
    
    res.status(201).json({
      success: true,
      token: {
        id: tokenId,
        token,  // 只返回一次
        name: name || 'Token ' + tokenId.slice(-4),
        scope,
        rateLimit,
        dailyLimit,
        expiresAt,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Agents V2] 创建 Token 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/:id/api-tokens
 * 获取 Token 列表
 */
router.get('/:id/api-tokens', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    const tokens = db.prepare(`
      SELECT id, name, scope, rate_limit, daily_limit, 
             total_requests, last_used, enabled, expires_at, created_at
      FROM agent_api_tokens 
      WHERE agent_id = ?
      ORDER BY created_at DESC
    `).all(id);
    
    // 解析 scope
    const parsedTokens = tokens.map(t => ({
      ...t,
      scope: t.scope ? JSON.parse(t.scope) : [],
      // 不返回 token 值
      token: undefined
    }));
    
    res.json({
      success: true,
      count: parsedTokens.length,
      tokens: parsedTokens
    });
  } catch (error) {
    console.error('[Agents V2] 获取 Token 列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agents/tokens/:tokenId
 * 删除 Token
 */
router.delete('/tokens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const token = db.prepare('SELECT * FROM agent_api_tokens WHERE id = ?').get(tokenId);
    if (!token) {
      return res.status(404).json({ 
        success: false, 
        error: 'Token not found' 
      });
    }
    
    db.prepare('DELETE FROM agent_api_tokens WHERE id = ?').run(tokenId);
    
    console.log('[Agents V2] 删除 Token: ' + tokenId);
    
    res.json({
      success: true,
      message: 'Token deleted'
    });
  } catch (error) {
    console.error('[Agents V2] 删除 Token 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 会话消息 API
// ============================================================

/**
 * GET /api/agents/:id/sessions/:sessionId/messages
 * 获取会话消息历史
 */
router.get('/:id/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const { limit, offset, includeSummary } = req.query;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证会话属于该 Agent
    const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ? AND agent_id = ?').get(sessionId, id);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // 获取消息
    const messages = await sessionManager.getMessages(sessionId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      includeSummary: includeSummary === 'true'
    });
    
    res.json({
      success: true,
      sessionId,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('[Agents V2] 获取会话消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agents/:id/sessions/:sessionId
 * 删除会话
 */
router.delete('/:id/sessions/:sessionId', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证会话属于该 Agent
    const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ? AND agent_id = ?').get(sessionId, id);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // 删除会话消息
    db.prepare('DELETE FROM session_messages WHERE session_id = ?').run(sessionId);
    
    // 删除压缩记录
    db.prepare('DELETE FROM context_compressions WHERE session_id = ?').run(sessionId);
    
    // 删除会话
    db.prepare('DELETE FROM agent_sessions WHERE id = ?').run(sessionId);
    
    console.log('[Agents V2] 删除会话: ' + sessionId);
    
    res.json({
      success: true,
      message: 'Session deleted'
    });
  } catch (error) {
    console.error('[Agents V2] 删除会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// Token 计费统计 API
// ============================================================

/**
 * GET /api/agents/:id/billing
 * 获取 Token 计费统计
 * 
 * Query:
 * - startDate: 开始日期 (YYYY-MM-DD 或时间戳)
 * - endDate: 结束日期
 * - groupBy: 分组方式 (day/hour)
 */
router.get('/:id/billing', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 解析日期
    let startTimestamp = startDate ? new Date(startDate).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
    let endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
    
    // 获取总统计
    const totalStats = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(request_tokens) as total_input_tokens,
        SUM(response_tokens) as total_output_tokens,
        SUM(request_tokens + response_tokens) as total_tokens,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM agent_api_logs 
      WHERE agent_id = ? AND created_at >= ? AND created_at <= ?
    `).get(id, startTimestamp, endTimestamp);
    
    // 按时间分组统计
    const timeFormat = groupBy === 'hour' 
      ? "strftime('%Y-%m-%d %H:00', created_at / 1000, 'unixepoch')"
      : "date(created_at / 1000, 'unixepoch')";
    
    const groupedStats = db.prepare(`
      SELECT 
        ${timeFormat} as time,
        COUNT(*) as requests,
        SUM(request_tokens) as input_tokens,
        SUM(response_tokens) as output_tokens,
        AVG(latency_ms) as avg_latency
      FROM agent_api_logs 
      WHERE agent_id = ? AND created_at >= ? AND created_at <= ?
      GROUP BY time
      ORDER BY time ASC
    `).all(id, startTimestamp, endTimestamp);
    
    // 按会话统计
    const sessionStats = db.prepare(`
      SELECT 
        session_id,
        COUNT(*) as requests,
        SUM(request_tokens) as input_tokens,
        SUM(response_tokens) as output_tokens
      FROM agent_api_logs 
      WHERE agent_id = ? AND created_at >= ? AND created_at <= ? AND session_id IS NOT NULL
      GROUP BY session_id
      ORDER BY requests DESC
      LIMIT 10
    `).all(id, startTimestamp, endTimestamp);
    
    // 计算费用（假设每 1K tokens $0.002）
    const inputCostPer1K = 0.0015;  // GPT-3.5-turbo input
    const outputCostPer1K = 0.002;  // GPT-3.5-turbo output
    
    const inputCost = ((totalStats.total_input_tokens || 0) / 1000) * inputCostPer1K;
    const outputCost = ((totalStats.total_output_tokens || 0) / 1000) * outputCostPer1K;
    const totalCost = inputCost + outputCost;
    
    res.json({
      success: true,
      billing: {
        period: {
          start: startTimestamp,
          end: endTimestamp
        },
        summary: {
          totalRequests: totalStats.total_requests || 0,
          totalInputTokens: totalStats.total_input_tokens || 0,
          totalOutputTokens: totalStats.total_output_tokens || 0,
          totalTokens: totalStats.total_tokens || 0,
          avgLatency: Math.round(totalStats.avg_latency || 0),
          errorCount: totalStats.error_count || 0,
          errorRate: totalStats.total_requests > 0 
            ? ((totalStats.error_count || 0) / totalStats.total_requests * 100).toFixed(2)
            : '0.00'
        },
        cost: {
          inputCost: inputCost.toFixed(6),
          outputCost: outputCost.toFixed(6),
          totalCost: totalCost.toFixed(6),
          currency: 'USD',
          rates: {
            inputPer1K: inputCostPer1K,
            outputPer1K: outputCostPer1K
          }
        },
        byTime: groupedStats,
        topSessions: sessionStats
      }
    });
  } catch (error) {
    console.error('[Agents V2] 获取计费统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/:id/billing/export
 * 导出计费数据 (CSV)
 */
router.get('/:id/billing/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, format = 'csv' } = req.query;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 解析日期
    let startTimestamp = startDate ? new Date(startDate).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
    let endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
    
    // 获取详细日志
    const logs = db.prepare(`
      SELECT 
        id, session_id, user_id, request_type,
        request_tokens, response_tokens, is_streaming,
        latency_ms, status, error_message, created_at
      FROM agent_api_logs 
      WHERE agent_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at ASC
    `).all(id, startTimestamp, endTimestamp);
    
    if (format === 'csv') {
      // 生成 CSV
      const headers = ['ID', 'Session ID', 'User ID', 'Type', 'Input Tokens', 'Output Tokens', 'Streaming', 'Latency (ms)', 'Status', 'Error', 'Timestamp'];
      const rows = logs.map(log => [
        log.id,
        log.session_id || '',
        log.user_id || '',
        log.request_type || '',
        log.request_tokens || 0,
        log.response_tokens || 0,
        log.is_streaming ? 'Yes' : 'No',
        log.latency_ms || 0,
        log.status || '',
        log.error_message || '',
        new Date(log.created_at).toISOString()
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agent_${id}_billing_${new Date().toISOString().slice(0,10)}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        logs
      });
    }
  } catch (error) {
    console.error('[Agents V2] 导出计费数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/:id/sessions/:sessionId/resume
 * 恢复会话（断线重连）
 */
router.post('/:id/sessions/:sessionId/resume', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 检查会话是否存在
    const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ? AND agent_id = ?').get(sessionId, id);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // 检查缓存中是否有未完成的流
    const cachedSession = sessionCache.get(sessionId);
    
    // 更新会话活跃时间
    db.prepare('UPDATE agent_sessions SET last_active = ? WHERE id = ?').run(Date.now(), sessionId);
    
    // 获取消息历史
    const messages = await sessionManager.getMessages(sessionId, { includeSummary: true });
    
    res.json({
      success: true,
      session: {
        id: session.id,
        agentId: session.agent_id,
        userId: session.user_id,
        messageCount: session.message_count,
        totalTokens: session.total_tokens,
        createdAt: session.created_at,
        lastActive: Date.now()
      },
      messages,
      hasPendingStream: !!cachedSession
    });
  } catch (error) {
    console.error('[Agents V2] 恢复会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/:id/bind-link
 * 生成绑定链接
 * 
 * Body:
 * - expiresIn: 过期时间（小时，默认 168 = 7天）
 */
router.post('/:id/bind-link', async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresIn = 168 } = req.body;
    const userId = req.headers['x-user-id'];
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 验证所有权
    if (userId && agent.ownerId && agent.ownerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Permission denied' 
      });
    }
    
    // 生成绑定 Token
    const bindToken = 'bind_' + crypto.randomBytes(16).toString('base64url');
    const expiresAt = Date.now() + expiresIn * 60 * 60 * 1000;
    
    // 先删除旧的绑定 Token
    db.prepare('DELETE FROM agent_bind_tokens WHERE agent_id = ?').run(id);
    
    // 存储绑定 Token
    db.prepare(`
      INSERT INTO agent_bind_tokens (id, agent_id, token, created_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'btk_' + Date.now(),
      id,
      bindToken,
      userId || 'system',
      expiresAt,
      Date.now()
    );
    
    // 生成绑定链接
    const baseUrl = process.env.BASE_URL || 'https://openclaw.ai';
    const bindLink = `${baseUrl}/bind?agent=${id}&token=${bindToken}`;
    
    console.log('[Agents V2] 生成绑定链接: ' + agent.nickname + ' (' + id + ')');
    
    res.json({
      success: true,
      bindLink,
      bindToken,
      expiresIn,
      expiresAt
    });
  } catch (error) {
    console.error('[Agents V2] 生成绑定链接失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/bind
 * 绑定 Agent 到 OpenClaw
 * 
 * Body:
 * - agentId: Agent ID
 * - token: 绑定 Token
 * - config: 绑定配置
 */
router.post('/bind', async (req, res) => {
  try {
    const { agentId, token, config = {} } = req.body;
    
    if (!agentId || !token) {
      return res.status(400).json({ 
        success: false, 
        error: 'agentId and token are required' 
      });
    }
    
    // 验证绑定 Token
    const bindRecord = db.prepare(`
      SELECT * FROM agent_bind_tokens 
      WHERE agent_id = ? AND token = ? AND used_at IS NULL AND expires_at > ?
    `).get(agentId, token, Date.now());
    
    if (!bindRecord) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired bind token' 
      });
    }
    
    // 获取 Agent
    const agent = registry.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 标记 Token 已使用
    db.prepare(`
      UPDATE agent_bind_tokens 
      SET used_at = ?, used_by = ?
      WHERE id = ?
    `).run(Date.now(), config.openclawId || 'unknown', bindRecord.id);
    
    // 更新 Agent 状态为已绑定
    registry.updateAgent(agentId, {
      status: 'active',
      bindConfig: config
    });
    
    console.log('[Agents V2] Agent 已绑定: ' + agent.nickname + ' (' + agentId + ')');
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        nickname: agent.nickname,
        status: 'active',
        boundAt: Date.now()
      }
    });
  } catch (error) {
    console.error('[Agents V2] 绑定失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/:id/bind-status
 * 获取绑定状态
 */
router.get('/:id/bind-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 获取绑定 Token 信息
    const bindRecord = db.prepare(`
      SELECT * FROM agent_bind_tokens WHERE agent_id = ?
    `).get(id);
    
    res.json({
      success: true,
      status: {
        bound: !!agent.bindConfig,
        bindLink: bindRecord && !bindRecord.used_at ? {
          token: bindRecord.token,
          expiresAt: bindRecord.expires_at,
          createdAt: bindRecord.created_at
        } : null,
        boundAt: agent.bindConfig?.boundAt || null
      }
    });
  } catch (error) {
    console.error('[Agents V2] 获取绑定状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/:id/duplicate
 * 复制 Agent
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
    const agent = registry.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 复制 Agent
    const newAgent = registry.register({
      nickname: agent.nickname + ' (副本)',
      avatar: agent.avatar,
      description: agent.description,
      type: agent.type,
      isPublic: false,  // 副本默认私有
      ownerId: userId || agent.ownerId,
      apiEndpoint: agent.apiEndpoint,
      apiKey: agent.apiKey,  // 复制时也复制 API Key
      model: agent.model,
      params: agent.params,
      capabilities: agent.capabilities,
      memoryEnabled: agent.memoryEnabled,
      memoryConfig: agent.memoryConfig,
      skills: agent.skills
    });
    
    console.log('[Agents V2] 复制 Agent: ' + agent.nickname + ' -> ' + newAgent.nickname);
    
    const { apiKeyEncrypted, ...safeAgent } = newAgent;
    
    res.status(201).json({
      success: true,
      agent: safeAgent
    });
  } catch (error) {
    console.error('[Agents V2] 复制失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
