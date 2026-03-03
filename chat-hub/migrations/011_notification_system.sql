-- 通知系统迁移
-- 创建时间: 2026-03-03

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- message, friend_request, group_invite, mention, system
  title TEXT,
  content TEXT,
  data TEXT,                    -- JSON 格式的额外数据
  is_read INTEGER DEFAULT 0,
  created_at INTEGER
);

-- 通知设置表
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id TEXT PRIMARY KEY,
  message_sound INTEGER DEFAULT 1,
  message_vibrate INTEGER DEFAULT 1,
  group_sound INTEGER DEFAULT 1,
  dm_sound INTEGER DEFAULT 1,
  mention_sound INTEGER DEFAULT 1,
  quiet_hours_start TEXT,       -- 免打扰开始时间 (HH:MM)
  quiet_hours_end TEXT          -- 免打扰结束时间 (HH:MM)
);

-- 置顶聊天表
CREATE TABLE IF NOT EXISTS pinned_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_type TEXT NOT NULL,      -- 'group' or 'dm'
  chat_id TEXT NOT NULL,        -- 群ID 或 用户ID
  pinned_at INTEGER,
  UNIQUE(user_id, chat_type, chat_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pinned_user ON pinned_chats(user_id);
