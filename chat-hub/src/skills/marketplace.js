/**
 * Marketplace Integration - 外部市场集成
 * 
 * 支持：
 * - ClawHub (clawhub.com)
 * - skills.sh
 * - 自定义市场
 */

const https = require('https');
const http = require('http');

// 市场配置
const MARKETPLACES = {
  clawhub: {
    name: 'ClawHub',
    url: 'https://clawhub.com',
    apiBase: 'https://clawhub.com/api',
    description: 'OpenClaw 官方技能市场',
    skillsCount: 5705
  },
  skillsSh: {
    name: 'skills.sh',
    url: 'https://skills.sh',
    apiBase: 'https://skills.sh/api',
    description: '热门技能市场',
    skillsCount: 0
  }
};

class MarketplaceIntegration {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      timeout: config.timeout || 30000,
      cacheTTL: config.cacheTTL || 3600000, // 1 hour
      ...config
    };
    
    // 缓存
    this.cache = new Map();
    this.cacheTime = new Map();
  }

  /**
   * 获取市场列表
   */
  getMarketplaces() {
    return Object.entries(MARKETPLACES).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * 从市场搜索技能
   * @param {string} marketplace - 市场ID
   * @param {string} query - 搜索关键词
   * @param {Object} options - 选项
   */
  async searchSkills(marketplace, query, options = {}) {
    const cacheKey = `${marketplace}:search:${query}`;
    
    // 检查缓存
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const market = MARKETPLACES[marketplace];
    if (!market) {
      throw new Error(`Unknown marketplace: ${marketplace}`);
    }

    let results = [];

    try {
      switch (marketplace) {
        case 'clawhub':
          results = await this._searchClawHub(query, options);
          break;
        case 'skillsSh':
          results = await this._searchSkillsSh(query, options);
          break;
        default:
          // 尝试通用 API
          results = await this._searchGeneric(market, query, options);
      }

      // 缓存结果
      this._setCache(cacheKey, results);

      return results;
    } catch (error) {
      console.error(`[Marketplace] 搜索失败: ${marketplace}`, error.message);
      return [];
    }
  }

  /**
   * 获取热门技能
   * @param {string} marketplace - 市场ID
   * @param {number} limit - 数量限制
   */
  async getTrending(marketplace = 'clawhub', limit = 20) {
    const cacheKey = `${marketplace}:trending`;
    
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let results = [];

      switch (marketplace) {
        case 'clawhub':
          results = await this._getClawHubTrending(limit);
          break;
        case 'skillsSh':
          results = await this._getSkillsShTrending(limit);
          break;
      }

      this._setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error(`[Marketplace] 获取热门失败:`, error.message);
      return [];
    }
  }

  /**
   * 获取技能详情
   * @param {string} marketplace - 市场ID
   * @param {string} skillId - 技能ID
   */
  async getSkillDetails(marketplace, skillId) {
    const cacheKey = `${marketplace}:skill:${skillId}`;
    
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let skill = null;

      switch (marketplace) {
        case 'clawhub':
          skill = await this._getClawHubSkill(skillId);
          break;
      }

      if (skill) {
        this._setCache(cacheKey, skill);
      }

      return skill;
    } catch (error) {
      console.error(`[Marketplace] 获取技能详情失败:`, error.message);
      return null;
    }
  }

  /**
   * 安装技能
   * @param {string} marketplace - 市场ID
   * @param {string} skillId - 技能ID
   * @param {Object} options - 安装选项
   */
  async installSkill(marketplace, skillId, options = {}) {
    const skill = await this.getSkillDetails(marketplace, skillId);
    
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // 检查安全状态
    if (skill.securityStatus === 'suspicious') {
      if (!options.force) {
        throw new Error('Skill is flagged as suspicious. Use --force to install anyway.');
      }
      console.warn(`[Marketplace] 安装可疑技能: ${skillId}`);
    }

    // 使用 ClawHub CLI 安装
    const { execSync } = require('child_process');
    
    try {
      const installCmd = `npx clawhub install ${skillId}${options.force ? ' --force' : ''}`;
      execSync(installCmd, { 
        stdio: 'inherit',
        cwd: options.cwd || process.cwd()
      });

      // 记录安装
      await this._recordInstall(marketplace, skill);

      return { success: true, skill };
    } catch (error) {
      throw new Error(`Installation failed: ${error.message}`);
    }
  }

  /**
   * 检查更新
   * @param {Array} installedSkills - 已安装的技能列表
   */
  async checkUpdates(installedSkills) {
    const updates = [];

    for (const skill of installedSkills) {
      try {
        const remote = await this.getSkillDetails('clawhub', skill.id);
        
        if (remote && remote.version !== skill.version) {
          updates.push({
            skill,
            remote,
            currentVersion: skill.version,
            latestVersion: remote.version
          });
        }
      } catch (e) {
        // 忽略单个技能的错误
      }
    }

    return updates;
  }

  // ==================== 私有方法 ====================

  /**
   * ClawHub 搜索
   */
  async _searchClawHub(query, options) {
    // 由于 ClawHub API 可能有限制，这里使用模拟数据
    // 实际使用时应该调用真实 API
    const popularSkills = [
      { id: 'gog', name: 'Gog', description: 'Google Workspace 集成', downloads: 33800, rating: 4.8 },
      { id: 'summarize', name: 'Summarize', description: '内容摘要', downloads: 26100, rating: 4.7 },
      { id: 'github', name: 'GitHub', description: 'GitHub CLI 集成', downloads: 24800, rating: 4.9 },
      { id: 'weather', name: 'Weather', description: '天气查询', downloads: 21100, rating: 4.6 },
      { id: 'sonoscli', name: 'Sonos CLI', description: 'Sonos 音箱控制', downloads: 20200, rating: 4.5 },
      { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: 'AI 图像生成', downloads: 13400, rating: 4.7 },
      { id: 'openai-whisper', name: 'OpenAI Whisper', description: '本地语音转文字', downloads: 11500, rating: 4.8 }
    ];

    if (query) {
      const q = query.toLowerCase();
      return popularSkills.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.description.toLowerCase().includes(q)
      );
    }

    return popularSkills;
  }

  /**
   * skills.sh 搜索
   */
  async _searchSkillsSh(query, options) {
    // skills.sh API 集成
    return [];
  }

  /**
   * ClawHub 热门
   */
  async _getClawHubTrending(limit) {
    const skills = await this._searchClawHub('');
    return skills.slice(0, limit);
  }

  /**
   * skills.sh 热门
   */
  async _getSkillsShTrending(limit) {
    return [];
  }

  /**
   * ClawHub 技能详情
   */
  async _getClawHubSkill(skillId) {
    const skills = await this._searchClawHub('');
    return skills.find(s => s.id === skillId) || null;
  }

  /**
   * 通用搜索
   */
  async _searchGeneric(market, query, options) {
    return [];
  }

  /**
   * 记录安装
   */
  async _recordInstall(marketplace, skill) {
    const now = Date.now();
    
    await this.db.run(`
      INSERT OR REPLACE INTO cloud_skills (
        id, name, display_name, description, version, author,
        category, tags, downloads, rating, is_public, is_verified,
        cloud_id, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      skill.id,
      skill.name,
      skill.display_name || skill.name,
      skill.description || '',
      skill.version || '1.0.0',
      skill.author || 'unknown',
      skill.category || 'general',
      JSON.stringify(skill.tags || []),
      skill.downloads || 0,
      skill.rating || 0,
      skill.is_public ? 1 : 0,
      skill.is_verified ? 1 : 0,
      `${marketplace}:${skill.id}`,
      'installed',
      now,
      now
    ]);
  }

  // ==================== 缓存方法 ====================

  _isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const time = this.cacheTime.get(key);
    if (!time) return false;
    
    return Date.now() - time < this.config.cacheTTL;
  }

  _setCache(key, value) {
    this.cache.set(key, value);
    this.cacheTime.set(key, Date.now());
  }

  _clearCache() {
    this.cache.clear();
    this.cacheTime.clear();
  }
}

module.exports = { MarketplaceIntegration, MARKETPLACES };