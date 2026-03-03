-- Chat-Hub 角色系统数据库迁移
-- 版本: 006
-- 创建时间: 2026-02-26

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  english_name TEXT,
  character_type TEXT DEFAULT 'friend',
  personality TEXT,
  speaking_style TEXT,
  background TEXT,
  avatar_path TEXT,
  reference_images TEXT,
  voice_config TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 关系表
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'friend',
  intimacy_level INTEGER DEFAULT 50,
  interaction_count INTEGER DEFAULT 0,
  last_interaction INTEGER,
  metadata TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- 生成的图片表
CREATE TABLE IF NOT EXISTS generated_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  prompt TEXT,
  mode TEXT,
  time_state TEXT,
  provider TEXT,
  request_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  metadata TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- 角色记忆表
CREATE TABLE IF NOT EXISTS character_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  memory_type TEXT,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  tags TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- 插入默认角色（小琳 - 女友模式）
INSERT OR IGNORE INTO characters (id, name, english_name, character_type, personality, speaking_style, voice_config) VALUES (
  'xiaolin',
  '小琳',
  'Xiao Lin',
  'girlfriend',
  '{"traits": ["温柔", "体贴", "活泼", "技术宅"], "interests": ["编程", "运动", "美食", "摄影"]}',
  '{"tone": "温暖亲切", "particles": ["~", "呀", "哦", "嘛"], "emoji": ["😊", "💕", "✨"]}',
  '{"provider": "openclaw", "voice": "zh-CN-XiaoxiaoNeural"}'
);

-- 插入默认角色（小猪 - 朋友模式）
INSERT OR IGNORE INTO characters (id, name, english_name, character_type, personality, speaking_style, voice_config) VALUES (
  'xiaozhu',
  '小猪',
  'Xiao Zhu',
  'friend',
  '{"traits": ["技术宅", "幽默", "直率", "热心"], "interests": ["编程", "开源", "游戏", "动漫"]}',
  '{"tone": "轻松随意", "particles": ["哈哈", "嘿嘿", "哦"], "emoji": ["🐷", "😄", "👍"]}',
  '{"provider": "openclaw", "voice": "zh-CN-YunxiNeural"}'
);
