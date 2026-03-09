# Chat-Hub 知识库

**生成**: 2026-03-08 | **Commit**: cbdda51 | **Branch**: dev

---

## 概述

枫琳 AI 聊天室消息中转服务 - Node.js + Express + SQLite + Redis。多机器人消息同步、钉钉集成、Agent 管理。

---

## 目录结构

```
chat-hub/
├── src/
│   ├── index.ts           # 入口 - PID锁、内存监控、启动服务
│   ├── server.ts          # Express 服务
│   ├── config.ts          # 配置加载
│   ├── auth.ts            # JWT 认证
│   ├── dingtalk-sender.ts # 钉钉 Webhook 发送
│   ├── dm-handler.ts      # 私信处理
│   ├── bot-manager.ts     # 机器人管理
│   ├── agent/             # Agent 系统（记忆、技能、对话）
│   ├── bots/              # 触发器（OpenClaw、智能对话）
│   ├── routes/            # API 路由
│   ├── services/          # 业务服务
│   ├── gateway/           # Gateway 中转
│   ├── e2ee/              # 端到端加密
│   └── observability/     # 可观测性
├── config/
│   ├── default.json       # 默认配置
│   └── local.json         # 本地配置（Git 忽略）
└── migrations/            # 数据库迁移
```

---

## 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **入口** | `index.ts` | PID锁、内存监控、启动触发器 |
| **服务器** | `server.ts` | Express 应用、中间件、路由 |
| **认证** | `auth.ts` | JWT 登录、Token 刷新、权限 |
| **钉钉** | `dingtalk-sender.ts` | Webhook 发送、签名、多群支持 |
| **私信** | `dm-handler.ts` | 私聊会话、消息存储 |
| **机器人** | `bot-manager.ts` | 多机器人管理、配置加载 |

---

## 运行模式

| 模式 | 触发器 | 用途 |
|------|--------|------|
| **A - 存储分析** | 关闭 | 消息存储 + 分析（推荐） |
| **B - 完整中转** | 开启 | 消息触发 + 存储 + 同步 |

配置：`config.mode = 'storage' | 'hub'`

---

## 常用命令

```bash
# 开发
npm run dev           # ts-node 启动
npm run build         # tsc 编译
npm start             # 生产运行

# 测试
npm test              # Jest 测试
npm run typecheck     # 类型检查

# 健康检查
curl http://localhost:8273/health
```

---

## API 端点

### 核心
- `GET /health` - 健康检查
- `POST /api/v1/messages/reply` - 发送消息到钉钉
- `POST /api/v1/dm/send` - 发送私聊消息
- `GET /api/v1/messages/search` - FTS5 全文搜索

### Agent
- `POST /api/agents/:id/chat` - 与 Agent 对话
- `POST /api/agents/:id/chat/stream` - SSE 流式对话

---

## 配置要点

```json
{
  "mode": "storage",
  "server": { "port": 8273 },
  "bot": { "name": "小琳", "local": true },
  "dingtalk": {
    "webhooks": { "primary": { "webhookBase": "...", "secret": "..." } }
  },
  "trigger": { "enabled": false, "smart": true }
}
```

---

## 开发规范

### 文件命名
- 服务/工具：`kebab-case.ts`（如 `dingtalk-sender.ts`）
- 模块目录：`lowercase/`（如 `agent/`、`bots/`）

### 代码风格
- TypeScript + CommonJS 混合（`.ts` 文件用 `require`）
- 2 空格缩进、单引号、分号
- `async/await` 优先

### 添加新 API
1. 在 `src/routes/` 创建路由文件
2. 在 `src/services/` 实现业务逻辑
3. 在 `server.ts` 注册路由

---

## 注意事项

- **PID 锁**：防止多实例运行，锁文件 `~/.openclaw/chat-hub.pid`
- **内存监控**：默认 500MB 限制，超过触发 GC
- **钉钉签名**：依赖系统时间准确性
- **Redis**：可选，`bot.local: true` 跳过

---

## 相关文档

- [API 文档](./docs/API.md)
- [部署指南](./docs/DEPLOYMENT.md)
- [项目根目录 AGENTS.md](../AGENTS.md)