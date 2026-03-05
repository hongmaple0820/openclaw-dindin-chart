/**
 * MCP Service - MCP 服务器管理服务 (TypeScript)
 * 
 * 管理内置 MCP、云市场 MCP、用户 MCP
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  MCPServer, 
  MarketplaceMCPServer, 
  UserMCPServer, 
  CustomMCPServer,
  ExternalMarket,
  ApiResponse,
  DbWrapper 
} from '../types/mcp';

export class MCPService {
  private db: DbWrapper;

  constructor(db: DbWrapper) {
    this.db = db;
  }

  // ==================== 内置 MCP ====================

  async getBuiltinMCPServers(): Promise<MCPServer[]> {
    const rows = await this.db.all(
      'SELECT * FROM builtin_mcp_servers WHERE enabled = 1 ORDER BY order_index ASC, name ASC'
    );
    return rows.map(row => this.formatMCP(row as Record<string, unknown>));
  }

  async getBuiltinMCP(id: string): Promise<MCPServer | null> {
    const row = await this.db.get(
      'SELECT * FROM builtin_mcp_servers WHERE id = ?', 
      [id]
    );
    return row ? this.formatMCP(row as Record<string, unknown>) : null;
  }

  async addBuiltinMCP(mcp: Partial<MCPServer>): Promise<MCPServer | null> {
    const id = mcp.id || uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO builtin_mcp_servers (
        id, name, display_name, description, version, author,
        transport_type, command, endpoint, env_config, args, tools,
        enabled, order_index, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, mcp.name || '', mcp.display_name || mcp.name || '',
      mcp.description || '', mcp.version || '1.0.0', mcp.author || 'system',
      mcp.transport_type || 'stdio',
      mcp.command || '', mcp.endpoint || '',
      JSON.stringify(mcp.env_config || {} as Record<string, unknown> as Record<string, unknown>),
      JSON.stringify(mcp.args || [] as unknown[]),
      JSON.stringify(mcp.tools || [] as unknown[]),
      mcp.enabled !== false ? 1 : 0, mcp.order_index || 0,
      mcp.icon || '', now, now
    ]);

    return this.getBuiltinMCP(id);
  }

  // ==================== 云市场 MCP ====================

  async getMarketplaceMCPServers(filters: { 
    search?: string; 
    limit?: number 
  } = {}): Promise<MarketplaceMCPServer[]> {
    let sql = "SELECT * FROM marketplace_mcp_servers WHERE status = 'approved'";
    const params: (string | number)[] = [];

    if (filters.search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY downloads DESC, rating DESC, created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.formatMCP(row as Record<string, unknown>) as MarketplaceMCPServer);
  }

  async getMarketplaceMCP(id: string): Promise<MarketplaceMCPServer | null> {
    const row = await this.db.get(
      "SELECT * FROM marketplace_mcp_servers WHERE id = ? AND status = 'approved'",
      [id]
    );
    return row ? this.formatMCP(row as Record<string, unknown>) as MarketplaceMCPServer : null;
  }

  async installMCP(userId: string, mcpId: string): Promise<ApiResponse<MCPServer>> {
    const existing = await this.db.get(
      'SELECT * FROM user_mcp_servers WHERE user_id = ? AND mcp_id = ?',
      [userId, mcpId]
    );

    if (existing) {
      return { success: false, error: 'MCP already installed' };
    }

    const mcp = await this.getMarketplaceMCP(mcpId);
    if (!mcp) {
      return { success: false, error: 'MCP not found' };
    }

    const now = Date.now();
    await this.db.run(`
      INSERT INTO user_mcp_servers (user_id, mcp_id, mcp_type, enabled, installed_at)
      VALUES (?, ?, 'marketplace', 1, ?)
    `, [userId, mcpId, now]);

    await this.db.run(
      'UPDATE marketplace_mcp_servers SET installs = installs + 1 WHERE id = ?',
      [mcpId]
    );

    return { success: true, data: mcp };
  }

  async submitToMarketplace(
    userId: string, 
    mcpData: Partial<MarketplaceMCPServer>
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO marketplace_mcp_servers (
        id, name, display_name, description, version,
        author_id, author_name, transport_type, command, endpoint,
        env_config, args, tools, status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      id, mcpData.name || '', mcpData.display_name || mcpData.name || '',
      mcpData.description || '', mcpData.version || '1.0.0',
      userId, mcpData.author_name || '',
      mcpData.transport_type || 'stdio',
      mcpData.command || '', mcpData.endpoint || '',
      JSON.stringify(mcpData.env_config || {} as Record<string, unknown>),
      JSON.stringify(mcpData.args || [] as unknown[]),
      JSON.stringify(mcpData.tools || [] as unknown[]),
      mcpData.icon || '', now, now
    ]);

    return { success: true, data: { id, status: 'pending' } };
  }

  // ==================== 用户 MCP ====================

  async getUserMCPServers(userId: string): Promise<UserMCPServer[]> {
    return this.db.all(`
      SELECT um.*,
        CASE
          WHEN um.mcp_type = 'builtin' THEN (SELECT name FROM builtin_mcp_servers WHERE id = um.mcp_id)
          WHEN um.mcp_type = 'marketplace' THEN (SELECT name FROM marketplace_mcp_servers WHERE id = um.mcp_id)
          WHEN um.mcp_type = 'custom' THEN (SELECT name FROM custom_mcp_servers WHERE id = um.mcp_id)
        END as mcp_name
      FROM user_mcp_servers um
      WHERE um.user_id = ?
      ORDER BY um.installed_at DESC
    `, [userId]);
  }

  async getCustomMCPServers(userId: string): Promise<CustomMCPServer[]> {
    const rows = await this.db.all(
      'SELECT * FROM custom_mcp_servers WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(row => this.formatMCP(row as Record<string, unknown>) as CustomMCPServer);
  }

  async createCustomMCP(
    userId: string, 
    mcpData: Partial<CustomMCPServer>
  ): Promise<CustomMCPServer | null> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO custom_mcp_servers (
        id, user_id, name, display_name, description, version,
        transport_type, command, endpoint, env_config, args, tools,
        publish_status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?)
    `, [
      id, userId, mcpData.name || '', mcpData.display_name || mcpData.name || '',
      mcpData.description || '', mcpData.version || '1.0.0',
      mcpData.transport_type || 'stdio',
      mcpData.command || '', mcpData.endpoint || '',
      JSON.stringify(mcpData.env_config || {} as Record<string, unknown>),
      JSON.stringify(mcpData.args || [] as unknown[]),
      JSON.stringify(mcpData.tools || [] as unknown[]),
      mcpData.icon || '', now, now
    ]);

    return this.getCustomMCP(id);
  }

  async getCustomMCP(id: string): Promise<CustomMCPServer | null> {
    const row = await this.db.get('SELECT * FROM custom_mcp_servers WHERE id = ?', [id]);
    return row ? this.formatMCP(row as Record<string, unknown>) as CustomMCPServer : null;
  }

  async deleteCustomMCP(id: string, userId: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM custom_mcp_servers WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.changes > 0;
  }

  // ==================== 外部市场 ====================

  async getExternalMarkets(): Promise<ExternalMarket[]> {
    return this.db.all(
      'SELECT * FROM external_markets WHERE enabled = 1 ORDER BY order_index ASC'
    );
  }

  // ==================== 管理功能 ====================

  async getPendingMCPs(): Promise<MarketplaceMCPServer[]> {
    const rows = await this.db.all(
      "SELECT * FROM marketplace_mcp_servers WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return rows.map(row => this.formatMCP(row as Record<string, unknown>) as MarketplaceMCPServer);
  }

  async approveMCP(
    mcpId: string, 
    reviewerId: string, 
    note: string = ''
  ): Promise<ApiResponse> {
    const now = Date.now();
    
    await this.db.run(`
      UPDATE marketplace_mcp_servers SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = ?,
        review_note = ?,
        updated_at = ?
      WHERE id = ?
    `, [reviewerId, now, note, now, mcpId]);

    return { success: true };
  }

  async rejectMCP(
    mcpId: string, 
    reviewerId: string, 
    note: string = ''
  ): Promise<ApiResponse> {
    const now = Date.now();
    
    await this.db.run(`
      UPDATE marketplace_mcp_servers SET
        status = 'rejected',
        reviewed_by = ?,
        reviewed_at = ?,
        review_note = ?,
        updated_at = ?
      WHERE id = ?
    `, [reviewerId, now, note, now, mcpId]);

    return { success: true };
  }

  // ==================== 工具方法 ====================

  private formatMCP(row: Record<string, unknown>): MCPServer {
    if (!row) return null as unknown as MCPServer;
    
    return {
      ...row,
      env_config: typeof row.env_config === 'string' 
        ? JSON.parse(row.env_config as string) 
        : row.env_config,
      args: typeof row.args === 'string' 
        ? JSON.parse(row.args as string) 
        : row.args,
      tools: typeof row.tools === 'string' 
        ? JSON.parse(row.tools as string) 
        : row.tools
    } as MCPServer;
  }
}