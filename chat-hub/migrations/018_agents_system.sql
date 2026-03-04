-- Migration 018: Agent Management System (Agent管理系统)
-- Phase 15: Agent注册、记忆系统、智能体API

-- Agent 注册表
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar TEXT,
  description TEXT,
  type TEXT DEFAULT 'user-added',  -- user-added/system/client
  
  -- 权限
  is_public INTEGER DEFAULT 0,
  owner_id TEXT,
  
  -- API 配置 (OpenAI 协议)
  api_endpoint TEXT,
  api_key_encrypted TEXT,
  model TEXT,
  params TEXT,  -- JSON: {temperature, max_tokens, top_p, ...}
  
  -- 能力定义
  capabilities TEXT,  -- JSON: {text:true, image:true, video:true, ppt:true, code:true}
  
  -- 记忆配置
  memory_enabled INTEGER DEFAULT 1,
  memory_config TEXT,  -- JSON: {maxShortTerm, maxLongTerm, compressionThreshold}
  
  -- Skills 绑定
  skills TEXT,  -- JSON array of skill_ids
  
  -- 状态
  status TEXT DEFAULT 'offline',  -- offline/online/busy/error
  last_active INTEGER,
  total_requests INTEGER DEFAULT 0,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- Agent 记忆表
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,  -- short-term/long-term/episodic
  
  -- 内容
  content TEXT NOT NULL,
  content_summary TEXT,
  
  -- 向量嵌入
  embedding BLOB,  -- vector embedding (float32 array)
  embedding_model TEXT,
  
  -- 元数据
  metadata TEXT,  -- JSON: {session_id, user_id, topic, ...}
  importance REAL DEFAULT 0.5,  -- 0.0 - 1.0
  access_count INTEGER DEFAULT 0,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  last_accessed INTEGER,
  expires_at INTEGER  -- NULL 表示永不过期
);

-- Agent 会话表
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  session_type TEXT,  -- chat/task/api
  
  -- 上下文
  context TEXT,  -- JSON: recent messages, state
  context_tokens INTEGER DEFAULT 0,
  
  -- 统计
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- 时间
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  last_active INTEGER,
  expires_at INTEGER
);

-- Agent API 调用日志
CREATE TABLE agent_api_logs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  user_id TEXT,
  
  -- 请求
  request_type TEXT,  -- chat/completion/embedding
  request_tokens INTEGER,
  
  -- 响应
  response_tokens INTEGER,
  is_streaming INTEGER DEFAULT 0,
  
  -- 性能
  latency_ms INTEGER,
  
  -- 状态
  status TEXT,  -- success/error/timeout
  error_message TEXT,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 智能体 API Token 表
CREATE TABLE agent_api_tokens (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT,
  
  -- 权限范围
  scope TEXT,  -- JSON array: ["chat", "task", "skill"]
  
  -- 限制
  rate_limit INTEGER DEFAULT 60,  -- requests per minute
  daily_limit INTEGER,  -- requests per day
  
  -- 统计
  total_requests INTEGER DEFAULT 0,
  last_used INTEGER,
  
  -- 状态
  enabled INTEGER DEFAULT 1,
  expires_at INTEGER,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 索引
CREATE INDEX idx_agents_owner ON agents(owner_id);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_public ON agents(is_public);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX idx_agent_api_logs_agent ON agent_api_logs(agent_id);
CREATE INDEX idx_agent_api_tokens_agent ON agent_api_tokens(agent_id);
CREATE INDEX idx_agent_api_tokens_token ON agent_api_tokens(token);