const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

/**
 * 插件管理器
 * 负责插件的注册、配置、绑定和生命周期管理
 */
class PluginManager {
  constructor(db, messageStore = null) {
    this.db = db;
    this.messageStore = messageStore;
    this.plugins = new Map();         // 已加载的插件实例
    this.adapters = new Map();         // 插件适配器
    this._initialized = false;
    this._pluginPaths = new Set();    // 插件搜索路径
  }

  /**
   * 初始化插件系统
   */
  async init() {
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
  async _runMigrations() {
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
  async _loadRegisteredPlugins() {
    const rows = this.db.prepare(`
      SELECT * FROM plugins WHERE enabled = 1 ORDER BY priority DESC
    `).all();
    
    for (const row of rows) {
      try {
        if (row.skill_path && fs.existsSync(row.skill_path)) {
          await this._loadPluginFromPath(row.skill_path, row);
        }
      } catch (error) {
        console.error(`[PluginManager] 加载插件 ${row.id} 失败:`, error.message);
      }
    }
  }

  /**
   * 从路径加载插件
   */
  async _loadPluginFromPath(skillPath, dbRecord = null) {
    const indexPath = path.join(skillPath, 'index.js');
    const pluginPath = path.join(skillPath, 'plugin.js');
    
    let PluginClass;
    let pluginFile = null;
    
    if (fs.existsSync(indexPath)) {
      pluginFile = indexPath;
    } else if (fs.existsSync(pluginPath)) {
      pluginFile = pluginPath;
    } else {
      throw new Error(`No plugin entry found in ${skillPath}`);
    }
    
    // 清除缓存以确保重新加载
    delete require.cache[require.resolve(pluginFile)];
    PluginClass = require(pluginFile);
    
    // 处理不同导出格式
    if (PluginClass.default) {
      PluginClass = PluginClass.default;
    }
    
    const config = dbRecord?.config ? JSON.parse(dbRecord.config) : {};
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
   * @param {string} skillPath - skill.yaml 所在目录路径
   * @param {object} options - 注册选项
   */
  async register(skillPath, options = {}) {
    if (!fs.existsSync(skillPath)) {
      return { success: false, error: `Path not found: ${skillPath}` };
    }
    
    // 读取 skill.yaml
    const yamlPath = path.join(skillPath, 'skill.yaml');
    let pluginMeta = {};
    
    if (fs.existsSync(yamlPath)) {
      const yaml = require('js-yaml');
      pluginMeta = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
    }
    
    const pluginId = options.id || pluginMeta.id || path.basename(skillPath);
    const pluginName = options.name || pluginMeta.name || pluginId;
    const pluginType = options.type || pluginMeta.type || 'unknown';
    const category = options.category || pluginMeta.category || null;
    const version = options.version || pluginMeta.version || '1.0.0';
    const description = options.description || pluginMeta.description || '';
    const configSchema = options.configSchema || pluginMeta.configSchema || null;
    
    // 检查是否已存在
    const existing = this.db.prepare('SELECT id FROM plugins WHERE id = ?').get(pluginId);
    
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
      await this._loadPluginFromPath(skillPath, { id: pluginId });
    } catch (error) {
      console.error(`[PluginManager] 加载插件实例失败:`, error.message);
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
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * 获取插件列表
   */
  listPlugins(options = {}) {
    const { type, enabled, limit = 100, offset = 0 } = options;
    
    let sql = 'SELECT * FROM plugins WHERE 1=1';
    const params = [];
    
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
    
    const rows = this.db.prepare(sql).all(...params);
    
    return rows.map(row => ({
      ...row,
      config_schema: row.config_schema ? JSON.parse(row.config_schema) : null,
      loaded: this.plugins.has(row.id)
    }));
  }

  /**
   * 获取插件详情
   */
  getPluginInfo(pluginId) {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
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
  async togglePlugin(pluginId, enabled) {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
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
    
    return { success: true, enabled };
  }

  /**
   * 配置插件
   */
  async configurePlugin(pluginId, ownerId, config, ownerType = 'agent') {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
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
  getPluginConfig(pluginId, ownerId, ownerType = 'agent') {
    const row = this.db.prepare(`
      SELECT * FROM plugin_configs 
      WHERE plugin_id = ? AND owner_id = ? AND owner_type = ?
    `).get(pluginId, ownerId, ownerType);
    
    if (!row) return null;
    
    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : {}
    };
  }

  /**
   * 绑定插件到 Agent
   */
  async bindToAgent(agentId, pluginId, permissions = []) {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
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
  unbindFromAgent(agentId, pluginId) {
    const result = this.db.prepare(`
      DELETE FROM plugin_bindings WHERE agent_id = ? AND plugin_id = ?
    `).run(agentId, pluginId);
    
    return { success: result.changes > 0 };
  }

  /**
   * 获取 Agent 绑定的插件
   */
  getAgentPlugins(agentId) {
    const rows = this.db.prepare(`
      SELECT pb.*, p.name, p.type, p.category, p.description
      FROM plugin_bindings pb
      JOIN plugins p ON pb.plugin_id = p.id
      WHERE pb.agent_id = ? AND pb.enabled = 1 AND p.enabled = 1
    `).all(agentId);
    
    return rows.map(row => ({
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      instance: this.plugins.get(row.plugin_id)?.getInfo() || null
    }));
  }

  /**
   * 删除插件
   */
  async deletePlugin(pluginId) {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
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
  async testPlugin(pluginId) {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      return { success: false, error: 'Plugin not loaded' };
    }
    
    return instance.testConnection();
  }

  /**
   * 执行插件功能
   */
  async execute(pluginId, action, params = {}) {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      return { success: false, error: 'Plugin not loaded' };
    }
    
    return instance.execute(action, params);
  }

  /**
   * 注册适配器
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
  }

  /**
   * 获取适配器
   */
  getAdapter(name) {
    return this.adapters.get(name);
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    return {
      initialized: this._initialized,
      pluginCount: this.plugins.size,
      adapterCount: this.adapters.size,
      plugins: Array.from(this.plugins.keys())
    };
  }
}

module.exports = PluginManager;
