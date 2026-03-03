-- 群组表
CREATE TABLE IF NOT EXISTS chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  description TEXT,
  owner_id TEXT NOT NULL,
  owner_type TEXT DEFAULT 'human',
  created_at INTEGER,
  updated_at INTEGER,
  status TEXT DEFAULT 'active',
  max_members INTEGER DEFAULT 500,
  settings TEXT
);

-- 群成员表
CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_type TEXT DEFAULT 'human',
  nickname TEXT,
  role TEXT DEFAULT 'member',
  permissions TEXT,
  joined_at INTEGER,
  status TEXT DEFAULT 'active'
);

-- 群邀请表
CREATE TABLE IF NOT EXISTS group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_groups_owner ON chat_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_group_user ON group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_invites_group ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_invites_invitee ON group_invites(invitee_id);
