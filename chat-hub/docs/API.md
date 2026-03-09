# API 接口文档

> **完整 API 规范请参考 [OpenAPI 文档](./OPENAPI.md)**
> **使用示例请参考 [使用示例文档](./EXAMPLES.md)**

## 概述

chat-hub 提供 RESTful API，用于消息的存储、发送、查询和同步。

**基础 URL：** `http://localhost:8273`

## 认证

当前版本无认证要求。生产环境建议添加认证机制。

---

## 消息相关 API

### POST /api/store

**仅存储消息，不发送到钉钉**

用于 OpenClaw 转存从其他渠道收到的消息。

**请求体：**

```json
{
  "sender": "发送者名字",
  "content": "消息内容",
  "source": "dingtalk",    // 可选，默认 "openclaw"
  "timestamp": 1234567890  // 可选，默认当前时间戳（毫秒）
}
```

**响应：**

```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "type": "human",
    "sender": "发送者名字",
    "content": "消息内容",
    "timestamp": 1234567890,
    "source": "dingtalk",
    "replyTo": null
  }
}
```

---

### POST /api/reply

**机器人发送回复（会发送到钉钉群）**

```json
{
  "content": "回复内容",
  "sender": "小琳",
  "atTargets": ["@某人"]  // 可选，@ 某人
}
```

**响应：**

```json
{
  "success": true,
  "message": { ... }
}
```

---

### POST /api/send

**Web 前端发送消息（会发送到钉钉群）**

```json
{
  "content": "消息内容",
  "sender": "WebUser"
}
```

---

### GET /api/context

**获取最近消息列表**

**参数：**
- `limit`：返回条数，默认 50

**响应：**

```json
{
  "success": true,
  "context": [
    {
      "id": "uuid",
      "type": "human|bot",
      "sender": "发送者",
      "content": "内容",
      "timestamp": 1234567890,
      "source": "dingtalk|web|bot|redis"
    }
  ]
}
```

---

### GET /api/search

**搜索消息**

**参数：**
- `q`：搜索关键词（必填）
- `limit`：返回条数，默认 50

**响应：**

```json
{
  "success": true,
  "count": 5,
  "messages": [ ... ]
}
```

---

### GET /api/stats

**获取统计信息**

**响应：**

```json
{
  "success": true,
  "stats": {
    "total": 100,
    "today": 20,
    "bySender": [
      { "sender": "小琳", "count": 50 },
      { "sender": "小猪", "count": 30 },
      { "sender": "鸿枫", "count": 20 }
    ]
  }
}
```

---

### DELETE /api/message/:messageId

**删除指定消息**

**响应：**

```json
{
  "success": true
}
```

---

## 同步相关 API

### GET /api/sync/:participantId

**获取参与者未同步的消息**

用于离线后重新上线时获取错过的消息。

**响应：**

```json
{
  "success": true,
  "count": 5,
  "messages": [ ... ]
}
```

---

### POST /api/sync/:participantId

**标记同步完成**

**请求体：**

```json
{
  "timestamp": 1234567890  // 可选，默认当前时间
}
```

---

### GET /api/sync-status

**获取所有参与者的同步状态**

---

## Agent V2 API

> 以下端点由 `src/routes/agents-v2.ts` 提供，当前代码库已经实际挂载到 `/api/agents`。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | GET | 获取 Agent 列表 |
| `/api/agents` | POST | 创建 Agent |
| `/api/agents/:id` | GET | 获取 Agent 详情 |
| `/api/agents/:id` | PUT | 更新 Agent |
| `/api/agents/:id` | DELETE | 删除 Agent |
| `/api/agents/:id/chat` | POST | 与 Agent 对话 |
| `/api/agents/:id/chat/stream` | POST | SSE 流式对话 |
| `/api/agents/:id/memories` | GET/POST | 查询或写入记忆 |
| `/api/agents/:id/memories/:memoryId` | DELETE | 删除记忆 |
| `/api/agents/:id/sessions` | GET | 获取会话列表 |
| `/api/agents/:id/sessions/:sessionId/messages` | GET | 获取会话消息 |
| `/api/agents/:id/sessions/:sessionId` | DELETE | 删除会话 |
| `/api/agents/:id/sessions/:sessionId/resume` | POST | 恢复会话 |
| `/api/agents/:id/stats` | GET | 获取 Agent 统计 |
| `/api/agents/:id/billing` | GET | 获取计费统计 |
| `/api/agents/:id/billing/export` | GET | 导出计费数据 |
| `/api/agents/:id/api-token` | POST | 创建 API Token |
| `/api/agents/:id/api-tokens` | GET | 查询 API Token |
| `/api/agents/tokens/:tokenId` | DELETE | 删除 API Token |

---

## Observability API

> 以下端点由 `src/routes/observability.ts` 提供，当前代码库已经实际挂载到 `/api/observability`。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/observability/dashboard` | GET | 仪表盘聚合数据 |
| `/api/observability/logs` | GET | 查询日志 |
| `/api/observability/metrics` | GET | 查询指标 |
| `/api/observability/stats` | GET | 获取观测统计 |
| `/api/observability/health` | GET | 观测模块健康检查 |
| `/api/observability/system` | GET | 获取系统运行时信息 |

---

## Email API

> 当前邮件通道仍挂载在 `/api/email`。默认安装只保证 SMTP 发信可用；IMAP 收件箱能力需要额外安装 `imap` 依赖，并在初始化时显式传入 `inbound_enabled: true`。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/email/init` | POST | 初始化邮件通道 |
| `/api/email/send` | POST | 发送邮件 |
| `/api/email/send-text` | POST | 发送纯文本邮件 |
| `/api/email/send-html` | POST | 发送 HTML 邮件 |
| `/api/email/test` | GET | 测试 SMTP 连通性 |
| `/api/email/status` | GET | 查看 SMTP / IMAP 状态 |
| `/api/email/unread` | GET | 获取未读邮件数，要求启用 IMAP 收件箱 |
| `/api/email/recent` | GET | 获取最近邮件，要求启用 IMAP 收件箱 |
| `/api/email/close` | POST | 关闭邮件通道 |

**初始化示例：**

```json
{
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "bot@example.com",
  "smtp_password": "secret",
  "from": "bot@example.com",
  "inbound_enabled": false
}
```

**启用 IMAP 收件箱时额外需要：**

```json
{
  "imap_host": "imap.example.com",
  "imap_port": 993,
  "inbound_enabled": true
}
```

---

## OpenAI 兼容 API

> 当前服务在 `src/server.ts` 中额外挂载了兼容入口，用于把请求转发到 Agent API。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | OpenAI Chat Completions 兼容入口，需要 `X-Agent-ID` |
| `/v1/models` | GET | OpenAI Models 兼容入口，支持 `X-Agent-ID` |

---

## Webhook 回调

### POST /webhook/dingtalk

**接收钉钉 Outgoing 消息**

钉钉会自动发送 POST 请求到此地址。

---

## 健康检查

### GET /health

**服务健康检查**

**响应：**

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "messageCount": 100,
  "todayCount": 20,
  "config": {
    "bot": "小琳",
    "storeDir": "/home/user/.openclaw/chat-data",
    "dbPath": "/home/user/.openclaw/chat-data/messages.db"
  }
}
```

---

## 错误响应

所有 API 在出错时返回：

```json
{
  "success": false,
  "error": "错误描述"
}
```

HTTP 状态码：
- `400`：请求参数错误
- `404`：资源不存在
- `500`：服务器内部错误
