/**
 * 技能系统路由
 * 
 * API 端点：
 * - GET    /api/skills              获取技能列表
 * - GET    /api/skills/:id          获取技能详情
 * - POST   /api/skills              注册技能
 * - PUT    /api/skills/:id          更新技能
 * - DELETE /api/skills/:id          删除技能
 * 
 * 用户技能绑定：
 * - GET    /api/skills/user/:userId         获取用户技能列表
 * - POST   /api/skills/user/:userId         绑定用户技能
 * - DELETE /api/skills/user/:userId/:skillId 解绑用户技能
 * 
 * 执行技能：
 * - POST   /api/skills/execute      执行技能
 * 
 * MCP 服务器：
 * - GET    /api/skills/mcp          获取 MCP 服务器列表
 * - POST   /api/skills/mcp          添加 MCP 服务器
 * - POST   /api/skills/mcp/call     调用 MCP 工具
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Skills 模块引用
let skillsManager = null;
let skillRegistry = null;
let skillExecutor = null;
let mcporterBridge = null;

/**
 * 设置 SkillsManager 实例
 */
function setSkillsManager(manager) {
  skillsManager = manager;
  skillRegistry = manager.registry;
  skillExecutor = manager.executor;
  mcporterBridge = manager.mcporterBridge;
}

/**
 * 确保技能管理器已初始化
 */
function ensureManager(req, res, next) {
  if (!skillsManager) {
    return res.status(500).json({
      success: false,
      error: 'Skills manager not initialized'
    });
  }
  next();
}

// ==================== 技能管理 API ====================

/**
 * GET /api/skills
 * 获取技能列表
 */
router.get('/', ensureManager, async (req, res) => {
  try {
    const { category, source, enabled, search, limit, offset } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (source) filter.source = source;
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    if (search) filter.search = search;
    
    const skills = await skillRegistry.list(filter);
    
    // 分页
    const start = offset ? parseInt(offset) : 0;
    const end = limit ? start + parseInt(limit) : skills.length;
    const paginatedSkills = skills.slice(start, end);
    
    res.json({
      success: true,
      data: paginatedSkills,
      total: skills.length,
      limit: limit ? parseInt(limit) : null,
      offset: start
    });
  } catch (error) {
    console.error('[Skills API] 获取技能列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/skills/:id
 * 获取技能详情
 */
router.get('/:id', ensureManager, async (req, res) => {
  try {
    const skill = await skillRegistry.get(req.params.id);
    
    if (!skill) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }
    
    res.json({
      success: true,
      data: skill
    });
  } catch (error) {
    console.error('[Skills API] 获取技能详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills
 * 注册技能
 */
router.post('/', ensureManager, async (req, res) => {
  try {
    const {
      id,
      name,
      display_name,
      description,
      version,
      author,
      category,
      tags,
      source,
      skill_path,
      config_schema,
      default_config,
      permissions,
      mcp_compatible,
      mcp_tools,
      enabled,
      is_public,
      priority
    } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'id and name are required'
      });
    }
    
    const skillData = {
      id,
      name,
      display_name,
      description,
      version,
      author,
      category,
      tags,
      source,
      skill_path,
      config_schema,
      default_config,
      permissions,
      mcp_compatible,
      mcp_tools,
      enabled,
      is_public,
      priority
    };
    
    const result = await skillRegistry.register(skillData);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Skills API] 注册技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/skills/:id
 * 更新技能信息
 */
router.put('/:id', ensureManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查技能是否存在
    const existing = await skillRegistry.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }
    
    // 更新数据库
    const db = skillRegistry.db;
    const updates = [];
    const values = [];
    
    const updateFields = [
      'name', 'display_name', 'description', 'version', 'author',
      'category', 'tags', 'source', 'skill_path', 'config_schema',
      'default_config', 'permissions', 'mcp_compatible', 'mcp_tools',
      'enabled', 'is_public', 'priority'
    ];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        // JSON 字段需要序列化
        if (['tags', 'config_schema', 'default_config', 'permissions', 'mcp_tools'].includes(field)) {
          values.push(JSON.stringify(req.body[field]));
        } else if (field === 'mcp_compatible' || field === 'enabled' || field === 'is_public') {
          values.push(req.body[field] ? 1 : 0);
        } else {
          values.push(req.body[field]);
        }
      }
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);
      
      await db.run(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    
    // 返回更新后的技能
    const updated = await skillRegistry.get(id);
    
    // 清除缓存
    skillRegistry._invalidateCache(`skill:${id}`);
    skillRegistry._invalidateCache('skills:all');
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[Skills API] 更新技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/skills/:id
 * 删除技能
 */
router.delete('/:id', ensureManager, async (req, res) => {
  try {
    const result = await skillRegistry.unregister(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }
    
    res.json({
      success: true,
      data: { id: req.params.id, deleted: true }
    });
  } catch (error) {
    console.error('[Skills API] 删除技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 用户技能绑定 API ====================

/**
 * GET /api/skills/user/:userId
 * 获取用户绑定的技能列表
 */
router.get('/user/:userId', ensureManager, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userSkills = await skillRegistry.getUserSkills(userId);
    
    res.json({
      success: true,
      data: userSkills,
      total: userSkills.length
    });
  } catch (error) {
    console.error('[Skills API] 获取用户技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills/user/:userId
 * 绑定用户技能
 */
router.post('/user/:userId', ensureManager, async (req, res) => {
  try {
    const { userId } = req.params;
    const { skillId, config, enabled, pinned } = req.body;
    
    if (!skillId) {
      return res.status(400).json({
        success: false,
        error: 'skillId is required'
      });
    }
    
    // 检查技能是否存在
    const skill = await skillRegistry.get(skillId);
    if (!skill) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found'
      });
    }
    
    const result = await skillRegistry.bindUserSkill(userId, skillId, config);
    
    // 如果有额外配置，更新
    if (enabled !== undefined || pinned !== undefined) {
      const db = skillRegistry.db;
      const extraUpdates = [];
      const extraValues = [];
      
      if (enabled !== undefined) {
        extraUpdates.push('enabled = ?');
        extraValues.push(enabled ? 1 : 0);
      }
      if (pinned !== undefined) {
        extraUpdates.push('pinned = ?');
        extraValues.push(pinned ? 1 : 0);
      }
      
      if (extraUpdates.length > 0) {
        extraValues.push(userId, skillId);
        await db.run(
          `UPDATE user_skills SET ${extraUpdates.join(', ')} WHERE user_id = ? AND skill_id = ?`,
          extraValues
        );
      }
    }
    
    const userSkill = await skillRegistry.getUserSkill(userId, skillId);
    
    res.status(201).json({
      success: true,
      data: userSkill
    });
  } catch (error) {
    console.error('[Skills API] 绑定用户技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/skills/user/:userId/:skillId
 * 解绑用户技能
 */
router.delete('/user/:userId/:skillId', ensureManager, async (req, res) => {
  try {
    const { userId, skillId } = req.params;
    
    const result = await skillRegistry.unbindUserSkill(userId, skillId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'User skill binding not found'
      });
    }
    
    res.json({
      success: true,
      data: { userId, skillId, unbound: true }
    });
  } catch (error) {
    console.error('[Skills API] 解绑用户技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 执行技能 API ====================

/**
 * POST /api/skills/execute
 * 执行技能
 */
router.post('/execute', ensureManager, async (req, res) => {
  try {
    const { skillId, skillName, params, context } = req.body;
    
    const identifier = skillId || skillName;
    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'skillId or skillName is required'
      });
    }
    
    // 构建执行上下文
    const execContext = {
      userId: context?.userId || req.user?.id,
      sessionId: context?.sessionId,
      timeout: context?.timeout,
      ...context
    };
    
    // 执行技能
    const result = await skillExecutor.execute(identifier, params || {}, execContext);
    
    // 记录使用
    if (execContext.userId) {
      await skillRegistry.recordUsage(execContext.userId, identifier);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Skills API] 执行技能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== MCP 服务器 API ====================

/**
 * GET /api/skills/mcp
 * 获取 MCP 服务器列表
 */
router.get('/mcp', ensureManager, async (req, res) => {
  try {
    const { serverName, withSchema } = req.query;
    
    if (serverName) {
      // 获取单个服务器详情
      const server = mcporterBridge.getServer(serverName);
      if (!server) {
        return res.status(404).json({
          success: false,
          error: 'MCP server not found'
        });
      }
      return res.json({
        success: true,
        data: server
      });
    }
    
    // 获取所有服务器
    const servers = mcporterBridge.getAllServers();
    
    // 如果需要 schema，调用 mcporter 获取详细信息
    if (withSchema === 'true') {
      try {
        const detailedList = await mcporterBridge.listServers(null, true);
        res.json({
          success: true,
          data: detailedList
        });
      } catch (error) {
        // 如果获取详细信息失败，返回本地缓存
        console.warn('[Skills API] Failed to get detailed MCP info:', error.message);
        res.json({
          success: true,
          data: servers,
          warning: 'Could not fetch detailed schema from MCPorter'
        });
      }
    } else {
      res.json({
        success: true,
        data: servers,
        total: servers.length
      });
    }
  } catch (error) {
    console.error('[Skills API] 获取 MCP 服务器列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills/mcp
 * 添加 MCP 服务器
 */
router.post('/mcp', ensureManager, async (req, res) => {
  try {
    const {
      id,
      name,
      display_name,
      description,
      type,
      command,
      args,
      env,
      url,
      headers,
      is_public
    } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }
    
    // 验证类型
    if (type && !['stdio', 'http', 'sse'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be one of: stdio, http, sse'
      });
    }
    
    const serverConfig = {
      id,
      name,
      display_name,
      description,
      type: type || 'stdio',
      command,
      args,
      env,
      url,
      headers,
      is_public
    };
    
    const server = await mcporterBridge.addServer(serverConfig);
    
    res.status(201).json({
      success: true,
      data: server
    });
  } catch (error) {
    console.error('[Skills API] 添加 MCP 服务器失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/skills/mcp/:serverId
 * 删除 MCP 服务器
 */
router.delete('/mcp/:serverId', ensureManager, async (req, res) => {
  try {
    const result = await mcporterBridge.removeServer(req.params.serverId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'MCP server not found'
      });
    }
    
    res.json({
      success: true,
      data: { id: req.params.serverId, deleted: true }
    });
  } catch (error) {
    console.error('[Skills API] 删除 MCP 服务器失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills/mcp/call
 * 调用 MCP 工具
 */
router.post('/mcp/call', ensureManager, async (req, res) => {
  try {
    const { selector, args, context } = req.body;
    
    if (!selector) {
      return res.status(400).json({
        success: false,
        error: 'selector is required (format: server.tool)'
      });
    }
    
    // 检查工具是否可用
    if (!mcporterBridge.isToolAvailable(selector)) {
      return res.status(404).json({
        success: false,
        error: `MCP tool not available: ${selector}`
      });
    }
    
    const result = await mcporterBridge.call(selector, args || {}, context || {});
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Skills API] 调用 MCP 工具失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills/mcp/auth
 * MCP 服务器 OAuth 认证
 */
router.post('/mcp/auth', ensureManager, async (req, res) => {
  try {
    const { serverName } = req.body;
    
    if (!serverName) {
      return res.status(400).json({
        success: false,
        error: 'serverName is required'
      });
    }
    
    const result = await mcporterBridge.auth(serverName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Skills API] MCP 认证失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 系统状态 ====================

/**
 * GET /api/skills/status
 * 获取技能系统状态
 */
router.get('/status', ensureManager, (req, res) => {
  try {
    const executorStats = skillExecutor.getStats();
    
    res.json({
      success: true,
      data: {
        executor: executorStats,
        servers: {
          mcp: mcporterBridge.getAllServers().length,
          skills: skillRegistry.cache?.size || 0
        }
      }
    });
  } catch (error) {
    console.error('[Skills API] 获取状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/skills/cache/clear
 * 清除执行缓存
 */
router.post('/cache/clear', ensureManager, (req, res) => {
  try {
    const { skillId } = req.body;
    
    skillExecutor.clearCache(skillId);
    
    res.json({
      success: true,
      data: { cleared: true, skillId: skillId || 'all' }
    });
  } catch (error) {
    console.error('[Skills API] 清除缓存失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router, setSkillsManager };
