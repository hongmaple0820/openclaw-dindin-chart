/**
 * Agent 管理 API
 */

const express = require('express');
const router = express.Router();
const AgentManager = require('../agent/agent-manager');
const sseManager = require('../sse-manager');
const messageRouter = require('../message-router');
const config = require('../config');

const agentManager = new AgentManager();

// ========== Agent 管理 ==========

/**
 * POST /api/agents/register
 * 注册新 Agent
 */
router.post('/register', async (req, res) => {
  try {
    const { name, type = 'custom', permissions = [], metadata = {} } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'name is required' 
      });
    }

    const result = await agentManager.registerAgent({
      name,
      type,
      permissions,
      metadata
    });

    console.log(`[Agents] 注册新 Agent: ${name} (${result.agentId})`);
    
    res.json({
      success: true,
      agentId: result.agentId,
      apiKey: result.apiKey
    });
  } catch (error) {
    console.error('[Agents] 注册失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/agents
 * 获取 Agent 列表
 */
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    
    const agents = await agentManager.listAgents({ type, status });
    
    // 隐藏敏感信息
    const safeAgents = agents.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      permissions: a.permissions,
      subscribedChannels: a.subscribedChannels || [],
      createdAt: a.created_at,
      lastActive: a.last_active
    }));
    
    res.json({
      success: true,
      count: safeAgents.length,
      agents: safeAgents
    });
  } catch (error) {
    console.error('[Agents] 获取列表失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/agents/:id
 * 获取 Agent 详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = await agentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    // 隐藏敏感信息
    const safeAgent = {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      permissions: agent.permissions,
      subscribedChannels: agent.subscribedChannels || [],
      createdAt: agent.created_at,
      lastActive: agent.last_active
    };
    
    res.json({
      success: true,
      agent: safeAgent
    });
  } catch (error) {
    console.error('[Agents] 获取详情失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/agents/:id
 * 注销 Agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    await agentManager.unregisterAgent(id);
    
    console.log(`[Agents] 注销 Agent: ${agent.name} (${id})`);
    
    res.json({
      success: true,
      message: `Agent ${agent.name} has been unregistered`
    });
  } catch (error) {
    console.error('[Agents] 注销失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ========== 配置管理 ==========

/**
 * GET /api/agents/:id/config
 * 获取 Agent 配置
 */
router.get('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await agentManager.getAgentConfig(id);
    
    if (config === null) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[Agents] 获取配置失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /api/agents/:id/config
 * 更新 Agent 配置
 */
router.put('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    const newConfig = await agentManager.updateAgentConfig(id, updates);
    
    console.log(`[Agents] 更新配置: ${agent.name} (${id})`);
    
    res.json({
      success: true,
      config: newConfig
    });
  } catch (error) {
    console.error('[Agents] 更新配置失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ========== 通道绑定 ==========

/**
 * GET /api/agents/:id/channels
 * 获取 Agent 绑定的通道
 */
router.get('/:id/channels', async (req, res) => {
  try {
    const { id } = req.params;
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    const channels = await agentManager.getBoundChannels(id);
    
    res.json({
      success: true,
      count: channels.length,
      channels
    });
  } catch (error) {
    console.error('[Agents] 获取通道失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/agents/:id/channels/:channelId
 * 绑定通道到 Agent
 */
router.post('/:id/channels/:channelId', async (req, res) => {
  try {
    const { id, channelId } = req.params;
    const { permissions = [] } = req.body;
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    await agentManager.bindChannel(id, channelId, permissions);
    
    console.log(`[Agents] 绑定通道: ${agent.name} -> ${channelId}`);
    
    res.json({
      success: true,
      message: `Channel ${channelId} bound to agent ${agent.name}`
    });
  } catch (error) {
    console.error('[Agents] 绑定通道失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/agents/:id/channels/:channelId
 * 解绑通道
 */
router.delete('/:id/channels/:channelId', async (req, res) => {
  try {
    const { id, channelId } = req.params;
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    await agentManager.unbindChannel(id, channelId);
    
    console.log(`[Agents] 解绑通道: ${agent.name} -> ${channelId}`);
    
    res.json({
      success: true,
      message: `Channel ${channelId} unbound from agent ${agent.name}`
    });
  } catch (error) {
    console.error('[Agents] 解绑通道失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ========== 消息 ==========

/**
 * POST /api/agents/:id/messages
 * Agent 发送消息
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', channel, atTargets, replyTo } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'content is required' 
      });
    }
    
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agent not found' 
      });
    }
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: id,
      sender: agent.name,
      content,
      type,
      channel,
      atTargets,
      replyTo,
      timestamp: Date.now(),
      source: 'agent'
    };
    
    // 发送消息
    const result = await agentManager.sendMessage(id, message);
    
    console.log(`[Agents] 发送消息: ${agent.name} -> ${content.substring(0, 50)}...`);
    
    res.json({
      success: true,
      message: {
        id: message.id,
        sender: message.sender,
        content: message.content,
        timestamp: message.timestamp
      },
      delivered: result.delivered
    });
  } catch (error) {
    console.error('[Agents] 发送消息失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/agents/:id/stream
 * SSE 消息流
 */
router.get('/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = req.headers['x-agent-api-key'];
    
    // 验证 Agent
    const agent = apiKey 
      ? await agentManager.verifyAgent(apiKey)
      : await agentManager.getAgent(id);
    
    if (!agent || agent.id !== id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid agent or API key' 
      });
    }
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // 发送连接确认
    res.write(`event: connected\ndata: ${JSON.stringify({ agentId: id, timestamp: Date.now() })}\n\n`);
    
    // 创建消息流
    const stream = agentManager.createMessageStream(id);
    
    // 处理消息
    const messageHandler = (message) => {
      try {
        res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
      } catch (e) {
        // 连接可能已关闭
      }
    };
    
    stream.on('message', messageHandler);
    
    // 心跳
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (e) {
        clearInterval(heartbeat);
        stream.off('message', messageHandler);
      }
    }, 30000);
    
    // 客户端断开连接时清理
    req.on('close', () => {
      clearInterval(heartbeat);
      stream.off('message', messageHandler);
      console.log(`[Agents] SSE 连接关闭: ${id}`);
    });
    
    console.log(`[Agents] SSE 连接建立: ${agent.name} (${id})`);
    
  } catch (error) {
    console.error('[Agents] SSE 连接失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = router;

// Make this a module
export {};
