-- Migration 015: Virtual Session System
-- Creates tables for user/group plugin bindings, webhooks, admin auth, and session configs

-- 用户级插件绑定
CREATE TABLE user_plugins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(user_id, plugin_id)
);

-- 群聊级插件绑定
CREATE TABLE group_plugins (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(group_id, plugin_id)
);

-- Webhook 配置（群聊级，二选一）
CREATE TABLE group_webhooks (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  secret TEXT,
  enabled INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(group_id, channel)
);

-- 超级管理员
CREATE TABLE super_admin (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  last_login INTEGER
);

-- 初始化超级管理员（密码: admin123）
-- bcrypt hash for 'admin123': $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO super_admin (id, username, password_hash, created_at)
VALUES ('admin', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', strftime('%s', 'now') * 1000);

-- 会话配置
CREATE TABLE session_configs (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  max_context_size INTEGER DEFAULT 50,
  compression_threshold INTEGER DEFAULT 40,
  summary_max_length INTEGER DEFAULT 500,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 索引
CREATE INDEX idx_user_plugins_user ON user_plugins(user_id);
CREATE INDEX idx_group_plugins_group ON group_plugins(group_id);
CREATE INDEX idx_group_webhooks_group ON group_webhooks(group_id);
