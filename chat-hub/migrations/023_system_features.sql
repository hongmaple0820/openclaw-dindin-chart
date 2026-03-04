-- Migration 023: Group Skills & System Features (群聊Skills与系统功能)
-- Phase 20: 群聊默认Skills，系统更新，数据备份

-- 群聊默认Skills配置表
CREATE TABLE group_default_skills (
  id TEXT PRIMARY KEY,
  group_type TEXT NOT NULL,  -- normal/project/community
  skill_id TEXT NOT NULL,
  config TEXT,  -- JSON
  priority INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,  -- 是否必须启用
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(group_type, skill_id)
);

-- 项目群配置表
CREATE TABLE project_group_configs (
  id TEXT PRIMARY KEY,
  group_id TEXT UNIQUE NOT NULL,
  
  -- Git 配置
  git_repo_url TEXT,
  git_branch TEXT DEFAULT 'main',
  git_workflow TEXT,  -- JSON: {branches, mergeStrategy, commitConvention}
  
  -- 文档配置
  docs_path TEXT DEFAULT 'docs',
  readme_path TEXT DEFAULT 'README.md',
  changelog_path TEXT DEFAULT 'CHANGELOG.md',
  
  -- 项目计划
  plan_path TEXT DEFAULT '.maple',
  temp_path TEXT DEFAULT 'temp',
  auto_cleanup_temp INTEGER DEFAULT 1,
  temp_cleanup_days INTEGER DEFAULT 2,
  
  -- 任务看板
  task_board_enabled INTEGER DEFAULT 1,
  task_board_config TEXT,  -- JSON
  
  -- 隐私设置
  privacy_mode TEXT DEFAULT 'internal',  -- public/internal/private
  allowed_export_types TEXT,  -- JSON array
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 系统更新表
CREATE TABLE system_updates (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  
  -- 更新内容
  title TEXT NOT NULL,
  changelog TEXT,
  changelog_html TEXT,
  
  -- 更新类型
  update_type TEXT DEFAULT 'patch',  -- major/minor/patch/hotfix
  is_forced INTEGER DEFAULT 0,  -- 是否强制更新
  
  -- 迁移
  migration_script TEXT,
  migration_required INTEGER DEFAULT 0,
  breaking_changes TEXT,  -- JSON array
  
  -- 时间
  released_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 用户更新状态表
CREATE TABLE user_update_status (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  update_id TEXT NOT NULL,
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/notified/downloading/installing/completed/skipped
  
  -- 时间
  notified_at INTEGER,
  downloaded_at INTEGER,
  installed_at INTEGER,
  skipped_at INTEGER,
  
  -- 错误
  error_message TEXT,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(user_id, update_id)
);

-- 数据备份表
CREATE TABLE user_backups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  
  -- 备份类型
  backup_type TEXT DEFAULT 'full',  -- full/partial/custom
  data_types TEXT,  -- JSON array: ["skills", "mcp", "messages", "configs", "files"]
  
  -- 文件信息
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_format TEXT DEFAULT 'json',  -- json/sql/zip
  checksum TEXT,
  is_compressed INTEGER DEFAULT 1,
  is_encrypted INTEGER DEFAULT 0,
  encryption_method TEXT,
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/creating/completed/failed/expired
  
  -- 统计
  records_count INTEGER,
  tables_count INTEGER,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  completed_at INTEGER,
  expires_at INTEGER,
  
  -- 存储
  storage_type TEXT DEFAULT 'local',  -- local/s3/oss/custom
  storage_config TEXT  -- JSON
);

-- 备份恢复记录表
CREATE TABLE backup_restores (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/restoring/completed/failed
  
  -- 选项
  overwrite_existing INTEGER DEFAULT 0,
  merge_mode INTEGER DEFAULT 0,
  
  -- 结果
  restored_tables TEXT,  -- JSON array
  restored_records INTEGER,
  failed_records INTEGER,
  
  -- 错误
  error_message TEXT,
  
  -- 时间
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 关于我们配置表
CREATE TABLE about_config (
  id TEXT PRIMARY KEY,
  
  -- 基本信息
  project_name TEXT DEFAULT 'Chat-Hub',
  project_version TEXT,
  project_description TEXT,
  
  -- 链接
  official_website TEXT DEFAULT 'https://hongmaple.top',
  github_repo TEXT,
  documentation_url TEXT,
  
  -- 联系方式
  support_email TEXT,
  support_chat TEXT,
  
  -- 团队
  team_members TEXT,  -- JSON array
  
  -- 许可证
  license TEXT DEFAULT 'MIT',
  license_url TEXT,
  
  -- 第三方致谢
  acknowledgements TEXT,  -- JSON array
  
  updated_at INTEGER
);

-- 插入默认关于信息
INSERT INTO about_config (id, project_name, project_version, project_description, official_website, license)
VALUES ('default', 'Chat-Hub', '2.0.0', '面向开发者和团队的智能协作平台', 'https://hongmaple.top', 'MIT');

-- 索引
CREATE INDEX idx_group_default_skills_type ON group_default_skills(group_type);
CREATE INDEX idx_project_group_configs_group ON project_group_configs(group_id);
CREATE INDEX idx_system_updates_version ON system_updates(version);
CREATE INDEX idx_user_update_status_user ON user_update_status(user_id);
CREATE INDEX idx_user_backups_user ON user_backups(user_id);
CREATE INDEX idx_user_backups_status ON user_backups(status);
CREATE INDEX idx_backup_restores_backup ON backup_restores(backup_id);