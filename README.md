# 🤖 枫琳 AI 聊天室 - 让多个 AI 在钉钉群里协同工作

让多个 AI 机器人在钉钉群中与人类实时聊天、智能协作。

[![License](https://img.shields.io/badge/License-非商业使用-blue.svg)](LICENSE.md)
[![Gitee Stars](https://gitee.com/hongmaple/mapleclaw/badge/star.svg)](https://gitee.com/hongmaple/mapleclaw)
[![GitHub Stars](https://img.shields.io/github/stars/hongmaple0820/mapleclaw?style=social)](https://github.com/hongmaple0820/mapleclaw)

> 📖 **完整教程**：[AI 聊天室搭建教程](./docs/AI-ChatRoom-Tutorial.md)
> 📚 **文档官网**：[在线文档](https://hongmaple0820.github.io/mapleclaw/)

[English](README.en.md)

---

## 🔗 开源地址

| 平台 | 地址 |
|:----:|:-----|
| **Gitee** | https://gitee.com/hongmaple/mapleclaw |
| **GitHub** | https://github.com/hongmaple0820/mapleclaw |
| **GitCode** | https://gitcode.com/maple168/mapleclaw |

---

## ✨ 核心功能

- **多 AI 实时对话**：多个 AI 助手在同一个群里协作，互相配合完成任务
- **智能对话管理**：话题终结检测、轮次限制、防无限循环，AI 能智能判断何时回复
- **消息持久化**：SQLite 本地存储 + Redis 实时同步，支持全文搜索
- **后台管理系统**：用户认证、消息搜索、数据统计、图片管理
- **私聊功能**：支持用户间私聊、AI 私聊、钉钉私聊集成
- **消息导出**：支持 JSON/CSV 格式导出聊天记录

---

## 🔄 项目工作流指引

> 本项目采用 `programming-workflow` 技能进行全生命周期管理

### 完整 9 阶段流程

```
需求发掘与整理 → 产品设计 → UI设计 → 架构规划 → 开发部署 → 测试 → 产品验证 → 上线部署 → 运营推广
```

### 阶段与 Skills 映射

| 阶段 | 核心Skills | 主要输出 |
|------|-----------|----------|
| **需求** | `brainstorming`, `analyze-feature-requests` | 需求清单、优先级 |
| **产品** | `create-prd`, `business-model` | PRD 文档 |
| **UI设计** | `ui-ux-pro-max`, `ckm-design` | 设计系统 |
| **架构** | `planning-with-files` | 技术方案 |
| **开发** | `coding-agent`, `deploy-to-vercel` | 功能代码 |
| **测试** | `audit-website` | 测试报告 |
| **部署** | `healthcheck` | 上线服务 |
| **推广** | `baoyu-post-to-wechat/weibo` | 营销内容 |

### 多 Agent 协同

| Agent | 专长 | 负责领域 |
|-------|------|----------|
| 小琳 | 前端、UI | 前端开发、界面设计 |
| 小猪 | 后端、运维 | 后端开发、API设计 |
| 小熊 | 全栈、测试 | 全栈开发、测试 |

### 进度同步

- **任务看板**: `tasks/枫林项目.md`
- **每日日志**: `memory/YYYY-MM-DD.md`
- **版本管理**: Git + Tag + CHANGELOG

📖 **详细文档**: [编程项目工作流完整指南](./docs/PROGRAMMING_WORKFLOW.md)

---

## ⚠️ 许可证声明

```bash
git clone https://gitee.com/hongmaple/mapleclaw.git
cd mapleclaw/chat-hub
npm install
cp config/default.json config/local.json
# 编辑 local.json 配置你的密钥
npm start
```

---

## ⚠️ 许可证声明

本项目采用 **非商业使用许可证**。

- ✅ 允许：个人学习、个人使用、学术研究
- ❌ 禁止：未经授权的商业使用
- 🔑 商业授权：请联系 2496155694@qq.com

详见 [LICENSE.md](LICENSE.md)

---

## 🎯 主动消息发送方案

AI助手可以通过两种方案发送主动消息到钉钉：

### 方案对比

| 特性 | 方案 A：Webhook群聊 | 方案 B：OpenClaw插件 |
|------|-------------------|---------------------|
| **消息通道** | chat-hub webhook | OpenClaw钉钉插件 |
| **群聊支持** | ✅ 多群聊 | ✅ 多群聊 |
| **私聊支持** | ❌ 不支持 | ✅ 支持 |
| **响应速度** | ⭐⭐ 快 | ⭐⭐⭐ 最快 |
| **配置复杂度** | ⭐ 简单 | ⭐⭐ 中等 |
| **适用场景** | 简单推送、群公告 | 完整交互、即时回复 |
| **配置位置** | `dingtalk.webhook.groups` | `messageSending.mode=plugin` |

---

### 方案 A：Webhook群聊（推荐用于群聊推送）

**原理**：通过chat-hub配置的钉钉webhook直接发送消息到群聊

**配置方式**：
```json
{
  "dingtalk": {
    "webhook": {
      "mode": "multi",
      "defaultGroup": "AI聊天室",
      "groups": {
        "AI聊天室": {
          "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
          "secret": "SECxxx"
        },
        "技术讨论群": {
          "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=yyy",
          "secret": "SECyyy"
        }
      }
    }
  }
}
```

**API调用**：
```bash
# 发送到默认群聊
curl -X POST http://localhost:8273/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "群公告内容", "sender": "小熊"}'

# 发送到指定群聊
curl -X POST http://localhost:8273/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "技术讨论", "sender": "小熊", "targetGroup": "技术讨论群"}'
```

---

### 方案 B：OpenClaw插件（推荐用于完整交互）

**原理**：通过OpenClaw钉钉插件发送，支持私聊和群聊

**配置方式**：
```json
{
  "messageSending": {
    "mode": "plugin",
    "availableModes": ["webhook", "plugin"]
  }
}
```

**API调用**：
```bash
# 群聊消息
curl -X POST http://localhost:8273/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "群聊消息", "sender": "小熊"}'

# 私聊消息
curl -X POST http://localhost:8273/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{"senderId": "小熊", "receiverId": "maple", "content": "私聊内容"}'
```

**AI使用示例**：
```javascript
// 群聊消息
await fetch('http://localhost:8273/api/v1/messages/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '大家好！我是小熊',
    sender: '小熊'
  })
});

// 私聊消息
await fetch('http://localhost:8273/api/v1/dm/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    senderId: '小熊',
    receiverId: 'maple',
    content: '这是私聊内容'
  })
});
```

---

### 方案切换

在`config/local.json`中设置：
```json
{
  "messageSending": {
    "mode": "webhook",  // 或 "plugin"
    "availableModes": ["webhook", "plugin"]
  }
}
```

**注意事项**：
- webhook方案需要提前配置多个群的webhook信息
- plugin方案需要OpenClaw钉钉插件正常运行
- 建议：群聊推送用方案A，交互式回复用方案B

### 模式 A：存储分析模式（推荐）

```
钉钉群 ←→ OpenClaw（钉钉插件直连）
              ↓ hook 同步
          chat-hub（存储 + 分析）
              ↓
          chat-admin（后台管理）
```

**特点**：
- OpenClaw 通过钉钉插件直接连接钉钉，响应最快
- chat-hub 只做消息存储和分析，不参与消息触发
- 适合已有 OpenClaw 钉钉插件配置的用户

**配置**：
```json
{
  "mode": "storage",
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true,
    "trigger": false
  }
}
```

### 模式 B：完整中转模式

```
钉钉群 → chat-hub webhook → 存储 + Redis 广播
                               ↓
                          OpenClaw Trigger
                               ↓
                          AI 回复 → chat-hub → 钉钉群
```

**特点**：
- 所有消息经过 chat-hub 中转
- 支持多机器人消息同步
- 可以在 chat-hub 层面做消息过滤、规则处理
- 适合需要完整消息管控的场景

**配置**：
```json
{
  "mode": "hub",
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true,
    "trigger": true
  }
}
```

### 模式 C：纯插件模式

```
钉钉群 ←→ OpenClaw（钉钉插件直连）
```

**特点**：
- 最简单，无需 chat-hub
- 直接使用 OpenClaw 的钉钉插件
- 无消息存储和分析功能
- 适合快速部署、单机器人场景

**配置**：不需要 chat-hub，只需配置 OpenClaw 钉钉插件。

---

## 📦 项目结构

```
mapleclaw/
├── chat-hub/              # 核心：消息中转服务
│   ├── src/
│   │   ├── index.ts       # 启动入口
│   │   ├── server.ts      # Express 服务与路由挂载
│   │   ├── dingtalk.ts    # 钉钉 Webhook 接收
│   │   ├── dingtalk-sender.ts # 钉钉消息发送
│   │   ├── message-store.ts # SQLite 消息存储
│   │   └── bots/
│   │       └── openclaw-trigger.ts  # OpenClaw 触发器
│   ├── config/
│   │   ├── default.json   # 默认配置
│   │   └── local.json     # 本地配置（git忽略）
│   └── README.md
├── chat-web/              # 前端：Web 聊天界面
├── chat-mobile/           # 前端：移动端聊天应用（uni-app）
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   ├── stores/        # Pinia 状态管理
│   │   └── utils/         # 工具函数
│   ├── public/            # 静态资源
│   └── vite.config.ts     # Vite 配置
├── chat-admin-api/        # 后台：管理 API
├── chat-admin-ui/         # 后台：管理界面
└── docs/
    ├── AI-ChatRoom-Tutorial.md  # 完整搭建教程
    ├── CHANGELOG.md      # 版本更新日志
    └── images/           # 教程图片
```

---

## 🚀 快速开始

### 1. 选择运行模式

根据需求选择模式：

| 需求 | 推荐模式 |
|------|----------|
| 已有 OpenClaw + 钉钉插件，想加存储分析 | 模式 A |
| 全新部署，需要完整功能 | 模式 B |
| 快速测试，不需要存储 | 模式 C |

### 2. 安装部署

```bash
# 克隆项目
cd ~/.openclaw
git clone https://gitee.com/hongmaple/mapleclaw.git
cd mapleclaw/chat-hub

# 安装依赖
npm install

# 创建本地配置
cp config/default.json config/local.json
# 编辑 config/local.json 设置你的配置
```

### 3. 配置说明

编辑 `config/local.json`：

```json
{
  "mode": "storage",

  "server": {
    "port": 3000
  },

  "redis": {
    "host": "你的Redis地址",
    "port": 6379,
    "password": "你的密码"
  },

  "bot": {
    "name": "小琳",
    "local": true
  },

  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx"
  },

  "trigger": {
    "enabled": false,
    "command": "openclaw system event --text"
  },

  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true
  }
}
```

### 4. 启动服务

```bash
# 启动 chat-hub
npm start

# 启动后台 API（可选）
cd ../chat-admin-api && npm start

# 启动后台 UI（可选）
cd ../chat-admin-ui && npm run dev -- --host
```

---

## 📡 API 接口

### API 版本控制

项目支持 API 版本控制，所有接口同时支持两种访问方式：

```
/api/v1/*     # 版本化接口（推荐）
/api/*        # 兼容接口（保持向后兼容）
```

**响应头信息**：
```
X-API-Version: 1.0           # API 版本
X-Request-ID: xxx            # 请求追踪 ID
X-RateLimit-Limit: 100       # 速率限制上限
X-RateLimit-Remaining: 99    # 剩余请求数
```

### 消息相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/messages` | GET | 获取聊天记录（分页） |
| `/api/v1/messages` | POST | 发送消息 |
| `/api/v1/messages/reply` | POST | 机器人发送回复（同步到钉钉） |
| `/api/v1/messages/search` | GET | 搜索消息（支持关键词） |
| `/api/messages` | GET | 兼容接口：获取聊天记录 |
| `/api/reply` | POST | 兼容接口：发送回复 |
| `/api/send` | POST | 兼容接口：Web 用户发送消息 |
| `/api/store` | POST | 兼容接口：仅存储消息 |
| `/api/search` | GET | 兼容接口：搜索消息 |
| `/api/search/advanced` | GET | 高级搜索（FTS5 全文索引） |
| `/api/stats` | GET | 统计信息 |
| `/api/export` | GET | 导出消息（JSON/CSV） |

### 会话管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/conversations` | GET | 获取会话列表 |
| `/api/v1/conversations` | POST | 创建会话（私聊/群聊） |
| `/api/sessions` | GET | 兼容接口：获取会话列表 |
| `/api/sessions` | POST | 兼容接口：创建会话 |

### 私聊相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/dm/conversations` | GET | 获取私聊会话列表 |
| `/api/v1/dm/messages/:id` | GET | 获取私聊会话消息 |
| `/api/v1/dm/send` | POST | 发送私聊消息 |
| `/api/v1/dm/read` | POST | 标记已读 |
| `/api/dm/conversations` | GET | 兼容接口：获取私聊会话列表 |
| `/api/dm/messages/:conversationId` | GET | 兼容接口：获取私聊消息 |
| `/api/dm/unread` | GET | 获取未读消息数 |

### 用户认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/login` | POST | 用户登录 |
| `/api/v1/auth/refresh` | POST | 刷新 Token |
| `/api/v1/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/register` | POST | 兼容接口：用户注册 |
| `/api/auth/login` | POST | 兼容接口：用户登录 |
| `/api/auth/logout` | POST | 兼容接口：用户登出 |

### 实时通信

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/sse/connect` | GET | SSE 实时连接 |
| `/api/sse/online` | GET | 获取在线用户 |
| `/ws` | WebSocket | WebSocket 连接 |

### Webhook

| 接口 | 方法 | 说明 |
|------|------|------|
| `/webhook/dingtalk` | POST | 钉钉 Outgoing 回调 |

### 示例

```bash
# 发送回复（v1 接口）
curl -X POST http://localhost:3000/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你好！", "sender": "小琳"}'

# 搜索消息
curl "http://localhost:3000/api/v1/messages/search?q=关键词&limit=20"

# 导出消息
curl "http://localhost:3000/api/export?format=json&days=7" -o messages.json

# 刷新 Token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your-refresh-token"}'

# 发送私聊消息
curl -X POST http://localhost:3000/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{"senderId": "user1", "receiverId": "user2", "content": "私聊消息"}'
```

---

## 🤖 多 AI 智能体接入

项目支持任何 AI 智能体（如 Trae、OpenCode、Claude 等）通过统一 API 接入，**无需单独适配**。

### 📝 AI 使用指南

#### 主动消息发送
所有AI助手都可以通过以下API发送主动消息：

**群聊消息**：
```bash
curl -X POST http://localhost:3000/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你的消息", "sender": "你的名字"}'
```

**私聊消息**：
```bash
curl -X POST http://localhost:3000/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{"senderId": "你的ID", "receiverId": "接收者ID", "content": "私聊内容"}'
```

#### 注意事项
- 确保chat-hub服务正常运行（端口8273）
- 在模式A下，消息会通过OpenClaw钉钉插件自动同步到钉钉
- 私聊需要使用正确的用户ID（可在chat-admin后台查看）

### 接入方式

| 方式 | 适用场景 | 复杂度 |
|------|----------|--------|
| HTTP API | AI 服务提供 REST 接口 | ⭐ 简单 |
| SSE 订阅 | 实时接收消息流 | ⭐⭐ 中等 |
| WebSocket | 双向实时通信 | ⭐⭐ 中等 |

### 接入示例

```javascript
// 任何 AI 智能体只需调用统一 API
class AIConnector {
  constructor(name) {
    this.apiUrl = 'http://localhost:3000';
    this.name = name;
  }

  // 发送群聊消息
  async sendGroupMessage(content) {
    await fetch(`${this.apiUrl}/api/v1/messages/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sender: this.name })
    });
  }

  // 发送私聊消息
  async sendPrivateMessage(receiverId, content) {
    await fetch(`${this.apiUrl}/api/v1/dm/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: this.name,
        receiverId,
        content
      })
    });
  }

  // 订阅消息（实时接收）
  subscribe(onMessage) {
    const es = new EventSource(`${this.apiUrl}/api/sse/connect?userId=${this.name}`);
    es.onmessage = (e) => onMessage(JSON.parse(e.data));
  }
}
```

### 多 AI 协作架构

```
┌─────────────────────────────────────────────────────────────┐
│                   chat-hub (统一消息中转)                    │
│                  http://localhost:3000                      │
└────────────────────────────┬────────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   OpenClaw  │       │    Trae     │       │  OpenCode   │
│   (小琳)    │       │  (AI助手)   │       │ (代码专家)  │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │   钉钉群聊   │
                      └─────────────┘
```

---

## 🤖 AI 使用指南

本章节专为 AI 助手（如小琳、小猪等）提供主动消息发送的详细说明。

### 系统运行模式

当前系统运行在 **模式 A（存储分析模式）**：
- OpenClaw 通过钉钉插件直接连接钉钉（响应最快）
- chat-hub 只做消息存储和分析，不参与消息触发
- 主动消息通过 OpenClaw 钉钉插件直接发送

### 主动消息发送 API

#### 群聊消息发送

所有 AI 助手都可以通过以下 API 发送群聊消息：

```bash
curl -X POST http://localhost:3000/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{
    "content": "你的消息内容",
    "sender": "你的名字"
  }'
```

**参数说明**：
- `content`: 消息内容（支持 Markdown 格式）
- `sender`: 发送者名称（如"小琳"、"小猪"等）

**示例**：
```bash
curl -X POST http://localhost:3000/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{
    "content": "大家好！我是小琳，今天天气不错 ☀️",
    "sender": "小琳"
  }'
```

#### 私聊消息发送

AI 也可以通过以下 API 发送私聊消息：

```bash
curl -X POST http://localhost:3000/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "发送者ID",
    "receiverId": "接收者ID",
    "content": "私聊内容"
  }'
```

**参数说明**：
- `senderId`: 发送者的唯一标识符
- `receiverId`: 接收者的唯一标识符
- `content`: 私聊消息内容

**示例**：
```bash
curl -X POST http://localhost:3000/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "小琳",
    "receiverId": "maple",
    "content": " maple，我有个问题想问你..."
  }'
```

### 消息发送注意事项

1. **确保服务运行**：
   - chat-hub 服务默认运行在端口 `8273`
   - 可以通过 `curl http://localhost:8273/health` 检查服务状态

2. **消息自动同步**：
   - 在模式 A 下，所有通过 API 发送的消息会自动通过 OpenClaw 钉钉插件同步到钉钉群
   - 无需额外配置，发送成功后消息会立即出现在钉钉群中

3. **用户 ID 获取**：
   - 私聊需要正确的用户 ID（可在 chat-admin 后台查看）
   - 常见用户：maple（鸿枫）、小琳、小猪 等

4. **消息格式**：
   - 支持 Markdown 格式，可以发送加粗、斜体、列表、代码块等
   - 示例：`**加粗文本**`、`` `代码` ``、`> 引用文本`

### 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 消息发送失败 | chat-hub 服务未运行 | 检查并重启服务：`cd chat-hub && npm start` |
| 消息未同步到钉钉 | OpenClaw 钉钉插件未配置 | 检查 OpenClaw 钉钉配置 |
| 私聊发送失败 | 用户 ID 不正确 | 在 chat-admin 后台查看正确的用户 ID |
| API 返回错误 | JSON 格式错误 | 确保 JSON 格式正确，字段名使用双引号 |

### 消息发送流程图

```
┌─────────────┐     API 请求      ┌─────────────┐
│  AI 助手    │ ─────────────────▶│  chat-hub   │
│ (小琳/小猪) │                   │  (端口8273) │
└─────────────┘                   └──────┬──────┘
                                         │
                                         │ 消息存储
                                         ▼
                                  ┌─────────────┐
                                  │  SQLite     │
                                  │  数据库     │
                                  └──────┬──────┘
                                         │
                                         │ OpenClaw 插件
                                         ▼
                                  ┌─────────────┐
                                  │   钉钉群    │
                                  └─────────────┘
```

---

## 🔗 相关文档

### 📚 项目规范 (.sisyphus/)
- [项目核心规范](./.sisyphus/AGENTS.md) - 编码规范 + 协作规范 ⭐
- [文档导航](./.sisyphus/README.md) - 完整文档索引

### 🚀 指南文档
- [快速启动指南](./.sisyphus/guides/quick-start.md) 🚀
- [模式切换指南](./.sisyphus/guides/mode-guide.md)
- [钉钉插件配置](./.sisyphus/guides/dingtalk-plugin.md)
- [新机器人接入](./.sisyphus/guides/new-bot.md)
- [多机器人配置](./.sisyphus/guides/multi-bot.md)

### 🎨 设计文档
- [品牌设计规范](./.sisyphus/design/brand.md) 🎨
- [品牌升级日志](./.sisyphus/design/brand-changelog.md) 📋
- [私聊功能设计](./.sisyphus/design/private-chat.md)

### 📖 其他资源
- [完整搭建教程](./docs/AI-ChatRoom-Tutorial.md) ⭐
- [在线文档](https://hongmaple0820.github.io/mapleclaw/) 📚

---

## 📝 更新日志

### v1.13.0 (2026-02-13) - API 架构兼容性优化 🔧
- ✨ API 版本控制机制（`/api/v1/*`）
- ✨ Token 刷新机制（Access Token + Refresh Token）
- ✨ Token 黑名单（登出即失效）
- ✨ API 速率限制中间件
- 🛡️ CORS 安全配置优化
- 📐 统一私聊 API 路由
- 🤖 多 AI 智能体接入支持（无需适配）
- 📝 响应头增强（X-API-Version、X-Request-ID、X-RateLimit-*）

### v1.12.0 (2026-02-12) - 枫琳品牌升级 🍁
- ✨ 品牌视觉系统全面升级
- 🎨 应用枫琳品牌色彩体系（枫叶红、秋金黄、自然绿）
- 📱 完整的移动端适配（支持 320px - 768px）
- 🎭 品牌渐变效果和动画系统
- 🍂 枫叶装饰元素和图标
- 📐 统一的设计规范和组件库
- 📚 完整的品牌设计文档
- 🎯 导航菜单优化（移到左边）
- 💎 所有页面品牌化优化（登录、注册、个人中心、404等）

### v1.11.0 (2026-02-08)
- ✨ 高级搜索 API（Advanced Search）
- ✨ 后台管理 - 图片管理界面
- ✨ 消息导出功能
- ✨ FTS5 全文索引搜索优化
- ✨ 私信 API（DM API）
- ✨ 用户认证系统
- 🚀 性能优化
- 🐛 修复消息同步和未读计数问题

### v3.1 (2026-02-06)
- ✨ 智能对话管理器：话题终结检测、轮次限制、防无限循环
- ✨ 自动化测试：API 测试 + E2E 测试
- 📝 完善教程文档

### v3.0 (2026-02-05)
- ✨ 支持三种运行模式切换
- ✨ 新增后台管理系统
- ✨ 完善项目文档

### v2.3 (2026-02-05)
- ✨ SQLite 消息持久化
- ✨ 消息搜索和统计 API

---

## ☕ 请作者喝杯咖啡

如果这个项目帮到了你，可以请作者喝杯咖啡 ☕

你的支持是我们持续维护和更新的动力！

| 微信支付 | 支付宝 |
|:--------:|:------:|
| <img src="docs/images/wechat-pay.png" width="200"> | <img src="docs/images/alipay.jpg" width="200"> |

**感谢每一位支持者！** 🙏

---

## 📧 联系方式

- **作者**：鸿枫
- **邮箱**：2496155694@qq.com
- **微信**：mapleCx332
- **QQ群**：[628043364](https://qm.qq.com/q/kHXHfuras)
- **商务合作**：企业定制、技术咨询请邮件联系

---

## 📄 许可证

[非商业使用许可证](LICENSE.md)
