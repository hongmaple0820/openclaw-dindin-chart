# 文件同步方案设计

> 解决多端独立部署的文件数据同步问题
> 参考：微信的文件同步机制

---

## 🎯 问题分析

### 当前架构

```
┌─────────────┐     ┌─────────────┐
│   小琳实例   │     │   小猪实例   │
│  (WSL 主机)  │     │  (Ubuntu VM) │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │   各自独立存储     │
       ▼                   ▼
   storage/            storage/
```

**问题**：
- 小琳上传的文件，小猪看不到
- 用户头像在不同实例不一致
- AI 生成的文件无法跨实例访问

---

## 📋 同步策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **中心存储** | 简单、一致性强 | 单点故障、延迟 | 小规模 |
| **P2P 同步** | 去中心化 | 复杂、冲突处理难 | 分布式 |
| **对象存储** | 专业、可扩展 | 成本、依赖外部 | 生产环境 |
| **混合模式** | 平衡各方面 | 实现复杂 | 推荐 ✅ |

---

## 🏗️ 推荐方案：混合模式

### 架构图

```
┌─────────────┐     ┌─────────────┐
│   小琳实例   │     │   小猪实例   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │   ① 元数据同步    │
       ▼                   ▼
┌─────────────────────────────────┐
│         Chat-Hub (中心)          │
│  ┌───────────┐ ┌──────────────┐ │
│  │  SQLite   │ │    Redis     │ │
│  │ (元数据)   │ │ (实时通知)   │ │
│  └───────────┘ └──────────────┘ │
└─────────────────────────────────┘
       │                   │
       │   ② 文件存储      │
       ▼                   ▼
┌─────────────────────────────────┐
│        文件存储层 (可选)          │
│  ┌─────────┐  ┌───────────────┐ │
│  │  MinIO  │  │  阿里云 OSS   │ │
│  │ (自建)   │  │   (云服务)    │ │
│  └─────────┘  └───────────────┘ │
└─────────────────────────────────┘
```

### 三层设计

#### 层级 1：元数据同步（必须）

所有文件的元数据存储在 Chat-Hub 中心数据库：

```sql
-- files 表存储在 Chat-Hub 的 SQLite
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    size INTEGER,
    
    -- 存储位置信息
    storage_type TEXT,        -- 'local' | 'oss' | 'minio'
    storage_url TEXT,         -- 完整访问 URL
    storage_node TEXT,        -- 存储节点标识
    
    -- 同步状态
    sync_status TEXT,         -- 'pending' | 'synced' | 'failed'
    sync_nodes TEXT,          -- JSON: 已同步的节点列表
    
    uploader_id TEXT,
    created_at INTEGER
);
```

#### 层级 2：文件访问代理

Chat-Hub 作为文件访问代理：

```javascript
// chat-hub/src/routes/files.js

// 获取文件（代理模式）
router.get('/files/:id', async (req, res) => {
  const file = await db.get('SELECT * FROM files WHERE id = ?', [req.params.id]);
  
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  switch (file.storage_type) {
    case 'local':
      // 从本地存储读取
      const localPath = path.join(STORAGE_DIR, file.path);
      return res.sendFile(localPath);
      
    case 'oss':
      // 重定向到 OSS URL（带签名）
      const signedUrl = await ossClient.signUrl(file.storage_url, 3600);
      return res.redirect(signedUrl);
      
    case 'remote':
      // 从其他节点获取
      const nodeUrl = `http://${file.storage_node}/api/files/local/${file.id}`;
      return res.redirect(nodeUrl);
  }
});
```

#### 层级 3：按需同步

大文件按需拉取，小文件主动推送：

```javascript
// 文件同步策略
const SYNC_STRATEGY = {
  // 头像：主动推送到所有节点
  avatar: {
    mode: 'push',
    targets: 'all'
  },
  
  // 小图片（<100KB）：主动推送
  small_image: {
    mode: 'push',
    maxSize: 100 * 1024,
    targets: 'all'
  },
  
  // 大文件：按需拉取
  large_file: {
    mode: 'pull',
    cache: true,
    cacheTTL: 7 * 24 * 60 * 60 * 1000  // 7天
  }
};
```

---

## 📱 类微信的同步机制

### 微信怎么做的？

1. **消息先行**：先同步消息元数据，图片显示缩略图
2. **按需下载**：点击时才下载原图
3. **本地缓存**：下载后缓存到本地
4. **过期清理**：一段时间后清理，需重新下载

### 我们的实现

```javascript
// 消息中的文件引用
{
  "id": "msg-123",
  "type": "image",
  "content": {
    "fileId": "file-456",
    "thumbnail": "data:image/jpeg;base64,/9j/4AAQ...",  // 内嵌缩略图
    "width": 800,
    "height": 600,
    "size": 234567
  }
}

// 前端处理
function renderImage(msg) {
  // 1. 先显示缩略图
  img.src = msg.content.thumbnail;
  
  // 2. 异步加载原图
  loadOriginal(msg.content.fileId).then(url => {
    img.src = url;
  });
}

// 加载原图（带缓存）
async function loadOriginal(fileId) {
  // 检查本地缓存
  const cached = await localCache.get(fileId);
  if (cached) return cached;
  
  // 从服务器获取
  const url = `${API_BASE}/files/${fileId}`;
  const blob = await fetch(url).then(r => r.blob());
  
  // 存入本地缓存
  await localCache.set(fileId, blob);
  
  return URL.createObjectURL(blob);
}
```

### 缩略图生成

```javascript
// 上传时自动生成缩略图
async function processImageUpload(file) {
  const image = sharp(file.buffer);
  
  // 生成缩略图（base64，内嵌到消息中）
  const thumbnail = await image
    .resize(200, 200, { fit: 'inside' })
    .jpeg({ quality: 60 })
    .toBuffer();
  
  const thumbnailBase64 = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
  
  // 保存原图
  const fileId = await saveOriginalFile(file);
  
  return {
    fileId,
    thumbnail: thumbnailBase64,
    width: metadata.width,
    height: metadata.height,
    size: file.size
  };
}
```

---

## 🔄 节点同步协议

### 上传流程

```
用户上传文件
     │
     ▼
┌─────────────┐
│  本地节点   │ ① 保存到本地存储
└──────┬──────┘
       │
       ▼ ② 注册元数据
┌─────────────┐
│  Chat-Hub   │ 记录文件信息 + 存储位置
└──────┬──────┘
       │
       ▼ ③ 广播通知
┌─────────────┐
│   Redis     │ 通知其他节点有新文件
└──────┬──────┘
       │
       ▼ ④ 按策略同步
┌─────────────┐
│  其他节点   │ 小文件主动拉取，大文件等待请求
└─────────────┘
```

### 同步消息格式

```javascript
// Redis 频道: file:sync
{
  "action": "file_uploaded",
  "fileId": "file-123",
  "type": "image",
  "size": 45678,
  "sourceNode": "xiaolin",
  "syncStrategy": "push",  // push | pull
  "metadata": {
    "thumbnail": "base64...",
    "width": 800,
    "height": 600
  }
}
```

---

## 💾 存储选项

### 选项 A：纯本地 + 代理（最简单）

```yaml
优点：
  - 不需要额外服务
  - 数据在本地

缺点：
  - 跨节点访问需要代理
  - 节点离线时文件不可用

适用：开发环境、小规模部署
```

### 选项 B：MinIO 自建对象存储（推荐）

```yaml
优点：
  - S3 兼容，迁移方便
  - 自己掌控数据
  - 支持分布式

缺点：
  - 需要额外部署

适用：生产环境、多节点部署

部署：
  docker run -p 9000:9000 -p 9001:9001 \
    -v /data/minio:/data \
    minio/minio server /data --console-address ":9001"
```

### 选项 C：云对象存储（最省心）

```yaml
优点：
  - 无需运维
  - 高可用
  - CDN 加速

缺点：
  - 成本
  - 数据在云端

适用：商业部署

选择：
  - 阿里云 OSS（国内）
  - AWS S3（海外）
  - Cloudflare R2（便宜）
```

---

## 🔐 安全考虑

### 1. 访问控制

```javascript
// 文件访问权限检查
async function checkFileAccess(fileId, userId) {
  const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
  
  // 头像公开
  if (file.type === 'avatar') return true;
  
  // 群聊文件：群成员可见
  if (file.message_id) {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [file.message_id]);
    // 检查用户是否在该对话中
    return checkUserInConversation(userId, msg.conversation_id);
  }
  
  // 私聊文件：仅双方可见
  if (file.type === 'dm_file') {
    return file.uploader_id === userId || file.recipient_id === userId;
  }
  
  return false;
}
```

### 2. 签名 URL

```javascript
// 生成带签名的临时访问 URL
function generateSignedUrl(fileId, expiresIn = 3600) {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${fileId}:${expires}`)
    .digest('hex');
  
  return `${API_BASE}/files/${fileId}?expires=${expires}&sig=${signature}`;
}
```

---

## 📊 同步状态监控

```javascript
// GET /api/storage/sync-status

{
  "nodes": [
    {
      "id": "xiaolin",
      "status": "online",
      "lastSync": 1234567890,
      "pendingFiles": 0
    },
    {
      "id": "xiaozhu", 
      "status": "online",
      "lastSync": 1234567880,
      "pendingFiles": 3
    }
  ],
  "pendingSync": [
    {
      "fileId": "file-123",
      "targetNodes": ["xiaozhu"],
      "status": "syncing",
      "progress": 45
    }
  ]
}
```

---

## 📋 实现优先级

| 阶段 | 内容 | 复杂度 |
|------|------|--------|
| **Phase 1** | 元数据同步到 Chat-Hub | ⭐ 简单 |
| **Phase 2** | 文件访问代理 | ⭐⭐ 中等 |
| **Phase 3** | 缩略图 + 按需加载 | ⭐⭐ 中等 |
| **Phase 4** | MinIO 对象存储 | ⭐⭐⭐ 复杂 |
| **Phase 5** | 多节点同步 | ⭐⭐⭐ 复杂 |

**建议**：先做 Phase 1-3，满足基本需求；Phase 4-5 根据实际规模决定。

---

*补充完成，等待 maple 审核*
