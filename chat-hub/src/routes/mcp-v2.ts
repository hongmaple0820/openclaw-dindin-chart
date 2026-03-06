/**
 * MCP V2 Routes - MCP 系统路由 V2
 * 
 * API 端点：
 * - 内置 MCP: /api/mcp/builtin
 * - 云市场: /api/mcp/market
 * - 我的 MCP: /api/mcp/mine
 * - 外部市场: /api/mcp/external
 */

const express = require('express');
const router = express.Router();

let mcpService = null;

function setMCPService(service) {
  mcpService = service;
}

function ensureService(req, res, next) {
  if (!mcpService) {
    return res.status(500).json({ success: false, error: 'MCP service not initialized' });
  }
  next();
}

// ==================== 内置 MCP ====================

router.get('/builtin', ensureService, async (req, res) => {
  try {
    const mcps = await mcpService.getBuiltinMCPServers();
    res.json({ success: true, data: mcps });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/builtin/:id', ensureService, async (req, res) => {
  try {
    const mcp = await mcpService.getBuiltinMCP(req.params.id);
    if (!mcp) {
      return res.status(404).json({ success: false, error: 'MCP not found' });
    }
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 云市场 ====================

router.get('/market', ensureService, async (req, res) => {
  try {
    const { search, limit } = req.query;
    const mcps = await mcpService.getMarketplaceMCPServers({ search, limit: limit ? parseInt(limit) : undefined });
    res.json({ success: true, data: mcps });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/market/:id', ensureService, async (req, res) => {
  try {
    const mcp = await mcpService.getMarketplaceMCP(req.params.id);
    if (!mcp) {
      return res.status(404).json({ success: false, error: 'MCP not found' });
    }
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/:id/install', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const result = await mcpService.installMCP(userId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/submit', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const result = await mcpService.submitToMarketplace(userId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 我的 MCP ====================

router.get('/mine', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const [installed, custom] = await Promise.all([
      mcpService.getUserMCPServers(userId),
      mcpService.getCustomMCPServers(userId)
    ]);
    res.json({ success: true, data: { installed, custom } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/mine', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const mcp = await mcpService.createCustomMCP(userId, req.body);
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/mine/:id', ensureService, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const deleted = await mcpService.deleteCustomMCP(req.params.id, userId);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 外部市场 ====================

router.get('/external', ensureService, async (req, res) => {
  try {
    const markets = await mcpService.getExternalMarkets();
    res.json({ success: true, data: markets });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = { router, setMCPService };
// Make this a module
export {};
