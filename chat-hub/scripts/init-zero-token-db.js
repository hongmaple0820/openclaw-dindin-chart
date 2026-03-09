/**
 * Zero Token 数据库初始化脚本
 * 
 * 创建 Provider 和 Zero Token 相关的数据表
 * @version 1.0.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME, '.openclaw', 'chat-data');
const DB_PATH = path.join(DATA_DIR, 'chat-hub.db');

// 确保目录存在
fs.mkdirSync(DATA_DIR, { recursive: true });

// 创建数据库连接
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('[Zero Token DB] 初始化数据库...');
console.log(`[Zero Token DB] 数据库路径: ${DB_PATH}`);

// ============================================
// 创建表
// ============================================

// providers 表 - Provider 配置
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    type TEXT NOT NULL CHECK(type IN ('free', 'paid', 'local')),
    priority INTEGER DEFAULT 10,
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'error', 'configuring')),
    config TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  )
`);

// models 表 - 模型信息
db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    capabilities TEXT,
    context_window INTEGER DEFAULT 4096,
    max_output INTEGER DEFAULT 2048,
    pricing TEXT,
    tags TEXT,
    deprecated INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// credentials 表 - 凭证信息
db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('api_key', 'session_token', 'cookie')),
    value TEXT NOT NULL,
    expires_at INTEGER,
    last_used INTEGER,
    status TEXT DEFAULT 'valid' CHECK(status IN ('valid', 'expired', 'invalid')),
    source TEXT DEFAULT 'manual' CHECK(source IN ('zero_token', 'manual', 'env')),
    metadata TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  )
`);

// zero_token_sessions 表 - Zero Token 登录会话
db.exec(`
  CREATE TABLE IF NOT EXISTS zero_token_sessions (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
    credential_id TEXT,
    error_message TEXT,
    started_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    completed_at INTEGER,
    FOREIGN KEY (credential_id) REFERENCES credentials(id)
  )
`);

// provider_usage 表 - Provider 使用统计
db.exec(`
  CREATE TABLE IF NOT EXISTS provider_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    user_id TEXT,
    conversation_id TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// ============================================
// 创建索引
// ============================================

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider);
  CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
  CREATE INDEX IF NOT EXISTS idx_credentials_source ON credentials(source);
  
  CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider_id);
  
  CREATE INDEX IF NOT EXISTS idx_usage_provider ON provider_usage(provider_id);
  CREATE INDEX IF NOT EXISTS idx_usage_created ON provider_usage(created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON provider_usage(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_sessions_platform ON zero_token_sessions(platform);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON zero_token_sessions(status);
`);

// ============================================
// 插入默认数据
// ============================================

// 插入 Zero Token Provider
const insertProvider = db.prepare(`
  INSERT OR REPLACE INTO providers (id, name, display_name, type, priority, status, config)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertProvider.run(
  'zero-token',
  'zero-token',
  'Zero Token (免费)',
  'free',
  1,
  'configuring',
  JSON.stringify({
    enabled: true,
    priority: 1
  })
);

// 插入默认模型
const insertModel = db.prepare(`
  INSERT OR REPLACE INTO models (id, provider_id, name, display_name, description, capabilities, context_window, max_output, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const defaultModels = [
  // OpenAI 模型
  {
    id: 'gpt-4o',
    provider_id: 'zero-token',
    name: 'gpt-4o',
    display_name: 'GPT-4o (via Zero Token)',
    description: '最新的 GPT-4 优化版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 128000,
    max_output: 4096,
    tags: JSON.stringify(['推荐', '多模态'])
  },
  {
    id: 'gpt-4-turbo',
    provider_id: 'zero-token',
    name: 'gpt-4-turbo',
    display_name: 'GPT-4 Turbo (via Zero Token)',
    description: 'GPT-4 Turbo 版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 128000,
    max_output: 4096,
    tags: JSON.stringify(['多模态'])
  },
  {
    id: 'gpt-3.5-turbo',
    provider_id: 'zero-token',
    name: 'gpt-3.5-turbo',
    display_name: 'GPT-3.5 Turbo (via Zero Token)',
    description: '快速经济的 GPT-3.5',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: false, tools: true }),
    context_window: 16385,
    max_output: 4096,
    tags: JSON.stringify(['快速', '经济'])
  },

  // Anthropic 模型
  {
    id: 'claude-3-5-sonnet-20241022',
    provider_id: 'zero-token',
    name: 'claude-3-5-sonnet-20241022',
    display_name: 'Claude 3.5 Sonnet (via Zero Token)',
    description: '最新的 Claude 3.5 版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 200000,
    max_output: 8192,
    tags: JSON.stringify(['推荐', '多模态'])
  },
  {
    id: 'claude-3-opus-20240229',
    provider_id: 'zero-token',
    name: 'claude-3-opus-20240229',
    display_name: 'Claude 3 Opus (via Zero Token)',
    description: 'Claude 3 最强版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 200000,
    max_output: 4096,
    tags: JSON.stringify(['最强'])
  },
  {
    id: 'claude-3-haiku-20240307',
    provider_id: 'zero-token',
    name: 'claude-3-haiku-20240307',
    display_name: 'Claude 3 Haiku (via Zero Token)',
    description: 'Claude 3 快速版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: false, tools: true }),
    context_window: 200000,
    max_output: 4096,
    tags: JSON.stringify(['快速', '经济'])
  },

  // Google 模型
  {
    id: 'gemini-2.0-flash-exp',
    provider_id: 'zero-token',
    name: 'gemini-2.0-flash-exp',
    display_name: 'Gemini 2.0 Flash (via Zero Token)',
    description: '最新的 Gemini 2.0 实验版',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 1000000,
    max_output: 8192,
    tags: JSON.stringify(['推荐', '超长上下文'])
  },
  {
    id: 'gemini-1.5-pro',
    provider_id: 'zero-token',
    name: 'gemini-1.5-pro',
    display_name: 'Gemini 1.5 Pro (via Zero Token)',
    description: 'Gemini 1.5 Pro 版本',
    capabilities: JSON.stringify({ chat: true, stream: true, vision: true, tools: true }),
    context_window: 1000000,
    max_output: 8192,
    tags: JSON.stringify(['超长上下文'])
  }
];

for (const model of defaultModels) {
  insertModel.run(
    model.id,
    model.provider_id,
    model.name,
    model.display_name,
    model.description,
    model.capabilities,
    model.context_window,
    model.max_output,
    model.tags
  );
}

// 关闭数据库
db.close();

console.log('[Zero Token DB] 数据库初始化完成');
console.log(`[Zero Token DB] 已创建 ${defaultModels.length} 个默认模型`);