-- Migration 019: Sandbox & Workspace System (沙箱与工作区系统)
-- Phase 16: 虚拟沙箱环境，.fengLin 工作区管理

-- 沙箱表
CREATE TABLE sandboxes (
  id TEXT PRIMARY KEY,
  name TEXT,
  session_id TEXT,
  task_id TEXT,
  
  -- 容器信息
  container_id TEXT UNIQUE,
  image TEXT DEFAULT 'node:20-slim',
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/creating/running/busy/paused/error/stopped
  
  -- 资源配置
  cpu_limit INTEGER DEFAULT 1,  -- CPU 核心数
  memory_limit INTEGER DEFAULT 512,  -- MB
  disk_limit INTEGER DEFAULT 1024,  -- MB
  gpu_enabled INTEGER DEFAULT 0,
  gpu_memory_limit INTEGER,  -- MB
  
  -- 资源使用
  cpu_usage REAL,
  memory_usage REAL,
  disk_usage REAL,
  gpu_usage REAL,
  
  -- 网络配置
  network_enabled INTEGER DEFAULT 1,
  allowed_hosts TEXT,  -- JSON array
  environment_vars TEXT,  -- JSON object
  
  -- 挂载
  mounts TEXT,  -- JSON array: [{source, target, mode}]
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  started_at INTEGER,
  expires_at INTEGER,
  last_activity INTEGER,
  stopped_at INTEGER
);

-- 沙箱日志表
CREATE TABLE sandbox_logs (
  id TEXT PRIMARY KEY,
  sandbox_id TEXT NOT NULL,
  level TEXT DEFAULT 'info',  -- debug/info/warn/error
  source TEXT,  -- stdout/stderr/system
  message TEXT,
  metadata TEXT,  -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 沙箱文件表
CREATE TABLE sandbox_files (
  id TEXT PRIMARY KEY,
  sandbox_id TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT,  -- file/directory
  size INTEGER,
  mime_type TEXT,
  checksum TEXT,
  is_modified INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(sandbox_id, path)
);

-- 工作区表
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT,
  path TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,  -- default/group/private/task/custom
  
  -- 关联
  owner_id TEXT,
  group_id TEXT,
  task_id TEXT,
  
  -- 配置
  auto_cleanup INTEGER DEFAULT 0,
  cleanup_after_days INTEGER,
  max_size INTEGER,  -- bytes
  
  -- 统计
  file_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  last_accessed INTEGER
);

-- 工作区文件索引表
CREATE TABLE workspace_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  type TEXT,  -- file/directory
  size INTEGER,
  mime_type TEXT,
  checksum TEXT,
  is_encrypted INTEGER DEFAULT 0,
  metadata TEXT,  -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  modified_at INTEGER,
  UNIQUE(workspace_id, relative_path)
);

-- 索引
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_sandboxes_session ON sandboxes(session_id);
CREATE INDEX idx_sandboxes_task ON sandboxes(task_id);
CREATE INDEX idx_sandbox_logs_sandbox ON sandbox_logs(sandbox_id);
CREATE INDEX idx_sandbox_files_sandbox ON sandbox_files(sandbox_id);
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_group ON workspaces(group_id);
CREATE INDEX idx_workspaces_type ON workspaces(type);
CREATE INDEX idx_workspace_files_workspace ON workspace_files(workspace_id);