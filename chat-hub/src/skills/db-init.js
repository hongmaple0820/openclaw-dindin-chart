/**
 * Skills Database - 技能数据库初始化
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * 初始化 skills 表
 */
async function initSkillsTables(db) {
  // 创建 skills 表
  await db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      description TEXT,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      category TEXT DEFAULT 'general',
      tags TEXT DEFAULT '[]',
      source TEXT DEFAULT 'custom',
      skill_path TEXT,
      config_schema TEXT,
      default_config TEXT,
      permissions TEXT DEFAULT '[]',
      mcp_compatible INTEGER DEFAULT 0,
      mcp_tools TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      is_public INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  // 创建索引
  await db.run(`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)`);
  
  // 创建用户技能绑定表
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      UNIQUE(user_id, skill_id)
    )
  `);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id)`);

  // 创建技能调用日志表
  await db.run(`
    CREATE TABLE IF NOT EXISTS skill_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL,
      user_id TEXT,
      input TEXT,
      output TEXT,
      success INTEGER DEFAULT 1,
      duration_ms INTEGER,
      error TEXT,
      created_at INTEGER
    )
  `);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_skill_logs_skill ON skill_logs(skill_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_skill_logs_created ON skill_logs(created_at)`);

  console.log('[SkillsDB] 技能表初始化完成');
}

/**
 * 从共享知识库导入技能
 */
async function importSkillsFromKnowledgeBase(db, knowledgeBasePath) {
  const skillsPath = path.join(knowledgeBasePath, 'skills');
  
  try {
    await fs.access(skillsPath);
  } catch (e) {
    console.log('[SkillsDB] 共享知识库 skills 目录不存在:', skillsPath);
    return { imported: 0, errors: [] };
  }

  const entries = await fs.readdir(skillsPath, { withFileTypes: true });
  const results = {
    imported: 0,
    skipped: 0,
    errors: []
  };

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'README.md') continue;

    const skillPath = path.join(skillsPath, entry.name);
    
    try {
      const skill = await parseSkillFromDir(skillPath);
      if (skill) {
        await registerSkill(db, skill);
        results.imported++;
        console.log(`[SkillsDB] 导入技能: ${skill.name}`);
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.errors.push({
        skill: entry.name,
        error: error.message
      });
    }
  }

  console.log(`[SkillsDB] 导入完成: ${results.imported} 成功, ${results.skipped} 跳过, ${results.errors.length} 错误`);
  return results;
}

/**
 * 从目录解析技能定义
 */
async function parseSkillFromDir(skillPath) {
  const skillName = path.basename(skillPath);
  
  // 尝试读取 SKILL.md
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  
  try {
    const content = await fs.readFile(skillMdPath, 'utf8');
    const skill = parseSkillMd(content, skillName);
    skill.skill_path = skillPath;
    return skill;
  } catch (e) {
    // 没有 SKILL.md，创建基本定义
    return {
      id: skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: skillName,
      display_name: skillName,
      description: `Imported skill: ${skillName}`,
      version: '1.0.0',
      category: 'general',
      skill_path: skillPath,
      source: 'knowledge-base'
    };
  }
}

/**
 * 解析 SKILL.md 文件
 */
function parseSkillMd(content, defaultName) {
  const skill = {
    id: defaultName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: defaultName,
    version: '1.0.0',
    category: 'general',
    tags: [],
    permissions: [],
    mcp_tools: [],
    enabled: true
  };

  // 解析 YAML front matter
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex !== -1) {
      const frontMatter = content.slice(3, endIndex).trim();
      const yaml = require('js-yaml');
      
      try {
        const meta = yaml.load(frontMatter);
        
        // 映射字段
        skill.name = meta.name || defaultName;
        skill.display_name = meta.display_name || meta.title || skill.name;
        skill.description = meta.description || '';
        skill.version = meta.version || '1.0.0';
        skill.author = meta.author || '';
        skill.category = meta.category || detectCategory(skill.name);
        skill.tags = meta.tags || meta.triggers || [];
        skill.enabled = meta.enabled !== false;
        
      } catch (e) {
        console.warn(`[SkillsDB] 解析 YAML 失败: ${defaultName}`, e.message);
      }
      
      // 提取描述
      const body = content.slice(endIndex + 3).trim();
      if (!skill.description) {
        const lines = body.split('\n');
        for (const line of lines) {
          if (line.startsWith('#')) continue;
          if (line.trim() === '') continue;
          skill.description = line.trim();
          break;
        }
      }
    }
  }

  return skill;
}

/**
 * 检测技能类别
 */
function detectCategory(name) {
  const nameLower = name.toLowerCase();
  
  const categoryMap = {
    development: ['github', 'git', 'docker', 'kubernetes', 'api', 'code', 'debug', 'pr-', 'eslint'],
    productivity: ['summarize', 'weather', 'planning', 'brainstorm', 'search', 'schedule'],
    communication: ['discord', 'slack', 'email', 'telegram', 'imsg', 'message'],
    multimedia: ['image', 'video', 'audio', 'whisper', 'tts', 'remotion', 'nano'],
    automation: ['n8n', 'workflow', 'automation', 'cron', 'action'],
    security: ['security', 'password', '1password', 'audit', 'sentinel'],
    'ai-ml': ['gemini', 'gpt', 'claude', 'model', 'openai', 'ai-'],
    'home-iot': ['home', 'iot', 'sonos', 'hue', 'smart']
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

/**
 * 注册技能到数据库
 */
async function registerSkill(db, skill) {
  const now = Date.now();
  
  await db.run(`
    INSERT OR REPLACE INTO skills (
      id, name, display_name, description, version, author,
      category, tags, source, skill_path,
      config_schema, default_config, permissions,
      mcp_compatible, mcp_tools, enabled, is_public, priority,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    skill.id,
    skill.name,
    skill.display_name || skill.name,
    skill.description || '',
    skill.version || '1.0.0',
    skill.author || '',
    skill.category || 'general',
    JSON.stringify(skill.tags || []),
    skill.source || 'knowledge-base',
    skill.skill_path || '',
    JSON.stringify(skill.config_schema || {}),
    JSON.stringify(skill.default_config || {}),
    JSON.stringify(skill.permissions || []),
    skill.mcp_compatible ? 1 : 0,
    JSON.stringify(skill.mcp_tools || []),
    skill.enabled !== false ? 1 : 0,
    skill.is_public ? 1 : 0,
    skill.priority || 0,
    now,
    now
  ]);
}

module.exports = {
  initSkillsTables,
  importSkillsFromKnowledgeBase,
  parseSkillFromDir,
  registerSkill
};