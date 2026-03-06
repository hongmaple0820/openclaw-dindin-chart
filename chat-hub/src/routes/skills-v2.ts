/**
 * Skills V2 Routes - 技能系统路由 V2
 * 
 * API 端点：
 * - 内置技能: /api/skills/builtin
 * - 云市场: /api/skills/market
 * - 我的技能: /api/skills/mine
 * - 管理: /api/skills/admin
 */

const express = require('express');
const router = express.Router();

let skillsService = null;

function setSkillsService(service) {
  skillsService = service;
}

function ensureService(req, res, next) {
  if (!skillsService) {
    return res.status(500).json({ success: false, error: 'Skills service not initialized' });
  }
  next();
}

// ==================== 内置技能 ====================

router.get('/builtin', ensureService, async (req, res) => {
  try {
    const { category } = req.query;
    const skills = await skillsService.getBuiltinSkills({ category });
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/builtin/:id', ensureService, async (req, res) => {
  try {
    const skill = await skillsService.getBuiltinSkill(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 云市场 ====================

router.get('/market', ensureService, async (req, res) => {
  try {
    const { category, search, limit } = req.query;
    const skills = await skillsService.getMarketplaceSkills({ category, search, limit: limit ? parseInt(limit) : undefined });
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/market/:id', ensureService, async (req, res) => {
  try {
    const skill = await skillsService.getMarketplaceSkill(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/:id/install', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const result = await skillsService.installSkill(userId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/submit', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const result = await skillsService.submitToMarketplace(userId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 我的技能 ====================

router.get('/mine', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const [installed, custom] = await Promise.all([
      skillsService.getUserSkills(userId),
      skillsService.getCustomSkills(userId)
    ]);
    res.json({ success: true, data: { installed, custom } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/mine', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const skill = await skillsService.createCustomSkill(userId, req.body);
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/mine/:id', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const skill = await skillsService.updateCustomSkill(req.params.id, userId, req.body);
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/mine/:id', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const deleted = await skillsService.deleteCustomSkill(req.params.id, userId);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 管理（管理员）====================

router.get('/admin/pending', ensureService, async (req, res) => {
  try {
    const skills = await skillsService.getPendingSkills();
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/admin/:id/approve', ensureService, async (req, res) => {
  try {
    const reviewerId = req.user?.id || 'admin';
    const { note } = req.body;
    const result = await skillsService.approveSkill(req.params.id, reviewerId, note);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/admin/:id/reject', ensureService, async (req, res) => {
  try {
    const reviewerId = req.user?.id || 'admin';
    const { note } = req.body;
    const result = await skillsService.rejectSkill(req.params.id, reviewerId, note);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = { router, setSkillsService };
// Make this a module
export {};
