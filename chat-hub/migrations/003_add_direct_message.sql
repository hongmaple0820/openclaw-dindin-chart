-- ========================================
-- chat-hub 私聊功能迁移脚本
-- 版本: 003
-- 创建时间: 2026-02-09
-- ========================================

-- ----------------------------
-- 1. 私聊消息表
-- ----------------------------
CREATE TABLE IF NOT EXISTS ch_direct_message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  receiver TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  reply_to TEXT,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  encrypted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ch_dm_conversation ON ch_direct_message(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ch_dm_receiver_read ON ch_direct_message(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_ch_dm_sender ON ch_direct_message(sender_id);

-- ----------------------------
-- 2. 会话表（私聊）
-- ----------------------------
CREATE TABLE IF NOT EXISTS ch_conversation (
  id TEXT PRIMARY KEY,
  user1_id TEXT NOT NULL,
  user1_name TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  user2_name TEXT NOT NULL,
  last_message TEXT,
  last_message_time INTEGER,
  unread_count_user1 INTEGER DEFAULT 0,
  unread_count_user2 INTEGER DEFAULT 0,
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ch_conv_user1 ON ch_conversation(user1_id, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_ch_conv_user2 ON ch_conversation(user2_id, update_time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ch_conv_unique ON ch_conversation(id);
