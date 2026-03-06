/**
 * MCP Service - MCP 服务器管理服务
 * 
 * 管理内置 MCP、云市场 MCP、用户 MCP
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

type MCPTransportType = 'stdio' | 'sse' | 'ws';
type MCPStatus = 'pending' | 'approved' | 'rejected';

interface MCPServer {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version?: string;
  author?: string;
  transport_type?: MCPTransportType;
  command?: string;
  endpoint?: string;
  env_config?: Record<string, any>;
  args?: string[];
  tools?: any[];
  enabled?: number;
  order_index?: number;
  icon?: string;
  created_at?: number;
  updated_at?: number;
  status?: MCPStatus;
  author_id?: string;
  author_name?: string;
  publish_status?: string;
  reviewed_by?: string;
  reviewed_at?: number;
  review_note?: string;
  downloads?: number;
  rating?: number;
  installs?: number;
  user_id?: string;
  mcp_id?: string;
  mcp_type?: string;
  mcp_name?: string;
  installed_at?: number;
}

interface MCPFilters {
  search?: string;
  limit?: number;
}

interface CreateMCPData {
  id?: string;
  name: string;
  display_name?: string;
  description?: string;
  version?: string;
  author?: string;
  transport_type?: MCPTransportType;
  command?: string;
  endpoint?: string;
  env_config?: Record<string, any>;
  args?: string[];
  tools?: any[];
  enabled?: boolean;
  order_index?: number;
  icon?: string;
}

interface Database {
  run(sql: string, params?: any[]): Promise<{ changes: number }>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

// ==================== MCP 服务类 ====================

class MCPService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ==================== 内置 MCP ====================

  /**
   * 获取内置 MCP 列表
   */
  async getBuiltinMCPServers(filters: MCPFilters = {}): Promise<MCPServer[]> {
    let sql = 'SELECT * FROM builtin_mcp_servers WHERE enabled = 1';
    const params: any[] = [];

    sql += ' ORDER BY order_index ASC, name ASC';

    const rows = await this.db.all(sql, params);
    return rows.map(this.formatMCP);
  }

  /**
   * 获取内置 MCP 详情
   */
  async getBuiltinMCP(id: string): Promise<MCPServer | null> {
    const row = await this.db.get('SELECT * FROM builtin_mcp_servers WHERE id = ?', [id]);
    return row ? this.formatMCP(row) : null;
  }

  /**
   * 添加内置 MCP（管理员）
   */
  async addBuiltinMCP(mcp: CreateMCPData): Promise<MCPServer | null> {
    const id = mcp.id || uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO builtin_mcp_servers (
        id, name, display_name, description, version, author,
        transport_type, command, endpoint, env_config, args, tools,
        enabled, order_index, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, mcp.name, mcp.display_name || mcp.name,
      mcp.description || '', mcp.version || '1.0.0', mcp.author || 'system',
      mcp.transport_type || 'stdio',
      mcp.command || '', mcp.endpoint || '',
      JSON.stringify(mcp.env_config || {}),
      JSON.stringify(mcp.args || []),
      JSON.stringify(mcp.tools || []),
      mcp.enabled !== false ? 1 : 0, mcp.order_index || 0,
      mcp.icon || '', now, now
    ]);

    return this.getBuiltinMCP(id);
  }

  // ==================== 云市场 MCP ====================

  /**
   * 获取云市场 MCP 列表
   */
  async getMarketplaceMCPServers(filters: MCPFilters = {}): Promise<MCPServer[]> {
    let sql = "SELECT * FROM marketplace_mcp_servers WHERE status = 'approved'";
    const params: any[] = [];

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
    return rows.map(this.formatMCP);
  }

  /**
   * 获取云市场 MCP 详情
   */
  async getMarketplaceMCP(id: string): Promise<MCPServer | null> {
    const row = await this.db.get(
      "SELECT * FROM marketplace_mcp_servers WHERE id = ? AND status = 'approved'",
      [id]
    );
    return row ? this.formatMCP(row) : null;
  }

  /**
   * 安装云市场 MCP
   */
  async installMCP(userId: string, mcpId: string): Promise<{ success: boolean; error?: string; mcp?: MCPServer }> {
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

    return { success: true, mcp };
  }

  /**
   * 提交 MCP 到云市场
   */
  async submitToMarketplace(userId: string, mcpData: CreateMCPData): Promise<{ success: boolean; id?: string; status?: string }> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO marketplace_mcp_servers (
        id, name, display_name, description, version,
        author_id, author_name, transport_type, command, endpoint,
        env_config, args, tools, status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      id, mcpData.name, mcpData.display_name || mcpData.name,
      mcpData.description || '', mcpData.version || '1.0.0',
      userId, mcpData.author || '',
      mcpData.transport_type || 'stdio',
      mcpData.command || '', mcpData.endpoint || '',
      JSON.stringify(mcpData.env_config || {}),
      JSON.stringify(mcpData.args || []),
      JSON.stringify(mcpData.tools || []),
      mcpData.icon || '', now, now
    ]);

    return { success: true, id, status: 'pending' };
  }

  // ==================== 用户 MCP ====================

  /**
   * 获取用户安装的 MCP
   */
  async getUserMCPServers(userId: string): Promise<MCPServer[]> {
    const rows = await this.db.all(`
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

    return rows;
  }

  /**
   * 获取用户自建 MCP
   */
  async getCustomMCPServers(userId: string): Promise<MCPServer[]> {
    const rows = await this.db.all(
      'SELECT * FROM custom_mcp_servers WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(this.formatMCP);
  }

  /**
   * 创建自建 MCP
   */
  async createCustomMCP(userId: string, mcpData: CreateMCPData): Promise<MCPServer | null> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO custom_mcp_servers (
        id, user_id, name, display_name, description, version,
        transport_type, command, endpoint, env_config, args, tools,
        publish_status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?)
    `, [
      id, userId, mcpData.name, mcpData.display_name || mcpData.name,
      mcpData.description || '', mcpData.version || '1.0.0',
      mcpData.transport_type || 'stdio',
      mcpData.command || '', mcpData.endpoint || '',
      JSON.stringify(mcpData.env_config || {}),
      JSON.stringify(mcpData.args || []),
      JSON.stringify(mcpData.tools || []),
      mcpData.icon || '', now, now
    ]);

    return this.getCustomMCP(id);
  }

  /**
   * 获取自建 MCP 详情
   */
  async getCustomMCP(id: string): Promise<MCPServer | null> {
    const row = await this.db.get('SELECT * FROM custom_mcp_servers WHERE id = ?', [id]);
    return row ? this.formatMCP(row) : null;
  }

  /**
   * 删除自建 MCP
   */
  async deleteCustomMCP(id: string, userId: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM custom_mcp_servers WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.changes > 0;
  }

  // ==================== 管理功能 ====================

  /**
   * 获取待审核 MCP
   */
  async getPendingMCPs(): Promise<MCPServer[]> {
    const rows = await this.db.all(
      "SELECT * FROM marketplace_mcp_servers WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return rows.map(this.formatMCP);
  }

  /**
   * 批准 MCP
   */
  async approveMCP(mcpId: string, reviewerId: string, note: string = ''): Promise<{ success: boolean }> {
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

  /**
   * 拒绝 MCP
   */
  async rejectMCP(mcpId: string, reviewerId: string, note: string = ''): Promise<{ success: boolean }> {
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

  // ==================== 外部市场 ====================

  /**
   * 获取外部市场列表
   */
  async getExternalMarkets(): Promise<any[]> {
    const rows = await this.db.all(
      'SELECT * FROM external_markets WHERE enabled = 1 ORDER BY order_index ASC'
    );
    return rows;
  }

  // ==================== 工具方法 ====================

  private formatMCP(row: any): MCPServer {
    if (!row) return null;
    
    return {
      ...row,
      env_config: typeof row.env_config === 'string' ? JSON.parse(row.env_config) : row.env_config,
      args: typeof row.args === 'string' ? JSON.parse(row.args) : row.args,
      tools: typeof row.tools === 'string' ? JSON.parse(row.tools) : row.tools
    };
  }
}

export { MCPService };
export type { MCPServer, MCPTransportType, MCPStatus, MCPFilters, CreateMCPData, Database };