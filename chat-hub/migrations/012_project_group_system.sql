-- 项目群系统迁移
-- 创建时间: 2026-03-03

-- 项目群表
CREATE TABLE IF NOT EXISTS project_groups (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  repo_url TEXT,
  status TEXT DEFAULT 'active',
  created_at INTEGER,
  updated_at INTEGER,
  settings TEXT
);

-- 项目技能表
CREATE TABLE IF NOT EXISTS project_skills (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- rule/tool/workflow
  content TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER,
  is_active INTEGER DEFAULT 1
);

-- 项目任务表
CREATE TABLE IF NOT EXISTS project_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assignee_id TEXT,
  due_date INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  tags TEXT
);

-- 任务评论表
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT,
  created_at INTEGER
);

-- 看板列表表
CREATE TABLE IF NOT EXISTS task_boards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER,
  created_at INTEGER
);

-- 看板卡片表
CREATE TABLE IF NOT EXISTS task_cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  order_index INTEGER
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_group ON project_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_skills_project ON project_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_skills_active ON project_skills(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON project_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_boards_project ON task_boards(project_id);
CREATE INDEX IF NOT EXISTS idx_cards_board ON task_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_task ON task_cards(task_id);
