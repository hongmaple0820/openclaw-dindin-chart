/**
 * 插件系统路由
 * 
 * API 端点：
 * - GET    /api/plugins              获取插件列表
 * - GET    /api/plugins/:id          获取插件详情
 * - POST   /api/plugins/register    注册插件
 * - PUT    /api/plugins/:id          更新插件
 * - DELETE /api/plugins/:id          删除插件
 * - POST   /api/plugins/:id/test     测试插件
 * - GET    /api/plugins/:id/config   获取配置
 * - PUT    /api/plugins/:id/config   更新配置
 * - GET    /api/agents/:id/plugins   获取 Agent 的插件
 * - POST   /api/agents/:id/plugins/:pluginId  绑定插件
 * - DELETE /api/agents/:id/plugins/:pluginId   解绑插件
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let pluginManager = null;

/**
 * 设置 PluginManager 实例
 */
function setPluginManager(manager) {
  pluginManager = manager;
}

/**
 * 确保插件管理器已初始化
 */
function ensureManager(req, res, next) {
  if (!pluginManager) {
    return res.status(500).json({
      success: false,
      error: 'Plugin manager not initialized'
    });
  }
  next();
}

// ==================== 插件管理 API ====================

/**
 * GET /api/plugins
 * 获取插件列表
 */
router.get('/', ensureManager, (req, res) => {
  try {
    const { type, enabled, limit, offset } = req.query;
    
    const plugins = pluginManager.listPlugins({
      type,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    
    res.json({
      success: true,
      data: plugins,
      total: plugins.length
    });
  } catch (error) {
    console.error('[Plugins API] 获取插件列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/:id
 * 获取插件详情
 */
router.get('/:id', ensureManager, (req, res) => {
  try {
    const plugin = pluginManager.getPluginInfo(req.params.id);
    
    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }
    
    res.json({
      success: true,
      data: plugin
    });
  } catch (error) {
    console.error('[Plugins API] 获取插件详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/register
 * 注册插件
 */
router.post('/register', ensureManager, async (req, res) => {
  try {
    const { skillPath, ...options } = req.body;
    
    if (!skillPath) {
      return res.status(400).json({
        success: false,
        error: 'skillPath is required'
      });
    }
    
    const result = await pluginManager.register(skillPath, options);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      data: {
        pluginId: result.pluginId,
        action: result.action
      }
    });
  } catch (error) {
    console.error('[Plugins API] 注册插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/plugins/:id
 * 更新插件信息
 */
router.put('/:id', ensureManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, category, version, description, priority, enabled } = req.body;
    
    const existing = pluginManager.getPluginInfo(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }
    
    // 更新数据库
    const db = pluginManager.db;
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (version !== undefined) { updates.push('version = ?'); values.push(version); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);
      
      db.prepare(`UPDATE plugins SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    res.json({
      success: true,
      data: pluginManager.getPluginInfo(id)
    });
  } catch (error) {
    console.error('[Plugins API] 更新插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/plugins/:id
 * 删除插件
 */
router.delete('/:id', ensureManager, async (req, res) => {
  try {
    const result = await pluginManager.deletePlugin(req.params.id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Plugins API] 删除插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/test
 * 测试插件连接
 */
router.post('/:id/test', ensureManager, async (req, res) => {
  try {
    const result = await pluginManager.testPlugin(req.params.id);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[Plugins API] 测试插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/execute
 * 执行插件功能
 */
router.post('/:id/execute', ensureManager, async (req, res) => {
  try {
    const { action, params } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'action is required'
      });
    }
    
    const result = await pluginManager.execute(req.params.id, action, params);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('[Plugins API] 执行插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 插件配置 API ====================

/**
 * GET /api/plugins/:id/config
 * 获取插件配置
 */
router.get('/:id/config', ensureManager, (req, res) => {
  try {
    const { ownerId, ownerType } = req.query;
    
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        error: 'ownerId is required'
      });
    }
    
    const config = pluginManager.getPluginConfig(
      req.params.id,
      ownerId,
      ownerType || 'agent'
    );
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[Plugins API] 获取配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/plugins/:id/config
 * 更新插件配置
 */
router.put('/:id/config', ensureManager, async (req, res) => {
  try {
    const { ownerId, ownerType, config } = req.body;
    
    if (!ownerId || !config) {
      return res.status(400).json({
        success: false,
        error: 'ownerId and config are required'
      });
    }
    
    const result = await pluginManager.configurePlugin(
      req.params.id,
      ownerId,
      config,
      ownerType || 'agent'
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      data: { configId: result.configId }
    });
  } catch (error) {
    console.error('[Plugins API] 更新配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/toggle
 * 启用/禁用插件
 */
router.post('/:id/toggle', ensureManager, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled is required'
      });
    }
    
    const result = await pluginManager.togglePlugin(req.params.id, enabled);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json({
      success: true,
      data: { enabled: result.enabled }
    });
  } catch (error) {
    console.error('[Plugins API] 切换插件状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Agent 绑定 API ====================

/**
 * GET /api/agents/:id/plugins
 * 获取 Agent 绑定的插件
 */
router.get('/agents/:id/plugins', ensureManager, (req, res) => {
  try {
    const plugins = pluginManager.getAgentPlugins(req.params.id);
    
    res.json({
      success: true,
      data: plugins
    });
  } catch (error) {
    console.error('[Plugins API] 获取 Agent 插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agents/:id/plugins/:pluginId
 * 绑定插件到 Agent
 */
router.post('/agents/:id/plugins/:pluginId', ensureManager, async (req, res) => {
  try {
    const { permissions } = req.body;
    
    const result = await pluginManager.bindToAgent(
      req.params.id,
      req.params.pluginId,
      permissions || []
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      data: { bindingId: result.bindingId }
    });
  } catch (error) {
    console.error('[Plugins API] 绑定插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/agents/:id/plugins/:pluginId
 * 解绑插件
 */
router.delete('/agents/:id/plugins/:pluginId', ensureManager, (req, res) => {
  try {
    const result = pluginManager.unbindFromAgent(
      req.params.id,
      req.params.pluginId
    );
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Plugins API] 解绑插件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 系统状态 ====================

/**
 * GET /api/plugins/status
 * 获取插件系统状态
 */
router.get('/status', ensureManager, (req, res) => {
  try {
    const status = pluginManager.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Plugins API] 获取状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router, setPluginManager };
