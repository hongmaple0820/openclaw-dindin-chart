-- Migration 021: Scheduler System (定时任务系统)
-- Phase 18: 内置调度器，支持外部系统

-- 定时任务表
CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL,
  
  -- 调度类型
  schedule_type TEXT NOT NULL,  -- cron/interval/once
  
  -- Cron 表达式
  cron_expr TEXT,  -- e.g., "0 9 * * 1-5" (工作日早9点)
  timezone TEXT DEFAULT 'Asia/Shanghai',
  
  -- 间隔（秒）
  interval_seconds INTEGER,  -- e.g., 3600 (每小时)
  
  -- 单次执行时间
  run_once_at INTEGER,  -- timestamp
  
  -- 下次执行
  next_run_at INTEGER,
  last_run_at INTEGER,
  
  -- 任务配置
  task_type TEXT NOT NULL,  -- skill/agent/message/webhook/custom
  task_config TEXT,  -- JSON
  
  -- 外部调度器
  use_external INTEGER DEFAULT 0,
  external_type TEXT,  -- webhook/openclaw-cron/systemd
  external_config TEXT,  -- JSON
  
  -- 输入参数
  input_params TEXT,  -- JSON
  
  -- 状态
  enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'idle',  -- idle/running/paused/error
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  -- 重试配置
  retry_on_failure INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- 通知配置
  notify_on_success INTEGER DEFAULT 0,
  notify_on_failure INTEGER DEFAULT 1,
  notification_channels TEXT,  -- JSON array
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 定时任务执行日志表
CREATE TABLE scheduled_task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  
  -- 执行时间
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  
  -- 状态
  status TEXT NOT NULL,  -- running/success/failed/timeout/skipped
  
  -- 结果
  result TEXT,  -- JSON
  error_message TEXT,
  error_stack TEXT,
  
  -- 性能
  duration_ms INTEGER,
  
  -- 重试
  is_retry INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 定时任务锁表（防止重复执行）
CREATE TABLE scheduled_task_locks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  locked_at INTEGER,
  locked_by TEXT,  -- instance id
  expires_at INTEGER
);

-- 索引
CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
CREATE INDEX idx_scheduled_task_runs_task ON scheduled_task_runs(task_id);
CREATE INDEX idx_scheduled_task_runs_status ON scheduled_task_runs(status);
CREATE INDEX idx_scheduled_task_runs_scheduled ON scheduled_task_runs(scheduled_at);