/**
 * Cloud Market Routes - 云市场 API
 */

import express, { type Request, type Response } from 'express';

const router = express.Router();

interface CloudMarketService {
  discoverSkills(options: {
    category?: string;
    query?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ skills: unknown[]; total: number }>;
  publishSkill(userId: string, data: unknown): Promise<{ success: boolean; error?: string }>;
  installSkill(skillId: string, userId: string): Promise<{ success: boolean; error?: string }>;
  discoverMCPServers(options: {
    query?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ servers: unknown[]; total: number }>;
  publishMCPServer(userId: string, data: unknown): Promise<{ success: boolean; error?: string }>;
  syncToCloud(userId: string, data: unknown): Promise<{ success: boolean; error?: string }>;
  getStats(): unknown;
}

let cloudMarket: CloudMarketService | null = null;

router.setCloudMarket = (service: CloudMarketService): void => {
  cloudMarket = service;
};

interface DiscoverSkillsQuery {
  category?: string;
  query?: string;
  sort?: string;
  limit?: string;
  offset?: string;
}

interface DiscoverMCPQuery {
  query?: string;
  sort?: string;
  limit?: string;
  offset?: string;
}

// ==================== Skills Market ====================

/**
 * GET /api/market/skills
 * 发现 Skills
 */
router.get('/skills', async (req: Request<object, object, object, DiscoverSkillsQuery>, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const { category, query, sort, limit, offset } = req.query;

  const result = await cloudMarket.discoverSkills({
    category,
    query,
    sort,
    limit: parseInt(limit || '20'),
    offset: parseInt(offset || '0')
  });

  res.json({ success: true, ...result });
});

/**
 * POST /api/market/skills
 * 发布 Skill
 */
router.post('/skills', async (req: Request, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const userId = req.headers['x-user-id'] as string || 'anonymous';
  const result = await cloudMarket.publishSkill(userId, req.body);

  res.status(result.success ? 201 : 400).json(result);
});

/**
 * POST /api/market/skills/:id/install
 * 安装 Skill
 */
router.post('/skills/:id/install', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const userId = req.headers['x-user-id'] as string || 'anonymous';
  const result = await cloudMarket.installSkill(req.params.id, userId);

  res.json(result);
});

// ==================== MCP Market ====================

/**
 * GET /api/market/mcp
 * 发现 MCP Servers
 */
router.get('/mcp', async (req: Request<object, object, object, DiscoverMCPQuery>, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const { query, sort, limit, offset } = req.query;

  const result = await cloudMarket.discoverMCPServers({
    query,
    sort,
    limit: parseInt(limit || '20'),
    offset: parseInt(offset || '0')
  });

  res.json({ success: true, ...result });
});

/**
 * POST /api/market/mcp
 * 发布 MCP Server
 */
router.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const userId = req.headers['x-user-id'] as string || 'anonymous';
  const result = await cloudMarket.publishMCPServer(userId, req.body);

  res.status(result.success ? 201 : 400).json(result);
});

// ==================== Sync ====================

/**
 * POST /api/market/sync
 * 同步到云端
 */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const userId = req.headers['x-user-id'] as string || 'anonymous';
  const result = await cloudMarket.syncToCloud(userId, req.body);

  res.json(result);
});

/**
 * GET /api/market/stats
 * 获取市场统计
 */
router.get('/stats', (req: Request, res: Response): void => {
  if (!cloudMarket) {
    res.status(503).json({ error: 'Cloud market not initialized' });
    return;
  }

  const stats = cloudMarket.getStats();
  res.json({ success: true, stats });
});

export = router;