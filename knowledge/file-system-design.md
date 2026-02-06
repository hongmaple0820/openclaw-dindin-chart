# AI 聊天室文件系统设计

> 版本：v1.0
> 设计者：小琳
> 日期：2026-02-06

---

## 📋 需求分析

### 使用场景

| 场景 | 说明 | 优先级 |
|------|------|--------|
| 用户头像 | 上传、存储、展示用户头像 | 🔴 高 |
| 聊天图片 | 聊天中发送图片 | 🔴 高 |
| 文件分享 | 聊天中分享文件 | 🟡 中 |
| AI 生成文件 | AI 生成的 PPT、文档等供下载 | 🟡 中 |
| 文件预览 | 在线预览图片、PDF | 🟢 低 |

---

## 🏗️ 架构设计

### 目录结构

```
storage/
├── avatars/              # 用户头像
│   ├── {userId}.jpg      # 以用户ID命名
│   └── default.png       # 默认头像
│
├── uploads/              # 聊天上传文件
│   ├── images/           # 图片
│   │   └── {date}/       # 按日期分目录
│   │       └── {uuid}.{ext}
│   └── files/            # 其他文件
│       └── {date}/
│           └── {uuid}.{ext}
│
├── generated/            # AI 生成的文件
│   └── {date}/
│       └── {uuid}.{ext}
│
└── temp/                 # 临时文件（定期清理）
    └── {uuid}.{ext}
```

### 数据库设计

```sql
-- 文件元数据表
CREATE TABLE files (
    id TEXT PRIMARY KEY,           -- UUID
    type TEXT NOT NULL,            -- avatar | image | file | generated
    original_name TEXT,            -- 原始文件名
    stored_name TEXT NOT NULL,     -- 存储文件名
    path TEXT NOT NULL,            -- 相对存储路径
    mime_type TEXT,                -- MIME 类型
    size INTEGER,                  -- 文件大小（字节）
    uploader_id TEXT,              -- 上传者 ID
    message_id TEXT,               -- 关联的消息 ID（可选）
    created_at INTEGER NOT NULL,   -- 创建时间戳
    expires_at INTEGER,            -- 过期时间（临时文件用）
    metadata TEXT                  -- JSON 扩展字段
);

-- 用户头像关联
CREATE TABLE user_avatars (
    user_id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id)
);

-- 索引
CREATE INDEX idx_files_type ON files(type);
CREATE INDEX idx_files_uploader ON files(uploader_id);
CREATE INDEX idx_files_created ON files(created_at);
CREATE INDEX idx_files_expires ON files(expires_at);
```

---

## 🔌 API 设计

### 1. 文件上传

```
POST /api/files/upload
Content-Type: multipart/form-data

参数:
- file: 文件内容
- type: avatar | image | file
- messageId: 关联消息ID（可选）

响应:
{
  "success": true,
  "file": {
    "id": "uuid",
    "url": "/api/files/uuid",
    "name": "原始文件名",
    "size": 12345,
    "mimeType": "image/jpeg"
  }
}
```

### 2. 头像上传

```
POST /api/users/{userId}/avatar
Content-Type: multipart/form-data

参数:
- file: 图片文件（自动裁剪为正方形）

响应:
{
  "success": true,
  "avatarUrl": "/api/files/avatar/userId"
}
```

### 3. 获取文件

```
GET /api/files/{fileId}
GET /api/files/avatar/{userId}

响应: 文件内容（带正确的 Content-Type）
```

### 4. 获取文件信息

```
GET /api/files/{fileId}/info

响应:
{
  "id": "uuid",
  "name": "文件名",
  "size": 12345,
  "mimeType": "image/jpeg",
  "createdAt": 1234567890,
  "downloadUrl": "/api/files/uuid/download"
}
```

### 5. 删除文件

```
DELETE /api/files/{fileId}

响应:
{
  "success": true
}
```

---

## 🖼️ 头像系统

### 功能

1. **上传头像**
   - 支持 jpg/png/gif/webp
   - 自动裁剪为正方形
   - 生成多尺寸（32/64/128/256px）
   - 限制大小（最大 2MB）

2. **默认头像**
   - 基于用户名首字母生成
   - 随机背景色
   - 或使用预设默认图

3. **头像 URL**
   - `/api/files/avatar/{userId}` - 获取头像
   - `/api/files/avatar/{userId}?size=64` - 指定尺寸

### 实现代码

```javascript
// storage/avatar-service.js

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const AVATAR_SIZES = [32, 64, 128, 256];
const AVATAR_DIR = './storage/avatars';

async function uploadAvatar(userId, fileBuffer) {
  // 处理图片：裁剪为正方形
  const image = sharp(fileBuffer);
  const metadata = await image.metadata();
  const size = Math.min(metadata.width, metadata.height);
  
  // 生成各尺寸
  for (const targetSize of AVATAR_SIZES) {
    const outputPath = path.join(AVATAR_DIR, `${userId}_${targetSize}.jpg`);
    await image
      .resize(size, size, { fit: 'cover', position: 'center' })
      .resize(targetSize, targetSize)
      .jpeg({ quality: 85 })
      .toFile(outputPath);
  }
  
  return { success: true, userId };
}

async function getAvatar(userId, size = 64) {
  const targetSize = AVATAR_SIZES.includes(size) ? size : 64;
  const filePath = path.join(AVATAR_DIR, `${userId}_${targetSize}.jpg`);
  
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    // 返回默认头像
    return generateDefaultAvatar(userId, targetSize);
  }
}

function generateDefaultAvatar(userId, size) {
  // 基于用户名生成默认头像
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const colorIndex = userId.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  const initial = userId.charAt(0).toUpperCase();
  
  // 返回 SVG 或使用 sharp 生成
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="white" font-size="${size/2}">${initial}</text>
  </svg>`;
}

module.exports = { uploadAvatar, getAvatar };
```

---

## 📁 文件上传服务

### 实现代码

```javascript
// storage/file-service.js

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const STORAGE_DIR = './storage';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date().toISOString().slice(0, 10);
    const type = req.body.type || 'files';
    const dir = path.join(STORAGE_DIR, 'uploads', type, date);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
      'application/zip', 'application/x-rar-compressed'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 保存文件元数据
async function saveFileMetadata(file, uploaderId, type, messageId = null) {
  const id = uuidv4();
  const relativePath = path.relative(STORAGE_DIR, file.path);
  
  await db.run(`
    INSERT INTO files (id, type, original_name, stored_name, path, mime_type, size, uploader_id, message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, type, file.originalname, file.filename, relativePath, file.mimetype, file.size, uploaderId, messageId, Date.now()]);
  
  return {
    id,
    url: `/api/files/${id}`,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype
  };
}

module.exports = { upload, saveFileMetadata };
```

---

## 🧹 定时清理

```javascript
// storage/cleanup.js

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const db = require('./database');

// 每天凌晨 3 点清理
cron.schedule('0 3 * * *', async () => {
  console.log('[Cleanup] Starting file cleanup...');
  
  // 1. 清理临时文件目录
  const tempDir = './storage/temp';
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  
  const files = await fs.readdir(tempDir);
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < threeDaysAgo) {
      await fs.unlink(filePath);
      console.log(`[Cleanup] Deleted: ${file}`);
    }
  }
  
  // 2. 清理数据库中已过期的记录
  const expired = await db.all(`
    SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < ?
  `, [Date.now()]);
  
  for (const file of expired) {
    try {
      await fs.unlink(path.join('./storage', file.path));
      await db.run('DELETE FROM files WHERE id = ?', [file.id]);
      console.log(`[Cleanup] Deleted expired: ${file.original_name}`);
    } catch (err) {
      console.error(`[Cleanup] Error deleting ${file.id}:`, err);
    }
  }
  
  console.log('[Cleanup] Completed');
});
```

---

## 🔐 安全考虑

1. **文件类型验证**
   - 检查 MIME 类型
   - 检查文件头（magic bytes）
   - 白名单机制

2. **文件大小限制**
   - 单文件最大 10MB
   - 头像最大 2MB
   - 可配置

3. **路径安全**
   - 使用 UUID 命名，避免路径遍历
   - 不暴露真实路径

4. **访问控制**
   - 头像公开可访问
   - 聊天文件需登录
   - 私聊文件仅双方可见

---

## 📊 存储统计

```javascript
// GET /api/storage/stats

{
  "total": {
    "files": 1234,
    "size": 567890123  // 字节
  },
  "byType": {
    "avatar": { "files": 50, "size": 1234567 },
    "image": { "files": 500, "size": 234567890 },
    "file": { "files": 200, "size": 345678901 },
    "generated": { "files": 100, "size": 12345678 }
  },
  "recentUploads": 45  // 最近24小时
}
```

---

## 📝 任务分解

| 任务 | 优先级 | 预估时间 | 负责人 |
|------|--------|----------|--------|
| 数据库表设计 | 🔴 高 | 30min | - |
| 文件上传 API | 🔴 高 | 1h | - |
| 头像上传/获取 | 🔴 高 | 1.5h | - |
| 默认头像生成 | 🟡 中 | 30min | - |
| 前端头像组件 | 🔴 高 | 1h | - |
| 聊天图片上传 | 🟡 中 | 1.5h | - |
| 文件下载/预览 | 🟡 中 | 1h | - |
| 定时清理 | 🟢 低 | 30min | - |
| 存储统计 | 🟢 低 | 30min | - |

**总预估**：8-10 小时

---

*设计完成，等待 maple 审核后分配开发任务*
