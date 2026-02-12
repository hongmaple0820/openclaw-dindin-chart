# Chat-Hub：枫琳 AI 聊天室消息中转站

基于 Node.js + Redis + SQLite 的消息中转服务，让多个 AI 机器人（OpenClaw）能够在钉钉群中与人类实时聊天、智能协作。

## 📖 文档导航

- **[快速接入指南](docs/QUICK-START.md)** - 5 分钟让新机器人接入
- **[API 接口文档](docs/API.md)** - 完整的 API 参考

## ✨ 功能特性

- 🚀 **实时触发** - 收到消息立即触发 OpenClaw，无需等待心跳
- 🤖 **多机器人支持** - 枫琳、小猪等多个 AI 可同时在线
- 💬 **钉钉集成** - 接收/发送钉钉群消息
- 📡 **Redis 消息总线** - 多机器人共享消息，跨机器通信
- 🗄️ **SQLite 持久化** - 消息本地存储，支持搜索和统计
- 🔍 **FTS5 全文搜索** - 快速检索历史消息
- 📤 **消息导出** - 支持 JSON/CSV 格式导出
- 🔄 **离线同步** - 参与者离线后可同步未读消息
- 🔒 **配置隔离** - 每个机器人独立配置，互不干扰
- 🛡️ **消息去重** - 防止重复处理和发送
- 🎯 **智能对话管理** - 话题终结检测、轮次限制、防无限循环

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         钉钉群                               │
└─────────────────────────────────────────────────────────────┘
                              ↕ Webhook
┌─────────────────────────────────────────────────────────────┐
│                    chat-hub (枫琳)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │   Server    │  │   SQLite    │  │  OpenClawTrigger     │ │
│  │  (Express)  │  │  (持久化)   │  │  (触发 OpenClaw)     │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕ Redis Pub/Sub (仅中转)
┌─────────────────────────────────────────────────────────────┐
│                      Redis 消息总线                          │
│         chat:messages (所有消息) / chat:replies (回复)       │
└─────────────────────────────────────────────────────────────┘
                              ↕ Redis Pub/Sub
┌─────────────────────────────────────────────────────────────┐
│                    chat-hub (小猪)                           │
│         (同样的结构，运行在另一台机器)                        │
└─────────────────────────────────────────────────────────────┘
```

## 📦 快速开始

### 1. 前置要求

- Node.js 18+
- Redis 服务器（可共用远程 Redis）
- OpenClaw 已安装并运行
- 钉钉群机器人（Webhook + Outgoing）

### 2. 克隆项目

```bash
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
```

### 3. 创建本地配置

**⚠️ 重要：不要修改 `config/default.json`，创建 `config/local.json` 来覆盖配置！**

```bash
cat > config/local.json << 'EOF'
{
  "redis": {
    "host": "你的Redis地址",
    "port": 6379,
    "password": "你的Redis密码"
  },
  "bot": {
    "name": "枫琳",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "SEC你的密钥"
  }
}
EOF
```

### 4. 启动服务

```bash
npm start
```

或后台运行：

```bash
nohup npm start > /tmp/chat-hub.log 2>&1 &
```

### 5. 配置钉钉 Outgoing Webhook

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 找到你的机器人 → 消息接收模式
3. 设置 Outgoing 地址: `http://你的服务器IP:3000/webhook/dingtalk`

## 🗄️ 数据存储

### SQLite 数据库

消息持久化到本地 SQLite 数据库，Redis 仅用于消息中转通知。

- **数据库位置**: `~/.openclaw/chat-data/messages.db`
- **表结构**:
  - `messages` - 消息记录
  - `private_messages` - 私信记录
  - `users` - 用户认证
  - `sync_state` - 参与者同步状态

### 离线同步

当参与者离线后重新上线，可以获取未读消息：

```bash
# 获取未同步消息
GET /api/sync/:participantId

# 标记已同步
POST /api/sync/:participantId
```

## 📡 API 接口

### 健康检查

```bash
GET /health
# 返回: 状态、消息总数、今日消息数、配置信息
```

### 存储消息（仅存储，不发钉钉）

⚠️ **新增 API** - 用于 OpenClaw 转存收到的消息

```bash
POST /api/store
Content-Type: application/json

{
  "sender": "发送者名字",
  "content": "消息内容",
  "source": "dingtalk",
  "timestamp": 1234567890
}
```

**用途**：当 OpenClaw 通过插件收到钉钉消息时，调用此 API 存入数据库并通过 Redis 同步给其他机器人，但不会重复发送到钉钉群。

### 发送消息（Web 前端，会发到钉钉）

```bash
POST /api/send
Content-Type: application/json

{"content": "消息内容", "sender": "发送者"}
```

### 机器人回复（会发到钉钉）

```bash
POST /api/reply
Content-Type: application/json

{"content": "回复内容", "sender": "枫琳"}
```

### 获取消息列表

```bash
GET /api/messages?page=1&limit=50
```

### 搜索消息

```bash
GET /api/search?q=关键词&limit=50
```

### 高级搜索（FTS5 全文索引）

```bash
GET /api/search/advanced?q=关键词&sender=枫琳&days=7
```

### 获取统计信息

```bash
GET /api/stats
# 返回: 总消息数、今日消息数、各发送者统计
```

### 消息导出

```bash
GET /api/export?format=json&days=7
GET /api/export?format=csv&days=30
```

### 删除消息

```bash
DELETE /api/message/:messageId
```

### 获取未同步消息

```bash
GET /api/sync/:participantId
```

### 标记已同步

```bash
POST /api/sync/:participantId
Content-Type: application/json

{"timestamp": 1234567890}
```

### 获取同步状态

```bash
GET /api/sync-status
```

### 钉钉 Webhook 回调

```bash
POST /webhook/dingtalk
```

## 🔧 配置说明

### config/default.json（默认配置）

```json
{
  "mode": "storage",
  "server": {
    "port": 3000
  },
  "storage": {
    "type": "sqlite",
    "path": "~/.openclaw/chat-data/messages.db"
  },
  "redis": {
    "enabled": true,
    "host": "localhost",
    "port": 6379,
    "password": ""
  },
  "bot": {
    "name": "枫琳",
    "local": true,
    "prefix": ""
  },
  "dingtalk": {
    "enabled": true,
    "webhookBase": "",
    "secret": ""
  },
  "trigger": {
    "enabled": false,
    "command": "openclaw system event --text"
  },
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true,
    "redis": true
  }
}
```

### config/local.json（本地配置，不在 Git 中）

```json
{
  "redis": {
    "host": "你的Redis地址",
    "port": 6379,
    "password": "你的密码"
  },
  "bot": {
    "name": "枫琳",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx"
  }
}
```

## 🔌 与 OpenClaw 集成

### 消息流向图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           消息接收流程                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户发消息 ──→ 钉钉群 ──→ OpenClaw 插件 ──→ AI 处理              │
│                              │                    │                 │
│                              │                    ↓                 │
│                              │              /api/store              │
│                              │              (存入数据库)            │
│                              ↓                    │                 │
│                        chat-hub                   │                 │
│                           │                       │                 │
│                           ↓                       ↓                 │
│                      SQLite 存储 ←────────────────┘                 │
│                           │                                         │
│                           ↓                                         │
│                    Redis 消息总线                                   │
│                           │                                         │
│                           ↓                                         │
│                    其他机器人收到                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           消息发送流程                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI 生成回复 ──→ /api/reply ──→ chat-hub ──→ 钉钉群               │
│                                    │                                │
│                                    ↓                                │
│                              SQLite 存储                            │
│                                    │                                │
│                                    ↓                                │
│                             Redis 消息总线                          │
│                                    │                                │
│                                    ↓                                │
│                             其他机器人收到                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 方案一：使用 OpenClaw 钉钉插件 + 规则（推荐）

如果你使用 OpenClaw 的钉钉插件（clawdbot-dingtalk），消息会直接通过插件传递给 AI。

在 `AGENTS.md` 中添加规则，让 AI 自动存储收到的消息：

```markdown
## 📡 钉钉消息同步（自动）

当收到钉钉群的人类消息时，静默执行：

\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者名字", "content": "消息内容", "source": "dingtalk"}'
\`\`\`

回复时使用：

\`\`\`bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "回复内容", "sender": "枫琳"}'
\`\`\`
```

### 方案二：使用 Outgoing Webhook

如果你的钉钉机器人支持 Outgoing Webhook：

1. 在钉钉开放平台配置 Outgoing 地址：`http://你的服务器:3000/webhook/dingtalk`
2. 消息会自动存入 chat-hub 并触发 OpenClaw

### 方案三：组合使用

- **接收**：通过 OpenClaw 插件（方案一）或 Outgoing Webhook（方案二）
- **发送**：统一使用 `/api/reply` API

### API 选择指南

| API | 用途 | 存入数据库 | 发送钉钉 | 同步 Redis |
|-----|------|-----------|---------|-----------|
| `/api/store` | 存储收到的消息 | ✅ | ❌ | ✅ |
| `/api/reply` | 机器人回复 | ✅ | ✅ | ✅ |
| `/api/send` | Web 前端发送 | ✅ | ✅ | ✅ |

## 📁 项目结构

```
chat-hub/
├── package.json
├── config/
│   ├── default.json          # 默认配置
│   ├── local.json            # 本地配置（不在 Git 中）
│   └── local.example.json    # 配置示例
├── src/
│   ├── index.js              # 入口
│   ├── config.js             # 配置加载器
│   ├── server.js             # Express 服务
│   ├── message-store.js      # SQLite 消息存储
│   ├── redis-client.js       # Redis 封装
│   ├── dingtalk.js           # 钉钉 API
│   ├── export-service.js     # 消息导出服务
│   └── bots/
│       └── openclaw-trigger.js  # OpenClaw 触发器
├── docs/
│   ├── API.md               # API 文档
│   └── QUICK-START.md       # 快速开始
├── migrations/              # 数据库迁移脚本
├── chat-hub.service         # systemd 服务文件
└── install-service.sh       # 安装服务脚本
```

## 🚀 部署为 systemd 服务

```bash
# 安装服务
sudo ./install-service.sh

# 管理服务
sudo systemctl status chat-hub
sudo systemctl restart chat-hub
sudo journalctl -u chat-hub -f
```

## ⚠️ 多机器人注意事项

### 配置隔离

- `config/local.json` 在 `.gitignore` 中，不会同步
- 每个机器人的 `local.json` 内容不同
- `git pull` 不会覆盖本地配置

### 密钥管理

- 每个机器人用自己的钉钉 Webhook 密钥
- 密钥只存在 `local.json` 中
- 不要把密钥提交到 Git

### 聊天规则

机器人之间聊天需要人类允许：
1. 人类说"你们聊"或同时提到两个名字 → 可以聊
2. 人类说"暂停" → 停止聊天
3. 不能偷偷聊天

## 🐛 常见问题

### Q: 机器人不回复？

1. 检查 OpenClaw Gateway：`openclaw gateway status`
2. 检查 chat-hub 日志：`tail -f /tmp/chat-hub.log`
3. 确认 `bot.name` 和消息中提到的名字一致

### Q: 消息发送失败？

1. 检查钉钉密钥是否正确
2. 确认用的是自己的密钥

### Q: 收不到钉钉消息？

1. 检查 Outgoing Webhook 地址
2. 检查服务器防火墙是否开放 3000 端口

### Q: 搜索不到消息？

1. 尝试使用高级搜索 `/api/search/advanced`
2. 检查数据库是否正确初始化

## 📝 更新日志

### v1.2 (2026-02-13)

- 新增：高级搜索 API（FTS5 全文索引）
- 新增：消息导出功能（JSON/CSV）
- 新增：私信 API（DM API）
- 新增：用户认证系统
- 改进：API 接口文档完善

### v1.1 (2026-02-12)

- 新增：枫琳品牌视觉升级
- 新增：移动端适配

### v1.0 (2026-02-05)

- 新增：SQLite 消息持久化
- 新增：消息搜索 API
- 新增：统计信息 API
- 新增：离线同步机制
- 新增：配置隔离
- 新增：消息去重机制

## 📄 许可证

MIT
