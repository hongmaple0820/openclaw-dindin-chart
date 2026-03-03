-- 权限系统数据库迁移
-- Version: 014
-- Date: 2026-03-03

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,           -- plugin/agent/channel
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Agent-角色关联表
CREATE TABLE IF NOT EXISTS agent_roles (
  agent_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  PRIMARY KEY (agent_id, role_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_agent_roles_agent ON agent_roles(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_roles_role ON agent_roles(role_id);

-- 初始化权限
INSERT OR IGNORE INTO permissions (id, name, category, description) VALUES
  ('plugin:read', '查看插件', 'plugin', '查看插件列表和详情'),
  ('plugin:write', '管理插件', 'plugin', '创建、更新、删除插件'),
  ('agent:read', '查看 Agent', 'agent', '查看 Agent 列表和详情'),
  ('agent:write', '管理 Agent', 'agent', '创建、更新、删除 Agent'),
  ('channel:read', '查看通道', 'channel', '查看通道列表和详情'),
  ('channel:write', '管理通道', 'channel', '创建、更新、删除通道');

-- 初始化系统角色
INSERT OR IGNORE INTO roles (id, name, is_system, description) VALUES
  ('admin', '管理员', 1, '拥有所有权限'),
  ('developer', '开发者', 1, '拥有开发权限'),
  ('viewer', '观察者', 1, '只读权限');

-- 初始化角色权限 - admin 拥有所有权限
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'plugin:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'plugin:write');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'agent:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'agent:write');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'channel:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('admin', 'channel:write');

-- developer 拥有读取权限
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('developer', 'plugin:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('developer', 'agent:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('developer', 'channel:read');

-- viewer 只有基本读取权限
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('viewer', 'plugin:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('viewer', 'agent:read');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ('viewer', 'channel:read');
