# MapleClaw 项目架构分析报告

> 分析日期：2026-03-12  
> 分析版本：v2.1.0  
> 分析师：架构师 AI

---

## 📋 项目概述

**MapleClaw（枫琳）** 是一个人机共生智能协作平台，让多个 AI 机器人在钉钉群中与人类实时聊天、智能协作。

### 核心定位

- **多 AI 实时对话**：多个 AI 助手在同一群中协作配合
- **智能对话管理**：话题终结检测、轮次限制、防无限循环
- **消息持久化**：SQLite 本地存储 + Redis 实时同步
- **跨平台支持**：Web、移动端、钉钉集成

---

## 🏗️ 一、整体架构设计

### 1.1 三端架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MapleClaw 三端架构                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         chat-web (前端 Web)                          │   │
│  │                    Vue 3 + Vite + Element Plus                       │   │
│  │                    Tauri 桌面端支持                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ HTTP/WebSocket/SSE                     │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        chat-hub (后端服务)                           │   │
│  │                   Node.js + Express + TypeScript                     │   │
│  │                   SQLite + Redis + WebSocket                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ HTTP API                               │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       chat-mobile (移动端)                           │   │
│  │                      uni-app + Vue 3                                │   │
│  │                   微信小程序 + H5 支持                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        外部集成                                      │   │
│  │          钉钉 Webhook │ OpenClaw Agent │ MCP Server                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 三端职责划分

| 端 | 技术栈 | 职责 | 端口 |
|:---|:-------|:-----|:-----|
| **chat-hub** | Node.js + Express + TypeScript | 核心消息中转、数据存储、API 服务、Agent 管理 | 8273 |
| **chat-web** | Vue 3 + Vite + Element Plus | Web 用户界面、管理后台、Tauri 桌面端 | 5173 (dev) |
| **chat-mobile** | uni-app + Vue 3 | 移动端应用、微信小程序、H5 | - |

### 1.3 三种运行模式

```
模式 A：存储分析模式（推荐）
┌──────────┐      ┌──────────────┐      ┌──────────┐
│  钉钉群   │ ←──→ │ OpenClaw     │ ───→ │ chat-hub │
└──────────┘      │ (钉钉插件)    │      │ (存储)   │
                  └──────────────┘      └──────────┘

模式 B：完整中转模式
┌──────────┐      ┌──────────┐      ┌──────────────┐
│  钉钉群   │ ───→ │ chat-hub │ ───→ │ OpenClaw     │
└──────────┘      │ (中转)   │      │ (system event)│
      ↑            └──────────┘      └──────────────┘
      └─────────────────(回复)─────────────────────┘

模式 C：纯插件模式
┌──────────┐      ┌──────────────┐
│  钉钉群   │ ←──→ │ OpenClaw     │  （无需 chat-hub）
└──────────┘      │ (钉钉插件)    │
                  └──────────────┘
```

---

## 🔧 二、技术栈分析

### 2.1 后端 (chat-hub)

#### 核心框架
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 运行时 | Node.js | - | 服务端运行环境 |
| 框架 | Express | 4.18.2 | HTTP 服务框架 |
| 语言 | TypeScript | 5.8.3 | 类型安全 |

#### 数据存储
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 数据库 | better-sqlite3 | 12.6.2 | 消息持久化、全文索引 |
| 缓存 | ioredis | 5.3.2 | 消息同步、实时通知 |

#### 实时通信
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| WebSocket | ws | 8.19.0 | 双向实时通信 |
| SSE | - | - | 服务端推送 |

#### 外部集成
| 类别 | 技术 | 用途 |
|:-----|:-----|:-----|
| 钉钉 | Webhook + 签名 | 消息收发 |
| 邮件 | nodemailer | 通知发送 |
| 浏览器 | playwright | 自动化集成 |
| 任务调度 | node-cron | 定时任务 |

#### 安全与认证
| 类别 | 技术 | 用途 |
|:-----|:-----|:-----|
| 密码 | bcryptjs | 密码加密 |
| Token | jsonwebtoken | JWT 认证 |
| 内容过滤 | dompurify | XSS 防护 |

### 2.2 前端 Web (chat-web)

#### 核心框架
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 框架 | Vue | 3.5.24 | 响应式 UI |
| 构建 | Vite | 7.3.1 | 开发构建 |
| 状态 | Pinia | 3.0.4 | 状态管理 |
| 路由 | Vue Router | 4.6.4 | 路由管理 |

#### UI 组件
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 组件库 | Element Plus | 2.13.2 | UI 组件 |
| 图标 | @element-plus/icons-vue | 2.3.2 | 图标组件 |
| 图表 | ECharts | 6.0.0 | 数据可视化 |

#### 桌面端
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 桌面框架 | Tauri | 2.10.x | 跨平台桌面应用 |

#### 工具库
| 类别 | 技术 | 用途 |
|:-----|:-----|:-----|
| HTTP | axios | API 请求 |
| 工具 | @vueuse/core | Vue 组合式工具 |
| Markdown | marked | Markdown 渲染 |

### 2.3 移动端 (chat-mobile)

#### 核心框架
| 类别 | 技术 | 版本 | 用途 |
|:-----|:-----|:-----|:-----|
| 框架 | uni-app | 3.0.0 | 跨平台移动开发 |
| 语言 | Vue | 3.4.0 | 组件化开发 |
| 状态 | Pinia | 2.1.7 | 状态管理 |

#### 支持平台
- 微信小程序
- H5 网页
- (可扩展) Android/iOS App

---

## 📊 三、数据流设计

### 3.1 消息流向

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              消息数据流                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [用户发送消息]                                                              │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────┐     HTTP POST      ┌─────────────────┐                        │
│  │  钉钉群  │ ──────────────────▶│  dingtalk.ts    │                        │
│  │  Web    │                    │  message-router │                        │
│  │  Mobile │                    └────────┬────────┘                        │
│  └─────────┘                             │                                  │
│                                          ▼                                  │
│                              ┌─────────────────┐                           │
│                              │  message-store  │                           │
│                              │   (SQLite)      │                           │
│                              └────────┬────────┘                           │
│                                       │                                     │
│           ┌───────────────────────────┼───────────────────────────┐        │
│           ▼                           ▼                           ▼        │
│  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐   │
│  │ redis-client    │       │ sse-manager     │       │ websocket       │   │
│  │ (Redis Pub/Sub) │       │ (SSE 推送)      │       │ (实时推送)      │   │
│  └─────────────────┘       └─────────────────┘       └─────────────────┘   │
│           │                           │                           │         │
│           ▼                           ▼                           ▼         │
│  [其他 chat-hub 实例]       [Web 前端]                 [WebSocket 客户端]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 消息存储架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            消息存储架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        messages 表                                   │   │
│  │  - id (主键)                                                         │   │
│  │  - type, sender, content, timestamp                                  │   │
│  │  - source, at_targets, reply_to                                      │   │
│  │  索引: timestamp, sender, type, source                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     messages_fts (FTS5 全文索引)                     │   │
│  │  - id, content, sender                                               │   │
│  │  - tokenize: unicode61 (支持中文)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    private_messages 表                               │   │
│  │  - conversation_id (会话ID)                                          │   │
│  │  - sender_id, receiver_id                                            │   │
│  │  - content, read_at                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    其他辅助表                                        │   │
│  │  - users: 用户信息                                                   │   │
│  │  - images: 图片上传                                                  │   │
│  │  - reactions: 表情回应                                               │   │
│  │  - message_reads: 已读状态                                           │   │
│  │  - sync_state: 同步状态                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 实时通信机制

| 机制 | 场景 | 特点 |
|:-----|:-----|:-----|
| **WebSocket** | 双向实时通信 | 低延迟、双向推送 |
| **SSE** | 服务端推送 | 单向、自动重连、兼容性好 |
| **Redis Pub/Sub** | 多实例同步 | 分布式消息广播 |

---

## 📦 四、核心模块划分

### 4.1 chat-hub 核心模块

```
chat-hub/src/
├── 📡 消息处理
│   ├── server.ts           # Express 服务入口
│   ├── message-store.ts    # SQLite 消息存储
│   ├── message-router.ts   # 消息路由分发
│   ├── message-security.ts # 消息安全处理
│   └── dm-handler.ts       # 私聊消息处理
│
├── 🔌 通信层
│   ├── websocket.ts        # WebSocket 服务
│   ├── sse-manager.ts      # SSE 推送管理
│   ├── redis-client.ts     # Redis 客户端
│   └── transport/          # 传输层抽象
│       ├── index.ts        # 传输管理器
│       ├── redis-transport.ts
│       └── sse-cloud-transport.ts
│
├── 🤖 AI Agent
│   ├── agent/              # Agent 核心
│   │   ├── agent-manager.ts
│   │   ├── capability-router.ts
│   │   ├── registry.ts
│   │   └── adapters/       # 模型适配器
│   ├── bots/               # 机器人实现
│   │   ├── openclaw-trigger.ts
│   │   ├── openclaw-bot.ts
│   │   └── smart-conversation.ts
│   └── character/          # 角色系统
│
├── 👤 用户系统
│   ├── auth.ts             # 认证模块
│   ├── user-manager.ts     # 用户管理
│   ├── instance-auth.ts    # 实例认证
│   └── permissions.ts      # 权限管理
│
├── 🔗 外部集成
│   ├── dingtalk.ts         # 钉钉接收
│   ├── dingtalk-sender.ts  # 钉钉发送
│   └── wecom.ts            # 企业微信
│
├── 🛣️ 路由层
│   └── routes/             # API 路由 (42+ 文件)
│       ├── api-v1.ts       # v1 API
│       ├── auth-v2.ts      # 认证路由
│       ├── agents-v2.ts    # Agent 路由
│       ├── skills.ts       # 技能路由
│       ├── tasks.ts        # 任务路由
│       ├── sandbox.ts      # 沙箱路由
│       └── ...
│
├── 🛡️ 中间件
│   └── middleware/
│       ├── cors.ts         # CORS 处理
│       ├── auth.ts         # 认证中间件
│       ├── rate-limit.ts   # 速率限制
│       └── permission-check.ts
│
├── 🧩 功能模块
│   ├── skills/             # 技能系统
│   ├── sandbox/            # 沙箱环境
│   ├── task/               # 任务管理
│   ├── scheduler/          # 调度器
│   ├── memory/             # 记忆系统
│   ├── workspace/          # 工作空间
│   └── plugins/            # 插件系统
│
├── 📊 服务层
│   └── services/
│       ├── config-center.ts
│       ├── permission-manager.ts
│       ├── skills-service.ts
│       ├── asr-service.ts
│       └── tts-service.ts
│
└── 🏗️ 类型定义
    └── types/
        ├── index.ts
        ├── skills.ts
        └── mcp.ts
```

### 4.2 chat-web 核心模块

```
chat-web/src/
├── 📄 入口
│   ├── main.ts             # 应用入口
│   └── App.vue             # 根组件
│
├── 🛣️ 路由
│   └── router/
│       └── index.ts        # 路由配置 (40+ 路由)
│
├── 📦 状态管理
│   └── stores/
│       ├── user.ts         # 用户状态
│       └── ...
│
├── 🔌 API 层
│   └── api/
│       ├── index.ts        # Axios 实例
│       ├── auth.ts         # 认证 API
│       ├── agents.ts       # Agent API
│       ├── skills.ts       # 技能 API
│       └── ...
│
├── 🎨 视图层
│   ├── views/              # 页面组件 (40+ 页面)
│   │   ├── Home.vue
│   │   ├── Chat.vue
│   │   ├── DM.vue
│   │   ├── Agents.vue
│   │   ├── Skills.vue
│   │   └── ...
│   ├── components/         # 通用组件
│   └── layouts/            # 布局组件
│
├── 📝 类型定义
│   └── types/
│       └── index.ts
│
├── 🎨 样式
│   └── styles/
│       ├── global.css
│       ├── brand.css
│       └── mobile.css
│
└── 🛠️ 工具
    └── utils/
```

### 4.3 chat-mobile 核心模块

```
chat-mobile/src/
├── 📄 入口
│   ├── main.ts
│   ├── App.vue
│   ├── pages.json          # 页面配置
│   └── manifest.json       # 应用配置
│
├── 📱 页面
│   └── pages/
│       ├── login/          # 登录
│       ├── chat/           # 聊天
│       ├── agents/         # 智能体
│       ├── skills/         # 技能
│       ├── tasks/          # 任务
│       ├── character/      # 角色
│       └── settings/       # 设置
│
├── 📦 状态
│   └── stores/
│       └── user.ts
│
├── 🔌 API
│   └── api/
│
├── 📝 类型
│   └── types/
│
├── 🎨 组件
│   └── components/
│
└── ⚙️ 配置
    └── config/
        └── index.ts
```

---

## 🎯 五、设计模式与架构决策

### 5.1 设计模式

#### 1. 传输层抽象模式

```typescript
// transport/base.ts - 抽象基类
abstract class Transport {
  abstract connect(): Promise<void>;
  abstract send(message: Record<string, unknown>, channel?: string): Promise<void>;
  abstract onMessage(handler: MessageHandler): void;
  abstract healthCheck(): Promise<boolean>;
}

// transport/redis-transport.ts - Redis 实现
class RedisTransport extends Transport { ... }

// transport/sse-cloud-transport.ts - SSE 实现
class SSECloudTransport extends Transport { ... }

// transport/index.ts - 管理器
class TransportManager {
  async connect(): Promise<void> {
    // 自动降级策略
    for (const mode of this.fallbackOrder) {
      try {
        await this._connectMode(mode);
        return;
      } catch { /* 继续下一个 */ }
    }
  }
}
```

**优点**：
- 支持多种传输方式
- 自动故障降级
- 易于扩展新传输方式

#### 2. 配置加载策略模式

```typescript
// config.ts
function loadConfig(): ConfigType {
  // 1. 加载默认配置 (Git 跟踪)
  let config = JSON.parse(fs.readFileSync('config/default.json'));
  
  // 2. 加载本地配置 (Git 忽略，覆盖默认)
  const localConfig = JSON.parse(fs.readFileSync('config/local.json'));
  
  // 3. 深度合并
  return deepMerge(config, localConfig);
}
```

**优点**：
- 默认配置可共享
- 本地配置不冲突
- 敏感信息安全

#### 3. Agent 适配器模式

```typescript
// agent/adapters/ - 多模型适配
interface AgentAdapter {
  chat(messages: Message[]): Promise<string>;
  stream(messages: Message[]): AsyncIterable<string>;
}

// agent/adapters/openai-adapter.ts
class OpenAIAdapter implements AgentAdapter { ... }

// agent/capability-router.ts - 能力路由
class CapabilityRouter {
  route(task: Task): AgentAdapter {
    // 根据任务类型选择最佳模型
  }
}
```

**优点**：
- 支持多模型切换
- 能力路由选择
- 统一接口抽象

#### 4. 中间件模式

```typescript
// middleware/cors.ts
export function corsMiddleware() { ... }
export function apiVersionMiddleware() { ... }
export function requestIdMiddleware() { ... }

// server.ts
app.use(corsMiddleware());
app.use(apiVersionMiddleware());
app.use(requestIdMiddleware());
```

**优点**：
- 关注点分离
- 可组合
- 易于测试

#### 5. 发布-订阅模式 (Redis)

```typescript
// redis-client.ts
class RedisClient {
  async publish(channel, message) { ... }
  async subscribe(channel, handler) { ... }
}

// 用法
redis.subscribe('chat:messages', handleMessage);
redis.publish('chat:messages', newMessage);
```

**优点**：
- 多实例消息同步
- 解耦生产者消费者
- 支持分布式

### 5.2 架构决策

#### 决策 1：SQLite 作为主数据库

**背景**：需要本地持久化、低运维成本

**决策**：使用 better-sqlite3

**理由**：
- 零配置、无需独立服务
- WAL 模式支持并发
- FTS5 全文索引支持中文
- 性能足够应对中小规模

**权衡**：
- ✅ 简单部署、低资源占用
- ✅ 本地开发友好
- ❌ 不适合大规模分布式

#### 决策 2：Redis 作为消息同步

**背景**：多 chat-hub 实例需要消息同步

**决策**：使用 Redis Pub/Sub + 弹性客户端

**理由**：
- 实时性好
- 支持自动降级（本地缓存）
- 天然支持发布订阅

**实现**：
```typescript
// 弹性 Redis 客户端
class ResilientRedisClient {
  // 连接失败时自动降级到本地缓存
  async publish(channel, message) {
    if (this.degraded) {
      return this.localCache.push({ channel, message });
    }
    // 正常发送
  }
}
```

#### 决策 3：API 版本控制

**背景**：需要向后兼容、平滑升级

**决策**：双路由策略

```
/api/v1/*     # 版本化接口（推荐）
/api/*        # 兼容接口（保持向后兼容）
```

**响应头增强**：
```
X-API-Version: 1.0
X-Request-ID: xxx
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
```

#### 决策 4：前后端分离部署

**背景**：需要独立开发、灵活部署

**决策**：
- 前端：独立静态部署（Vite 构建）
- 后端：仅提供 API 服务
- 开发：CORS 跨域支持

**优点**：
- 前后端独立迭代
- 支持 CDN 加速
- 开发体验好

#### 决策 5：TypeScript 全栈

**背景**：需要类型安全、代码质量

**决策**：前后端统一使用 TypeScript

**优点**：
- 类型共享
- 编译时错误检查
- IDE 支持完善

#### 决策 6：Tauri 桌面端

**背景**：需要桌面客户端

**决策**：使用 Tauri 而非 Electron

**理由**：
- 包体积极小（~3MB vs Electron ~100MB）
- 系统原生 WebView，内存占用低
- Rust 后端，安全性高

#### 决策 7：uni-app 跨平台移动端

**背景**：需要移动端支持

**决策**：使用 uni-app 框架

**理由**：
- 一套代码多端运行
- 微信小程序支持
- Vue 3 生态兼容

---

## 📈 六、部署架构

### 6.1 Docker 容器编排

```yaml
# docker-compose.yml
services:
  redis:          # Redis 消息队列
  chat-hub-lin:   # 小琳服务 (8273)
  chat-hub-zhu:   # 小猪服务 (8274)
  nginx:          # 反向代理 (80/443)
```

### 6.2 服务拓扑

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (80/443)   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │ chat-hub-lin│   │ chat-hub-zhu│   │  静态资源   │
  │   (8273)    │   │   (8274)    │   │             │
  └──────┬──────┘   └──────┬──────┘   └─────────────┘
         │                 │
         └────────┬────────┘
                  ▼
           ┌─────────────┐
           │    Redis    │
           │   (6379)    │
           └─────────────┘
```

### 6.3 端口规划

| 服务 | 端口 | 用途 |
|:-----|:-----|:-----|
| Nginx | 80, 443 | HTTP/HTTPS 入口 |
| chat-hub-lin | 8273 | 小琳 API 服务 |
| chat-hub-zhu | 8274 | 小猪 API 服务 |
| Redis | 6379 | 消息队列 |
| chat-web (dev) | 5173 | 前端开发服务 |

---

## 🔐 七、安全架构

### 7.1 认证机制

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              认证流程                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [登录请求]                                                                  │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐                                                           │
│  │ 验证用户名   │                                                           │
│  │ 验证密码     │ (bcrypt)                                                  │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐     ┌─────────────┐                                       │
│  │ 生成 Access │ +   │ 生成 Refresh │                                       │
│  │ Token (15m) │     │ Token (7d)   │                                       │
│  └──────┬──────┘     └─────────────┘                                       │
│         │                                                                   │
│         ▼                                                                   │
│  [API 请求] ────▶ Authorization: Bearer <access_token>                      │
│                          │                                                  │
│                          ▼                                                  │
│                   ┌─────────────┐                                          │
│                   │ 验证 Token  │                                          │
│                   │ 检查黑名单  │                                          │
│                   └─────────────┘                                          │
│                                                                             │
│  [Token 过期] ────▶ 刷新 Token (使用 Refresh Token)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 安全措施

| 层面 | 措施 | 实现 |
|:-----|:-----|:-----|
| 传输 | HTTPS | Nginx SSL |
| 认证 | JWT + 双 Token | auth.ts |
| 密码 | bcrypt 加密 | bcryptjs |
| XSS | 内容过滤 | dompurify |
| CORS | 跨域控制 | cors 中间件 |
| 限流 | 速率限制 | rate-limit 中间件 |
| 审计 | 请求追踪 | X-Request-ID |

---

## 📝 八、总结

### 8.1 架构优势

1. **模块化设计**：清晰的模块划分，低耦合高内聚
2. **多端支持**：Web + 移动端 + 桌面端，一套 API 服务多端
3. **灵活部署**：支持单机、Docker、分布式部署
4. **可扩展性**：传输层抽象、Agent 适配器，易于扩展
5. **高可用**：Redis 自动降级、多实例支持
6. **类型安全**：全栈 TypeScript，编译时错误检查

### 8.2 架构演进建议

1. **微服务化**：随着规模增长，可拆分为独立服务
2. **消息队列**：引入 RabbitMQ/Kafka 处理高并发
3. **数据库升级**：大规模场景考虑 PostgreSQL/MongoDB
4. **缓存策略**：引入多级缓存提升性能
5. **监控告警**：完善可观测性（日志、指标、追踪）

### 8.3 文件统计

| 模块 | 文件数 | 代码行数（估算） |
|:-----|:-------|:-----------------|
| chat-hub | 185+ TS 文件 | ~50,000 行 |
| chat-web | 116+ 文件 | ~15,000 行 |
| chat-mobile | 50+ 文件 | ~5,000 行 |

---

## 📚 附录

### A. 关键文件索引

| 功能 | 文件路径 |
|:-----|:---------|
| 后端入口 | chat-hub/src/index.ts |
| 服务配置 | chat-hub/src/server.ts |
| 消息存储 | chat-hub/src/message-store.ts |
| 认证模块 | chat-hub/src/auth.ts |
| 传输层 | chat-hub/src/transport/index.ts |
| Agent 管理 | chat-hub/src/agent/agent-manager.ts |
| 前端入口 | chat-web/src/main.ts |
| 路由配置 | chat-web/src/router/index.ts |
| 用户状态 | chat-web/src/stores/user.ts |
| 移动端配置 | chat-mobile/src/pages.json |

### B. 配置文件

| 配置 | 路径 |
|:-----|:-----|
| 后端默认配置 | chat-hub/config/default.json |
| 后端本地配置 | chat-hub/config/local.json |
| Docker 编排 | docker-compose.yml |
| Nginx 配置 | nginx.conf |

---

*报告完成时间：2026-03-12*  
*分析工具：AI 架构师*