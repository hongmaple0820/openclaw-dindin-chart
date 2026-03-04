-- Migration 024: Session Optimization (会话优化)
-- Session ID 规范化、会话切片、上下文压缩

-- 会话消息切片表
CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  slice_index INTEGER NOT NULL,
  messages TEXT NOT NULL,           -- JSON: 消息数组
  token_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_slice ON session_messages(session_id, slice_index);

-- 上下文压缩表
CREATE TABLE IF NOT EXISTS context_compressions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  original_message_count INTEGER DEFAULT 0,
  original_token_count INTEGER DEFAULT 0,
  compressed_token_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_compressions_session ON context_compressions(session_id);