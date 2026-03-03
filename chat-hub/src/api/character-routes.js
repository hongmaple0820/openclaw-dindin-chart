/**
 * 角色系统 API 路由
 * 包含角色管理、关系管理、记忆管理、主动触发等 API
 */

const express = require('express');
const router = express.Router();
const CharacterManager = require('../character/character-manager');
const RelationshipManager = require('../character/relationship-manager');
const MemoryManager = require('../character/memory-manager');

// 实例化管理器
const relationshipManager = new RelationshipManager();
const memoryManager = new MemoryManager();

// ==================== 参数验证工具 ====================

/**
 * 验证必需参数
 */
function validateRequired(req, fields) {
  const missing = fields.filter(f => !req.body[f] && !req.params[f] && !req.query[f]);
  return missing.length > 0 ? `缺少必需参数: ${missing.join(', ')}` : null;
}

/**
 * 统一错误处理
 */
function handleError(res, error, context = '') {
  console.error(`[Character API] ${context}:`, error);
  
  if (error.message?.includes('not found')) {
    return res.status(404).json({ success: false, error: error.message });
  }
  
  if (error.message?.includes('required') || error.message?.includes('invalid')) {
    return res.status(400).json({ success: false, error: error.message });
  }
  
  res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
}

// ==================== 角色管理 API ====================

/**
 * 获取角色列表
 * GET /api/characters
 */
router.get('/characters', (req, res) => {
  try {
    const characters = CharacterManager.listCharacters();
    res.json({
      success: true,
      count: characters.length,
      characters
    });
  } catch (error) {
    handleError(res, error, '获取角色列表');
  }
});

/**
 * 获取当前激活角色
 * GET /api/characters/current
 */
router.get('/characters/current', (req, res) => {
  try {
    const character = CharacterManager.getCurrentCharacter();
    if (!character) {
      return res.status(404).json({ success: false, error: '未设置当前角色' });
    }
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error, '获取当前角色');
  }
});

/**
 * 获取角色详情
 * GET /api/characters/:id
 */
router.get('/characters/:id', (req, res) => {
  try {
    const { id } = req.params;
    const character = CharacterManager.loadCharacter(id);
    
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error, '获取角色详情');
  }
});

/**
 * 创建角色
 * POST /api/characters
 * Body: { id, name, englishName?, characterType?, personality?, speakingStyle?, background?, avatarPath?, referenceImages?, voiceConfig? }
 */
router.post('/characters', (req, res) => {
  try {
    const { id, name } = req.body;
    
    // 参数验证
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'id 和 name 是必需参数' });
    }
    
    // 检查角色是否已存在
    const existing = CharacterManager.loadCharacter(id);
    if (existing) {
      return res.status(409).json({ success: false, error: '角色 ID 已存在' });
    }
    
    const character = CharacterManager.createCharacter(req.body);
    console.log(`[Character API] 创建角色: ${character.name} (${character.id})`);
    
    res.status(201).json({ success: true, character });
  } catch (error) {
    handleError(res, error, '创建角色');
  }
});

/**
 * 更新角色
 * PUT /api/characters/:id
 * Body: { name?, personality?, speakingStyle?, voiceConfig?, ... }
 */
router.put('/characters/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const existing = CharacterManager.loadCharacter(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const character = CharacterManager.updateCharacter(id, req.body);
    console.log(`[Character API] 更新角色: ${character.name} (${id})`);
    
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error, '更新角色');
  }
});

/**
 * 删除角色
 * DELETE /api/characters/:id
 */
router.delete('/characters/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const existing = CharacterManager.loadCharacter(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    CharacterManager.deleteCharacter(id);
    console.log(`[Character API] 删除角色: ${id}`);
    
    res.json({ success: true, message: '角色已删除' });
  } catch (error) {
    handleError(res, error, '删除角色');
  }
});

/**
 * 切换当前角色
 * POST /api/characters/:id/switch
 */
router.post('/characters/:id/switch', (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(id);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    // 更新配置中的当前角色
    const config = require('../config');
    if (!config.character) {
      config.character = {};
    }
    config.character.currentCharacterId = id;
    
    console.log(`[Character API] 切换角色: ${character.name} (${id})`);
    
    res.json({ 
      success: true, 
      message: `已切换到角色: ${character.name}`,
      character 
    });
  } catch (error) {
    handleError(res, error, '切换角色');
  }
});

// ==================== 关系管理 API ====================

/**
 * 获取角色关系状态
 * GET /api/relationships/:characterId
 * Query: userId (可选，指定用户)
 */
router.get('/relationships/:characterId', (req, res) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.query;
    
    if (userId) {
      // 获取特定用户与角色的关系
      const relationship = relationshipManager.getRelationship(characterId, userId);
      if (!relationship) {
        return res.status(404).json({ success: false, error: '关系不存在' });
      }
      res.json({ success: true, relationship });
    } else {
      // 获取角色的所有关系
      const relationships = relationshipManager.getCharacterRelationships(characterId);
      res.json({ 
        success: true, 
        count: relationships.length,
        relationships 
      });
    }
  } catch (error) {
    handleError(res, error, '获取关系');
  }
});

/**
 * 建立关系
 * POST /api/relationships
 * Body: { characterId, userId, type?, intimacyLevel? }
 */
router.post('/relationships', (req, res) => {
  try {
    const { characterId, userId, type = 'friend', intimacyLevel = 50 } = req.body;
    
    if (!characterId || !userId) {
      return res.status(400).json({ success: false, error: 'characterId 和 userId 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const relationship = relationshipManager.createOrUpdateRelationship(characterId, userId, {
      type,
      intimacyLevel
    });
    
    console.log(`[Character API] 建立关系: ${characterId} <-> ${userId} (${type})`);
    
    res.status(201).json({ success: true, relationship });
  } catch (error) {
    handleError(res, error, '建立关系');
  }
});

/**
 * 更新亲密度
 * PUT /api/relationships/:characterId/intimacy
 * Body: { userId, delta }
 */
router.put('/relationships/:characterId/intimacy', (req, res) => {
  try {
    const { characterId } = req.params;
    const { userId, delta } = req.body;
    
    if (!userId || typeof delta !== 'number') {
      return res.status(400).json({ success: false, error: 'userId 和 delta (数字) 是必需参数' });
    }
    
    // 检查关系是否存在
    const existing = relationshipManager.getRelationship(characterId, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: '关系不存在' });
    }
    
    const relationship = relationshipManager.updateIntimacy(characterId, userId, delta);
    
    console.log(`[Character API] 更新亲密度: ${characterId} <-> ${userId}, delta=${delta}, new=${relationship.intimacy_level}`);
    
    res.json({ success: true, relationship });
  } catch (error) {
    handleError(res, error, '更新亲密度');
  }
});

/**
 * 获取互动历史
 * GET /api/relationships/:characterId/history
 * Query: userId (可选), limit (默认 20)
 */
router.get('/relationships/:characterId/history', (req, res) => {
  try {
    const { characterId } = req.params;
    const { userId, limit = 20 } = req.query;
    
    // 这里暂时返回关系的统计信息
    // 后续可以扩展为详细的互动历史记录
    const relationships = userId
      ? [relationshipManager.getRelationship(characterId, userId)]
      : relationshipManager.getCharacterRelationships(characterId);
    
    const stats = relationshipManager.getStats(characterId);
    
    res.json({
      success: true,
      stats,
      relationships: relationships.filter(Boolean)
    });
  } catch (error) {
    handleError(res, error, '获取互动历史');
  }
});

/**
 * 删除关系
 * DELETE /api/relationships/:characterId/:userId
 */
router.delete('/relationships/:characterId/:userId', (req, res) => {
  try {
    const { characterId, userId } = req.params;
    
    // 检查关系是否存在
    const existing = relationshipManager.getRelationship(characterId, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: '关系不存在' });
    }
    
    relationshipManager.deleteRelationship(characterId, userId);
    
    console.log(`[Character API] 删除关系: ${characterId} <-> ${userId}`);
    
    res.json({ success: true, message: '关系已删除' });
  } catch (error) {
    handleError(res, error, '删除关系');
  }
});

// ==================== 记忆管理 API ====================

/**
 * 获取角色记忆
 * GET /api/memories/:characterId
 * Query: userId?, type?, limit?, minImportance?
 */
router.get('/memories/:characterId', (req, res) => {
  try {
    const { characterId } = req.params;
    const { userId, type, limit, minImportance } = req.query;
    
    const options = {};
    if (userId) options.userId = userId;
    if (type) options.type = type;
    if (limit) options.limit = parseInt(limit);
    if (minImportance) options.minImportance = parseInt(minImportance);
    
    const memories = memoryManager.getMemories(characterId, options);
    
    res.json({
      success: true,
      count: memories.length,
      memories
    });
  } catch (error) {
    handleError(res, error, '获取记忆');
  }
});

/**
 * 添加记忆
 * POST /api/memories
 * Body: { characterId, userId?, type, content, importance?, tags? }
 */
router.post('/memories', (req, res) => {
  try {
    const { characterId, type, content } = req.body;
    
    if (!characterId || !type || !content) {
      return res.status(400).json({ success: false, error: 'characterId, type, content 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const memory = memoryManager.addMemory(characterId, req.body);
    
    console.log(`[Character API] 添加记忆: ${characterId}, type=${type}`);
    
    res.status(201).json({ success: true, memory });
  } catch (error) {
    handleError(res, error, '添加记忆');
  }
});

/**
 * 搜索记忆
 * GET /api/memories/:characterId/search
 * Query: q (搜索关键词), limit?
 */
router.get('/memories/:characterId/search', (req, res) => {
  try {
    const { characterId } = req.params;
    const { q, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: 'q (搜索关键词) 是必需参数' });
    }
    
    const options = {};
    if (limit) options.limit = parseInt(limit);
    
    const memories = memoryManager.searchMemories(characterId, q, options);
    
    res.json({
      success: true,
      count: memories.length,
      query: q,
      memories
    });
  } catch (error) {
    handleError(res, error, '搜索记忆');
  }
});

/**
 * 更新记忆重要性
 * PUT /api/memories/:memoryId/importance
 * Body: { importance }
 */
router.put('/memories/:memoryId/importance', (req, res) => {
  try {
    const { memoryId } = req.params;
    const { importance } = req.body;
    
    if (typeof importance !== 'number' || importance < 1 || importance > 10) {
      return res.status(400).json({ success: false, error: 'importance 必须是 1-10 的数字' });
    }
    
    memoryManager.updateImportance(memoryId, importance);
    
    res.json({ success: true, message: '记忆重要性已更新' });
  } catch (error) {
    handleError(res, error, '更新记忆重要性');
  }
});

/**
 * 删除记忆
 * DELETE /api/memories/:memoryId
 */
router.delete('/memories/:memoryId', (req, res) => {
  try {
    const { memoryId } = req.params;
    
    memoryManager.deleteMemory(memoryId);
    
    console.log(`[Character API] 删除记忆: ${memoryId}`);
    
    res.json({ success: true, message: '记忆已删除' });
  } catch (error) {
    handleError(res, error, '删除记忆');
  }
});

/**
 * 清除角色所有记忆
 * DELETE /api/memories/:characterId/all
 */
router.delete('/memories/:characterId/all', (req, res) => {
  try {
    const { characterId } = req.params;
    
    // 安全检查：需要确认参数
    const { confirm } = req.query;
    if (confirm !== 'true') {
      return res.status(400).json({ 
        success: false, 
        error: '需要确认参数: ?confirm=true' 
      });
    }
    
    memoryManager.clearMemories(characterId);
    
    console.log(`[Character API] 清除角色所有记忆: ${characterId}`);
    
    res.json({ success: true, message: '角色记忆已清空' });
  } catch (error) {
    handleError(res, error, '清除记忆');
  }
});

/**
 * 获取记忆统计
 * GET /api/memories/:characterId/stats
 */
router.get('/memories/:characterId/stats', (req, res) => {
  try {
    const { characterId } = req.params;
    const stats = memoryManager.getStats(characterId);
    
    res.json({ success: true, stats });
  } catch (error) {
    handleError(res, error, '获取记忆统计');
  }
});

// ==================== 主动触发 API ====================

/**
 * 触发器状态存储（简单内存存储）
 * 后续可以迁移到数据库或专门的 TriggerManager
 */
const triggerState = {
  enabled: true,
  lastTrigger: null,
  triggers: []
};

/**
 * 手动触发
 * POST /api/triggers/execute
 * Body: { characterId, triggerType?, data? }
 */
router.post('/triggers/execute', (req, res) => {
  try {
    const { characterId, triggerType = 'manual', data } = req.body;
    
    if (!characterId) {
      return res.status(400).json({ success: false, error: 'characterId 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    // TODO: 集成实际的触发器逻辑
    // 目前返回占位符响应
    const result = {
      triggered: true,
      characterId,
      triggerType,
      timestamp: Date.now(),
      message: `触发器已执行: ${character.name} (${triggerType})`,
      data
    };
    
    // 更新状态
    triggerState.lastTrigger = result;
    triggerState.triggers.push(result);
    if (triggerState.triggers.length > 100) {
      triggerState.triggers.shift();
    }
    
    console.log(`[Character API] 手动触发: ${characterId}, type=${triggerType}`);
    
    res.json({ success: true, result });
  } catch (error) {
    handleError(res, error, '执行触发器');
  }
});

/**
 * 获取触发器状态
 * GET /api/triggers/status
 */
router.get('/triggers/status', (req, res) => {
  try {
    res.json({
      success: true,
      status: {
        enabled: triggerState.enabled,
        lastTrigger: triggerState.lastTrigger,
        recentTriggers: triggerState.triggers.slice(-10)
      }
    });
  } catch (error) {
    handleError(res, error, '获取触发器状态');
  }
});

/**
 * 启用/禁用触发器
 * PUT /api/triggers/toggle
 * Body: { enabled: boolean }
 */
router.put('/triggers/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled 必须是 boolean 类型' });
    }
    
    triggerState.enabled = enabled;
    
    console.log(`[Character API] 触发器状态: ${enabled ? '启用' : '禁用'}`);
    
    res.json({ 
      success: true, 
      message: `触发器已${enabled ? '启用' : '禁用'}`,
      enabled 
    });
  } catch (error) {
    handleError(res, error, '切换触发器状态');
  }
});

module.exports = router;
