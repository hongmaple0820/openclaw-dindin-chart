/**
 * 角色系统 API 路由
 * 包含角色管理、关系管理、记忆管理、主动触发、情绪检测等 API
 */

import express, { Request, Response, Router } from 'express';

// CommonJS module imports
const CharacterManager = require('../character/character-manager').default;
const RelationshipManager = require('../character/relationship-manager').RelationshipManager;
const MemoryManager = require('../character/memory-manager').default;
const EmotionDetector = require('../character/emotion-detector').default;

const router: Router = express.Router();

// 实例化管理器
// CharacterManager is already a singleton instance
const relationshipManager = new RelationshipManager();
const memoryManager = new MemoryManager();
const emotionDetector = new EmotionDetector({ threshold: 1, verbose: false });

// ==================== 类型定义 ====================

interface Character {
  id: string;
  name: string;
  englishName?: string;
  characterType?: string;
  personality?: string;
  speakingStyle?: string;
  background?: string;
  avatarPath?: string;
  referenceImages?: string[];
  voiceConfig?: Record<string, unknown>;
}

interface Relationship {
  characterId: string;
  userId: string;
  type: string;
  intimacyLevel: number;
  createdAt?: number;
  updatedAt?: number;
}

interface Memory {
  id: string;
  characterId: string;
  userId?: string;
  type: string;
  content: string;
  importance: number;
  tags?: string[];
  createdAt?: number;
}

interface EmotionResult {
  emotion: number;
  emotionName: string;
  score: number;
}

interface TriggerResult {
  triggered: boolean;
  characterId: string;
  triggerType: string;
  timestamp: number;
  message: string;
  data?: unknown;
}

interface TriggerState {
  enabled: boolean;
  lastTrigger: TriggerResult | null;
  triggers: TriggerResult[];
}

// ==================== 参数验证工具 ====================

/**
 * 验证必需参数
 */
function validateRequired(req: Request, fields: string[]): string | null {
  const missing = fields.filter(f => !req.body[f] && !req.params[f] && !req.query[f]);
  return missing.length > 0 ? `缺少必需参数: ${missing.join(', ')}` : null;
}

/**
 * 统一错误处理
 */
function handleError(res: Response, error: Error, context: string = ''): void {
  console.error(`[Character API] ${context}:`, error);
  
  if (error.message?.includes('not found')) {
    res.status(404).json({ success: false, error: error.message });
    return;
  }
  
  if (error.message?.includes('required') || error.message?.includes('invalid')) {
    res.status(400).json({ success: false, error: error.message });
    return;
  }
  
  res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
}

// ==================== 角色管理 API ====================

/**
 * 获取角色列表
 * GET /api/characters
 */
router.get('/characters', (_req: Request, res: Response): void => {
  try {
    const characters = CharacterManager.listCharacters();
    res.json({
      success: true,
      count: characters.length,
      characters
    });
  } catch (error) {
    handleError(res, error as Error, '获取角色列表');
  }
});

/**
 * 获取当前激活角色
 * GET /api/characters/current
 */
router.get('/characters/current', (_req: Request, res: Response) => {
  try {
    const character = CharacterManager.getCurrentCharacter();
    if (!character) {
      res.status(404).json({ success: false, error: '未设置当前角色' });
    }
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error as Error, '获取当前角色');
  }
});

/**
 * 获取角色详情
 * GET /api/characters/:id
 */
router.get('/characters/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const character = CharacterManager.loadCharacter(id);
    
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error as Error, '获取角色详情');
  }
});

/**
 * 创建角色
 * POST /api/characters
 * Body: { id, name, englishName?, characterType?, personality?, speakingStyle?, background?, avatarPath?, referenceImages?, voiceConfig? }
 */
router.post('/characters', (req: Request, res: Response) => {
  try {
    const { id, name } = req.body;
    
    // 参数验证
    if (!id || !name) {
      res.status(400).json({ success: false, error: 'id 和 name 是必需参数' });
    }
    
    // 检查角色是否已存在
    const existing = CharacterManager.loadCharacter(id);
    if (existing) {
      res.status(409).json({ success: false, error: '角色 ID 已存在' });
    }
    
    const character = CharacterManager.createCharacter(req.body);
    console.log(`[Character API] 创建角色: ${character.name} (${character.id})`);
    
    res.status(201).json({ success: true, character });
  } catch (error) {
    handleError(res, error as Error, '创建角色');
  }
});

/**
 * 更新角色
 * PUT /api/characters/:id
 * Body: { name?, personality?, speakingStyle?, voiceConfig?, ... }
 */
router.put('/characters/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const existing = CharacterManager.loadCharacter(id);
    if (!existing) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const character = CharacterManager.updateCharacter(id, req.body);
    console.log(`[Character API] 更新角色: ${character.name} (${id})`);
    
    res.json({ success: true, character });
  } catch (error) {
    handleError(res, error as Error, '更新角色');
  }
});

/**
 * 删除角色
 * DELETE /api/characters/:id
 */
router.delete('/characters/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const existing = CharacterManager.loadCharacter(id);
    if (!existing) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    CharacterManager.deleteCharacter(id);
    console.log(`[Character API] 删除角色: ${id}`);
    
    res.json({ success: true, message: '角色已删除' });
  } catch (error) {
    handleError(res, error as Error, '删除角色');
  }
});

/**
 * 切换当前角色
 * POST /api/characters/:id/switch
 */
router.post('/characters/:id/switch', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(id);
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
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
    handleError(res, error as Error, '切换角色');
  }
});

// ==================== 关系管理 API ====================

/**
 * 获取角色关系状态
 * GET /api/relationships/:characterId
 * Query: userId (可选，指定用户)
 */
router.get('/relationships/:characterId', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.query;
    
    if (userId) {
      // 获取特定用户与角色的关系
      const relationship = relationshipManager.getRelationship(characterId, userId as string);
      if (!relationship) {
        res.status(404).json({ success: false, error: '关系不存在' });
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
    handleError(res, error as Error, '获取关系');
  }
});

/**
 * 建立关系
 * POST /api/relationships
 * Body: { characterId, userId, type?, intimacyLevel? }
 */
router.post('/relationships', (req: Request, res: Response) => {
  try {
    const { characterId, userId, type = 'friend', intimacyLevel = 50 } = req.body;
    
    if (!characterId || !userId) {
      res.status(400).json({ success: false, error: 'characterId 和 userId 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const relationship = relationshipManager.createOrUpdateRelationship(characterId, userId, {
      type,
      intimacyLevel
    });
    
    console.log(`[Character API] 建立关系: ${characterId} <-> ${userId} (${type})`);
    
    res.status(201).json({ success: true, relationship });
  } catch (error) {
    handleError(res, error as Error, '建立关系');
  }
});

/**
 * 更新亲密度
 * PUT /api/relationships/:characterId/intimacy
 * Body: { userId, delta }
 */
router.put('/relationships/:characterId/intimacy', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { userId, delta } = req.body;
    
    if (!userId || typeof delta !== 'number') {
      res.status(400).json({ success: false, error: 'userId 和 delta (数字) 是必需参数' });
    }
    
    // 检查关系是否存在
    const existing = relationshipManager.getRelationship(characterId, userId);
    if (!existing) {
      res.status(404).json({ success: false, error: '关系不存在' });
    }
    
    const relationship = relationshipManager.updateIntimacy(characterId, userId, delta);
    
    console.log(`[Character API] 更新亲密度: ${characterId} <-> ${userId}, delta=${delta}, new=${relationship.intimacy_level}`);
    
    res.json({ success: true, relationship });
  } catch (error) {
    handleError(res, error as Error, '更新亲密度');
  }
});

/**
 * 获取互动历史
 * GET /api/relationships/:characterId/history
 * Query: userId (可选), limit (默认 20)
 */
router.get('/relationships/:characterId/history', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { userId, limit = 20 } = req.query;
    
    // 这里暂时返回关系的统计信息
    // 后续可以扩展为详细的互动历史记录
    const relationships = userId
      ? [relationshipManager.getRelationship(characterId, userId as string)]
      : relationshipManager.getCharacterRelationships(characterId);
    
    const stats = relationshipManager.getStats(characterId);
    
    res.json({
      success: true,
      stats,
      relationships: relationships.filter(Boolean)
    });
  } catch (error) {
    handleError(res, error as Error, '获取互动历史');
  }
});

/**
 * 删除关系
 * DELETE /api/relationships/:characterId/:userId
 */
router.delete('/relationships/:characterId/:userId', (req: Request, res: Response) => {
  try {
    const { characterId, userId } = req.params;
    
    // 检查关系是否存在
    const existing = relationshipManager.getRelationship(characterId, userId);
    if (!existing) {
      res.status(404).json({ success: false, error: '关系不存在' });
    }
    
    relationshipManager.deleteRelationship(characterId, userId);
    
    console.log(`[Character API] 删除关系: ${characterId} <-> ${userId}`);
    
    res.json({ success: true, message: '关系已删除' });
  } catch (error) {
    handleError(res, error as Error, '删除关系');
  }
});

// ==================== 记忆管理 API ====================

/**
 * 获取角色记忆
 * GET /api/memories/:characterId
 * Query: userId?, type?, limit?, minImportance?
 */
router.get('/memories/:characterId', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { userId, type, limit, minImportance } = req.query;
    
    const options: Record<string, unknown> = {};
    if (userId) options.userId = userId;
    if (type) options.type = type;
    if (limit) options.limit = parseInt(limit as string);
    if (minImportance) options.minImportance = parseInt(minImportance as string);
    
    const memories = memoryManager.getMemories(characterId, options);
    
    res.json({
      success: true,
      count: memories.length,
      memories
    });
  } catch (error) {
    handleError(res, error as Error, '获取记忆');
  }
});

/**
 * 添加记忆
 * POST /api/memories
 * Body: { characterId, userId?, type, content, importance?, tags? }
 */
router.post('/memories', (req: Request, res: Response) => {
  try {
    const { characterId, type, content } = req.body;
    
    if (!characterId || !type || !content) {
      res.status(400).json({ success: false, error: 'characterId, type, content 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    const memory = memoryManager.addMemory(characterId, req.body);
    
    console.log(`[Character API] 添加记忆: ${characterId}, type=${type}`);
    
    res.status(201).json({ success: true, memory });
  } catch (error) {
    handleError(res, error as Error, '添加记忆');
  }
});

/**
 * 搜索记忆
 * GET /api/memories/:characterId/search
 * Query: q (搜索关键词), limit?
 */
router.get('/memories/:characterId/search', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const { q, limit } = req.query;
    
    if (!q) {
      res.status(400).json({ success: false, error: 'q (搜索关键词) 是必需参数' });
    }
    
    const options: { limit?: number } = {};
    if (limit) options.limit = parseInt(limit as string);
    
    const memories = memoryManager.searchMemories(characterId, q as string, options);
    
    res.json({
      success: true,
      count: memories.length,
      query: q,
      memories
    });
  } catch (error) {
    handleError(res, error as Error, '搜索记忆');
  }
});

/**
 * 更新记忆重要性
 * PUT /api/memories/:memoryId/importance
 * Body: { importance }
 */
router.put('/memories/:memoryId/importance', (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    const { importance } = req.body;
    
    if (typeof importance !== 'number' || importance < 1 || importance > 10) {
      res.status(400).json({ success: false, error: 'importance 必须是 1-10 的数字' });
    }
    
    memoryManager.updateImportance(memoryId, importance);
    
    res.json({ success: true, message: '记忆重要性已更新' });
  } catch (error) {
    handleError(res, error as Error, '更新记忆重要性');
  }
});

/**
 * 删除记忆
 * DELETE /api/memories/:memoryId
 */
router.delete('/memories/:memoryId', (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    
    memoryManager.deleteMemory(memoryId);
    
    console.log(`[Character API] 删除记忆: ${memoryId}`);
    
    res.json({ success: true, message: '记忆已删除' });
  } catch (error) {
    handleError(res, error as Error, '删除记忆');
  }
});

/**
 * 清除角色所有记忆
 * DELETE /api/memories/:characterId/all
 */
router.delete('/memories/:characterId/all', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    
    // 安全检查：需要确认参数
    const { confirm } = req.query;
    if (confirm !== 'true') {
      res.status(400).json({ 
        success: false, 
        error: '需要确认参数: ?confirm=true' 
      });
    }
    
    memoryManager.clearMemories(characterId);
    
    console.log(`[Character API] 清除角色所有记忆: ${characterId}`);
    
    res.json({ success: true, message: '角色记忆已清空' });
  } catch (error) {
    handleError(res, error as Error, '清除记忆');
  }
});

/**
 * 获取记忆统计
 * GET /api/memories/:characterId/stats
 */
router.get('/memories/:characterId/stats', (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;
    const stats = memoryManager.getStats(characterId);
    
    res.json({ success: true, stats });
  } catch (error) {
    handleError(res, error as Error, '获取记忆统计');
  }
});

// ==================== 情绪检测 API ====================

/**
 * 分析文本情绪
 * POST /api/emotion/analyze
 * Body: { text }
 */
router.post('/emotion/analyze', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      res.status(400).json({ success: false, error: 'text 是必需参数' });
    }
    
    const result = emotionDetector.analyze(text);
    
    console.log(`[Character API] 情绪分析: "${text.substring(0, 30)}..." -> ${result.emotionName} (${result.score})`);
    
    res.json({ success: true, result });
  } catch (error) {
    handleError(res, error as Error, '情绪分析');
  }
});

/**
 * 批量情绪分析
 * POST /api/emotion/analyze-batch
 * Body: { texts: string[] }
 */
router.post('/emotion/analyze-batch', (req: Request, res: Response) => {
  try {
    const { texts } = req.body;
    
    if (!texts || !Array.isArray(texts)) {
      res.status(400).json({ success: false, error: 'texts 数组是必需参数' });
    }
    
    const results = emotionDetector.analyzeBatch(texts);
    
    console.log(`[Character API] 批量情绪分析: ${texts.length} 条文本`);
    
    res.json({ 
      success: true, 
      count: results.length,
      results 
    });
  } catch (error) {
    handleError(res, error as Error, '批量情绪分析');
  }
});

/**
 * 获取情绪分析统计
 * GET /api/emotion/stats
 */
router.get('/emotion/stats', (_req: Request, res: Response) => {
  try {
    const stats = emotionDetector.getStats();
    
    res.json({ success: true, stats });
  } catch (error) {
    handleError(res, error as Error, '获取情绪统计');
  }
});

/**
 * 重置情绪分析统计
 * POST /api/emotion/stats/reset
 */
router.post('/emotion/stats/reset', (_req: Request, res: Response) => {
  try {
    emotionDetector.resetStats();
    
    console.log('[Character API] 情绪统计已重置');
    
    res.json({ success: true, message: '情绪统计已重置' });
  } catch (error) {
    handleError(res, error as Error, '重置情绪统计');
  }
});

/**
 * 获取情绪关键词词典
 * GET /api/emotion/keywords
 * Query: emotion (可选，指定情绪类型)
 */
router.get('/emotion/keywords', (req: Request, res: Response) => {
  try {
    const { emotion } = req.query;
    const keywords = emotionDetector.getKeywords(emotion as string || null);
    
    res.json({ 
      success: true, 
      emotions: Object.keys(keywords),
      keywords 
    });
  } catch (error) {
    handleError(res, error as Error, '获取情绪关键词');
  }
});

/**
 * 添加自定义情绪关键词
 * POST /api/emotion/keywords
 * Body: { emotion, keyword, weight? }
 */
router.post('/emotion/keywords', (req: Request, res: Response) => {
  try {
    const { emotion, keyword, weight = 1 } = req.body;
    
    if (!emotion || !keyword) {
      res.status(400).json({ success: false, error: 'emotion 和 keyword 是必需参数' });
    }
    
    emotionDetector.addKeyword(emotion, keyword, weight);
    
    console.log(`[Character API] 添加情绪关键词: ${emotion} -> ${keyword} (${weight})`);
    
    res.json({ success: true, message: '关键词已添加' });
  } catch (error) {
    handleError(res, error as Error, '添加情绪关键词');
  }
});

/**
 * 删除情绪关键词
 * DELETE /api/emotion/keywords
 * Body: { emotion, keyword }
 */
router.delete('/emotion/keywords', (req: Request, res: Response) => {
  try {
    const { emotion, keyword } = req.body;
    
    if (!emotion || !keyword) {
      res.status(400).json({ success: false, error: 'emotion 和 keyword 是必需参数' });
    }
    
    const removed = emotionDetector.removeKeyword(emotion, keyword);
    
    if (removed) {
      console.log(`[Character API] 删除情绪关键词: ${emotion} -> ${keyword}`);
      res.json({ success: true, message: '关键词已删除' });
    } else {
      res.status(404).json({ success: false, error: '关键词不存在' });
    }
  } catch (error) {
    handleError(res, error as Error, '删除情绪关键词');
  }
});

// ==================== 主动触发 API ====================

/**
 * 触发器状态存储（简单内存存储）
 * 后续可以迁移到数据库或专门的 TriggerManager
 */
const triggerState: TriggerState = {
  enabled: true,
  lastTrigger: null,
  triggers: []
};

/**
 * 手动触发
 * POST /api/triggers/execute
 * Body: { characterId, triggerType?, data? }
 */
router.post('/triggers/execute', (req: Request, res: Response) => {
  try {
    const { characterId, triggerType = 'manual', data } = req.body;
    
    if (!characterId) {
      res.status(400).json({ success: false, error: 'characterId 是必需参数' });
    }
    
    // 检查角色是否存在
    const character = CharacterManager.loadCharacter(characterId);
    if (!character) {
      res.status(404).json({ success: false, error: '角色不存在' });
    }
    
    // TODO: 集成实际的触发器逻辑
    // 目前返回占位符响应
    const result: TriggerResult = {
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
    handleError(res, error as Error, '执行触发器');
  }
});

/**
 * 获取触发器状态
 * GET /api/triggers/status
 */
router.get('/triggers/status', (_req: Request, res: Response) => {
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
    handleError(res, error as Error, '获取触发器状态');
  }
});

/**
 * 启用/禁用触发器
 * PUT /api/triggers/toggle
 * Body: { enabled: boolean }
 */
router.put('/triggers/toggle', (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled 必须是 boolean 类型' });
    }
    
    triggerState.enabled = enabled;
    
    console.log(`[Character API] 触发器状态: ${enabled ? '启用' : '禁用'}`);
    
    res.json({ 
      success: true, 
      message: `触发器已${enabled ? '启用' : '禁用'}`,
      enabled 
    });
  } catch (error) {
    handleError(res, error as Error, '切换触发器状态');
  }
});

module.exports = router;

export {};