/**
 * Skills & MCP 数据库迁移 - V1
 * 
 * 创建新的表结构支持：
 * - 内置 Skills/MCP
 * - 云市场 Skills/MCP
 * - 用户 Skills/MCP
 */

import { Database } from 'better-sqlite3';

const MIGRATION_V1 = `
-- ==================== Skills 系统表 ====================

-- 内置技能表
CREATE TABLE IF NOT EXISTS builtin_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author TEXT DEFAULT 'system',
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  skill_content TEXT,
  config_schema TEXT DEFAULT '{}',
  default_config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_builtin_skills_category ON builtin_skills(category);
CREATE INDEX IF NOT EXISTS idx_builtin_skills_enabled ON builtin_skills(enabled);

-- 云市场技能表
CREATE TABLE IF NOT EXISTS marketplace_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author_id TEXT,
  author_name TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  skill_content TEXT,
  config_schema TEXT DEFAULT '{}',
  default_config TEXT DEFAULT '{}',
  
  -- 状态: pending(待审核), approved(已通过), rejected(已拒绝), removed(已下架)
  status TEXT DEFAULT 'pending',
  is_public INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 0,
  
  -- 统计
  downloads INTEGER DEFAULT 0,
  installs INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- 审核
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_note TEXT,
  
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_marketplace_skills_status ON marketplace_skills(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_skills_category ON marketplace_skills(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_skills_author ON marketplace_skills(author_id);

-- 用户安装的技能
CREATE TABLE IF NOT EXISTS user_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_type TEXT DEFAULT 'marketplace', -- builtin, marketplace, custom
  config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  installed_at INTEGER,
  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);

-- 用户自建技能
CREATE TABLE IF NOT EXISTS custom_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  skill_content TEXT,
  config_schema TEXT DEFAULT '{}',
  default_config TEXT DEFAULT '{}',
  
  -- 发布状态: none(未发布), pending(审核中), published(已发布)
  marketplace_id TEXT,
  publish_status TEXT DEFAULT 'none',
  
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_custom_skills_user ON custom_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_skills_status ON custom_skills(publish_status);

-- 技能评分记录
CREATE TABLE IF NOT EXISTS skill_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  rating REAL NOT NULL,
  comment TEXT,
  created_at INTEGER,
  UNIQUE(user_id, skill_id)
);

-- ==================== MCP 系统表 ====================

-- 内置 MCP 服务器
CREATE TABLE IF NOT EXISTS builtin_mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author TEXT DEFAULT 'system',
  
  -- 连接配置
  transport_type TEXT, -- stdio, http, sse
  command TEXT,
  endpoint TEXT,
  env_config TEXT DEFAULT '{}',
  args TEXT DEFAULT '[]',
  
  -- 工具列表
  tools TEXT DEFAULT '[]',
  
  enabled INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_builtin_mcp_enabled ON builtin_mcp_servers(enabled);

-- 云市场 MCP
CREATE TABLE IF NOT EXISTS marketplace_mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author_id TEXT,
  author_name TEXT,
  
  transport_type TEXT,
  command TEXT,
  endpoint TEXT,
  env_config TEXT DEFAULT '{}',
  args TEXT DEFAULT '[]',
  tools TEXT DEFAULT '[]',
  
  status TEXT DEFAULT 'pending',
  is_public INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 0,
  
  downloads INTEGER DEFAULT 0,
  installs INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_note TEXT,
  
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_marketplace_mcp_status ON marketplace_mcp_servers(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_mcp_author ON marketplace_mcp_servers(author_id);

-- 用户安装的 MCP
CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mcp_id TEXT NOT NULL,
  mcp_type TEXT DEFAULT 'marketplace', -- builtin, marketplace, custom
  config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  installed_at INTEGER,
  UNIQUE(user_id, mcp_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mcp_user ON user_mcp_servers(user_id);

-- 用户自建 MCP
CREATE TABLE IF NOT EXISTS custom_mcp_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  
  transport_type TEXT,
  command TEXT,
  endpoint TEXT,
  env_config TEXT DEFAULT '{}',
  args TEXT DEFAULT '[]',
  tools TEXT DEFAULT '[]',
  
  marketplace_id TEXT,
  publish_status TEXT DEFAULT 'none',
  
  icon TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_custom_mcp_user ON custom_mcp_servers(user_id);

-- ==================== 外部市场配置 ====================

CREATE TABLE IF NOT EXISTS external_markets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  url TEXT NOT NULL,
  icon TEXT,
  market_type TEXT DEFAULT 'skills', -- skills, mcp, both
  enabled INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0
);

-- 初始外部市场数据
INSERT OR IGNORE INTO external_markets (id, name, display_name, description, url, market_type, order_index) VALUES
  ('clawhub', 'ClawHub', 'ClawHub 技能市场', 'OpenClaw 官方技能市场，5,705+ 技能', 'https://clawhub.com', 'skills', 1),
  ('mcp-cn', 'MCP中文站', 'MCP 中文社区', 'MCP 服务器发现平台', 'https://mcp-cn.com', 'mcp', 2),
  ('skills-sh', 'skills.sh', '热门技能排行', '热门技能排行和推荐', 'https://skills.sh', 'skills', 3);
`;

interface MigrationResult {
  success: boolean;
  stats?: Record<string, number>;
  error?: string;
}

/**
 * 执行迁移
 */
async function runMigration(db: Database): Promise<MigrationResult> {
  console.log('[Migration V1] 开始执行 Skills & MCP 数据库迁移...');
  
  try {
    // 执行 SQL
    db.exec(MIGRATION_V1);
    
    console.log('[Migration V1] ✅ 迁移完成');
    
    // 返回统计
    const stats = {
      builtin_skills: countTable(db, 'builtin_skills'),
      marketplace_skills: countTable(db, 'marketplace_skills'),
      user_skills: countTable(db, 'user_skills'),
      custom_skills: countTable(db, 'custom_skills'),
      builtin_mcp_servers: countTable(db, 'builtin_mcp_servers'),
      marketplace_mcp_servers: countTable(db, 'marketplace_mcp_servers'),
      user_mcp_servers: countTable(db, 'user_mcp_servers'),
      custom_mcp_servers: countTable(db, 'custom_mcp_servers'),
      external_markets: countTable(db, 'external_markets')
    };
    
    console.log('[Migration V1] 表统计:', stats);
    
    return { success: true, stats };
  } catch (error) {
    const err = error as Error;
    console.error('[Migration V1] ❌ 迁移失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 统计表行数
 */
function countTable(db: Database, tableName: string): number {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
    return result.count;
  } catch {
    return 0;
  }
}

export { runMigration, MIGRATION_V1 };