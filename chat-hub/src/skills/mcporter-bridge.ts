/**
 * MCPorter Bridge - MCP 桥接
 * 
 * 功能：
 * - 集成 MCPorter CLI
 * - 调用 MCP 工具
 * - 配置 MCP 服务器
 */

import { spawn, exec } from 'child_process';
import { EventEmitter } from 'events';

/**
 * MCP 服务器配置接口
 */
interface MCPServerConfig {
  id?: string;
  name: string;
  display_name?: string;
  description?: string;
  type?: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  is_public?: boolean;
}

/**
 * MCP 服务器信息接口
 */
interface MCPServer extends MCPServerConfig {
  id: string;
  tools: Array<{ name: string } | string>;
}

/**
 * MCPorter 选项接口
 */
export interface MCPorterOptions {
  mcporterPath?: string;
  configPath?: string;
  timeout?: number;
  daemonEnabled?: boolean;
}

/**
 * 用户绑定接口
 */
interface UserMCPBinding {
  id: string;
  user_id: string;
  mcp_id: string;
  config: Record<string, unknown> | null;
  enabled: boolean;
  name?: string;
  display_name?: string;
  description?: string;
  type?: string;
}

/**
 * 数据库接口
 */
interface Database {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  get(sql: string, params?: unknown[]): Promise<Record<string, unknown> | undefined>;
  all(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class MCPorterBridge extends EventEmitter {
  db: Database;
  options: {
    mcporterPath: string;
    configPath: string;
    timeout: number;
    daemonEnabled: boolean;
  };

  // MCP 服务器缓存
  servers: Map<string, MCPServer> = new Map();
  
  // 工具缓存
  tools: Map<string, unknown> = new Map();
  
  // 初始化标志
  private _initialized: boolean = false;

  constructor(db: Database, options: MCPorterOptions = {}) {
    super();
    
    this.db = db;
    this.options = {
      mcporterPath: options.mcporterPath || 'mcporter',
      configPath: options.configPath || './config/mcporter.json',
      timeout: options.timeout || 60000,
      daemonEnabled: options.daemonEnabled !== false
    };
  }

  /**
   * 初始化桥接
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // 检查 mcporter 是否可用
    await this._checkMCPorter();

    // 加载已配置的服务器
    await this.loadServers();

    // 启动守护进程
    if (this.options.daemonEnabled) {
      await this.startDaemon();
    }

    this._initialized = true;
    this.emit('initialized');
  }

  /**
   * 检查 MCPorter 是否可用
   */
  private async _checkMCPorter(): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`${this.options.mcporterPath} --version`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error('MCPorter CLI not found. Please install: npm install -g mcporter'));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * 加载服务器列表
   */
  async loadServers(): Promise<MCPServer[]> {
    const rows = await this.db.all('SELECT * FROM mcp_servers WHERE enabled = 1');
    
    this.servers.clear();
    
    for (const row of rows) {
      const server: MCPServer = {
        id: row.id as string,
        name: row.name as string,
        display_name: row.display_name as string | undefined,
        description: row.description as string | undefined,
        type: row.type as 'stdio' | 'http' | undefined,
        command: row.command as string | undefined,
        args: row.args ? JSON.parse(row.args as string) : [],
        env: row.env ? JSON.parse(row.env as string) : {},
        url: row.url as string | undefined,
        headers: row.headers ? JSON.parse(row.headers as string) : {},
        tools: row.tools ? JSON.parse(row.tools as string) : []
      };

      this.servers.set(server.name, server);
    }

    return Array.from(this.servers.values());
  }

  /**
   * 调用 MCP 工具
   */
  async call(
    selector: string, 
    args: Record<string, unknown> = {}, 
    context: { timeout?: number } = {}
  ): Promise<{ success: boolean; data: unknown; selector: string }> {
    const timeout = context.timeout || this.options.timeout;

    // 构建命令
    const callArgs = ['call', selector];
    
    // 添加参数
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        callArgs.push(`${key}=${this._serializeValue(value)}`);
      }
    }

    // 添加 JSON 输出
    callArgs.push('--output', 'json');

    this.emit('call', { selector, args, context });

    try {
      const result = await this._executeCommand(callArgs, timeout);
      
      this.emit('result', { selector, result });
      
      return {
        success: true,
        data: result,
        selector
      };
    } catch (error) {
      this.emit('error', { selector, error });
      
      throw error;
    }
  }

  /**
   * 列出服务器
   */
  async listServers(serverName?: string | null, withSchema: boolean = false): Promise<unknown> {
    const args = ['list'];
    
    if (serverName) {
      args.push(serverName);
    }
    
    if (withSchema) {
      args.push('--schema');
    }
    
    args.push('--output', 'json');

    const result = await this._executeCommand(args);
    return result;
  }

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPServerConfig): Promise<MCPServer> {
    const {
      id,
      name,
      display_name,
      description,
      type = 'stdio',
      command,
      args = [],
      env = {},
      url,
      headers = {},
      is_public = false
    } = config;

    if (!name) {
      throw new Error('Server name is required');
    }

    const serverId = id || `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(`
      INSERT INTO mcp_servers (
        id, name, display_name, description, type,
        command, args, env, url, headers,
        enabled, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      serverId,
      name,
      display_name || name,
      description,
      type,
      command,
      JSON.stringify(args),
      JSON.stringify(env),
      url,
      JSON.stringify(headers),
      is_public ? 1 : 0,
      Date.now()
    ]);

    // 发现工具
    const tools = await this._discoverTools(name);
    
    await this.db.run(
      'UPDATE mcp_servers SET tools = ? WHERE id = ?',
      [JSON.stringify(tools), serverId]
    );

    // 刷新缓存
    await this.loadServers();

    const server = this.servers.get(name);
    if (server) {
      this.emit('server_added', server);
    }

    return server!;
  }

  /**
   * 移除 MCP 服务器
   */
  async removeServer(serverId: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM mcp_servers WHERE id = ? OR name = ?',
      [serverId, serverId]
    );

    if (result.changes > 0) {
      await this.loadServers();
      this.emit('server_removed', serverId);
      return true;
    }

    return false;
  }

  /**
   * OAuth 认证
   */
  async auth(serverName: string): Promise<unknown> {
    const args = ['auth', serverName];

    this.emit('auth_start', { serverName });

    try {
      const result = await this._executeCommand(args, 120000); // 2分钟超时
      this.emit('auth_complete', { serverName, result });
      return result;
    } catch (error) {
      this.emit('auth_error', { serverName, error });
      throw error;
    }
  }

  /**
   * 启动守护进程
   */
  async startDaemon(): Promise<{ status: string }> {
    try {
      const result = await this._executeCommand(['daemon', 'start']);
      this.emit('daemon_started', result);
      return result as { status: string };
    } catch (error) {
      // 可能已经在运行
      if ((error as Error).message.includes('already running')) {
        return { status: 'already_running' };
      }
      throw error;
    }
  }

  /**
   * 停止守护进程
   */
  async stopDaemon(): Promise<unknown> {
    const result = await this._executeCommand(['daemon', 'stop']);
    this.emit('daemon_stopped');
    return result;
  }

  /**
   * 获取守护进程状态
   */
  async daemonStatus(): Promise<unknown> {
    return this._executeCommand(['daemon', 'status']);
  }

  /**
   * 生成 CLI
   */
  async generateCLI(options: { server?: string; command?: string; output?: string }): Promise<unknown> {
    const { server, command, output } = options;
    
    const args = ['generate-cli'];
    
    if (server) {
      args.push('--server', server);
    }
    if (command) {
      args.push('--command', command);
    }
    if (output) {
      args.push('--compile', output);
    }

    return this._executeCommand(args);
  }

  /**
   * 生成 TypeScript 类型
   */
  async emitTypeScript(serverName: string, mode: string = 'types'): Promise<unknown> {
    const args = ['emit-ts', serverName, '--mode', mode];
    return this._executeCommand(args);
  }

  /**
   * 绑定用户 MCP 服务器
   */
  async bindUserServer(
    userId: string, 
    mcpId: string, 
    config: Record<string, unknown> | null = null
  ): Promise<UserMCPBinding> {
    const id = `umb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(`
      INSERT OR REPLACE INTO user_mcp_bindings (
        id, user_id, mcp_id, config, enabled, created_at
      ) VALUES (?, ?, ?, ?, 1, ?)
    `, [id, userId, mcpId, config ? JSON.stringify(config) : null, Date.now()]);

    return this.getUserBinding(userId, mcpId)!;
  }

  /**
   * 获取用户绑定
   */
  async getUserBinding(userId: string, mcpId: string): Promise<UserMCPBinding | null> {
    const row = await this.db.get(`
      SELECT * FROM user_mcp_bindings 
      WHERE user_id = ? AND mcp_id = ?
    `, [userId, mcpId]);

    if (!row) return null;

    return {
      id: row.id as string,
      user_id: row.user_id as string,
      mcp_id: row.mcp_id as string,
      config: row.config ? JSON.parse(row.config as string) : null,
      enabled: row.enabled === 1
    };
  }

  /**
   * 获取用户所有绑定
   */
  async getUserBindings(userId: string): Promise<UserMCPBinding[]> {
    const rows = await this.db.all(`
      SELECT umb.*, ms.name, ms.display_name, ms.description, ms.type
      FROM user_mcp_bindings umb
      JOIN mcp_servers ms ON umb.mcp_id = ms.id
      WHERE umb.user_id = ? AND umb.enabled = 1 AND ms.enabled = 1
    `, [userId]);

    return rows.map(row => ({
      id: row.id as string,
      user_id: row.user_id as string,
      mcp_id: row.mcp_id as string,
      config: row.config ? JSON.parse(row.config as string) : null,
      enabled: row.enabled === 1,
      name: row.name as string,
      display_name: row.display_name as string,
      description: row.description as string,
      type: row.type as string
    }));
  }

  /**
   * 执行 MCPorter 命令
   */
  private async _executeCommand(args: string[], timeout?: number): Promise<unknown> {
    const actualTimeout = timeout || this.options.timeout;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timeout after ${actualTimeout}ms`));
      }, actualTimeout);

      const child = spawn(this.options.mcporterPath, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          try {
            // 尝试解析 JSON
            if (stdout.trim()) {
              const result = JSON.parse(stdout);
              resolve(result);
            } else {
              resolve({ success: true });
            }
          } catch (e) {
            // 不是 JSON，返回原始输出
            resolve(stdout.trim());
          }
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * 发现服务器工具
   */
  private async _discoverTools(serverName: string): Promise<Array<{ name: string }>> {
    try {
      const result = await this.listServers(serverName, true) as { tools?: Array<{ name: string }> };
      
      if (result && result.tools) {
        return result.tools;
      }
      
      return [];
    } catch (error) {
      console.warn(`Failed to discover tools for ${serverName}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * 序列化值
   */
  private _serializeValue(value: unknown): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'string' && value.includes(' ')) {
      return `"${value}"`;
    }
    return String(value);
  }

  /**
   * 获取服务器
   */
  getServer(name: string): MCPServer | null {
    return this.servers.get(name) || null;
  }

  /**
   * 获取所有服务器
   */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * 检查工具是否可用
   */
  isToolAvailable(selector: string): boolean {
    const [serverName, toolName] = selector.split('.');
    
    const server = this.servers.get(serverName);
    if (!server) return false;
    
    if (!toolName) return true;
    
    return server.tools.some(tool => 
      (typeof tool === 'object' ? tool.name : tool) === toolName
    );
  }
}