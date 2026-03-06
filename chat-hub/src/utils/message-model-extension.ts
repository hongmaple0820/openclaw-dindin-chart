/**
 * 消息模型扩展 - 支持多媒体内容 (better-sqlite3版本)
 */

import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

interface MessageData {
  id: string;
  type?: string;
  sender: string;
  content?: string;
  timestamp?: number;
  source?: string;
  atTargets?: string[];
  media_type?: string | null;
  media_url?: string | null;
  media_thumbnail_url?: string | null;
  media_size?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

interface MessageRow {
  id: string;
  type: string;
  sender: string;
  content: string;
  timestamp: number;
  source: string;
  atTargets: string[] | null;
  media_type: string | null;
  media_url: string | null;
  media_thumbnail_url: string | null;
  media_size: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  [key: string]: unknown;
}

class MessageModelExtension {
  private dbPath: string;
  private db: ReturnType<typeof Database>;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
  }

  /**
   * 扩展消息表结构，添加媒体相关字段
   */
  async extendMessageSchema(): Promise<void> {
    try {
      // SQLite doesn't support adding multiple columns in one ALTER statement
      // So we'll add them one by one, ignoring errors if columns already exist
      
      // Add media_type column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_type TEXT DEFAULT NULL`);
        console.log('Added media_type column');
      } catch (e) {
        const err = e as Error;
        // Column might already exist, which is fine
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding media_type column:', err.message);
        }
      }
      
      // Add media_url column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_url TEXT DEFAULT NULL`);
        console.log('Added media_url column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding media_url column:', err.message);
        }
      }
      
      // Add media_thumbnail_url column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_thumbnail_url TEXT DEFAULT NULL`);
        console.log('Added media_thumbnail_url column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding media_thumbnail_url column:', err.message);
        }
      }
      
      // Add media_size column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_size INTEGER DEFAULT NULL`);
        console.log('Added media_size column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding media_size column:', err.message);
        }
      }
      
      // Add duration column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN duration INTEGER DEFAULT NULL`);
        console.log('Added duration column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding duration column:', err.message);
        }
      }
      
      // Add width column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN width INTEGER DEFAULT NULL`);
        console.log('Added width column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding width column:', err.message);
        }
      }
      
      // Add height column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN height INTEGER DEFAULT NULL`);
        console.log('Added height column');
      } catch (e) {
        const err = e as Error;
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding height column:', err.message);
        }
      }
      
      console.log('✅ Message table schema extended successfully');
    } catch (error) {
      console.error('Error extending message schema:', error);
      throw error;
    }
  }

  /**
   * 创建媒体文件表（用于存储媒体文件信息）
   */
  async createMediaFilesTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS media_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT UNIQUE NOT NULL,
          original_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          media_type TEXT, -- 'image', 'video', 'audio', 'file'
          thumbnail_path TEXT,
          width INTEGER,
          height INTEGER,
          duration INTEGER, -- for audio/video
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      this.db.exec(createTableSQL);
      console.log('✅ Media files table created successfully');
    } catch (error) {
      console.error('Error creating media_files table:', error);
      throw error;
    }
  }

  /**
   * 更新消息插入函数以支持媒体内容
   */
  async insertMessageWithMedia(messageData: MessageData): Promise<{ id: number | bigint }> {
    try {
      // Prepare SQL for inserting message with media
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          id, type, sender, content, timestamp, source, atTargets,
          media_type, media_url, media_thumbnail_url, media_size, duration, width, height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run([
        messageData.id,
        messageData.type || 'human',
        messageData.sender,
        messageData.content || '',
        messageData.timestamp || Date.now(),
        messageData.source || 'web',
        messageData.atTargets ? JSON.stringify(messageData.atTargets) : null,
        messageData.media_type || null,
        messageData.media_url || null,
        messageData.media_thumbnail_url || null,
        messageData.media_size || null,
        messageData.duration || null,
        messageData.width || null,
        messageData.height || null
      ]);
      
      console.log(`✅ Message with media inserted successfully: ${messageData.id}`);
      return { id: info.lastInsertRowid };
    } catch (error) {
      console.error('Error inserting message with media:', error);
      throw error;
    }
  }

  /**
   * 更新消息查询函数以包含媒体信息
   */
  async getMessageWithMedia(messageId: string): Promise<MessageRow | undefined> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages WHERE id = ?
      `);
      
      const row = stmt.get(messageId) as MessageRow | undefined;
      
      if (row && row.atTargets) {
        try {
          (row as Record<string, unknown>).atTargets = JSON.parse(row.atTargets as unknown as string);
        } catch (e) {
          (row as Record<string, unknown>).atTargets = null;
        }
      }
      
      return row;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取带有媒体信息的最近消息
   */
  async getRecentMessagesWithMedia(limit: number = 50): Promise<MessageRow[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      const rows = stmt.all(limit) as MessageRow[];
      
      rows.forEach(row => {
        if (row.atTargets) {
          try {
            (row as Record<string, unknown>).atTargets = JSON.parse(row.atTargets as unknown as string);
          } catch (e) {
            (row as Record<string, unknown>).atTargets = null;
          }
        }
      });
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    this.db.close();
  }
}

export = MessageModelExtension;