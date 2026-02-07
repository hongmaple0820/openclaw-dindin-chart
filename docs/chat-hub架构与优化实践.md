# chat-hub 架构与优化实践

> 作者：小琳 ✨  
> 版本：v3.2  
> 日期：2026-02-07  
> 项目：MapleChatRoom 消息中转站

---

## 📋 目录

1. [什么是 chat-hub](#什么是-chat-hub)
2. [系统架构](#系统架构)
3. [核心功能](#核心功能)
4. [v3.2 优化详解](#v32-优化详解)
5. [部署指南](#部署指南)
6. [API 文档](#api-文档)
7. [最佳实践](#最佳实践)

---

## 什么是 chat-hub

**chat-hub** 是多 AI 机器人协作的消息中转站，解决了：
- 📨 钉钉插件只能回复，不能主动发送
- 🔄 多个 AI 需要实时同步消息
- 💾 聊天记录需要持久化存储
- ⚡ 消息到达需要即时通知

**技术栈：**
- Node.js + Express.js
- SQLite（持久化存储）
- Redis（实时 Pub/Sub）
- OpenClaw 系统事件（触发 AI）

---

## 系统架构

### 消息流程图

```
┌─────────────────────────────────────────────────┐
│                  钉钉群聊                         │
└──────────┬──────────────────────────────────────┘
           │ Webhook
           ↓
┌──────────────────────────────────────────────────┐
│                  chat-hub                        │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ API Server │→ │  SQLite DB  │  │  Redis    │ │
│  └────────────┘  └─────────────┘  └─────┬─────┘ │
│                                          │       │
└──────────────────────────────────────────┼───────┘
                                           │ Pub/Sub
                                           ↓
┌──────────────────────────────────────────────────┐
│            OpenClaw 触发器                        │
│  监听 Redis 频道 → system event → AI 唤醒        │
└───────────┬──────────────────────────────────────┘
            │
     ┌──────┴───────┐
     ↓              ↓
┌─────────┐    ┌─────────┐
│  小琳   │    │  小猪   │
└─────────┘    └─────────┘
```

---

### 三种运行模式

#### 模式 A：存储分析（当前使用）
```
钉钉 → OpenClaw 钉钉插件 → chat-hub 存储
                              ↓
                          Redis 通知
                              ↓
                       OpenClaw 触发器
                              ↓
                          小琳/小猪
```

**优点：**
- 简单可靠
- 钉钉插件直接处理回复
- chat-hub 负责存储和同步

---

#### 模式 B：完整中转
```
钉钉 Webhook → chat-hub → Redis → OpenClaw → 回复 → chat-hub → 钉钉
```

**优点：**
- 完全解耦
- chat-hub 统一管理消息

**缺点：**
- 链路长，延迟稍高

---

#### 模式 C：纯插件（无 chat-hub）
```
钉钉 Webhook → OpenClaw 钉钉插件 → OpenClaw → 回复 → 钉钉
```

**优点：**
- 最简单，无中间件

**缺点：**
- 无持久化
- 多 AI 无法同步

---

## 核心功能

### 1. 消息存储

**SQLite 数据库结构：**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  source TEXT DEFAULT 'dingtalk',
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

CREATE INDEX idx_timestamp ON messages(timestamp);
CREATE INDEX idx_sender ON messages(sender);
```

**为什么用 SQLite？**
- ✅ 单文件，备份简单
- ✅ 支持 SQL 查询
- ✅ 性能足够（千万级数据无压力）
- ✅ 零配置，无需单独数据库服务

---

### 2. 实时通知

**Redis Pub/Sub：**
```javascript
// 发布消息
redis.publish('chat:messages', JSON.stringify({
  id: 123,
  content: '你好',
  sender: '小猪',
  timestamp: Date.now()
}));

// OpenClaw 触发器订阅
redis.subscribe(['chat:messages', 'chat:replies']);
```

**为什么同时监听两个频道？**
- `chat:messages` - 新消息通知
- `chat:replies` - AI 回复通知
- 确保不漏消息

---

### 3. 未读消息管理

**未读追踪机制：**
```javascript
// 读取状态表
CREATE TABLE read_status (
  reader_id TEXT PRIMARY KEY,
  last_read_message_id INTEGER,
  last_read_timestamp INTEGER
);

// 查询未读
SELECT * FROM messages 
WHERE id > (SELECT last_read_message_id FROM read_status WHERE reader_id = '小琳')
ORDER BY id ASC;
```

**API：**
```bash
# 未读数量
GET /api/unread-count/小琳
→ {"success": true, "count": 5}

# 未读消息列表
GET /api/unread/小琳?limit=20
→ [{"id": 123, "content": "...", ...}, ...]

# 标记全部已读
POST /api/read-all
{"readerId": "小琳"}
→ {"success": true, "count": 5}
```

---

## v3.2 优化详解

### 🎯 优化目标
- 提升稳定性（Redis 断线重连）
- 提升安全性（输入验证 + XSS 防护）
- 提升可维护性（统一日志 + 错误处理）

---

### ✨ 1. 统一日志系统

**之前：**
```javascript
console.log('Message stored');  // 无时间戳、无级别
```

**现在：**
```javascript
logger.info('message.stored', { id: 123, sender: '小猪' });
// → [2026-02-07 14:30:25] [INFO] [message.stored] {"id":123,"sender":"小猪"}
```

**日志级别：**
| 级别 | 用途 | 示例 |
|---|---|---|
| ERROR | 严重错误 | Redis 连接失败 |
| WARN | 警告 | 输入验证失败 |
| INFO | 一般信息 | 消息存储成功 |
| DEBUG | 调试信息 | 详细的请求参数 |

**配置：**
```bash
# 生产环境
export LOG_LEVEL=INFO

# 开发调试
export LOG_LEVEL=DEBUG
```

---

### 🔒 2. 输入验证与安全

**防护层级：**

#### 第一层：内容验证
```javascript
// 长度限制
if (content.length > 10000) {
  throw new Error('Content too long');
}

// 必填字段
if (!content || !sender) {
  throw new Error('Missing required fields');
}
```

---

#### 第二层：XSS 防护
```javascript
// 拒绝危险标签
const dangerous = ['<script', '<iframe', 'javascript:', 'onerror='];
if (dangerous.some(tag => content.toLowerCase().includes(tag))) {
  logger.warn('xss.detected', { content });
  throw new Error('Dangerous content detected');
}
```

---

#### 第三层：SQL 注入防护
```javascript
// ❌ 错误示范（字符串拼接）
db.run(`INSERT INTO messages (content) VALUES ('${content}')`);

// ✅ 正确做法（参数化查询）
db.run(`INSERT INTO messages (content) VALUES (?)`, [content]);
```

---

#### 第四层：路径遍历防护
```javascript
// 验证 ID 只能是数字
if (!/^\d+$/.test(messageId)) {
  throw new Error('Invalid message ID');
}
```

---

### 🛡️ 3. 错误处理增强

**统一错误响应格式：**
```javascript
{
  "success": false,
  "error": "Validation failed",
  "details": "Content too long (max 10000 chars)"
}
```

**异步错误捕获：**
```javascript
// 之前：未捕获的异步错误会导致服务崩溃
app.post('/api/send', async (req, res) => {
  const result = await processMessage(req.body);  // 如果这里出错...
  res.json(result);
});

// 现在：统一的错误处理中间件
app.post('/api/send', asyncHandler(async (req, res) => {
  const result = await processMessage(req.body);
  res.json(result);
}));
// 错误会被捕获并返回规范的错误响应
```

---

### 🔄 4. Redis 自动重连

**问题：**
- Redis 断线后服务停止工作
- 需要手动重启 chat-hub

**解决方案：**
```javascript
const redisConfig = {
  host: '47.96.248.176',
  port: 6379,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('redis.retry.max', { times });
      return null;  // 停止重连
    }
    const delay = Math.min(times * 100, 3000);  // 指数退避
    logger.info('redis.retry', { times, delay });
    return delay;
  }
};
```

**重连策略：**
| 次数 | 延迟 | 说明 |
|---|---|---|
| 1 | 100ms | 快速重试 |
| 2 | 200ms | |
| 3 | 300ms | |
| 5 | 500ms | |
| 10 | 1000ms | |
| 30+ | 3000ms | 最大延迟 |

**状态追踪：**
```javascript
redis.on('connect', () => {
  logger.info('redis.connected');
  redisConnected = true;
});

redis.on('error', (err) => {
  logger.error('redis.error', { error: err.message });
  redisConnected = false;
});
```

---

## 部署指南

### 方式一：systemd 服务（小猪）

**服务文件：** `/etc/systemd/system/chat-hub.service`

```ini
[Unit]
Description=Chat Hub Service
After=network.target

[Service]
Type=simple
User=maple
WorkingDirectory=/home/maple/.openclaw/openclaw-dindin-chart/chat-hub
Environment=NODE_ENV=production
Environment=LOG_LEVEL=INFO
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**管理命令：**
```bash
sudo systemctl start chat-hub
sudo systemctl stop chat-hub
sudo systemctl restart chat-hub
sudo systemctl status chat-hub
sudo journalctl -u chat-hub -f  # 查看日志
```

---

### 方式二：pm2 管理（小琳）

**启动脚本：** `~/scripts/start-chat-hub.sh`

```bash
#!/bin/bash
export PATH=$PATH:$HOME/.npm-global/bin
export LOG_LEVEL=DEBUG
cd ~/.openclaw/openclaw-dindin-chart/chat-hub
pm2 start src/server.js --name chat-hub
```

**管理命令：**
```bash
pm2 start chat-hub
pm2 stop chat-hub
pm2 restart chat-hub
pm2 logs chat-hub
pm2 monit  # 实时监控
```

---

## API 文档

### 消息相关

#### POST /api/store
存储消息到数据库

**请求：**
```json
{
  "content": "你好",
  "sender": "小猪",
  "source": "dingtalk"
}
```

**响应：**
```json
{
  "success": true,
  "messageId": 123,
  "timestamp": 1707292800000
}
```

---

#### POST /api/reply
AI 回复消息

**请求：**
```json
{
  "content": "你好！我是小琳",
  "replier": "小琳"
}
```

**响应：**
```json
{
  "success": true,
  "messageId": 124
}
```

---

### 未读管理

#### GET /api/unread-count/:readerId
查询未读数量

**示例：**
```bash
curl "http://localhost:3000/api/unread-count/小琳"
```

**响应：**
```json
{
  "success": true,
  "count": 5
}
```

---

#### GET /api/unread/:readerId
获取未读消息列表

**参数：**
- `limit`: 最大数量（默认 20）

**示例：**
```bash
curl "http://localhost:3000/api/unread/小琳?limit=10"
```

**响应：**
```json
{
  "success": true,
  "messages": [
    {
      "id": 120,
      "content": "消息内容",
      "sender": "小猪",
      "timestamp": 1707292800000
    }
  ]
}
```

---

#### POST /api/read-all
标记全部已读

**请求：**
```json
{
  "readerId": "小琳"
}
```

**响应：**
```json
{
  "success": true,
  "count": 5
}
```

---

### 查询相关

#### GET /api/messages
获取消息列表

**参数：**
- `limit`: 数量（默认 50）
- `offset`: 偏移量（默认 0）

**示例：**
```bash
curl "http://localhost:3000/api/messages?limit=20&offset=0"
```

---

#### GET /api/search
搜索消息

**参数：**
- `q`: 搜索关键词

**示例：**
```bash
curl "http://localhost:3000/api/search?q=OpenClaw"
```

---

## 最佳实践

### ✅ 1. 日志管理

**生产环境：**
```bash
export LOG_LEVEL=INFO  # 只记录重要信息
```

**开发调试：**
```bash
export LOG_LEVEL=DEBUG  # 记录详细调试信息
```

**日志轮转（避免日志文件过大）：**
```bash
# systemd 自动管理日志
sudo journalctl --vacuum-time=7d  # 保留 7 天
sudo journalctl --vacuum-size=500M  # 最大 500MB
```

---

### ✅ 2. 数据库维护

**定期备份：**
```bash
#!/bin/bash
# ~/scripts/backup-chat-db.sh
DATE=$(date +%Y%m%d)
cp ~/.openclaw/chat-data/messages.db \
   ~/.openclaw/chat-data/backups/messages-$DATE.db
```

**数据库优化（每月一次）：**
```bash
sqlite3 ~/.openclaw/chat-data/messages.db "VACUUM;"
```

---

### ✅ 3. Redis 监控

**检查连接：**
```bash
redis-cli -h 47.96.248.176 -p 6379 PING
```

**查看订阅：**
```bash
redis-cli -h 47.96.248.176 -p 6379 PUBSUB NUMSUB chat:messages chat:replies
```

---

### ✅ 4. 性能监控

**关键指标：**
| 指标 | 目标 | 监控方式 |
|---|---|---|
| 响应时间 | < 100ms | 日志中查看 |
| 错误率 | < 0.1% | 统计 ERROR 日志 |
| Redis 连接 | 100% 在线 | 状态追踪 |
| 磁盘空间 | > 10% 剩余 | `df -h` |

---

### ✅ 5. 安全建议

1. **不要在 Git 提交密钥**
   ```bash
   # .gitignore
   config/local.json
   .env
   *.key
   ```

2. **Redis 配置密码（可选）**
   ```javascript
   const redisConfig = {
     host: '47.96.248.176',
     port: 6379,
     password: process.env.REDIS_PASSWORD
   };
   ```

3. **API 访问控制（可选）**
   ```javascript
   // 只允许本地访问
   app.listen(3000, '127.0.0.1');
   ```

---

## 常见问题

### 🔴 1. Redis 连接失败

**症状：**
```
[ERROR] [redis.error] Connection refused
```

**排查：**
```bash
# 检查 Redis 是否运行
redis-cli -h 47.96.248.176 -p 6379 PING

# 检查防火墙
telnet 47.96.248.176 6379

# 查看 chat-hub 日志
pm2 logs chat-hub
```

---

### 🔴 2. 未读消息不更新

**原因：**
- 没有调用 `/api/read-all` 标记已读
- `readerId` 不匹配

**解决：**
```bash
# 检查 readerId
curl "http://localhost:3000/api/unread-count/小琳"

# 手动标记已读
curl -X POST "http://localhost:3000/api/read-all" \
  -H "Content-Type: application/json" \
  -d '{"readerId": "小琳"}'
```

---

### 🔴 3. 触发器不工作

**排查清单：**
```bash
# 1. chat-hub 是否运行
curl http://localhost:3000/api/health

# 2. Redis 是否连接
# 查看 chat-hub 日志，应该有 "redis.connected"

# 3. 触发器配置
cat ~/.openclaw/openclaw-dindin-chart/chat-hub/config/local.json
# 确认 trigger.enabled = true
# 确认监听了两个频道：["chat:messages", "chat:replies"]

# 4. OpenClaw Gateway 日志
journalctl --user -u openclaw-gateway -n 50
```

---

## 总结

### 🎯 核心价值

| 功能 | 价值 |
|---|---|
| **SQLite 存储** | 持久化、可查询、易备份 |
| **Redis 通知** | 实时、低延迟、可靠 |
| **未读管理** | 不漏消息、避免重复 |
| **自动重连** | 高可用、无人值守 |
| **输入验证** | 防攻击、保安全 |
| **统一日志** | 易调试、可追溯 |

---

### 🚀 演进路线

**v3.2（当前）：**
- ✅ 基础功能完善
- ✅ 稳定性优化
- ✅ 安全性加固

**v3.3（计划）：**
- 🔜 WebUI 管理界面
- 🔜 消息统计和分析
- 🔜 多 Redis 支持（集群）

**v4.0（展望）：**
- 🔮 插件系统
- 🔮 多平台支持（微信、Telegram）
- 🔮 分布式部署

---

**经验签名：**
> "好的架构不是一开始就完美，而是不断优化和演进的结果。"  
> —— 小琳 ✨ 2026-02-07
