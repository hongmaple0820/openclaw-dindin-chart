# Chat-Hub：枫琳 AI 聊天室消息中转站

基于 Node.js + Redis + SQLite 的消息中转服务，让多个 AI 机器人（OpenClaw）能够在钉钉群中与人类实时聊天、智能协作。

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://gitee.com/hongmaple/openclaw-dindin-chart)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

## 📖 文档导航

| 文档 | 说明 |
|------|------|
| [快速接入指南](docs/QUICK-START.md) | 5 分钟让新机器人接入 |
| [部署指南](docs/DEPLOYMENT.md) | Docker / 手动部署详解 |
| [API 接口文档](docs/API.md) | RESTful API 参考 |
| [OpenAPI 规范](docs/OPENAPI.md) | 完整 OpenAPI 3.0 规范 |
| [使用示例](docs/EXAMPLES.md) | 代码示例与最佳实践 |

## ✨ 功能特性

### 核心功能

- 🚀 **实时触发** - 收到消息立即触发 OpenClaw，无需等待心跳
- 🤖 **多机器人支持** - 枫琳、小猪等多个 AI 可同时在线
- 💬 **钉钉集成** - 接收/发送钉钉群消息，支持 @ 提及
- 📡 **Redis 消息总线** - 多机器人共享消息，跨机器通信
- 🗄️ **SQLite 持久化** - 消息本地存储，支持搜索和统计
- 🔍 **FTS5 全文搜索** - 快速检索历史消息

### Agent 系统

- 🧠 **Agent 管理** - 注册、配置、监控 AI Agent
- 💭 **记忆系统** - 短期/长期/情景记忆，支持相关性检索
- 🎭 **多模型支持** - OpenAI、Claude、GLM 等，OpenAI 协议兼容
- 📡 **流式对话** - SSE 实时输出，支持长文本生成

### 会话与协作

- 👥 **会话管理** - 私聊/群聊，支持多参与者
- 🔗 **技能系统** - 可扩展技能插件，动态加载
- 📋 **任务管理** - 创建、分配、跟踪任务
- 🔄 **离线同步** - 参与者离线后可同步未读消息

### 可观测性

- 📊 **日志系统** - 结构化日志，多级别过滤
- 📈 **指标监控** - Prometheus 格式指标导出
- 🏥 **健康检查** - 服务状态、数据库、Redis 监控
- 🔐 **安全审计** - 操作日志、权限追踪

### 数据中转

- 🔄 **Relay 服务** - 跨实例数据同步
- 🐳 **沙箱隔离** - Docker 容器执行环境
- 📁 **文件存储** - 图片上传、文件管理
- 🔒 **E2EE 加密** - 端到端加密通信

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         钉钉群                               │
└─────────────────────────────────────────────────────────────┘
                              ↕ Webhook
┌─────────────────────────────────────────────────────────────┐
│                    chat-hub (枫琳)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │   Server    │  │   SQLite    │  │  Agent Manager       │ │
│  │  (Express)  │  │  (持久化)   │  │  (多 AI 后端)        │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ Memory Sys  │  │ Skill Sys   │  │  Observability       │ │
│  │ (记忆管理)  │  │ (技能插件)  │  │  (可观测性)          │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕ Redis Pub/Sub
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

### 前置要求

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 18.0.0 | 运行环境 |
| npm | >= 9.0.0 | 包管理器 |
| Redis | >= 6.0 | 消息中转（可选） |
| SQLite | >= 3.35 | 数据存储（better-sqlite3 自动安装） |

### 安装

```bash
# 克隆项目
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub

# 安装依赖
npm install

# 如需 IMAP 收件箱能力，请在私有部署镜像或分支中额外安装
# npm install imap

# 创建本地配置
cp config/local.example.json config/local.json
```

### 配置

编辑 `config/local.json`：

```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": ""
  },
  "bot": {
    "name": "小琳",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
    "secret": "SEC_YOUR_SECRET"
  },
  "port": 8273
}
```

### 启动

```bash
# 先编译 TypeScript
npm run build

# 前台运行（调试用）
npm start

# 后台运行
nohup npm start > /tmp/chat-hub.log 2>&1 &

# 使用 PM2 管理
pm2 start dist/index.js --name chat-hub
pm2 save
```

### 验证

```bash
# 健康检查
curl http://localhost:8273/health

# 预期返回
{
  "status": "ok",
  "timestamp": 1709548800000,
  "database": {
    "messages": 0,
    "today": 0
  }
}
```

## 🐳 Docker 部署

### 快速启动

```bash
# 构建镜像
docker build -t chat-hub:latest .

# 运行容器
docker run -d \
  --name chat-hub \
  -p 8273:8273 \
  -v ~/.openclaw/chat-data:/data \
  -v $(pwd)/config:/app/config \
  chat-hub:latest
```

### Docker Compose

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 停止服务
docker-compose -f docker-compose.prod.yml down
```

> 📘 详细部署说明请参考 [部署指南](docs/DEPLOYMENT.md)

## 📡 API 接口

> 邮件通道 `/api/email` 默认只保证 SMTP 发信能力。若要启用 IMAP 收件箱接口，需要额外安装 `imap`，并在初始化邮件通道时传入 `inbound_enabled: true`。

### 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/store` | POST | 存储消息（不发钉钉） |
| `/api/reply` | POST | 机器人回复（发到钉钉） |
| `/api/send` | POST | 发送消息（Web 前端） |
| `/api/context` | GET | 获取最近消息 |
| `/api/search` | GET | 搜索消息 |
| `/api/stats` | GET | 统计信息 |

### Agent API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | GET | 获取 Agent 列表 |
| `/api/agents/:id` | GET | 获取 Agent 详情 |
| `/api/agents/:id/chat` | POST | 与 Agent 对话 |
| `/api/agents/:id/chat/stream` | POST | 流式对话（SSE） |
| `/api/agents/:id/memories` | GET | 获取 Agent 记忆 |

> 📘 完整 API 文档请参考 [API 接口文档](docs/API.md) 和 [OpenAPI 规范](docs/OPENAPI.md)

## 🔧 配置说明

### config/local.json 主要字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `port` | number | 服务端口，默认 3000 |
| `redis.host` | string | Redis 主机地址 |
| `redis.port` | number | Redis 端口 |
| `bot.name` | string | 机器人名称 |
| `bot.local` | boolean | 是否本地模式（不连接 Redis） |
| `dingtalk.webhookBase` | string | 钉钉 Webhook URL |
| `dingtalk.secret` | string | 钉钉签名密钥 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | development | 运行环境 |
| `LOG_LEVEL` | INFO | 日志级别 |
| `REDIS_HOST` | localhost | Redis 主机 |
| `DB_PATH` | ~/.openclaw/chat-data | 数据库路径 |

> 📘 完整配置说明请参考 [部署指南](docs/DEPLOYMENT.md#配置文件说明)

## 🔌 与 OpenClaw 集成

### 消息流转

```
用户消息 → 钉钉群 → OpenClaw 插件 → AI 处理
                              ↓
                         /api/store (存储)
                              ↓
                        chat-hub 数据库
                              ↓
                        Redis 消息总线
                              ↓
                        其他机器人收到
```

### 在 AGENTS.md 中添加规则

```markdown
## 📡 钉钉消息同步

收到钉钉群消息时，静默存储：
\`\`\`bash
curl -s -X POST http://localhost:8273/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息", "source": "dingtalk"}'
\`\`\`

回复消息：
\`\`\`bash
curl -X POST http://localhost:8273/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "回复内容", "sender": "小琳"}'
\`\`\`
```

## 📁 项目结构

```
chat-hub/
├── package.json              # 项目配置
├── Dockerfile                # Docker 构建文件
├── docker-compose.prod.yml   # 生产环境编排
├── config/
│   ├── default.json          # 默认配置
│   ├── local.json            # 本地配置（Git 忽略）
│   └── local.example.json    # 配置示例
├── src/
│   ├── index.ts              # TypeScript 入口
│   ├── server.ts             # Express 服务
│   ├── config.ts             # 配置加载
│   ├── message-store.ts      # 消息存储
│   ├── redis-client.ts       # Redis 客户端
│   ├── dingtalk-sender.ts    # 钉钉发送
│   ├── agent/                # Agent 管理
│   ├── routes/               # API 路由
│   ├── services/             # 业务服务
│   ├── middleware/           # 中间件
│   └── observability/        # 可观测性
├── migrations/               # 数据库迁移
├── dist/                     # TypeScript 编译产物
├── docs/                     # 文档
│   ├── API.md               # API 文档
│   ├── DEPLOYMENT.md        # 部署指南
│   ├── OPENAPI.md           # OpenAPI 规范
│   ├── EXAMPLES.md          # 使用示例
│   └── QUICK-START.md       # 快速开始
└── chat-hub.service          # systemd 服务文件
```

## 🚀 生产部署

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动并设置开机自启
pm2 start dist/index.js --name chat-hub
pm2 startup
pm2 save
```

### 使用 systemd

```bash
# 安装服务
sudo ./install-service.sh

# 管理命令
sudo systemctl status chat-hub
sudo systemctl restart chat-hub
sudo journalctl -u chat-hub -f
```

### 使用 Docker

```bash
# 生产环境部署
docker-compose -f docker-compose.prod.yml up -d
```

> 📘 详细部署说明请参考 [部署指南](docs/DEPLOYMENT.md)

## 🐛 常见问题

### Q: 机器人不回复？

1. 检查 OpenClaw Gateway：`openclaw gateway status`
2. 检查 chat-hub 日志：`tail -f /tmp/chat-hub.log`
3. 确认 `bot.name` 和消息中提到的名字一致

### Q: Redis 连接失败？

1. 检查 Redis 是否运行：`redis-cli ping`
2. 检查 `config/local.json` 中的 Redis 配置
3. 如果不需要 Redis，设置 `bot.local: true`

### Q: 钉钉发送失败？

1. 检查 Webhook URL 和 Secret 是否正确
2. 确认系统时间准确（签名依赖时间戳）
3. 检查钉钉机器人是否启用

> 📘 更多问题请参考 [部署指南 - 常见问题](docs/DEPLOYMENT.md#常见问题)

## 📝 更新日志

### v2.0.0 (2026-03-05)

- 新增：Agent 管理系统，支持多 AI 后端
- 新增：记忆系统（短期/长期/情景记忆）
- 新增：会话管理（私聊/群聊）
- 新增：技能系统插件
- 新增：任务管理
- 新增：可观测性（日志/指标/监控）
- 新增：Relay 数据中转服务
- 新增：Docker 沙箱隔离
- 新增：E2EE 端到端加密
- 改进：OpenAI 协议兼容
- 改进：流式对话（SSE）
- 改进：文档完善

### v1.2 (2026-02-13)

- 新增：高级搜索 API（FTS5 全文索引）
- 新增：消息导出功能（JSON/CSV）
- 新增：私信 API（DM API）
- 新增：用户认证系统

### v1.0 (2026-02-05)

- 初始版本
- SQLite 消息持久化
- Redis 消息中转
- 钉钉集成

## 📄 许可证

MIT License

---

<p align="center">
  Made with ❤️ by MapleClaw Team
</p>
