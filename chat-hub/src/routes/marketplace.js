/**
 * Marketplace Routes - 市场路由
 * 
 * API 端点：
 * - GET    /api/marketplace              获取市场列表
 * - GET    /api/marketplace/:id/search    搜索技能
 * - GET    /api/marketplace/:id/trending  获取热门技能
 * - GET    /api/marketplace/:id/skill/:skillId  获取技能详情
 * - POST   /api/marketplace/:id/install   安装技能
 * - POST   /api/marketplace/check-updates 检查更新
 */

const express = require('express');
const router = express.Router();

let marketplaceIntegration = null;

/**
 * 设置 MarketplaceIntegration 实例
 */
function setMarketplaceIntegration(instance) {
  marketplaceIntegration = instance;
}

/**
 * 确保已初始化
 */
function ensureInitialized(req, res, next) {
  if (!marketplaceIntegration) {
    return res.status(500).json({
      success: false,
      error: 'Marketplace integration not initialized'
    });
  }
  next();
}

// ==================== 市场列表 ====================

/**
 * GET /api/marketplace
 * 获取所有市场
 */
router.get('/', ensureInitialized, (req, res) => {
  try {
    const marketplaces = marketplaceIntegration.getMarketplaces();
    
    res.json({
      success: true,
      data: marketplaces
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 搜索 ====================

/**
 * GET /api/marketplace/:id/search
 * 搜索技能
 */
router.get('/:id/search', ensureInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { q, query, limit } = req.query;
    const searchQuery = q || query || '';
    
    const results = await marketplaceIntegration.searchSkills(id, searchQuery, { limit });
    
    res.json({
      success: true,
      data: {
        marketplace: id,
        query: searchQuery,
        total: results.length,
        skills: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 热门 ====================

/**
 * GET /api/marketplace/:id/trending
 * 获取热门技能
 */
router.get('/:id/trending', ensureInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const results = await marketplaceIntegration.getTrending(id, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        marketplace: id,
        skills: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 技能详情 ====================

/**
 * GET /api/marketplace/:id/skill/:skillId
 * 获取技能详情
 */
router.get('/:id/skill/:skillId', ensureInitialized, async (req, res) => {
  try {
    const { id, skillId } = req.params;
    
    const skill = await marketplaceIntegration.getSkillDetails(id, skillId);
    
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 安装 ====================

/**
 * POST /api/marketplace/:id/install
 * 安装技能
 */
router.post('/:id/install', ensureInitialized, async (req, res) => {
  try {
    const { id } = req.params;
    const { skillId, force, cwd } = req.body;
    
    if (!skillId) {
      return res.status(400).json({
        success: false,
        error: 'skillId is required'
      });
    }
    
    const result = await marketplaceIntegration.installSkill(id, skillId, { 
      force, 
      cwd 
    });
    
    res.json({
      success: true,
      message: `Skill ${skillId} installed successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 检查更新 ====================

/**
 * POST /api/marketplace/check-updates
 * 检查已安装技能的更新
 */
router.post('/check-updates', ensureInitialized, async (req, res) => {
  try {
    const { skills } = req.body;
    
    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        error: 'skills array is required'
      });
    }
    
    const updates = await marketplaceIntegration.checkUpdates(skills);
    
    res.json({
      success: true,
      data: {
        total: updates.length,
        updates
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router, setMarketplaceIntegration };