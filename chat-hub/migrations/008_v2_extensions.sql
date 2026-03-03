-- Chat-Hub V2.0 数据库迁移
-- 日期: 2026-03-02

-- Agent 表
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,              -- opencode | doubao | claude | custom
  api_key_hash TEXT UNIQUE,
  permissions TEXT,       -- JSON array
  subscribed_channels TEXT, -- JSON array
  status TEXT DEFAULT 'active',
  created_at INTEGER,
  last_active INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- 消息扩展
ALTER TABLE messages ADD COLUMN sender_type TEXT DEFAULT 'human';
ALTER TABLE messages ADD COLUMN metadata TEXT;
ALTER TABLE messages ADD COLUMN is_recalled INTEGER DEFAULT 0;

-- 表情回应表
CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- 文件扩展
ALTER TABLE files ADD COLUMN storage_provider TEXT DEFAULT 'local';
ALTER TABLE files ADD COLUMN storage_bucket TEXT;

-- 角色记忆表
CREATE TABLE IF NOT EXISTS character_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT,
  user_id TEXT,
  memory_type TEXT,       -- event | preference | emotion
  content TEXT,
  importance INTEGER DEFAULT 5,
  timestamp INTEGER,
  tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_character ON character_memories(character_id);
CREATE INDEX IF NOT EXISTS idx_memories_user ON character_memories(user_id);

-- 关系表增强
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT,
  user_id TEXT,
  relationship_type TEXT,
  intimacy_level INTEGER DEFAULT 50,
  interaction_count INTEGER DEFAULT 0,
  last_interaction INTEGER,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_relationships_character ON relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user ON relationships(user_id);
