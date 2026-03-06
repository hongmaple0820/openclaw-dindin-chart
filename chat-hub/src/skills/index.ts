/**
 * Skills Manager - 技能系统入口
 */

import { SkillRegistry, SkillDefinition } from './registry';
import { SkillRouter, RouterOptions, CallInfo } from './router';
import { SkillExecutor, ExecutorOptions, SkillInfo } from './executor';
import { SkillLoader, LoaderOptions, Registry } from './loader';
import { MCPorterBridge, MCPorterOptions } from './mcporter-bridge';
import { MarketplaceIntegration, MarketplaceOptions } from './marketplace';
import { initSkillsTables } from './db-init';

/**
 * 技能系统配置接口
 */
interface SkillsConfig {
  skillsPath?: string[];
  builtinSkillsPath?: string;
  [key: string]: unknown;
}

/**
 * 数据库接口
 */
interface Database {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  get(sql: string, params?: unknown[]): Promise<Record<string, unknown> | undefined>;
  all(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class SkillsManager {
  db: Database;
  config: SkillsConfig;
  registry: SkillRegistry;
  router: SkillRouter;
  executor: SkillExecutor;
  loader: SkillLoader;
  mcporterBridge: MCPorterBridge;
  marketplace: MarketplaceIntegration;

  constructor(db: Database, config: SkillsConfig = {}) {
    this.db = db;
    this.config = {
      skillsPath: config.skillsPath || [],
      builtinSkillsPath: config.builtinSkillsPath,
      ...config
    };
    
    this.registry = new SkillRegistry(db, this.config);
    this.router = new SkillRouter(this.config as RouterOptions);
    this.executor = new SkillExecutor(this.registry as unknown as { db: Database; get: (id: string) => Promise<SkillInfo | null> }, this.config as ExecutorOptions);
    this.loader = new SkillLoader(this.registry as unknown as Registry, this.config as LoaderOptions);
    this.mcporterBridge = new MCPorterBridge(db, this.config as MCPorterOptions);
    this.marketplace = new MarketplaceIntegration(db, this.config as MarketplaceOptions);
  }

  async init(): Promise<void> {
    // 初始化数据库表
    await initSkillsTables(this.db);
    
    // 初始化注册表
    await this.registry.init?.();
    
    // 加载内置技能
    await this.loader.loadBuiltinSkills?.();
    
    // 初始化 MCP 桥接
    await this.mcporterBridge.initialize();
    
    console.log('[SkillsManager] 初始化完成');
  }

  /**
   * 执行技能 (#调用)
   */
  async execute(input: string, context: Record<string, unknown> = {}): Promise<{
    success: boolean;
    error?: string;
    data?: unknown;
  }> {
    // 解析技能调用
    const parsed = this.router.parse(input);
    if (!parsed) {
      return { success: false, error: '无效的技能调用格式' };
    }

    // 获取技能
    const callInfo = parsed.call as CallInfo | undefined;
    const skillName = callInfo?.skill || '';
    const skill = await this.registry.get(skillName);
    if (!skill) {
      return { success: false, error: `技能不存在: ${skillName}` };
    }

    // 执行
    const params = (callInfo?.params || {}) as Record<string, unknown>;
    return this.executor.execute(skill.id, params, context);
  }

  /**
   * 注册技能
   */
  async register(skill: SkillDefinition): Promise<{ id: string; name: string; version: string; registered: boolean }> {
    return this.registry.register(skill);
  }

  /**
   * 获取技能列表
   */
  async list(filter: Record<string, unknown> = {}): Promise<SkillDefinition[]> {
    return this.registry.list(filter);
  }

  /**
   * 调用 MCP 工具
   */
  async callMCP(server: string, tool: string, params: Record<string, unknown>): Promise<unknown> {
    return this.mcporterBridge.call(`${server}.${tool}`, params);
  }
}

export { 
  SkillRegistry, 
  SkillRouter, 
  SkillExecutor, 
  SkillLoader, 
  MCPorterBridge,
  MarketplaceIntegration
};