-- Migration 020: Task System (任务系统)
-- Phase 17: 单次任务管理，@好友协作

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/running/completed/cancelled/failed
  priority TEXT DEFAULT 'normal',  -- low/normal/important/urgent
  is_pinned INTEGER DEFAULT 0,
  
  -- 创建者
  creator_id TEXT NOT NULL,
  creator_type TEXT DEFAULT 'human',  -- human/agent
  
  -- 工作区
  workspace_id TEXT,
  workspace_path TEXT,
  
  -- 上下文
  context TEXT,  -- JSON: {files, conversations, configs, notes}
  context_tokens INTEGER DEFAULT 0,
  
  -- 结果
  result TEXT,  -- JSON
  result_summary TEXT,
  
  -- 标签
  tags TEXT,  -- JSON array
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  started_at INTEGER,
  completed_at INTEGER,
  due_at INTEGER,
  
  -- 统计
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- 任务执行者表
CREATE TABLE task_assignees (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  
  -- 执行者信息
  user_id TEXT NOT NULL,
  user_type TEXT DEFAULT 'human',  -- human/agent
  user_name TEXT,
  
  -- 角色
  role TEXT DEFAULT 'collaborator',  -- owner/collaborator/observer
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/accepted/rejected/working/completed
  
  -- 通知
  notified_at INTEGER,
  responded_at INTEGER,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  
  UNIQUE(task_id, user_id)
);

-- 任务上下文条目表
CREATE TABLE task_context_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  
  -- 类型
  type TEXT NOT NULL,  -- file/conversation/config/note/url
  
  -- 内容
  title TEXT,
  content TEXT,  -- JSON or text
  file_path TEXT,
  url TEXT,
  
  -- 元数据
  metadata TEXT,  -- JSON
  importance INTEGER DEFAULT 0,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 任务日志表
CREATE TABLE task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  level TEXT DEFAULT 'info',  -- debug/info/warn/error
  message TEXT,
  metadata TEXT,  -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 任务评论表
CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  content TEXT NOT NULL,
  parent_id TEXT,  -- for replies
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_creator ON tasks(creator_id);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_pinned ON tasks(is_pinned);
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_context_task ON task_context_items(task_id);
CREATE INDEX idx_task_logs_task ON task_logs(task_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);