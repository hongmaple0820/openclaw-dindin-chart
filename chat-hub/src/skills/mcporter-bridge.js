/**
 * MCPorter Bridge - MCP 桥接
 * 
 * 功能：
 * - 集成 MCPorter CLI
 * - 调用 MCP 工具
 * - 配置 MCP 服务器
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');

class MCPorterBridge extends EventEmitter {
  constructor(db, options = {}) {
    super();
    
    this.db = db;
    this.options = {
      mcporterPath: options.mcporterPath || 'mcporter',
      configPath: options.configPath || './config/mcporter.json',
      timeout: options.timeout || 60000,
      daemonEnabled: options.daemonEnabled !== false,
      ...options
    };

    // MCP 服务器缓存
    this.servers = new Map();
    
    // 工具缓存
    this.tools = new Map();
    
    // 初始化标志
    this._initialized = false;
  }

  /**
   * 初始化桥接
   */
  async initialize() {
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
   * @private
   */
  async _checkMCPorter() {
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
   * @returns {Promise<Array>}
   */
  async loadServers() {
    const rows = await this.db.all('SELECT * FROM mcp_servers WHERE enabled = 1');
    
    this.servers.clear();
    
    for (const row of rows) {
      const server = {
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        description: row.description,
        type: row.type,
        command: row.command,
        args: row.args ? JSON.parse(row.args) : [],
        env: row.env ? JSON.parse(row.env) : {},
        url: row.url,
        headers: row.headers ? JSON.parse(row.headers) : {},
        tools: row.tools ? JSON.parse(row.tools) : []
      };

      this.servers.set(server.name, server);
    }

    return Array.from(this.servers.values());
  }

  /**
   * 调用 MCP 工具
   * @param {string} selector - 工具选择器 (server.tool 或 URL)
   * @param {Object} args - 参数
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>}
   */
  async call(selector, args = {}, context = {}) {
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
   * @param {string} serverName - 可选，指定服务器名称
   * @param {boolean} withSchema - 是否包含工具 schema
   * @returns {Promise<Object>}
   */
  async listServers(serverName = null, withSchema = false) {
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
   * @param {Object} config - 服务器配置
   * @returns {Promise<Object>}
   */
  async addServer(config) {
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
    this.emit('server_added', server);

    return server;
  }

  /**
   * 移除 MCP 服务器
   * @param {string} serverId - 服务器ID或名称
   * @returns {Promise<boolean>}
   */
  async removeServer(serverId) {
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
   * @param {string} serverName - 服务器名称或 URL
   * @returns {Promise<Object>}
   */
  async auth(serverName) {
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
   * @returns {Promise<Object>}
   */
  async startDaemon() {
    try {
      const result = await this._executeCommand(['daemon', 'start']);
      this.emit('daemon_started', result);
      return result;
    } catch (error) {
      // 可能已经在运行
      if (error.message.includes('already running')) {
        return { status: 'already_running' };
      }
      throw error;
    }
  }

  /**
   * 停止守护进程
   * @returns {Promise<Object>}
   */
  async stopDaemon() {
    const result = await this._executeCommand(['daemon', 'stop']);
    this.emit('daemon_stopped');
    return result;
  }

  /**
   * 获取守护进程状态
   * @returns {Promise<Object>}
   */
  async daemonStatus() {
    return this._executeCommand(['daemon', 'status']);
  }

  /**
   * 生成 CLI
   * @param {Object} options - 生成选项
   * @returns {Promise<string>}
   */
  async generateCLI(options) {
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
   * @param {string} serverName - 服务器名称
   * @param {string} mode - 模式 (client 或 types)
   * @returns {Promise<string>}
   */
  async emitTypeScript(serverName, mode = 'types') {
    const args = ['emit-ts', serverName, '--mode', mode];
    return this._executeCommand(args);
  }

  /**
   * 绑定用户 MCP 服务器
   * @param {string} userId - 用户ID
   * @param {string} mcpId - MCP 服务器ID
   * @param {Object} config - 用户配置
   * @returns {Promise<Object>}
   */
  async bindUserServer(userId, mcpId, config = null) {
    const id = `umb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(`
      INSERT OR REPLACE INTO user_mcp_bindings (
        id, user_id, mcp_id, config, enabled, created_at
      ) VALUES (?, ?, ?, ?, 1, ?)
    `, [id, userId, mcpId, config ? JSON.stringify(config) : null, Date.now()]);

    return this.getUserBinding(userId, mcpId);
  }

  /**
   * 获取用户绑定
   * @param {string} userId - 用户ID
   * @param {string} mcpId - MCP 服务器ID
   * @returns {Promise<Object|null>}
   */
  async getUserBinding(userId, mcpId) {
    const row = await this.db.get(`
      SELECT * FROM user_mcp_bindings 
      WHERE user_id = ? AND mcp_id = ?
    `, [userId, mcpId]);

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      enabled: row.enabled === 1
    };
  }

  /**
   * 获取用户所有绑定
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>}
   */
  async getUserBindings(userId) {
    const rows = await this.db.all(`
      SELECT umb.*, ms.name, ms.display_name, ms.description, ms.type
      FROM user_mcp_bindings umb
      JOIN mcp_servers ms ON umb.mcp_id = ms.id
      WHERE umb.user_id = ? AND umb.enabled = 1 AND ms.enabled = 1
    `, [userId]);

    return rows.map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
      enabled: row.enabled === 1
    }));
  }

  /**
   * 执行 MCPorter 命令
   * @private
   */
  async _executeCommand(args, timeout = this.options.timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

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
   * @private
   */
  async _discoverTools(serverName) {
    try {
      const result = await this.listServers(serverName, true);
      
      if (result && result.tools) {
        return result.tools;
      }
      
      return [];
    } catch (error) {
      console.warn(`Failed to discover tools for ${serverName}:`, error.message);
      return [];
    }
  }

  /**
   * 序列化值
   * @private
   */
  _serializeValue(value) {
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
   * @param {string} name - 服务器名称
   * @returns {Object|null}
   */
  getServer(name) {
    return this.servers.get(name) || null;
  }

  /**
   * 获取所有服务器
   * @returns {Array}
   */
  getAllServers() {
    return Array.from(this.servers.values());
  }

  /**
   * 检查工具是否可用
   * @param {string} selector - 工具选择器
   * @returns {boolean}
   */
  isToolAvailable(selector) {
    const [serverName, toolName] = selector.split('.');
    
    const server = this.servers.get(serverName);
    if (!server) return false;
    
    if (!toolName) return true;
    
    return server.tools.some(tool => 
      tool.name === toolName || tool === toolName
    );
  }
}

module.exports = { MCPorterBridge };