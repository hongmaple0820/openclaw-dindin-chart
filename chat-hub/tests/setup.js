/**
 * Jest 测试环境设置
 * 
 * 测试端口: 8274（避免与开发服务器冲突）
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 测试配置
const TEST_PORT = process.env.TEST_PORT || 8274;
const TEST_DB_PATH = path.join(os.homedir(), '.openclaw/chat-data/test-chat-hub.db');

// 全局测试数据库
let testDb = null;

/**
 * 初始化测试数据库
 */
function initTestDb() {
  // 确保目录存在
  const dbDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // 删除旧测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  testDb = new Database(TEST_DB_PATH);
  // WSL 兼容性：使用 DELETE 模式而非 WAL
  testDb.pragma('journal_mode = DELETE');
  
  // 创建必要的表
  createTables();
  
  return testDb;
}

/**
 * 创建数据库表
 */
function createTables() {
  // 技能表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      description TEXT,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      category TEXT DEFAULT 'general',
      tags TEXT,
      source TEXT,
      skill_path TEXT,
      config_schema TEXT,
      default_config TEXT,
      permissions TEXT,
      mcp_compatible INTEGER DEFAULT 0,
      mcp_tools TEXT,
      enabled INTEGER DEFAULT 1,
      is_public INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
  
  // 用户技能绑定表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      config TEXT,
      enabled INTEGER DEFAULT 1,
      pinned INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      last_used_at INTEGER,
      bound_at INTEGER,
      UNIQUE(user_id, skill_id)
    )
  `);
  
  // Agent 表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar TEXT,
      description TEXT,
      type TEXT DEFAULT 'user-added',
      is_public INTEGER DEFAULT 0,
      owner_id TEXT,
      api_endpoint TEXT,
      api_key TEXT,
      model TEXT,
      params TEXT,
      capabilities TEXT,
      memory_enabled INTEGER DEFAULT 1,
      memory_config TEXT,
      skills TEXT,
      status TEXT DEFAULT 'offline',
      last_active INTEGER,
      total_requests INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
  
  // API Token 表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      name TEXT,
      permissions TEXT,
      rate_limit INTEGER DEFAULT 60,
      request_count INTEGER DEFAULT 0,
      last_used INTEGER,
      expires_at INTEGER,
      created_at INTEGER,
      UNIQUE(token_hash)
    )
  `);
  
  // 任务表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      is_pinned INTEGER DEFAULT 0,
      creator_id TEXT,
      creator_type TEXT DEFAULT 'human',
      workspace_id TEXT,
      workspace_path TEXT,
      context TEXT,
      context_tokens INTEGER DEFAULT 0,
      tags TEXT,
      result TEXT,
      result_summary TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      duration_ms INTEGER,
      retry_count INTEGER DEFAULT 0,
      due_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
  
  // 任务执行者表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_type TEXT DEFAULT 'human',
      user_name TEXT,
      role TEXT DEFAULT 'collaborator',
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      UNIQUE(task_id, user_id)
    )
  `);
  
  // 任务上下文条目表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS task_context_items (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT,
      file_path TEXT,
      url TEXT,
      metadata TEXT,
      importance INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);
  
  // 任务评论表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      content TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER
    )
  `);
  
  // 任务日志表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      message TEXT,
      metadata TEXT,
      created_at INTEGER
    )
  `);
  
  // 定时任务表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      cron_expr TEXT,
      timezone TEXT DEFAULT 'Asia/Shanghai',
      interval_seconds INTEGER,
      run_once_at INTEGER,
      next_run_at INTEGER,
      last_run_at INTEGER,
      task_type TEXT NOT NULL,
      task_config TEXT,
      use_external INTEGER DEFAULT 0,
      external_type TEXT,
      external_config TEXT,
      input_params TEXT,
      enabled INTEGER DEFAULT 1,
      run_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      retry_on_failure INTEGER DEFAULT 1,
      max_retries INTEGER DEFAULT 3,
      retry_delay_seconds INTEGER DEFAULT 60,
      notify_on_success INTEGER DEFAULT 0,
      notify_on_failure INTEGER DEFAULT 1,
      notification_channels TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
  
  // 定时任务运行记录表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_task_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      scheduled_at INTEGER,
      started_at INTEGER,
      completed_at INTEGER,
      duration_ms INTEGER,
      status TEXT DEFAULT 'pending',
      result TEXT,
      error_message TEXT,
      is_retry INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      is_manual INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);
  
  // 沙箱表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      name TEXT,
      session_id TEXT,
      task_id TEXT,
      container_id TEXT,
      image TEXT DEFAULT 'node:18-slim',
      status TEXT DEFAULT 'created',
      cpu_limit INTEGER DEFAULT 1,
      memory_limit INTEGER DEFAULT 512,
      disk_limit INTEGER DEFAULT 1024,
      gpu_enabled INTEGER DEFAULT 0,
      network_enabled INTEGER DEFAULT 1,
      allowed_hosts TEXT,
      environment_vars TEXT,
      mounts TEXT,
      created_at INTEGER,
      last_activity INTEGER,
      expires_at INTEGER
    )
  `);
  
  // 沙箱日志表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS sandbox_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sandbox_id TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      message TEXT,
      metadata TEXT,
      created_at INTEGER
    )
  `);
  
  // 工作区表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'custom',
      path TEXT NOT NULL,
      owner_id TEXT,
      group_id TEXT,
      task_id TEXT,
      auto_cleanup INTEGER DEFAULT 1,
      cleanup_after_days INTEGER DEFAULT 7,
      max_size INTEGER DEFAULT 100,
      created_at INTEGER,
      last_accessed INTEGER
    )
  `);
  
  // 工作区文件表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS workspace_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT DEFAULT 'file',
      size INTEGER DEFAULT 0,
      mime_type TEXT,
      created_at INTEGER,
      modified_at INTEGER,
      UNIQUE(workspace_id, path)
    )
  `);
  
  // MCP 服务器表
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      description TEXT,
      type TEXT DEFAULT 'stdio',
      command TEXT,
      args TEXT,
      env TEXT,
      url TEXT,
      headers TEXT,
      is_public INTEGER DEFAULT 0,
      created_by TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      UNIQUE(name)
    )
  `);
}

/**
 * 清理测试数据库
 */
function cleanupTestDb() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  // 清理 WAL 文件
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

/**
 * 获取测试数据库实例
 */
function getTestDb() {
  if (!testDb) {
    initTestDb();
  }
  return testDb;
}

// 导出测试工具
module.exports = {
  TEST_PORT,
  TEST_DB_PATH,
  initTestDb,
  cleanupTestDb,
  getTestDb
};

// Jest 全局钩子
beforeAll(() => {
  initTestDb();
  console.log(`[Test] 测试数据库已初始化: ${TEST_DB_PATH}`);
});

afterAll(() => {
  cleanupTestDb();
  console.log('[Test] 测试数据库已清理');
});

// 每个测试后清理数据
afterEach(() => {
  // 清空表数据（保留表结构）
  if (testDb) {
    const tables = [
      'skills', 'user_skills', 'agents', 'api_tokens',
      'tasks', 'task_assignees', 'task_context_items', 'task_comments', 'task_logs',
      'scheduled_tasks', 'scheduled_task_runs',
      'sandboxes', 'sandbox_logs',
      'workspaces', 'workspace_files',
      'mcp_servers'
    ];
    
    for (const table of tables) {
      try {
        testDb.exec(`DELETE FROM ${table}`);
      } catch (e) {
        // 表可能不存在
      }
    }
  }
});
