/**
 * 消息模型扩展 - 支持多媒体内容 (better-sqlite3版本)
 */

const Database = require('better-sqlite3');
const path = require('path');

class MessageModelExtension {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
  }

  /**
   * 扩展消息表结构，添加媒体相关字段
   */
  extendMessageSchema() {
    try {
      // SQLite doesn't support adding multiple columns in one ALTER statement
      // So we'll add them one by one, ignoring errors if columns already exist
      
      // Add media_type column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_type TEXT DEFAULT NULL`);
        console.log('Added media_type column');
      } catch (e) {
        // Column might already exist, which is fine
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding media_type column:', e.message);
        }
      }
      
      // Add media_url column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_url TEXT DEFAULT NULL`);
        console.log('Added media_url column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding media_url column:', e.message);
        }
      }
      
      // Add media_thumbnail_url column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_thumbnail_url TEXT DEFAULT NULL`);
        console.log('Added media_thumbnail_url column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding media_thumbnail_url column:', e.message);
        }
      }
      
      // Add media_size column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN media_size INTEGER DEFAULT NULL`);
        console.log('Added media_size column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding media_size column:', e.message);
        }
      }
      
      // Add duration column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN duration INTEGER DEFAULT NULL`);
        console.log('Added duration column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding duration column:', e.message);
        }
      }
      
      // Add width column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN width INTEGER DEFAULT NULL`);
        console.log('Added width column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding width column:', e.message);
        }
      }
      
      // Add height column
      try {
        this.db.exec(`ALTER TABLE messages ADD COLUMN height INTEGER DEFAULT NULL`);
        console.log('Added height column');
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error('Error adding height column:', e.message);
        }
      }
      
      console.log('✅ Message table schema extended successfully');
      return Promise.resolve();
    } catch (error) {
      console.error('Error extending message schema:', error);
      return Promise.reject(error);
    }
  }

  /**
   * 创建媒体文件表（用于存储媒体文件信息）
   */
  createMediaFilesTable() {
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
      return Promise.resolve();
    } catch (error) {
      console.error('Error creating media_files table:', error);
      return Promise.reject(error);
    }
  }

  /**
   * 更新消息插入函数以支持媒体内容
   */
  insertMessageWithMedia(messageData) {
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
      return Promise.resolve({ id: info.lastInsertRowid });
    } catch (error) {
      console.error('Error inserting message with media:', error);
      return Promise.reject(error);
    }
  }

  /**
   * 更新消息查询函数以包含媒体信息
   */
  getMessageWithMedia(messageId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages WHERE id = ?
      `);
      
      const row = stmt.get(messageId);
      
      if (row && row.atTargets) {
        try {
          row.atTargets = JSON.parse(row.atTargets);
        } catch (e) {
          row.atTargets = null;
        }
      }
      
      return Promise.resolve(row);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 获取带有媒体信息的最近消息
   */
  getRecentMessagesWithMedia(limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      const rows = stmt.all(limit);
      
      rows.forEach(row => {
        if (row.atTargets) {
          try {
            row.atTargets = JSON.parse(row.atTargets);
          } catch (e) {
            row.atTargets = null;
          }
        }
      });
      
      return Promise.resolve(rows);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
    return Promise.resolve();
  }
}

module.exports = MessageModelExtension;

// For testing purposes
if (require.main === module) {
  console.log('MessageModelExtension module loaded successfully');
}