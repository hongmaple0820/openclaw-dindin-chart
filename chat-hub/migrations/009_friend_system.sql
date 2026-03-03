-- 好友系统数据库迁移
-- 日期: 2026-03-03

-- 好友关系表
CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  remark TEXT,
  friend_group TEXT DEFAULT '默认',
  status TEXT DEFAULT 'pending',
  source TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(user_id, friend_id)
);

-- 好友申请表
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  handled_at INTEGER,
  handled_by TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_from ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON friend_requests(status);
