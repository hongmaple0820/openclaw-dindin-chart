-- Migration 016: Data Relay Service (数据中转服务)
-- Phase 13: 替代 Redis，实现 SSE 数据同步

-- 中继实例表
CREATE TABLE relay_instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  relay_url TEXT,
  last_ping INTEGER,
  status TEXT DEFAULT 'offline',  -- offline/online/busy
  config TEXT,  -- JSON: {maxConnections, heartbeatInterval}
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER
);

-- 同步日志表
CREATE TABLE relay_sync_logs (
  id TEXT PRIMARY KEY,
  instance_id TEXT,
  sync_type TEXT NOT NULL,  -- message/file/config/user
  direction TEXT NOT NULL,  -- push/pull
  status TEXT NOT NULL,  -- pending/success/failed
  bytes_transferred INTEGER DEFAULT 0,
  records_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 文件分块表
CREATE TABLE file_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_hash TEXT NOT NULL,
  chunk_size INTEGER NOT NULL,
  chunk_data BLOB,
  is_compressed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(file_id, chunk_index)
);

-- 同步检查点表
CREATE TABLE sync_checkpoints (
  id TEXT PRIMARY KEY,
  instance_id TEXT,
  data_type TEXT NOT NULL,  -- messages/files/configs
  last_sync_id TEXT,
  last_sync_timestamp INTEGER,
  checksum TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER,
  UNIQUE(instance_id, data_type)
);

-- 索引
CREATE INDEX idx_relay_instances_token ON relay_instances(token);
CREATE INDEX idx_relay_instances_status ON relay_instances(status);
CREATE INDEX idx_relay_sync_logs_instance ON relay_sync_logs(instance_id);
CREATE INDEX idx_relay_sync_logs_type ON relay_sync_logs(sync_type);
CREATE INDEX idx_file_chunks_file ON file_chunks(file_id);
CREATE INDEX idx_sync_checkpoints_instance ON sync_checkpoints(instance_id);