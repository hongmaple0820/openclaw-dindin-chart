# Chat-Hub Core Backend

**Generated:** 2026-03-08
**Commit:** Current
**Score:** 18 (High Complexity)

---

## OVERVIEW

Node.js/TypeScript backend powering multi-AI chat orchestration with Agent management, memory systems, and DingTalk integration. 185 TypeScript files.

---

## STRUCTURE

```
src/
├── agent/          # AI Agent 管理系统
│   ├── memory/     # 记忆系统 (短期/长期/情景)
│   ├── models/     # 多模型支持 (OpenAI/Claude/GLM)
│   └── skills/     # 技能插件系统
├── api/            # RESTful API 路由
├── bots/           # 机器人触发器
├── browser/        # 浏览器自动化
├── character/      # 角色/人格配置
├── cloud-market/   # 云市场集成
├── e2ee/           # 端到端加密
├── gateway/        # API Gateway
├── media/          # 媒体处理
├── observability/  # 可观测性 (日志/指标)
├── relay/          # 数据中转服务
├── sandbox/        # 代码沙箱
├── services/       # 业务服务
├── websocket/      # WebSocket 处理
├── *.ts            # 顶层模块 (auth, dingtalk-sender, dm-handler 等)
└── index.ts        # 入口
```

---

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 新增 API 端点 | `api/` 或顶层 `*.ts` | Express 路由模式 |
| AI 对话逻辑 | `agent/` + `bot-manager.ts` | 多模型路由 |
| 记忆系统 | `agent/memory/` | 短期/长期/情景记忆 |
| 钉钉集成 | `dingtalk-sender.ts` | Webhook + 签名 |
| 私聊功能 | `dm-handler.ts` | DM 消息处理 |
| 用户认证 | `auth.ts` | JWT + bcrypt |
| WebSocket | `websocket/` 或 `index.ts` | 实时通信 |
| 文件上传 | `image-upload.ts`, `audio-upload.ts` | 本地存储 |

---

## CONVENTIONS (chat-hub specific)

### 路径别名
```typescript
import { xxx } from '@/services/xxx';  // @/* → src/*
```

### 配置加载
```typescript
import config from './config.js';
// config.local.json 覆盖 config.default.json
```

### 数据库
```typescript
// SQLite via better-sqlite3
import Database from 'better-sqlite3';
const db = new Database('./data/chat.db');
```

---

## ANTI-PATTERNS

- **禁用 `var`** - 使用 `const`/`let`
- **禁用 `@ts-ignore`** - 修复类型错误
- **禁用空 catch** - 必须处理错误
- **禁用硬编码密钥** - 使用 `config/local.json`

---

## KEY MODULES

| 文件 | 行数 | 职责 |
|------|------|------|
| `index.ts` | ~200 | Express 服务入口 |
| `auth.ts` | ~400 | 用户认证 |
| `dingtalk-sender.ts` | ~450 | 钉钉消息发送 |
| `bot-manager.ts` | ~280 | 多机器人管理 |
| `dm-handler.ts` | ~180 | 私聊处理 |

---

## COMMANDS

```bash
# 开发
npm run dev           # ts-node 热重载
npm run typecheck     # 类型检查

# 构建
npm run build         # tsc → dist/

# 测试
npm test              # Jest 单元测试

# 生产
npm start             # node dist/index.js
```

---

## NOTES

- `ts-node` 用于开发，`tsc` 编译后运行生产
- Redis 可选 (`bot.local: true` 跳过)
- 沙箱容器用于安全执行用户代码