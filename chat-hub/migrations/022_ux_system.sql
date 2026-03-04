-- Migration 022: User Experience System (用户体验系统)
-- Phase 19: 快捷键、主题、通知配置

-- 快捷键配置表
CREATE TABLE user_shortcuts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  key_combo TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER,
  UNIQUE(user_id, action)
);

-- 主题配置表
CREATE TABLE user_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  
  -- 主题模式
  mode TEXT DEFAULT 'system',  -- light/dark/system
  
  -- 字体
  font_size TEXT DEFAULT 'standard',  -- xs/sm/standard/lg/xl
  font_size_px INTEGER DEFAULT 14,
  font_family TEXT DEFAULT 'system-ui',
  
  -- 颜色
  accent_color TEXT DEFAULT '#22C55E',
  primary_color TEXT,
  secondary_color TEXT,
  background_color TEXT,
  text_color TEXT,
  
  -- 消息气泡
  bubble_style TEXT DEFAULT 'rounded',  -- rounded/square
  bubble_opacity REAL DEFAULT 1.0,
  
  -- 自定义 CSS
  custom_css TEXT,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 通知配置表
CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_type TEXT NOT NULL,  -- desktop/sound/email/webhook/sms
  
  -- 开关
  enabled INTEGER DEFAULT 1,
  
  -- 配置
  config TEXT,  -- JSON
  
  -- 事件类型
  events TEXT,  -- JSON array: ["message", "task", "mention", "system"]
  
  -- 时间段（免打扰）
  quiet_hours_start TEXT,  -- e.g., "22:00"
  quiet_hours_end TEXT,  -- e.g., "08:00"
  quiet_hours_timezone TEXT DEFAULT 'Asia/Shanghai',
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER,
  
  UNIQUE(user_id, channel_type)
);

-- 通知历史表
CREATE TABLE notification_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- 通知内容
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  image TEXT,
  
  -- 类型
  type TEXT NOT NULL,  -- message/task/system/mention
  priority TEXT DEFAULT 'normal',  -- low/normal/high/urgent
  
  -- 关联数据
  related_type TEXT,  -- message/task/agent
  related_id TEXT,
  
  -- 渠道
  channel TEXT,  -- desktop/email/webhook
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending/sent/delivered/read/failed
  sent_at INTEGER,
  read_at INTEGER,
  
  -- 错误
  error_message TEXT,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 系统设置表
CREATE TABLE user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  
  -- 语言
  language TEXT DEFAULT 'zh-CN',
  
  -- 时区
  timezone TEXT DEFAULT 'Asia/Shanghai',
  
  -- 消息设置
  message_preview INTEGER DEFAULT 1,
  enter_to_send INTEGER DEFAULT 1,
  show_timestamps INTEGER DEFAULT 1,
  show_avatars INTEGER DEFAULT 1,
  
  -- 隐私设置
  show_online_status INTEGER DEFAULT 1,
  show_typing_status INTEGER DEFAULT 1,
  allow_mentions INTEGER DEFAULT 1,
  
  -- 其他设置
  settings TEXT,  -- JSON for additional settings
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 默认快捷键
INSERT INTO user_shortcuts (id, user_id, action, key_combo, description, enabled) VALUES
  ('default-1', 'system', 'new_task', 'Ctrl+N', '新建任务', 1),
  ('default-2', 'system', 'command_palette', 'Ctrl+/', '命令面板', 1),
  ('default-3', 'system', 'quick_search', 'Ctrl+K', '快速搜索', 1),
  ('default-4', 'system', 'pin_task', 'Ctrl+Shift+P', '置顶任务', 1),
  ('default-5', 'system', 'send_message', 'Ctrl+Enter', '发送消息', 1),
  ('default-6', 'system', 'close_modal', 'Escape', '关闭弹窗', 1),
  ('default-7', 'system', 'open_settings', 'Ctrl+,', '打开设置', 1),
  ('default-8', 'system', 'toggle_sidebar', 'Ctrl+B', '切换侧边栏', 1);

-- 索引
CREATE INDEX idx_user_shortcuts_user ON user_shortcuts(user_id);
CREATE INDEX idx_user_themes_user ON user_themes(user_id);
CREATE INDEX idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notification_history_user ON notification_history(user_id);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_user_settings_user ON user_settings(user_id);