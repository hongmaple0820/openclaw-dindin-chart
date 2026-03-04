/**
 * Cloud Market Routes - 云市场 API
 */

const express = require('express');
const router = express.Router();

let cloudMarket = null;

router.setCloudMarket = (service) => {
  cloudMarket = service;
};

// ==================== Skills Market ====================

/**
 * GET /api/market/skills
 * 发现 Skills
 */
router.get('/skills', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const { category, query, sort, limit, offset } = req.query;
  
  const result = await cloudMarket.discoverSkills({
    category,
    query,
    sort,
    limit: parseInt(limit) || 20,
    offset: parseInt(offset) || 0
  });

  res.json({ success: true, ...result });
});

/**
 * POST /api/market/skills
 * 发布 Skill
 */
router.post('/skills', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const userId = req.headers['x-user-id'] || 'anonymous';
  const result = await cloudMarket.publishSkill(userId, req.body);

  res.status(result.success ? 201 : 400).json(result);
});

/**
 * POST /api/market/skills/:id/install
 * 安装 Skill
 */
router.post('/skills/:id/install', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const userId = req.headers['x-user-id'] || 'anonymous';
  const result = await cloudMarket.installSkill(req.params.id, userId);

  res.json(result);
});

// ==================== MCP Market ====================

/**
 * GET /api/market/mcp
 * 发现 MCP Servers
 */
router.get('/mcp', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const { query, sort, limit, offset } = req.query;
  
  const result = await cloudMarket.discoverMCPServers({
    query,
    sort,
    limit: parseInt(limit) || 20,
    offset: parseInt(offset) || 0
  });

  res.json({ success: true, ...result });
});

/**
 * POST /api/market/mcp
 * 发布 MCP Server
 */
router.post('/mcp', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const userId = req.headers['x-user-id'] || 'anonymous';
  const result = await cloudMarket.publishMCPServer(userId, req.body);

  res.status(result.success ? 201 : 400).json(result);
});

// ==================== Sync ====================

/**
 * POST /api/market/sync
 * 同步到云端
 */
router.post('/sync', async (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const userId = req.headers['x-user-id'] || 'anonymous';
  const result = await cloudMarket.syncToCloud(userId, req.body);

  res.json(result);
});

/**
 * GET /api/market/stats
 * 获取市场统计
 */
router.get('/stats', (req, res) => {
  if (!cloudMarket) {
    return res.status(503).json({ error: 'Cloud market not initialized' });
  }

  const stats = cloudMarket.getStats();
  res.json({ success: true, stats });
});

module.exports = router;