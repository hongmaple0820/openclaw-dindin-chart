/**
 * 插件层级绑定服务
 * 
 * 功能：
 * - 用户级插件绑定
 * - 群聊级插件绑定
 * - 群聊 Webhook 管理
 * - 通道选择器
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class PluginBindingService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.dingtalkApi = null; // 钉钉 API 实例，用于检查群主
  }

  /**
   * 初始化数据库连接
   */
  init() {
    if (this.initialized) return;

    // 使用与 message-store 相同的数据目录
    const storeDir = path.join(process.env.HOME, '.openclaw', 'chat-data');
    const dbPath = path.join(storeDir, 'messages.db');

    // 确保目录存在
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }

    // 连接到现有的数据库
    this.db = new Database(dbPath, {
      timeout: 10000
    });

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');

    // 运行迁移
    this.runMigrations();

    this.initialized = true;
    console.log('[PluginBindingService] 初始化完成');
  }

  /**
   * 运行数据库迁移
   */
  runMigrations() {
    // 检查表是否存在
    const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_plugin_bindings'
    `).get();

    if (!tableExists) {
      console.log('[PluginBindingService] 创建插件绑定表...');
      
      this.db.exec(`
        -- 用户级插件绑定表
        CREATE TABLE IF NOT EXISTS user_plugin_bindings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          plugin_id TEXT NOT NULL,
          config TEXT,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          UNIQUE(user_id, plugin_id)
        );

        -- 群聊级插件绑定表
        CREATE TABLE IF NOT EXISTS group_plugin_bindings (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          plugin_id TEXT NOT NULL,
          config TEXT,
          operator_id TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          UNIQUE(group_id, plugin_id)
        );

        -- 群聊 Webhook 表（与插件二选一）
        CREATE TABLE IF NOT EXISTS group_webhooks (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          webhook_url TEXT NOT NULL,
          secret TEXT,
          operator_id TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          UNIQUE(group_id, channel)
        );

        -- 索引
        CREATE INDEX IF NOT EXISTS idx_user_plugin_bindings_user ON user_plugin_bindings(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_plugin_bindings_plugin ON user_plugin_bindings(plugin_id);
        CREATE INDEX IF NOT EXISTS idx_group_plugin_bindings_group ON group_plugin_bindings(group_id);
        CREATE INDEX IF NOT EXISTS idx_group_plugin_bindings_plugin ON group_plugin_bindings(plugin_id);
        CREATE INDEX IF NOT EXISTS idx_group_webhooks_group ON group_webhooks(group_id);
        CREATE INDEX IF NOT EXISTS idx_group_webhooks_channel ON group_webhooks(channel);
      `);

      console.log('[PluginBindingService] 插件绑定表创建完成');
    }
  }

  /**
   * 设置钉钉 API 实例
   */
  setDingtalkApi(api) {
    this.dingtalkApi = api;
  }

  // ==================== 用户级插件绑定 ====================

  /**
   * 绑定用户插件
   * @param {string} userId - 用户 ID
   * @param {string} pluginId - 插件 ID
   * @param {object} config - 插件配置
   */
  async bindUserPlugin(userId, pluginId, config = {}) {
    this.init();

    // 检查插件是否存在
    const plugin = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
    if (!plugin) {
      throw new Error('插件不存在');
    }

    const id = uuidv4();
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO user_plugin_bindings (id, user_id, plugin_id, config, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, plugin_id) DO UPDATE SET
          config = excluded.config,
          enabled = 1,
          updated_at = excluded.updated_at
      `).run(id, userId, pluginId, JSON.stringify(config), now, now);

      return this.getUserPlugin(userId, pluginId);
    } catch (error) {
      console.error('[PluginBindingService] 绑定用户插件失败:', error);
      throw error;
    }
  }

  /**
   * 解绑用户插件
   * @param {string} userId - 用户 ID
   * @param {string} pluginId - 插件 ID
   */
  async unbindUserPlugin(userId, pluginId) {
    this.init();

    const result = this.db.prepare(`
      DELETE FROM user_plugin_bindings WHERE user_id = ? AND plugin_id = ?
    `).run(userId, pluginId);

    return result.changes > 0;
  }

  /**
   * 获取用户插件绑定详情
   * @param {string} userId - 用户 ID
   * @param {string} pluginId - 插件 ID
   */
  getUserPlugin(userId, pluginId) {
    this.init();

    const binding = this.db.prepare(`
      SELECT upb.*, p.name, p.type, p.category, p.description
      FROM user_plugin_bindings upb
      LEFT JOIN plugins p ON upb.plugin_id = p.id
      WHERE upb.user_id = ? AND upb.plugin_id = ?
    `).get(userId, pluginId);

    if (binding && binding.config) {
      binding.config = JSON.parse(binding.config);
    }

    return binding;
  }

  /**
   * 获取用户插件列表
   * @param {string} userId - 用户 ID
   */
  async getUserPlugins(userId) {
    this.init();

    const bindings = this.db.prepare(`
      SELECT upb.*, p.name, p.type, p.category, p.description, p.version
      FROM user_plugin_bindings upb
      LEFT JOIN plugins p ON upb.plugin_id = p.id
      WHERE upb.user_id = ? AND upb.enabled = 1
      ORDER BY upb.created_at DESC
    `).all(userId);

    return bindings.map(b => ({
      ...b,
      config: b.config ? JSON.parse(b.config) : {}
    }));
  }

  /**
   * 获取用户可用插件（用户级 + 群聊级）
   * @param {string} userId - 用户 ID
   * @param {string} groupId - 群聊 ID（可选）
   */
  async getAvailablePlugins(userId, groupId = null) {
    this.init();

    const result = {
      userPlugins: [],
      groupPlugins: [],
      webhook: null,
      channel: null
    };

    // 获取用户级插件
    result.userPlugins = await this.getUserPlugins(userId);

    // 如果是群聊场景，获取群聊级配置
    if (groupId) {
      // 检查是否有 Webhook（优先级最高）
      result.webhook = this.getGroupWebhook(groupId, 'dingtalk');
      
      if (result.webhook) {
        result.channel = 'webhook';
      } else {
        // 获取群聊级插件
        result.groupPlugins = await this.getGroupPlugins(groupId);
        
        if (result.groupPlugins.length > 0) {
          result.channel = 'group_plugin';
        } else if (result.userPlugins.length > 0) {
          result.channel = 'user_plugin';
        }
      }
    } else {
      // 私聊场景，只能使用用户级插件
      if (result.userPlugins.length > 0) {
        result.channel = 'user_plugin';
      }
    }

    return result;
  }

  // ==================== 群聊级插件绑定 ====================

  /**
   * 检查是否是群主
   * @param {string} groupId - 群聊 ID
   * @param {string} userId - 用户 ID
   */
  async isGroupOwner(groupId, userId) {
    this.init();

    // 先检查本地群组表
    const localGroup = this.db.prepare(`
      SELECT owner_id FROM chat_groups WHERE id = ?
    `).get(groupId);

    if (localGroup) {
      return localGroup.owner_id === userId;
    }

    // 如果有钉钉 API，调用接口检查
    if (this.dingtalkApi && this.dingtalkApi.getGroupOwner) {
      try {
        const owner = await this.dingtalkApi.getGroupOwner(groupId);
        return owner === userId;
      } catch (error) {
        console.error('[PluginBindingService] 获取群主失败:', error);
        return false;
      }
    }

    // 默认返回 false
    return false;
  }

  /**
   * 绑定群聊插件（仅群主）
   * @param {string} groupId - 群聊 ID
   * @param {string} pluginId - 插件 ID
   * @param {object} config - 插件配置
   * @param {string} operatorId - 操作者 ID
   */
  async bindGroupPlugin(groupId, pluginId, config = {}, operatorId) {
    this.init();

    // 检查插件是否存在
    const plugin = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId);
    if (!plugin) {
      throw new Error('插件不存在');
    }

    // 检查是否是群主
    const isOwner = await this.isGroupOwner(groupId, operatorId);
    if (!isOwner) {
      throw new Error('只有群主才能绑定群聊插件');
    }

    // 检查是否已有 Webhook（互斥）
    const webhook = this.getGroupWebhook(groupId, 'dingtalk');
    if (webhook) {
      throw new Error('该群聊已配置 Webhook，请先删除 Webhook 再绑定插件');
    }

    const id = uuidv4();
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO group_plugin_bindings (id, group_id, plugin_id, config, operator_id, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(group_id, plugin_id) DO UPDATE SET
          config = excluded.config,
          operator_id = excluded.operator_id,
          enabled = 1,
          updated_at = excluded.updated_at
      `).run(id, groupId, pluginId, JSON.stringify(config), operatorId, now, now);

      return this.getGroupPlugin(groupId, pluginId);
    } catch (error) {
      console.error('[PluginBindingService] 绑定群聊插件失败:', error);
      throw error;
    }
  }

  /**
   * 解绑群聊插件（仅群主）
   * @param {string} groupId - 群聊 ID
   * @param {string} pluginId - 插件 ID
   * @param {string} operatorId - 操作者 ID
   */
  async unbindGroupPlugin(groupId, pluginId, operatorId) {
    this.init();

    // 检查是否是群主
    const isOwner = await this.isGroupOwner(groupId, operatorId);
    if (!isOwner) {
      throw new Error('只有群主才能解绑群聊插件');
    }

    const result = this.db.prepare(`
      DELETE FROM group_plugin_bindings WHERE group_id = ? AND plugin_id = ?
    `).run(groupId, pluginId);

    return result.changes > 0;
  }

  /**
   * 获取群聊插件绑定详情
   * @param {string} groupId - 群聊 ID
   * @param {string} pluginId - 插件 ID
   */
  getGroupPlugin(groupId, pluginId) {
    this.init();

    const binding = this.db.prepare(`
      SELECT gpb.*, p.name, p.type, p.category, p.description
      FROM group_plugin_bindings gpb
      LEFT JOIN plugins p ON gpb.plugin_id = p.id
      WHERE gpb.group_id = ? AND gpb.plugin_id = ?
    `).get(groupId, pluginId);

    if (binding && binding.config) {
      binding.config = JSON.parse(binding.config);
    }

    return binding;
  }

  /**
   * 获取群聊插件列表
   * @param {string} groupId - 群聊 ID
   */
  async getGroupPlugins(groupId) {
    this.init();

    const bindings = this.db.prepare(`
      SELECT gpb.*, p.name, p.type, p.category, p.description, p.version
      FROM group_plugin_bindings gpb
      LEFT JOIN plugins p ON gpb.plugin_id = p.id
      WHERE gpb.group_id = ? AND gpb.enabled = 1
      ORDER BY gpb.created_at DESC
    `).all(groupId);

    return bindings.map(b => ({
      ...b,
      config: b.config ? JSON.parse(b.config) : {}
    }));
  }

  // ==================== 群聊 Webhook 管理 ====================

  /**
   * 设置群聊 Webhook（仅群主）
   * @param {string} groupId - 群聊 ID
   * @param {string} channel - 通道类型（dingtalk, wecom 等）
   * @param {string} webhookUrl - Webhook URL
   * @param {string} secret - 签名密钥
   * @param {string} operatorId - 操作者 ID
   */
  async setGroupWebhook(groupId, channel, webhookUrl, secret = null, operatorId) {
    this.init();

    // 检查是否是群主
    const isOwner = await this.isGroupOwner(groupId, operatorId);
    if (!isOwner) {
      throw new Error('只有群主才能设置 Webhook');
    }

    // 检查是否已有群聊插件（互斥）
    const plugins = await this.getGroupPlugins(groupId);
    if (plugins.length > 0) {
      throw new Error('该群聊已绑定插件，请先解绑插件再设置 Webhook');
    }

    const id = uuidv4();
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO group_webhooks (id, group_id, channel, webhook_url, secret, operator_id, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(group_id, channel) DO UPDATE SET
          webhook_url = excluded.webhook_url,
          secret = excluded.secret,
          operator_id = excluded.operator_id,
          enabled = 1,
          updated_at = excluded.updated_at
      `).run(id, groupId, channel, webhookUrl, secret, operatorId, now, now);

      return this.getGroupWebhook(groupId, channel);
    } catch (error) {
      console.error('[PluginBindingService] 设置 Webhook 失败:', error);
      throw error;
    }
  }

  /**
   * 删除群聊 Webhook（仅群主）
   * @param {string} groupId - 群聊 ID
   * @param {string} channel - 通道类型
   * @param {string} operatorId - 操作者 ID
   */
  async removeGroupWebhook(groupId, channel, operatorId) {
    this.init();

    // 检查是否是群主
    const isOwner = await this.isGroupOwner(groupId, operatorId);
    if (!isOwner) {
      throw new Error('只有群主才能删除 Webhook');
    }

    const result = this.db.prepare(`
      DELETE FROM group_webhooks WHERE group_id = ? AND channel = ?
    `).run(groupId, channel);

    return result.changes > 0;
  }

  /**
   * 获取群聊 Webhook
   * @param {string} groupId - 群聊 ID
   * @param {string} channel - 通道类型
   */
  getGroupWebhook(groupId, channel) {
    this.init();

    const webhook = this.db.prepare(`
      SELECT * FROM group_webhooks 
      WHERE group_id = ? AND channel = ? AND enabled = 1
    `).get(groupId, channel);

    // 不返回 secret 给外部
    if (webhook) {
      const { secret, ...safeWebhook } = webhook;
      return {
        ...safeWebhook,
        hasSecret: !!secret
      };
    }

    return null;
  }

  /**
   * 获取群聊所有 Webhook
   * @param {string} groupId - 群聊 ID
   */
  getGroupWebhooks(groupId) {
    this.init();

    const webhooks = this.db.prepare(`
      SELECT id, group_id, channel, webhook_url, operator_id, enabled, created_at, updated_at
      FROM group_webhooks 
      WHERE group_id = ? AND enabled = 1
      ORDER BY created_at DESC
    `).all(groupId);

    return webhooks;
  }

  /**
   * 检查群聊是否有 Webhook
   * @param {string} groupId - 群聊 ID
   * @param {string} channel - 通道类型
   */
  hasWebhook(groupId, channel) {
    this.init();

    const webhook = this.db.prepare(`
      SELECT id FROM group_webhooks 
      WHERE group_id = ? AND channel = ? AND enabled = 1
    `).get(groupId, channel);

    return !!webhook;
  }

  // ==================== 通道选择器 ====================

  /**
   * 选择发送通道
   * @param {string} groupId - 群聊 ID（可选，私聊时为 null）
   * @param {string} userId - 用户 ID
   * @returns {object} 通道信息 { type: 'webhook'|'group_plugin'|'user_plugin', config: {...} }
   */
  async selectChannel(groupId, userId) {
    this.init();

    // 群聊场景
    if (groupId) {
      // 1. 检查是否有 Webhook（优先级最高）
      const webhook = this.db.prepare(`
        SELECT * FROM group_webhooks 
        WHERE group_id = ? AND enabled = 1
      `).get(groupId);

      if (webhook) {
        return {
          type: 'webhook',
          config: {
            url: webhook.webhook_url,
            secret: webhook.secret,
            channel: webhook.channel
          }
        };
      }

      // 2. 检查是否有群聊级插件
      const groupPlugins = this.db.prepare(`
        SELECT gpb.*, p.name, p.type
        FROM group_plugin_bindings gpb
        LEFT JOIN plugins p ON gpb.plugin_id = p.id
        WHERE gpb.group_id = ? AND gpb.enabled = 1
        ORDER BY gpb.created_at DESC
        LIMIT 1
      `).all(groupId);

      if (groupPlugins.length > 0) {
        const plugin = groupPlugins[0];
        return {
          type: 'group_plugin',
          config: {
            pluginId: plugin.plugin_id,
            pluginName: plugin.name,
            pluginType: plugin.type,
            config: plugin.config ? JSON.parse(plugin.config) : {}
          }
        };
      }

      // 3. 检查用户级插件
      const userPlugin = this.db.prepare(`
        SELECT upb.*, p.name, p.type
        FROM user_plugin_bindings upb
        LEFT JOIN plugins p ON upb.plugin_id = p.id
        WHERE upb.user_id = ? AND upb.enabled = 1
        ORDER BY upb.created_at DESC
        LIMIT 1
      `).get(userId);

      if (userPlugin) {
        return {
          type: 'user_plugin',
          config: {
            pluginId: userPlugin.plugin_id,
            pluginName: userPlugin.name,
            pluginType: userPlugin.type,
            config: userPlugin.config ? JSON.parse(userPlugin.config) : {}
          }
        };
      }

      // 没有可用通道
      return {
        type: null,
        config: null
      };
    }

    // 私聊场景：只能使用用户级插件
    const userPlugin = this.db.prepare(`
      SELECT upb.*, p.name, p.type
      FROM user_plugin_bindings upb
      LEFT JOIN plugins p ON upb.plugin_id = p.id
      WHERE upb.user_id = ? AND upb.enabled = 1
      ORDER BY upb.created_at DESC
      LIMIT 1
    `).get(userId);

    if (userPlugin) {
      return {
        type: 'user_plugin',
        config: {
          pluginId: userPlugin.plugin_id,
          pluginName: userPlugin.name,
          pluginType: userPlugin.type,
          config: userPlugin.config ? JSON.parse(userPlugin.config) : {}
        }
      };
    }

    return {
      type: null,
      config: null
    };
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  getStats() {
    this.init();

    const userBindings = this.db.prepare('SELECT COUNT(*) as count FROM user_plugin_bindings').get().count;
    const groupBindings = this.db.prepare('SELECT COUNT(*) as count FROM group_plugin_bindings').get().count;
    const webhooks = this.db.prepare('SELECT COUNT(*) as count FROM group_webhooks').get().count;

    return {
      userBindings,
      groupBindings,
      webhooks
    };
  }
}

// 单例
const pluginBindingService = new PluginBindingService();

module.exports = pluginBindingService;
