/**
 * MCP V2 Routes - MCP 系统路由 V2
 * 
 * API 端点：
 * - 内置 MCP: /api/mcp/builtin
 * - 云市场: /api/mcp/market
 * - 我的 MCP: /api/mcp/mine
 * - 外部市场: /api/mcp/external
 */

import express, { type Request, type Response, type NextFunction } from 'express';

const router = express.Router();

interface MCPServer {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  [key: string]: unknown;
}

interface UserMCPServer {
  id: string;
  user_id: string;
  mcp_id: string;
  [key: string]: unknown;
}

interface CustomMCPServer extends MCPServer {
  user_id: string;
}

interface ExternalMarket {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface MCPService {
  getBuiltinMCPServers(): Promise<MCPServer[]>;
  getBuiltinMCP(id: string): Promise<MCPServer | null>;
  getMarketplaceMCPServers(options?: { search?: string; limit?: number }): Promise<MCPServer[]>;
  getMarketplaceMCP(id: string): Promise<MCPServer | null>;
  installMCP(userId: string, mcpId: string): Promise<{ success: boolean; error?: string }>;
  submitToMarketplace(userId: string, data: unknown): Promise<{ success: boolean; error?: string }>;
  getUserMCPServers(userId: string): Promise<UserMCPServer[]>;
  getCustomMCPServers(userId: string): Promise<CustomMCPServer[]>;
  createCustomMCP(userId: string, data: unknown): Promise<CustomMCPServer>;
  deleteCustomMCP(id: string, userId: string): Promise<boolean>;
  getExternalMarkets(): Promise<ExternalMarket[]>;
}

let mcpService: MCPService | null = null;

function setMCPService(service: MCPService): void {
  mcpService = service;
}

function ensureService(req: Request, res: Response, next: NextFunction): void {
  if (!mcpService) {
    res.status(500).json({ success: false, error: 'MCP service not initialized' });
    return;
  }
  next();
}

interface MarketQuery {
  search?: string;
  limit?: string;
}

// ==================== 内置 MCP ====================

router.get('/builtin', ensureService, async (req: Request, res: Response): Promise<void> => {
  try {
    const mcps = await mcpService!.getBuiltinMCPServers();
    res.json({ success: true, data: mcps });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/builtin/:id', ensureService, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const mcp = await mcpService!.getBuiltinMCP(req.params.id);
    if (!mcp) {
      res.status(404).json({ success: false, error: 'MCP not found' });
      return;
    }
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 云市场 ====================

router.get('/market', ensureService, async (req: Request<object, object, object, MarketQuery>, res: Response): Promise<void> => {
  try {
    const { search, limit } = req.query;
    const mcps = await mcpService!.getMarketplaceMCPServers({
      search,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ success: true, data: mcps });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/market/:id', ensureService, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const mcp = await mcpService!.getMarketplaceMCP(req.params.id);
    if (!mcp) {
      res.status(404).json({ success: false, error: 'MCP not found' });
      return;
    }
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/:id/install', ensureService, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const result = await mcpService!.installMCP(userId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/market/submit', ensureService, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const result = await mcpService!.submitToMarketplace(userId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 我的 MCP ====================

router.get('/mine', ensureService, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const [installed, custom] = await Promise.all([
      mcpService!.getUserMCPServers(userId),
      mcpService!.getCustomMCPServers(userId)
    ]);
    res.json({ success: true, data: { installed, custom } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/mine', ensureService, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const mcp = await mcpService!.createCustomMCP(userId, req.body);
    res.json({ success: true, data: mcp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/mine/:id', ensureService, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = (req as Request & { user?: { id?: string } }).user?.id || 'anonymous';
    const deleted = await mcpService!.deleteCustomMCP(req.params.id, userId);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== 外部市场 ====================

router.get('/external', ensureService, async (req: Request, res: Response): Promise<void> => {
  try {
    const markets = await mcpService!.getExternalMarkets();
    res.json({ success: true, data: markets });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export { router, setMCPService };