-- Migration 017: Skills System (技能系统)
-- Phase 14: 全系统技能框架，支持 # 调用和 MCP 集成

-- 技能表
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author TEXT,
  category TEXT,  -- code/document/data/image/network/system
  tags TEXT,  -- JSON array
  source TEXT DEFAULT 'builtin',  -- builtin/imported/market/custom
  skill_path TEXT,
  
  -- 配置
  config_schema TEXT,  -- JSON Schema
  default_config TEXT,  -- JSON
  permissions TEXT,  -- JSON array: ["fs:read", "net:fetch"]
  
  -- MCP 配置
  mcp_compatible INTEGER DEFAULT 0,
  mcp_tools TEXT,  -- JSON array of tool names
  
  -- 状态
  enabled INTEGER DEFAULT 1,
  is_public INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 用户技能绑定表
CREATE TABLE user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  config TEXT,  -- JSON (用户覆盖的配置)
  enabled INTEGER DEFAULT 1,
  pinned INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(user_id, skill_id)
);

-- 群聊技能绑定表
CREATE TABLE group_skills (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(group_id, skill_id)
);

-- MCP 服务器表
CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  type TEXT NOT NULL,  -- stdio/http/sse
  
  -- stdio 配置
  command TEXT,  -- e.g., "node", "python", "bun"
  args TEXT,  -- JSON array
  env TEXT,  -- JSON object
  
  -- http/sse 配置
  url TEXT,
  headers TEXT,  -- JSON object
  
  -- 工具列表
  tools TEXT,  -- JSON array of tool definitions
  
  -- 状态
  enabled INTEGER DEFAULT 1,
  is_public INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 用户 MCP 绑定表
CREATE TABLE user_mcp_bindings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mcp_id TEXT NOT NULL,
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(user_id, mcp_id)
);

-- 技能调用日志表
CREATE TABLE skill_logs (
  id TEXT PRIMARY KEY,
  skill_id TEXT,
  user_id TEXT,
  session_id TEXT,
  input TEXT,  -- JSON
  output TEXT,  -- JSON
  status TEXT,  -- success/error/timeout
  error_message TEXT,
  duration_ms INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 索引
CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_source ON skills(source);
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX idx_group_skills_group ON group_skills(group_id);
CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_user_mcp_user ON user_mcp_bindings(user_id);
CREATE INDEX idx_skill_logs_skill ON skill_logs(skill_id);
CREATE INDEX idx_skill_logs_user ON skill_logs(user_id);