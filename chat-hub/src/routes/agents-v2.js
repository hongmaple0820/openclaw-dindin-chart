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
 */
router.post('/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
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
    
    // 创建 OpenAI 适配器
    const adapter = new OpenAIAdapter(agent);
    
    // 调用 API
    const response = await adapter.chatCompletion({
      messages,
      model: model || agent.model,
      temperature: temperature ?? agent.params?.temperature,
      max_tokens: max_tokens ?? agent.params?.max_tokens,
      stream: false,
      ...restParams
    });
    
    // 更新统计
    registry.incrementRequestCount(id);
    
    console.log('[Agents V2] 对话: ' + agent.nickname + ' (' + id + '), tokens: ' + (response.usage?.total_tokens || 0));
    
    res.json(response);
  } catch (error) {
    console.error('[Agents V2] 对话失败:', error);
    
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
 */
router.post('/:id/chat/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
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
    
    // 设置 SSE 响应头
    streamingHandler.createSSE(res);
    
    // 创建 OpenAI 适配器
    const adapter = new OpenAIAdapter(agent);
    
    // 生成流 ID
    const streamId = uuidv4().replace(/-/g, '').slice(0, 24);
    
    // 启动心跳
    const stopHeartbeat = streamingHandler.startHeartbeat(res);
    
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
    await streamingHandler.streamOpenAIFormat(
      res, 
      streamId, 
      iterator, 
      model || agent.model
    );
    
    // 更新统计
    registry.incrementRequestCount(id);
    
    console.log('[Agents V2] 流式对话完成: ' + agent.nickname + ' (' + id + ')');
    
  } catch (error) {
    console.error('[Agents V2] 流式对话失败:', error);
    
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

module.exports = router;
