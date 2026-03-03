-- 插件系统数据库迁移
-- Version: 013
-- Date: 2026-03-03

-- 插件表
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  version TEXT,
  description TEXT,
  skill_path TEXT,
  config_schema TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- 插件配置表
CREATE TABLE IF NOT EXISTS plugin_configs (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  owner_id TEXT,
  owner_type TEXT DEFAULT 'system',
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER,
  UNIQUE(plugin_id, owner_id, owner_type)
);

-- 插件绑定表
CREATE TABLE IF NOT EXISTS plugin_bindings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  permissions TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER,
  UNIQUE(agent_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_plugins_type ON plugins(type);
CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled);
CREATE INDEX IF NOT EXISTS idx_plugin_configs_plugin ON plugin_configs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_bindings_agent ON plugin_bindings(agent_id);
