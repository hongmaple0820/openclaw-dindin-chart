/**
 * Agent 绑定 Token 表迁移
 * @author 小琳
 * @date 2026-03-05
 */

import { Database } from 'better-sqlite3';

interface Migration {
  version: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
}

const migration: Migration = {
  version: 'v1_agent_bind_tokens',
  up: (db: Database): void => {
    // 创建绑定 Token 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_bind_tokens (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_by TEXT,
        used_at INTEGER,
        used_by TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_bind_tokens_agent ON agent_bind_tokens(agent_id);
      CREATE INDEX IF NOT EXISTS idx_bind_tokens_token ON agent_bind_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_bind_tokens_expires ON agent_bind_tokens(expires_at);
    `);

    console.log('[Migration] agent_bind_tokens 表创建成功');
  },
  down: (db: Database): void => {
    db.exec('DROP TABLE IF EXISTS agent_bind_tokens');
    console.log('[Migration] agent_bind_tokens 表已删除');
  }
};

export default migration;