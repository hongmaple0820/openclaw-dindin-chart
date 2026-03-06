/**
 * 插件层级绑定路由
 * 
 * API 端点：
 * - 用户插件
 *   GET    /api/plugins/user/:userId
 *   POST   /api/plugins/user/:userId
 *   DELETE /api/plugins/user/:userId/:pluginId
 * 
 * - 群聊插件
 *   GET    /api/plugins/group/:groupId
 *   POST   /api/plugins/group/:groupId
 *   DELETE /api/plugins/group/:groupId/:pluginId
 * 
 * - 群聊 Webhook（独立路由器）
 *   GET    /api/webhooks/group/:groupId
 *   POST   /api/webhooks/group/:groupId
 *   DELETE /api/webhooks/group/:groupId/:channel
 * 
 * - 其他
 *   POST   /api/plugins/channel/select
 *   GET    /api/plugins/bindings/stats
 *   GET    /api/plugins/bindings/check-owner
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const express = require('express');

let pluginBindingService = null;

/**
 * 设置 PluginBindingService 实例
 */
function setPluginBindingService(service) {
  pluginBindingService = service;
}

/**
 * 确保服务已初始化
 */
function ensureService(req, res, next) {
  if (!pluginBindingService) {
    return res.status(500).json({
      success: false,
      error: 'Plugin binding service not initialized'
    });
  }
  pluginBindingService.init();
  next();
}

// ==================== 插件路由器 ====================

const pluginRouter = express.Router();

/**
 * GET /api/plugins/user/:userId
 * 获取用户插件列表
 */
pluginRouter.get('/user/:userId', ensureService, async (req, res) => {
  try {
    const { userId } = req.params;
    const { groupId } = req.query;
    
    if (groupId) {
      const result = await pluginBindingService.getAvailablePlugins(userId, groupId);
      res.json({ success: true, data: result });
    } else {
      const plugins = await pluginBindingService.getUserPlugins(userId);
      res.json({ success: true, data: plugins });
    }
  } catch (error) {
    console.error('[PluginBindings API] 获取用户插件失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/plugins/user/:userId
 * 绑定用户插件
 */
pluginRouter.post('/user/:userId', ensureService, async (req, res) => {
  try {
    const { userId } = req.params;
    const { pluginId, config } = req.body;
    
    if (!pluginId) {
      return res.status(400).json({ success: false, error: 'pluginId is required' });
    }
    
    const binding = await pluginBindingService.bindUserPlugin(userId, pluginId, config || {});
    res.status(201).json({ success: true, data: binding });
  } catch (error) {
    console.error('[PluginBindings API] 绑定用户插件失败:', error);
    if ((error as Error).message === '插件不存在') {
      return res.status(404).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/plugins/user/:userId/:pluginId
 * 解绑用户插件
 */
pluginRouter.delete('/user/:userId/:pluginId', ensureService, async (req, res) => {
  try {
    const { userId, pluginId } = req.params;
    const success = await pluginBindingService.unbindUserPlugin(userId, pluginId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Binding not found' });
    }
    res.json({ success: true, message: 'Plugin unbound successfully' });
  } catch (error) {
    console.error('[PluginBindings API] 解绑用户插件失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/plugins/group/:groupId
 * 获取群聊插件列表
 */
pluginRouter.get('/group/:groupId', ensureService, async (req, res) => {
  try {
    const { groupId } = req.params;
    const plugins = await pluginBindingService.getGroupPlugins(groupId);
    res.json({ success: true, data: plugins });
  } catch (error) {
    console.error('[PluginBindings API] 获取群聊插件失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/plugins/group/:groupId
 * 绑定群聊插件（仅群主）
 */
pluginRouter.post('/group/:groupId', ensureService, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { pluginId, config, operatorId } = req.body;
    
    if (!pluginId) {
      return res.status(400).json({ success: false, error: 'pluginId is required' });
    }
    if (!operatorId) {
      return res.status(400).json({ success: false, error: 'operatorId is required' });
    }
    
    const binding = await pluginBindingService.bindGroupPlugin(groupId, pluginId, config || {}, operatorId);
    res.status(201).json({ success: true, data: binding });
  } catch (error) {
    console.error('[PluginBindings API] 绑定群聊插件失败:', error);
    if ((error as Error).message.includes('只有群主')) {
      return res.status(403).json({ success: false, error: (error as Error).message });
    }
    if ((error as Error).message === '插件不存在') {
      return res.status(404).json({ success: false, error: (error as Error).message });
    }
    if ((error as Error).message.includes('已配置 Webhook')) {
      return res.status(409).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/plugins/group/:groupId/:pluginId
 * 解绑群聊插件（仅群主）
 */
pluginRouter.delete('/group/:groupId/:pluginId', ensureService, async (req, res) => {
  try {
    const { groupId, pluginId } = req.params;
    const { operatorId } = req.query;
    
    if (!operatorId) {
      return res.status(400).json({ success: false, error: 'operatorId is required' });
    }
    
    const success = await pluginBindingService.unbindGroupPlugin(groupId, pluginId, operatorId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Binding not found' });
    }
    res.json({ success: true, message: 'Plugin unbound successfully' });
  } catch (error) {
    console.error('[PluginBindings API] 解绑群聊插件失败:', error);
    if ((error as Error).message.includes('只有群主')) {
      return res.status(403).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/plugins/channel/select
 * 选择发送通道
 */
pluginRouter.post('/channel/select', ensureService, async (req, res) => {
  try {
    const { userId, groupId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const channel = await pluginBindingService.selectChannel(groupId, userId);
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('[PluginBindings API] 选择通道失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/plugins/bindings/stats
 * 获取统计信息
 */
pluginRouter.get('/bindings/stats', ensureService, (req, res) => {
  try {
    const stats = pluginBindingService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[PluginBindings API] 获取统计信息失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/plugins/bindings/check-owner
 * 检查是否是群主
 */
pluginRouter.get('/bindings/check-owner', ensureService, async (req, res) => {
  try {
    const { groupId, userId } = req.query;
    
    if (!groupId || !userId) {
      return res.status(400).json({ success: false, error: 'groupId and userId are required' });
    }
    
    const isOwner = await pluginBindingService.isGroupOwner(groupId, userId);
    res.json({ success: true, data: { isOwner } });
  } catch (error) {
    console.error('[PluginBindings API] 检查群主失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== Webhook 路由器 ====================

const webhookRouter = express.Router();

/**
 * GET /api/webhooks/group/:groupId
 * 获取群聊 Webhook
 */
webhookRouter.get('/group/:groupId', ensureService, (req, res) => {
  try {
    const { groupId } = req.params;
    const { channel } = req.query;
    
    if (channel) {
      const webhook = pluginBindingService.getGroupWebhook(groupId, channel);
      res.json({ success: true, data: webhook });
    } else {
      const webhooks = pluginBindingService.getGroupWebhooks(groupId);
      res.json({ success: true, data: webhooks });
    }
  } catch (error) {
    console.error('[PluginBindings API] 获取 Webhook 失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/group/:groupId
 * 设置群聊 Webhook（仅群主）
 */
webhookRouter.post('/group/:groupId', ensureService, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { channel, webhookUrl, secret, operatorId } = req.body;
    
    if (!channel) {
      return res.status(400).json({ success: false, error: 'channel is required' });
    }
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'webhookUrl is required' });
    }
    if (!operatorId) {
      return res.status(400).json({ success: false, error: 'operatorId is required' });
    }
    
    const webhook = await pluginBindingService.setGroupWebhook(groupId, channel, webhookUrl, secret, operatorId);
    res.status(201).json({ success: true, data: webhook });
  } catch (error) {
    console.error('[PluginBindings API] 设置 Webhook 失败:', error);
    if ((error as Error).message.includes('只有群主')) {
      return res.status(403).json({ success: false, error: (error as Error).message });
    }
    if ((error as Error).message.includes('已绑定插件')) {
      return res.status(409).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/webhooks/group/:groupId/:channel
 * 删除群聊 Webhook（仅群主）
 */
webhookRouter.delete('/group/:groupId/:channel', ensureService, async (req, res) => {
  try {
    const { groupId, channel } = req.params;
    const { operatorId } = req.query;
    
    if (!operatorId) {
      return res.status(400).json({ success: false, error: 'operatorId is required' });
    }
    
    const success = await pluginBindingService.removeGroupWebhook(groupId, channel, operatorId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    res.json({ success: true, message: 'Webhook removed successfully' });
  } catch (error) {
    console.error('[PluginBindings API] 删除 Webhook 失败:', error);
    if ((error as Error).message.includes('只有群主')) {
      return res.status(403).json({ success: false, error: (error as Error).message });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = {
  pluginRouter,
  webhookRouter,
  setPluginBindingService
};

// Make this a module
export {};
