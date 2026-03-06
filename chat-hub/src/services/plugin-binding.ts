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

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

interface UserPluginBinding {
  id: string;
  user_id: string;
  plugin_id: string;
  config: Record<string, unknown>;
  enabled: number;
  created_at: number;
  updated_at: number;
  name?: string;
  type?: string;
  category?: string;
  description?: string;
  version?: string;
}

interface GroupPluginBinding {
  id: string;
  group_id: string;
  plugin_id: string;
  config: Record<string, unknown>;
  operator_id: string;
  enabled: number;
  created_at: number;
  updated_at: number;
  name?: string;
  type?: string;
  category?: string;
  description?: string;
  version?: string;
}

interface GroupWebhook {
  id: string;
  group_id: string;
  channel: string;
  webhook_url: string;
  secret?: string;
  operator_id: string;
  enabled: number;
  created_at: number;
  updated_at: number;
  hasSecret?: boolean;
}

interface ChannelResult {
  type: 'webhook' | 'group_plugin' | 'user_plugin' | null;
  config: {
    url?: string;
    secret?: string;
    channel?: string;
    pluginId?: string;
    pluginName?: string;
    pluginType?: string;
    config?: Record<string, unknown>;
  } | null;
}

interface AvailablePluginsResult {
  userPlugins: UserPluginBinding[];
  groupPlugins: GroupPluginBinding[];
  webhook: GroupWebhook | null;
  channel: 'webhook' | 'group_plugin' | 'user_plugin' | null;
}

interface Stats {
  userBindings: number;
  groupBindings: number;
  webhooks: number;
}

interface DingtalkApi {
  getGroupOwner?(groupId: string): Promise<string>;
}

interface PluginRow {
  id: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  version?: string;
}

// ==================== 服务类 ====================

class PluginBindingService {
  private db: Database.Database | null = null;
  private initialized: boolean = false;
  private dingtalkApi: DingtalkApi | null = null;

  /**
   * 初始化数据库连接
   */
  init(): void {
    if (this.initialized) return;

    // 使用与 message-store 相同的数据目录
    const storeDir = path.join(process.env.HOME || '', '.openclaw', 'chat-data');
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
  private runMigrations(): void {
    if (!this.db) return;

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
  setDingtalkApi(api: DingtalkApi): void {
    this.dingtalkApi = api;
  }

  // ==================== 用户级插件绑定 ====================

  /**
   * 绑定用户插件
   */
  async bindUserPlugin(userId: string, pluginId: string, config: Record<string, unknown> = {}): Promise<UserPluginBinding> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

    // 检查插件是否存在
    const plugin = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId) as PluginRow | undefined;
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

      return this.getUserPlugin(userId, pluginId)!;
    } catch (error) {
      console.error('[PluginBindingService] 绑定用户插件失败:', error);
      throw error;
    }
  }

  /**
   * 解绑用户插件
   */
  async unbindUserPlugin(userId: string, pluginId: string): Promise<boolean> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.prepare(`
      DELETE FROM user_plugin_bindings WHERE user_id = ? AND plugin_id = ?
    `).run(userId, pluginId);

    return result.changes > 0;
  }

  /**
   * 获取用户插件绑定详情
   */
  getUserPlugin(userId: string, pluginId: string): UserPluginBinding | undefined {
    this.init();
    if (!this.db) return undefined;

    const binding = this.db.prepare(`
      SELECT upb.*, p.name, p.type, p.category, p.description
      FROM user_plugin_bindings upb
      LEFT JOIN plugins p ON upb.plugin_id = p.id
      WHERE upb.user_id = ? AND upb.plugin_id = ?
    `).get(userId, pluginId) as any;

    if (binding && binding.config) {
      binding.config = JSON.parse(binding.config);
    }

    return binding;
  }

  /**
   * 获取用户插件列表
   */
  async getUserPlugins(userId: string): Promise<UserPluginBinding[]> {
    this.init();
    if (!this.db) return [];

    const bindings = this.db.prepare(`
      SELECT upb.*, p.name, p.type, p.category, p.description, p.version
      FROM user_plugin_bindings upb
      LEFT JOIN plugins p ON upb.plugin_id = p.id
      WHERE upb.user_id = ? AND upb.enabled = 1
      ORDER BY upb.created_at DESC
    `).all(userId) as any[];

    return bindings.map(b => ({
      ...b,
      config: b.config ? JSON.parse(b.config) : {}
    }));
  }

  /**
   * 获取用户可用插件（用户级 + 群聊级）
   */
  async getAvailablePlugins(userId: string, groupId: string | null = null): Promise<AvailablePluginsResult> {
    this.init();

    const result: AvailablePluginsResult = {
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
   */
  async isGroupOwner(groupId: string, userId: string): Promise<boolean> {
    this.init();
    if (!this.db) return false;

    // 先检查本地群组表
    const localGroup = this.db.prepare(`
      SELECT owner_id FROM chat_groups WHERE id = ?
    `).get(groupId) as { owner_id: string } | undefined;

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
   */
  async bindGroupPlugin(groupId: string, pluginId: string, config: Record<string, unknown> = {}, operatorId: string): Promise<GroupPluginBinding> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

    // 检查插件是否存在
    const plugin = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId) as PluginRow | undefined;
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

      return this.getGroupPlugin(groupId, pluginId)!;
    } catch (error) {
      console.error('[PluginBindingService] 绑定群聊插件失败:', error);
      throw error;
    }
  }

  /**
   * 解绑群聊插件（仅群主）
   */
  async unbindGroupPlugin(groupId: string, pluginId: string, operatorId: string): Promise<boolean> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

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
   */
  getGroupPlugin(groupId: string, pluginId: string): GroupPluginBinding | undefined {
    this.init();
    if (!this.db) return undefined;

    const binding = this.db.prepare(`
      SELECT gpb.*, p.name, p.type, p.category, p.description
      FROM group_plugin_bindings gpb
      LEFT JOIN plugins p ON gpb.plugin_id = p.id
      WHERE gpb.group_id = ? AND gpb.plugin_id = ?
    `).get(groupId, pluginId) as any;

    if (binding && binding.config) {
      binding.config = JSON.parse(binding.config);
    }

    return binding;
  }

  /**
   * 获取群聊插件列表
   */
  async getGroupPlugins(groupId: string): Promise<GroupPluginBinding[]> {
    this.init();
    if (!this.db) return [];

    const bindings = this.db.prepare(`
      SELECT gpb.*, p.name, p.type, p.category, p.description, p.version
      FROM group_plugin_bindings gpb
      LEFT JOIN plugins p ON gpb.plugin_id = p.id
      WHERE gpb.group_id = ? AND gpb.enabled = 1
      ORDER BY gpb.created_at DESC
    `).all(groupId) as any[];

    return bindings.map(b => ({
      ...b,
      config: b.config ? JSON.parse(b.config) : {}
    }));
  }

  // ==================== 群聊 Webhook 管理 ====================

  /**
   * 设置群聊 Webhook（仅群主）
   */
  async setGroupWebhook(groupId: string, channel: string, webhookUrl: string, secret: string | null = null, operatorId: string): Promise<GroupWebhook> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

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

      return this.getGroupWebhook(groupId, channel)!;
    } catch (error) {
      console.error('[PluginBindingService] 设置 Webhook 失败:', error);
      throw error;
    }
  }

  /**
   * 删除群聊 Webhook（仅群主）
   */
  async removeGroupWebhook(groupId: string, channel: string, operatorId: string): Promise<boolean> {
    this.init();
    if (!this.db) throw new Error('Database not initialized');

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
   */
  getGroupWebhook(groupId: string, channel: string): GroupWebhook | null {
    this.init();
    if (!this.db) return null;

    const webhook = this.db.prepare(`
      SELECT * FROM group_webhooks 
      WHERE group_id = ? AND channel = ? AND enabled = 1
    `).get(groupId, channel) as any;

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
   */
  getGroupWebhooks(groupId: string): Omit<GroupWebhook, 'secret'>[] {
    this.init();
    if (!this.db) return [];

    const webhooks = this.db.prepare(`
      SELECT id, group_id, channel, webhook_url, operator_id, enabled, created_at, updated_at
      FROM group_webhooks 
      WHERE group_id = ? AND enabled = 1
      ORDER BY created_at DESC
    `).all(groupId) as Omit<GroupWebhook, 'secret'>[];

    return webhooks;
  }

  /**
   * 检查群聊是否有 Webhook
   */
  hasWebhook(groupId: string, channel: string): boolean {
    this.init();
    if (!this.db) return false;

    const webhook = this.db.prepare(`
      SELECT id FROM group_webhooks 
      WHERE group_id = ? AND channel = ? AND enabled = 1
    `).get(groupId, channel);

    return !!webhook;
  }

  // ==================== 通道选择器 ====================

  /**
   * 选择发送通道
   */
  async selectChannel(groupId: string | null, userId: string): Promise<ChannelResult> {
    this.init();
    if (!this.db) return { type: null, config: null };

    // 群聊场景
    if (groupId) {
      // 1. 检查是否有 Webhook（优先级最高）
      const webhook = this.db.prepare(`
        SELECT * FROM group_webhooks 
        WHERE group_id = ? AND enabled = 1
      `).get(groupId) as any;

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
      `).all(groupId) as any[];

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
      `).get(userId) as any;

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
    `).get(userId) as any;

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
  getStats(): Stats {
    this.init();
    if (!this.db) return { userBindings: 0, groupBindings: 0, webhooks: 0 };

    const userBindings = (this.db.prepare('SELECT COUNT(*) as count FROM user_plugin_bindings').get() as { count: number }).count;
    const groupBindings = (this.db.prepare('SELECT COUNT(*) as count FROM group_plugin_bindings').get() as { count: number }).count;
    const webhooks = (this.db.prepare('SELECT COUNT(*) as count FROM group_webhooks').get() as { count: number }).count;

    return {
      userBindings,
      groupBindings,
      webhooks
    };
  }
}

// 单例
const pluginBindingService = new PluginBindingService();

export default pluginBindingService;
export { PluginBindingService };