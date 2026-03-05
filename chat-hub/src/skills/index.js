/**
 * Skills Manager - 技能系统入口
 */

const { SkillRegistry } = require('./registry');
const { SkillRouter } = require('./router');
const { SkillExecutor } = require('./executor');
const { SkillLoader } = require('./loader');
const { MCPorterBridge } = require('./mcporter-bridge');
const { initSkillsTables } = require('./db-init');

class SkillsManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      skillsPath: config.skillsPath || [],
      builtinSkillsPath: config.builtinSkillsPath,
      ...config
    };
    
    this.registry = new SkillRegistry(db, this.config);
    this.router = new SkillRouter(db, this.config);
    this.executor = new SkillExecutor(db, this.config);
    this.loader = new SkillLoader(db, this.config);
    this.mcporterBridge = new MCPorterBridge(db, this.config);
  }

  async init() {
    // 初始化数据库表
    await initSkillsTables(this.db);
    
    // 初始化注册表
    await this.registry.init();
    
    // 加载内置技能
    await this.loader.loadBuiltinSkills();
    
    // 初始化 MCP 桥接
    await this.mcporterBridge.init();
    
    console.log('[SkillsManager] 初始化完成');
  }

  /**
   * 执行技能 (#调用)
   */
  async execute(input, context = {}) {
    // 解析技能调用
    const parsed = this.router.parse(input);
    if (!parsed) {
      return { success: false, error: '无效的技能调用格式' };
    }

    // 获取技能
    const skill = await this.registry.get(parsed.skillName);
    if (!skill) {
      return { success: false, error: `技能不存在: ${parsed.skillName}` };
    }

    // 执行
    return this.executor.execute(skill, parsed.params, context);
  }

  /**
   * 注册技能
   */
  async register(skill) {
    return this.registry.register(skill);
  }

  /**
   * 获取技能列表
   */
  async list(filter = {}) {
    return this.registry.list(filter);
  }

  /**
   * 调用 MCP 工具
   */
  async callMCP(server, tool, params) {
    return this.mcporterBridge.call(server, tool, params);
  }
}

module.exports = { SkillsManager, SkillRegistry, SkillRouter, SkillExecutor, SkillLoader, MCPorterBridge };