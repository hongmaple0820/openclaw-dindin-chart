-- ========================================
-- chat-hub 会话管理迁移脚本
-- 版本: 004
-- 创建时间: 2026-02-13
-- 功能: 支持私聊和群聊会话管理
-- ========================================

-- ----------------------------
-- 1. 会话表
-- ----------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'private',
  participants TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  owner_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message TEXT,
  last_message_time INTEGER,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- ----------------------------
-- 2. 会话参与者表
-- ----------------------------
CREATE TABLE IF NOT EXISTS session_participants (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  last_read_at INTEGER,
  unread_count INTEGER DEFAULT 0,
  muted INTEGER DEFAULT 0,
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sp_user ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_sp_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_sp_unread ON session_participants(user_id, unread_count);

-- ----------------------------
-- 3. 实例注册表（多实例部署支持）
-- ----------------------------
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  api_key TEXT,
  status TEXT DEFAULT 'active',
  last_heartbeat INTEGER,
  created_at INTEGER NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
CREATE INDEX IF NOT EXISTS idx_instances_heartbeat ON instances(last_heartbeat);

-- ----------------------------
-- 4. 用户会话绑定表（多实例部署支持）
-- ----------------------------
CREATE TABLE IF NOT EXISTS user_instance_bindings (
  user_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  session_id TEXT,
  connected_at INTEGER NOT NULL,
  disconnected_at INTEGER,
  PRIMARY KEY (user_id, instance_id),
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uib_user ON user_instance_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_uib_instance ON user_instance_bindings(instance_id);
