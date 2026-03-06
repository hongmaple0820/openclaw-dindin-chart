import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import BasePlugin, { PluginConfig, InitResult, ExecuteResult, PluginInfo } from './base-plugin';

// Database types
interface Database {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get<T = unknown>(...params: unknown[]): T | undefined;
    all<T = unknown>(...params: unknown[]): T[];
  };
}

interface MessageStore {
  // Add properties as needed
}

interface PluginRow {
  id: string;
  name: string;
  type: string;
  category: string | null;
  version: string;
  description: string;
  skill_path: string | null;
  config_schema: string | null;
  config: string | null;
  enabled: number;
  priority: number;
  created_at: number;
  updated_at: number;
}

interface PluginConfigRow {
  id: string;
  plugin_id: string;
  owner_id: string;
  owner_type: string;
  config: string;
  created_at: number;
}

interface PluginBindingRow {
  id: string;
  agent_id: string;
  plugin_id: string;
  permissions: string;
  enabled: number;
  created_at: number;
  name?: string;
  type?: string;
  category?: string;
  description?: string;
}

interface RegisterOptions {
  id?: string;
  name?: string;
  type?: string;
  category?: string | null;
  version?: string;
  description?: string;
  configSchema?: unknown;
}

interface ListPluginsOptions {
  type?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

interface PluginListItem extends Omit<PluginRow, 'config_schema'> {
  config_schema: unknown;
  loaded: boolean;
}

interface PluginInfoResult extends Omit<PluginRow, 'config_schema'> {
  config_schema: unknown;
  loaded: boolean;
  instance: PluginInfo | null;
}

/**
 * 插件管理器
 * 负责插件的注册、配置、绑定和生命周期管理
 */
class PluginManager {
  private db: Database;
  private messageStore: MessageStore | null;
  private plugins: Map<string, BasePlugin>;
  private adapters: Map<string, unknown>;
  private _initialized: boolean;
  private _pluginPaths: Set<string>;

  constructor(db: Database, messageStore: MessageStore | null = null) {
    this.db = db;
    this.messageStore = messageStore;
    this.plugins = new Map();
    this.adapters = new Map();
    this._initialized = false;
    this._pluginPaths = new Set();
  }

  /**
   * 初始化插件系统
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    // 运行数据库迁移
    await this._runMigrations();

    // 加载已注册的插件
    await this._loadRegisteredPlugins();

    this._initialized = true;
    console.log('[PluginManager] 初始化完成');
  }

  /**
   * 运行数据库迁移
   */
  private async _runMigrations(): Promise<void> {
    const migrationPath = path.join(__dirname, '../../migrations/013_plugin_system.sql');
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      this.db.exec(migrationSQL);
      console.log('[PluginManager] 数据库迁移完成');
    }
  }

  /**
   * 加载已注册的插件
   */
  private async _loadRegisteredPlugins(): Promise<void> {
    const rows = this.db.prepare(`
      SELECT * FROM plugins WHERE enabled = 1 ORDER BY priority DESC
    `).all<PluginRow>();

    for (const row of rows) {
      try {
        if (row.skill_path && fs.existsSync(row.skill_path)) {
          await this._loadPluginFromPath(row.skill_path, row);
        }
      } catch (error) {
        console.error(`[PluginManager] 加载插件 ${row.id} 失败:`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * 从路径加载插件
   */
  private async _loadPluginFromPath(skillPath: string, dbRecord: PluginRow | null = null): Promise<BasePlugin> {
    const indexPath = path.join(skillPath, 'index.js');
    const pluginPath = path.join(skillPath, 'plugin.js');

    let PluginClass: new (config: PluginConfig) => BasePlugin;
    let pluginFile: string | null = null;

    if (fs.existsSync(indexPath)) {
      pluginFile = indexPath;
    } else if (fs.existsSync(pluginPath)) {
      pluginFile = pluginPath;
    } else {
      throw new Error(`No plugin entry found in ${skillPath}`);
    }

    // 清除缓存以确保重新加载
    delete require.cache[require.resolve(pluginFile)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require(pluginFile);
    PluginClass = loaded.default || loaded;

    const config: PluginConfig = dbRecord?.config ? JSON.parse(dbRecord.config) : {};
    const plugin = new PluginClass({ ...config, id: dbRecord?.id });

    // 初始化插件
    const result = await plugin.init();
    if (!result.success) {
      throw new Error(`Plugin init failed: ${result.error}`);
    }

    this.plugins.set(plugin.id, plugin);
    console.log(`[PluginManager] 加载插件: ${plugin.id} (${plugin.type})`);

    return plugin;
  }

  /**
   * 注册插件
   * @param skillPath - skill.yaml 所在目录路径
   * @param options - 注册选项
   */
  async register(skillPath: string, options: RegisterOptions = {}): Promise<InitResult & { pluginId?: string; action?: 'created' | 'updated' }> {
    if (!fs.existsSync(skillPath)) {
      return { success: false, error: `Path not found: ${skillPath}` };
    }

    // 读取 skill.yaml
    const yamlPath = path.join(skillPath, 'skill.yaml');
    let pluginMeta: Record<string, unknown> = {};

    if (fs.existsSync(yamlPath)) {
      pluginMeta = yaml.load(fs.readFileSync(yamlPath, 'utf-8')) as Record<string, unknown>;
    }

    const pluginId = options.id || (pluginMeta.id as string) || path.basename(skillPath);
    const pluginName = options.name || (pluginMeta.name as string) || pluginId;
    const pluginType = options.type || (pluginMeta.type as string) || 'unknown';
    const category = options.category ?? pluginMeta.category ?? null;
    const version = options.version || (pluginMeta.version as string) || '1.0.0';
    const description = options.description || (pluginMeta.description as string) || '';
    const configSchema = options.configSchema ?? pluginMeta.configSchema ?? null;

    // 检查是否已存在
    const existing = this.db.prepare('SELECT id FROM plugins WHERE id = ?').get<{ id: string }>(pluginId);

    const now = Date.now();

    if (existing) {
      // 更新
      this.db.prepare(`
        UPDATE plugins SET 
          name = ?, type = ?, category = ?, version = ?, description = ?,
          skill_path = ?, config_schema = ?, updated_at = ?
        WHERE id = ?
      `).run(
        pluginName, pluginType, category, version, description,
        skillPath, configSchema ? JSON.stringify(configSchema) : null,
        now, pluginId
      );
    } else {
      // 插入
      this.db.prepare(`
        INSERT INTO plugins (id, name, type, category, version, description, skill_path, config_schema, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pluginId, pluginName, pluginType, category, version, description,
        skillPath, configSchema ? JSON.stringify(configSchema) : null,
        now, now
      );
    }

    // 加载插件实例
    try {
      await this._loadPluginFromPath(skillPath, { id: pluginId } as PluginRow);
    } catch (error) {
      console.error(`[PluginManager] 加载插件实例失败:`, error instanceof Error ? error.message : error);
      // 注册成功但加载失败，仍然返回成功
    }

    return {
      success: true,
      pluginId,
      action: existing ? 'updated' : 'created'
    };
  }

  /**
   * 获取插件实例
   */
  getPlugin(pluginId: string): BasePlugin | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * 获取插件列表
   */
  listPlugins(options: ListPluginsOptions = {}): PluginListItem[] {
    const { type, enabled, limit = 100, offset = 0 } = options;

    let sql = 'SELECT * FROM plugins WHERE 1=1';
    const params: unknown[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    sql += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all<PluginRow>(...params);

    return rows.map(row => ({
      ...row,
      config_schema: row.config_schema ? JSON.parse(row.config_schema) : null,
      loaded: this.plugins.has(row.id)
    }));
  }

  /**
   * 获取插件详情
   */
  getPluginInfo(pluginId: string): PluginInfoResult | null {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get<PluginRow>(pluginId);
    if (!row) return null;

    const instance = this.plugins.get(pluginId);

    return {
      ...row,
      config_schema: row.config_schema ? JSON.parse(row.config_schema) : null,
      loaded: !!instance,
      instance: instance ? instance.getInfo() : null
    };
  }

  /**
   * 启用/禁用插件
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<InitResult> {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get<PluginRow>(pluginId);
    if (!row) {
      return { success: false, error: 'Plugin not found' };
    }

    this.db.prepare('UPDATE plugins SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, Date.now(), pluginId);

    const instance = this.plugins.get(pluginId);
    if (instance) {
      if (enabled) {
        await instance.init();
      } else {
        await instance.stop();
      }
    }

    if (!enabled) {
      this.plugins.delete(pluginId);
    }

    return { success: true };
  }

  /**
   * 配置插件
   */
  async configurePlugin(pluginId: string, ownerId: string, config: Record<string, unknown>, ownerType: string = 'agent'): Promise<InitResult & { configId?: string }> {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get<PluginRow>(pluginId);
    if (!row) {
      return { success: false, error: 'Plugin not found' };
    }

    // 验证配置
    const instance = this.plugins.get(pluginId);
    if (instance) {
      const validation = instance.validateConfig(config);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    const configId = uuidv4();
    const now = Date.now();

    // Upsert
    this.db.prepare(`
      INSERT INTO plugin_configs (id, plugin_id, owner_id, owner_type, config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(plugin_id, owner_id, owner_type) DO UPDATE SET
        config = excluded.config
    `).run(configId, pluginId, ownerId, ownerType, JSON.stringify(config), now);

    return { success: true, configId };
  }

  /**
   * 获取插件配置
   */
  getPluginConfig(pluginId: string, ownerId: string, ownerType: string = 'agent'): (PluginConfigRow & { config: Record<string, unknown> }) | null {
    const row = this.db.prepare(`
      SELECT * FROM plugin_configs 
      WHERE plugin_id = ? AND owner_id = ? AND owner_type = ?
    `).get<PluginConfigRow>(pluginId, ownerId, ownerType);

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : {}
    };
  }

  /**
   * 绑定插件到 Agent
   */
  async bindToAgent(agentId: string, pluginId: string, permissions: string[] = []): Promise<InitResult & { bindingId?: string }> {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get<PluginRow>(pluginId);
    if (!row) {
      return { success: false, error: 'Plugin not found' };
    }

    const bindingId = uuidv4();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO plugin_bindings (id, agent_id, plugin_id, permissions, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, plugin_id) DO UPDATE SET
        permissions = excluded.permissions,
        enabled = 1
    `).run(bindingId, agentId, pluginId, JSON.stringify(permissions), now);

    return { success: true, bindingId };
  }

  /**
   * 解绑插件
   */
  unbindFromAgent(agentId: string, pluginId: string): InitResult {
    const result = this.db.prepare(`
      DELETE FROM plugin_bindings WHERE agent_id = ? AND plugin_id = ?
    `).run(agentId, pluginId);

    return { success: result.changes > 0 };
  }

  /**
   * 获取 Agent 绑定的插件
   */
  getAgentPlugins(agentId: string): (PluginBindingRow & { permissions: string[]; instance: PluginInfo | null })[] {
    const rows = this.db.prepare(`
      SELECT pb.*, p.name, p.type, p.category, p.description
      FROM plugin_bindings pb
      JOIN plugins p ON pb.plugin_id = p.id
      WHERE pb.agent_id = ? AND pb.enabled = 1 AND p.enabled = 1
    `).all<PluginBindingRow>(agentId);

    return rows.map(row => ({
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      instance: this.plugins.get(row.plugin_id)?.getInfo() || null
    }));
  }

  /**
   * 删除插件
   */
  async deletePlugin(pluginId: string): Promise<InitResult> {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get<PluginRow>(pluginId);
    if (!row) {
      return { success: false, error: 'Plugin not found' };
    }

    // 停止插件实例
    const instance = this.plugins.get(pluginId);
    if (instance) {
      await instance.stop();
      this.plugins.delete(pluginId);
    }

    // 删除数据库记录（级联删除配置和绑定）
    this.db.prepare('DELETE FROM plugins WHERE id = ?').run(pluginId);

    return { success: true };
  }

  /**
   * 测试插件
   */
  async testPlugin(pluginId: string): Promise<ExecuteResult> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      return { success: false, error: 'Plugin not loaded' };
    }

    return instance.testConnection();
  }

  /**
   * 执行插件功能
   */
  async execute(pluginId: string, action: string, params: Record<string, unknown> = {}): Promise<ExecuteResult> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      return { success: false, error: 'Plugin not loaded' };
    }

    return instance.execute(action, params);
  }

  /**
   * 注册适配器
   */
  registerAdapter(name: string, adapter: unknown): void {
    this.adapters.set(name, adapter);
  }

  /**
   * 获取适配器
   */
  getAdapter(name: string): unknown | undefined {
    return this.adapters.get(name);
  }

  /**
   * 获取系统状态
   */
  getStatus(): { initialized: boolean; pluginCount: number; adapterCount: number; plugins: string[] } {
    return {
      initialized: this._initialized,
      pluginCount: this.plugins.size,
      adapterCount: this.adapters.size,
      plugins: Array.from(this.plugins.keys())
    };
  }
}

export default PluginManager;
export type { Database, MessageStore, PluginRow, PluginConfigRow, PluginBindingRow };