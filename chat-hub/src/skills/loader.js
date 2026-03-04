/**
 * Skills Loader - 技能加载器
 * 
 * 功能：
 * - 从目录加载技能
 * - 验证技能结构
 * - 热更新支持
 */

const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const EventEmitter = require('events');

class SkillLoader extends EventEmitter {
  constructor(registry, options = {}) {
    super();
    
    this.registry = registry;
    this.options = {
      skillsDir: options.skillsDir || './skills',
      watchForChanges: options.watchForChanges !== false,
      watchDebounce: options.watchDebounce || 1000,
      validateOnLoad: options.validateOnLoad !== false,
      ...options
    };

    // 已加载的技能
    this.loaded = new Map();
    
    // 文件观察器
    this.watchers = new Map();
    
    // 热更新定时器
    this.updateTimers = new Map();
  }

  /**
   * 加载所有技能
   * @returns {Promise<Object>}
   */
  async loadAll() {
    const skillsDir = this.options.skillsDir;
    const results = {
      loaded: [],
      skipped: [],
      errors: []
    };

    try {
      await fs.access(skillsDir);
    } catch (e) {
      // 目录不存在，创建它
      await fs.mkdir(skillsDir, { recursive: true });
      return results;
    }

    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name);
      
      try {
        const result = await this.load(skillPath);
        
        if (result.loaded) {
          results.loaded.push(result.skill);
        } else if (result.skipped) {
          results.skipped.push(result);
        }
      } catch (error) {
        results.errors.push({
          path: skillPath,
          error: error.message
        });
      }
    }

    // 设置文件观察
    if (this.options.watchForChanges) {
      this._setupWatcher(skillsDir);
    }

    this.emit('load_all', results);
    return results;
  }

  /**
   * 加载单个技能
   * @param {string} skillPath - 技能目录路径
   * @returns {Promise<Object>}
   */
  async load(skillPath) {
    // 查找技能定义文件
    const definitionFile = await this._findDefinitionFile(skillPath);
    
    if (!definitionFile) {
      return {
        skipped: true,
        path: skillPath,
        reason: 'No SKILL.md or skill.yaml found'
      };
    }

    // 解析技能定义
    const definition = await this._parseDefinition(definitionFile);
    
    // 验证技能结构
    if (this.options.validateOnLoad) {
      const validation = this._validate(definition);
      
      if (!validation.valid) {
        throw new Error(`Invalid skill structure: ${validation.errors.join(', ')}`);
      }
    }

    // 注册技能
    const skillId = definition.id || this._generateId(definition.name);
    
    const skill = {
      id: skillId,
      name: definition.name,
      display_name: definition.display_name || definition.title || definition.name,
      description: definition.description || '',
      version: definition.version || '1.0.0',
      author: definition.author || 'unknown',
      category: definition.category || this._detectCategory(skillPath),
      tags: definition.tags || [],
      source: 'imported',
      skill_path: skillPath,
      config_schema: definition.config_schema || definition.configSchema,
      default_config: definition.default_config || definition.config,
      permissions: definition.permissions || [],
      mcp_compatible: definition.mcp_compatible || false,
      mcp_tools: definition.mcp_tools || definition.mcpTools || [],
      enabled: definition.enabled !== false,
      is_public: definition.public || definition.is_public || false,
      priority: definition.priority || 0
    };

    await this.registry.register(skill);

    // 缓存已加载的技能
    this.loaded.set(skillId, {
      path: skillPath,
      definition,
      loadedAt: Date.now()
    });

    // 设置单个技能的文件观察
    if (this.options.watchForChanges) {
      this._setupSkillWatcher(skillId, skillPath);
    }

    this.emit('load', { skillId, skill, path: skillPath });

    return {
      loaded: true,
      skill
    };
  }

  /**
   * 卸载技能
   * @param {string} skillId - 技能ID
   * @returns {Promise<boolean>}
   */
  async unload(skillId) {
    const loaded = this.loaded.get(skillId);
    if (!loaded) {
      return false;
    }

    // 停止观察
    this._stopSkillWatcher(skillId);

    // 注销
    await this.registry.unregister(skillId);
    
    this.loaded.delete(skillId);

    this.emit('unload', { skillId });
    return true;
  }

  /**
   * 重新加载技能
   * @param {string} skillId - 技能ID
   * @returns {Promise<Object>}
   */
  async reload(skillId) {
    const loaded = this.loaded.get(skillId);
    if (!loaded) {
      throw new Error(`Skill not loaded: ${skillId}`);
    }

    await this.unload(skillId);
    return this.load(loaded.path);
  }

  /**
   * 从 YAML 文件加载技能
   * @param {string} yamlPath - YAML 文件路径
   * @returns {Promise<Object>}
   */
  async loadFromYaml(yamlPath) {
    const content = await fs.readFile(yamlPath, 'utf8');
    const definition = yaml.load(content);

    return this.load(definition);
  }

  /**
   * 查找技能定义文件
   * @private
   */
  async _findDefinitionFile(skillPath) {
    const candidates = [
      'SKILL.md',
      'skill.md',
      'skill.yaml',
      'skill.yml',
      'skill.json',
      'package.json'
    ];

    for (const name of candidates) {
      const filePath = path.join(skillPath, name);
      try {
        await fs.access(filePath);
        return filePath;
      } catch (e) {
        // 文件不存在，继续
      }
    }

    return null;
  }

  /**
   * 解析技能定义
   * @private
   */
  async _parseDefinition(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf8');

    switch (ext) {
      case '.md':
        return this._parseMarkdown(content);
      case '.yaml':
      case '.yml':
        return yaml.load(content);
      case '.json':
        return JSON.parse(content);
      default:
        // 尝试解析为 markdown
        if (content.startsWith('---')) {
          return this._parseMarkdown(content);
        }
        return JSON.parse(content);
    }
  }

  /**
   * 解析 Markdown 格式的技能定义
   * @private
   */
  _parseMarkdown(content) {
    const definition = {};

    // 解析 YAML front matter
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontMatter = content.slice(3, endIndex).trim();
        Object.assign(definition, yaml.load(frontMatter));
        
        // 提取描述（第一段）
        const body = content.slice(endIndex + 3).trim();
        const lines = body.split('\n');
        let desc = '';
        for (const line of lines) {
          if (line.startsWith('#')) continue;
          if (line.trim() === '') {
            if (desc) break;
            continue;
          }
          desc += (desc ? ' ' : '') + line.trim();
        }
        if (desc && !definition.description) {
          definition.description = desc;
        }
      }
    }

    return definition;
  }

  /**
   * 验证技能结构
   * @private
   */
  _validate(definition) {
    const errors = [];

    // 必需字段
    if (!definition.name) {
      errors.push('Missing required field: name');
    }

    // 名称格式
    if (definition.name && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(definition.name)) {
      errors.push('Invalid skill name format (must start with letter, contain only letters, numbers, underscores, and hyphens)');
    }

    // 版本格式
    if (definition.version && !/^\d+\.\d+\.\d+/.test(definition.version)) {
      errors.push('Invalid version format (expected semver)');
    }

    // 权限格式
    if (definition.permissions) {
      for (const perm of definition.permissions) {
        if (!/^[a-z]+:[a-z]+$/.test(perm)) {
          errors.push(`Invalid permission format: ${perm} (expected format: resource:action)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 检测技能类别
   * @private
   */
  _detectCategory(skillPath) {
    const name = path.basename(skillPath).toLowerCase();

    // 基于名称猜测类别
    const categoryHints = {
      code: ['code', 'script', 'dev', 'build', 'test', 'lint', 'format'],
      document: ['doc', 'readme', 'markdown', 'text', 'write'],
      data: ['data', 'db', 'database', 'query', 'json', 'csv'],
      image: ['image', 'photo', 'picture', 'visual', 'graphic'],
      network: ['http', 'api', 'fetch', 'request', 'web', 'url'],
      system: ['system', 'file', 'process', 'monitor', 'log']
    };

    for (const [category, hints] of Object.entries(categoryHints)) {
      if (hints.some(hint => name.includes(hint))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * 生成技能ID
   * @private
   */
  _generateId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * 设置目录观察器
   * @private
   */
  _setupWatcher(dir) {
    if (this.watchers.has(dir)) return;

    const chokidar = require('chokidar');
    
    try {
      const watcher = chokidar.watch(dir, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('addDir', (path) => {
        this._scheduleUpdate(path);
      });

      watcher.on('change', (path) => {
        this._scheduleUpdate(path);
      });

      watcher.on('unlinkDir', (path) => {
        const skillId = this._findSkillByPath(path);
        if (skillId) {
          this.unload(skillId);
        }
      });

      this.watchers.set(dir, watcher);
    } catch (e) {
      // chokidar 不可用，跳过观察
      console.warn('chokidar not available, file watching disabled');
    }
  }

  /**
   * 设置单个技能观察器
   * @private
   */
  _setupSkillWatcher(skillId, skillPath) {
    if (this.watchers.has(`skill:${skillId}`)) return;

    const chokidar = require('chokidar');
    
    try {
      const watcher = chokidar.watch(skillPath, {
        persistent: true,
        ignoreInitial: true,
        depth: 1
      });

      watcher.on('change', (path) => {
        this._scheduleUpdate(skillPath, skillId);
      });

      this.watchers.set(`skill:${skillId}`, watcher);
    } catch (e) {
      // chokidar 不可用
    }
  }

  /**
   * 停止技能观察器
   * @private
   */
  _stopSkillWatcher(skillId) {
    const watcher = this.watchers.get(`skill:${skillId}`);
    if (watcher) {
      watcher.close();
      this.watchers.delete(`skill:${skillId}`);
    }
  }

  /**
   * 调度更新
   * @private
   */
  _scheduleUpdate(skillPath, skillId) {
    // 防抖
    const key = skillId || skillPath;
    
    if (this.updateTimers.has(key)) {
      clearTimeout(this.updateTimers.get(key));
    }

    this.updateTimers.set(key, setTimeout(async () => {
      this.updateTimers.delete(key);
      
      try {
        if (skillId) {
          await this.reload(skillId);
          this.emit('hot_reload', { skillId, path: skillPath });
        } else {
          await this.load(skillPath);
          this.emit('hot_reload', { path: skillPath });
        }
      } catch (e) {
        this.emit('load_error', { path: skillPath, error: e });
      }
    }, this.options.watchDebounce));
  }

  /**
   * 根据路径查找技能
   * @private
   */
  _findSkillByPath(searchPath) {
    for (const [skillId, loaded] of this.loaded) {
      if (loaded.path === searchPath) {
        return skillId;
      }
    }
    return null;
  }

  /**
   * 停止所有观察器
   */
  stopWatching() {
    for (const watcher of this.watchers.values()) {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
    }
    this.watchers.clear();

    for (const timer of this.updateTimers.values()) {
      clearTimeout(timer);
    }
    this.updateTimers.clear();
  }

  /**
   * 获取已加载的技能列表
   * @returns {Array}
   */
  getLoadedSkills() {
    return Array.from(this.loaded.entries()).map(([id, data]) => ({
      id,
      path: data.path,
      loadedAt: data.loadedAt
    }));
  }
}

module.exports = { SkillLoader };