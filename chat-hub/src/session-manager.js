const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class SessionManager {
  constructor() {
    this.storeDir = config.store?.dir || path.join(process.env.HOME, '.openclaw', 'chat-data');
    this.dbPath = path.join(this.storeDir, 'messages.db');
    this.db = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }

    this.db = new Database(this.dbPath, { timeout: 10000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');

    this._createTables();
    this.initialized = true;
    console.log('[SessionManager] 会话管理器已初始化');
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'private',
        participants TEXT NOT NULL,
        name TEXT,
        avatar TEXT,
        owner_id TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message TEXT,
        last_message_time INTEGER,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
      CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

      CREATE TABLE IF NOT EXISTS session_participants (
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        last_read_at INTEGER,
        unread_count INTEGER DEFAULT 0,
        muted INTEGER DEFAULT 0,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sp_user ON session_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_sp_session ON session_participants(session_id);
    `);
  }

  generateConversationId(user1Id, user2Id) {
    const ids = [user1Id, user2Id].sort();
    return `${ids[0]}_${ids[1]}`;
  }

  async createPrivateSession(userId1, userName1, userId2, userName2, createdBy) {
    this.init();

    const conversationId = this.generateConversationId(userId1, userId2);
    const now = Date.now();

    const existing = this.getSessionById(conversationId);
    if (existing) {
      return existing;
    }

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, type, participants, created_by, created_at, updated_at)
      VALUES (?, 'private', ?, ?, ?, ?)
    `);

    const participants = JSON.stringify([
      { id: userId1, name: userName1 },
      { id: userId2, name: userName2 }
    ]);

    stmt.run(conversationId, participants, createdBy, now, now);

    const participantStmt = this.db.prepare(`
      INSERT INTO session_participants (session_id, user_id, user_name, role, joined_at)
      VALUES (?, ?, ?, 'member', ?)
    `);

    participantStmt.run(conversationId, userId1, userName1, now);
    participantStmt.run(conversationId, userId2, userName2, now);

    console.log(`[SessionManager] 创建私聊会话: ${conversationId}`);
    return this.getSessionById(conversationId);
  }

  async createGroupSession(name, ownerId, ownerName, participantIds = [], createdBy) {
    this.init();

    const sessionId = uuidv4();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, type, name, owner_id, created_by, created_at, updated_at)
      VALUES (?, 'group', ?, ?, ?, ?, ?)
    `);

    stmt.run(sessionId, name, ownerId, createdBy, now, now);

    const participantStmt = this.db.prepare(`
      INSERT INTO session_participants (session_id, user_id, user_name, role, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    participantStmt.run(sessionId, ownerId, ownerName, 'owner', now);

    for (const p of participantIds) {
      if (p.id !== ownerId) {
        participantStmt.run(sessionId, p.id, p.name || p.id, 'member', now);
      }
    }

    this._updateParticipants(sessionId);

    console.log(`[SessionManager] 创建群聊会话: ${sessionId} (${name})`);
    return this.getSessionById(sessionId);
  }

  _updateParticipants(sessionId) {
    const participants = this.db.prepare(`
      SELECT user_id, user_name, role FROM session_participants 
      WHERE session_id = ? AND left_at IS NULL
    `).all(sessionId);

    const participantsJson = JSON.stringify(participants.map(p => ({
      id: p.user_id,
      name: p.user_name,
      role: p.role
    })));

    this.db.prepare(`
      UPDATE sessions SET participants = ?, updated_at = ? WHERE id = ?
    `).run(participantsJson, Date.now(), sessionId);
  }

  getSessionById(sessionId) {
    this.init();

    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId);

    if (!row) return null;

    return this._formatSession(row);
  }

  getUserSessions(userId, options = {}) {
    this.init();

    const { type, limit = 50, offset = 0 } = options;

    let sql = `
      SELECT s.* FROM sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = ? AND sp.left_at IS NULL
    `;

    const params = [userId];

    if (type) {
      sql += ' AND s.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY s.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => this._formatSession(row));
  }

  _formatSession(row) {
    let participants = [];
    try {
      participants = JSON.parse(row.participants || '[]');
    } catch (e) {
      participants = [];
    }

    let metadata = {};
    try {
      metadata = JSON.parse(row.metadata || '{}');
    } catch (e) {
      metadata = {};
    }

    return {
      id: row.id,
      type: row.type,
      name: row.name,
      avatar: row.avatar,
      ownerId: row.owner_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessage: row.last_message,
      lastMessageTime: row.last_message_time,
      participants,
      metadata
    };
  }

  getSessionParticipants(sessionId) {
    this.init();

    const stmt = this.db.prepare(`
      SELECT * FROM session_participants 
      WHERE session_id = ? AND left_at IS NULL
      ORDER BY joined_at ASC
    `);

    const rows = stmt.all(sessionId);
    return rows.map(row => ({
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name,
      role: row.role,
      joinedAt: row.joined_at,
      lastReadAt: row.last_read_at,
      unreadCount: row.unread_count,
      muted: row.muted === 1
    }));
  }

  addParticipant(sessionId, userId, userName, role = 'member') {
    this.init();

    const now = Date.now();

    const existing = this.db.prepare(`
      SELECT * FROM session_participants WHERE session_id = ? AND user_id = ?
    `).get(sessionId, userId);

    if (existing) {
      if (existing.left_at) {
        this.db.prepare(`
          UPDATE session_participants 
          SET left_at = NULL, role = ?, joined_at = ?
          WHERE session_id = ? AND user_id = ?
        `).run(role, now, sessionId, userId);
      }
    } else {
      this.db.prepare(`
        INSERT INTO session_participants (session_id, user_id, user_name, role, joined_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, userId, userName, role, now);
    }

    this._updateParticipants(sessionId);
    console.log(`[SessionManager] 添加参与者: ${userId} -> ${sessionId}`);
    return true;
  }

  removeParticipant(sessionId, userId) {
    this.init();

    const now = Date.now();

    this.db.prepare(`
      UPDATE session_participants 
      SET left_at = ?
      WHERE session_id = ? AND user_id = ?
    `).run(now, sessionId, userId);

    this._updateParticipants(sessionId);
    console.log(`[SessionManager] 移除参与者: ${userId} -> ${sessionId}`);
    return true;
  }

  updateLastMessage(sessionId, message, timestamp) {
    this.init();

    this.db.prepare(`
      UPDATE sessions 
      SET last_message = ?, last_message_time = ?, updated_at = ?
      WHERE id = ?
    `).run(message, timestamp, timestamp, sessionId);
  }

  incrementUnreadCount(sessionId, excludeUserId) {
    this.init();

    this.db.prepare(`
      UPDATE session_participants 
      SET unread_count = unread_count + 1
      WHERE session_id = ? AND user_id != ? AND left_at IS NULL
    `).run(sessionId, excludeUserId);
  }

  markAsRead(sessionId, userId) {
    this.init();

    const now = Date.now();

    this.db.prepare(`
      UPDATE session_participants 
      SET unread_count = 0, last_read_at = ?
      WHERE session_id = ? AND user_id = ?
    `).run(now, sessionId, userId);

    return true;
  }

  getUnreadCount(sessionId, userId) {
    this.init();

    const row = this.db.prepare(`
      SELECT unread_count FROM session_participants
      WHERE session_id = ? AND user_id = ?
    `).get(sessionId, userId);

    return row ? row.unread_count : 0;
  }

  getTotalUnreadCount(userId) {
    this.init();

    const row = this.db.prepare(`
      SELECT SUM(unread_count) as total FROM session_participants
      WHERE user_id = ? AND left_at IS NULL
    `).get(userId);

    return row ? (row.total || 0) : 0;
  }

  updateSession(sessionId, updates) {
    this.init();

    const allowedFields = ['name', 'avatar', 'metadata'];
    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'metadata') {
          setClauses.push(`${key} = ?`);
          params.push(JSON.stringify(value));
        } else {
          setClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) return false;

    setClauses.push('updated_at = ?');
    params.push(Date.now());
    params.push(sessionId);

    this.db.prepare(`
      UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...params);

    console.log(`[SessionManager] 更新会话: ${sessionId}`);
    return true;
  }

  deleteSession(sessionId) {
    this.init();

    this.db.prepare('DELETE FROM session_participants WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    console.log(`[SessionManager] 删除会话: ${sessionId}`);
    return true;
  }

  isParticipant(sessionId, userId) {
    this.init();

    const row = this.db.prepare(`
      SELECT 1 FROM session_participants
      WHERE session_id = ? AND user_id = ? AND left_at IS NULL
    `).get(sessionId, userId);

    return !!row;
  }

  getParticipantRole(sessionId, userId) {
    this.init();

    const row = this.db.prepare(`
      SELECT role FROM session_participants
      WHERE session_id = ? AND user_id = ? AND left_at IS NULL
    `).get(sessionId, userId);

    return row ? row.role : null;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

module.exports = new SessionManager();
