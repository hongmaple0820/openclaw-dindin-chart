# Chat-Hub OpenAPI 规范

> 版本: 1.0.0
> 基础地址: http://localhost:8273
> 更新时间: 2026-03-04

## 概述

Chat-Hub 提供完整的 RESTful API，支持消息管理、Agent 对话、会话管理、文件存储、可观测性等功能。

### 认证方式

- **Bearer Token**: 通过 `Authorization: Bearer <token>` 头部认证
- **X-User-ID**: 部分接口支持通过 `X-User-ID` 头部标识用户

### 响应格式

所有 API 返回 JSON 格式：

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误描述"
}
```

---

## API 端点总览

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 消息 | `/api` | 消息存储、发送、搜索 |
| Agent | `/api/agents` | Agent 管理与对话 |
| 会话 | `/api/session` | 会话管理 |
| 技能 | `/api/skills` | 技能系统 |
| 任务 | `/api/tasks` | 任务管理 |
| 可观测性 | `/api/observability` | 日志、指标、监控 |
| Relay | `/api/relay` | 数据中转服务 |
| 沙箱 | `/api/sandbox` | Docker 容器隔离 |
| 用户 | `/api/auth` | 用户认证 |
| 群组 | `/api/groups` | 群组管理 |
| 好友 | `/api/friends` | 好友关系 |

---

## 消息 API

### POST /api/store

仅存储消息，不发送到钉钉。用于 OpenClaw 转存收到的消息。

**请求体：**

```json
{
  "sender": "发送者名字",
  "content": "消息内容",
  "source": "dingtalk",
  "timestamp": 1234567890,
  "atTargets": ["@小琳"],
  "replyTo": "message-id"
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
    "atTargets": ["小琳"],
    "replyTo": null
  }
}
```

### POST /api/reply

机器人发送回复（会发送到钉钉群）。

**请求体：**

```json
{
  "content": "回复内容",
  "sender": "小琳",
  "atTargets": ["@某人"],
  "replyTo": "message-id"
}
```

### POST /api/send

Web 前端发送消息（会发送到钉钉群）。

**请求体：**

```json
{
  "content": "消息内容",
  "sender": "WebUser",
  "atTargets": ["@小琳"]
}
```

### GET /api/context

获取最近消息列表。

**参数：**
- `limit`: 返回条数，默认 50

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
      "source": "dingtalk|web|bot|redis",
      "atTargets": null,
      "replyTo": null
    }
  ]
}
```

### GET /api/search

搜索消息（支持全文检索）。

**参数：**
- `q`: 搜索关键词（必填）
- `sender`: 发送者过滤
- `startTime`: 开始时间戳
- `endTime`: 结束时间戳
- `source`: 来源过滤
- `limit`: 返回条数，默认 50
- `offset`: 偏移量
- `highlight`: 是否高亮关键词
- `includeChain`: 是否包含引用链

**响应：**

```json
{
  "success": true,
  "count": 5,
  "messages": [...],
  "query": "关键词",
  "options": {...}
}
```

### GET /api/stats

获取统计信息。

**响应：**

```json
{
  "success": true,
  "stats": {
    "total": 1000,
    "today": 50,
    "bySender": [
      { "sender": "小琳", "count": 500 },
      { "sender": "小猪", "count": 300 }
    ]
  }
}
```

### DELETE /api/message/:messageId

删除指定消息。

---

## Agent API

### GET /api/agents

获取 Agent 列表。

**参数：**
- `type`: 类型过滤 (user-added/system/client)
- `isPublic`: 公开状态 (true/false)
- `ownerId`: 拥有者 ID
- `status`: 状态过滤 (offline/online/busy/error)
- `limit`: 返回数量，默认 100
- `offset`: 偏移量

**响应：**

```json
{
  "success": true,
  "count": 10,
  "agents": [
    {
      "id": "agent-001",
      "nickname": "小琳",
      "avatar": "https://...",
      "description": "AI 助手",
      "type": "system",
      "isPublic": true,
      "model": "gpt-4",
      "capabilities": {
        "chat": true,
        "image": false
      },
      "status": "online",
      "lastActive": 1709548800000,
      "totalRequests": 1234,
      "createdAt": 1700000000000
    }
  ]
}
```

### GET /api/agents/:id

获取 Agent 详情。

### POST /api/agents

注册新 Agent。

**请求体：**

```json
{
  "nickname": "新助手",
  "avatar": "https://...",
  "description": "描述",
  "type": "user-added",
  "isPublic": false,
  "apiEndpoint": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4",
  "params": {
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "capabilities": {
    "chat": true,
    "image": false,
    "function_calling": true
  },
  "memoryEnabled": true,
  "memoryConfig": {
    "maxMessages": 100,
    "relevanceThreshold": 0.7
  },
  "skills": ["skill-001", "skill-002"]
}
```

### PUT /api/agents/:id

更新 Agent 配置。

### DELETE /api/agents/:id

删除 Agent。

### POST /api/agents/:id/toggle-public

切换 Agent 公开/私密状态。

---

## Agent 对话 API (OpenAI 协议兼容)

### POST /api/agents/:id/chat

与 Agent 对话（非流式）。

**请求体（OpenAI 格式）：**

```json
{
  "messages": [
    { "role": "system", "content": "你是一个有帮助的助手" },
    { "role": "user", "content": "你好" }
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**响应（OpenAI 格式）：**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1709548800,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮助你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### POST /api/agents/:id/chat/stream

流式对话（SSE）。

**请求体：**

```json
{
  "messages": [{ "role": "user", "content": "讲个故事" }],
  "stream": true
}
```

**响应（SSE 格式）：**

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"很"},"index":0}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"久"},"index":0}]}

data: [DONE]
```

---

## Agent 记忆 API

### GET /api/agents/:id/memories

获取 Agent 记忆列表。

**参数：**
- `type`: 记忆类型 (short-term/long-term/episodic)
- `limit`: 返回数量，默认 10
- `minImportance`: 最小重要性 (0-1)

### POST /api/agents/:id/memories

添加记忆。

**请求体：**

```json
{
  "content": "用户喜欢喝咖啡",
  "type": "long-term",
  "importance": 0.8,
  "metadata": {
    "source": "conversation",
    "timestamp": 1709548800000
  }
}
```

### DELETE /api/agents/:id/memories/:memoryId

删除记忆。

---

## 会话 API

### POST /api/session

创建会话。

**私聊：**

```json
{
  "type": "private",
  "participants": [
    { "id": "user-001", "name": "用户A" },
    { "id": "agent-001", "name": "小琳" }
  ]
}
```

**群聊：**

```json
{
  "type": "group",
  "name": "项目讨论组",
  "ownerId": "user-001",
  "ownerName": "用户A",
  "participants": [
    { "id": "user-002", "name": "用户B" },
    { "id": "agent-001", "name": "小琳" }
  ]
}
```

### GET /api/session

获取用户会话列表。

**参数：**
- `type`: 会话类型 (private/group)
- `limit`: 返回数量
- `offset`: 偏移量

### GET /api/session/:sessionId

获取会话详情。

### POST /api/session/:sessionId/messages

发送消息到会话。

**请求体：**

```json
{
  "content": "消息内容",
  "senderId": "user-001",
  "senderName": "用户A"
}
```

### GET /api/session/:sessionId/messages

获取会话消息。

**参数：**
- `limit`: 返回数量
- `before`: 时间戳，获取此时间之前的消息
- `after`: 时间戳，获取此时间之后的消息

---

## 技能 API

### GET /api/skills

获取技能列表。

**参数：**
- `category`: 分类过滤
- `source`: 来源过滤
- `enabled`: 是否启用
- `search`: 搜索关键词
- `limit`: 返回数量
- `offset`: 偏移量

### GET /api/skills/:id

获取技能详情。

### POST /api/skills

注册技能。

**请求体：**

```json
{
  "name": "天气查询",
  "description": "查询指定城市的天气",
  "category": "utility",
  "version": "1.0.0",
  "enabled": true,
  "config": {
    "apiEndpoint": "https://api.weather.com"
  },
  "inputs": {
    "city": {
      "type": "string",
      "description": "城市名称",
      "required": true
    }
  },
  "outputs": {
    "temperature": "number",
    "condition": "string"
  }
}
```

### POST /api/skills/execute

执行技能。

**请求体：**

```json
{
  "skillId": "skill-001",
  "inputs": {
    "city": "北京"
  },
  "context": {
    "userId": "user-001"
  }
}
```

### GET /api/skills/user/:userId

获取用户绑定的技能列表。

### POST /api/skills/user/:userId

绑定技能到用户。

---

## 任务 API

### GET /api/tasks

获取任务列表。

**参数：**
- `status`: 状态 (pending/running/completed/failed)
- `priority`: 优先级 (low/medium/high/urgent)
- `creator_id`: 创建者 ID
- `pinned`: 是否置顶
- `limit`: 返回数量
- `offset`: 偏移量

### POST /api/tasks

创建任务。

**请求体：**

```json
{
  "title": "分析数据报告",
  "description": "分析本周的销售数据",
  "priority": "high",
  "creator_id": "user-001",
  "creator_name": "用户A",
  "context": {
    "dataUrl": "https://..."
  },
  "tags": ["数据分析", "销售"]
}
```

### PUT /api/tasks/:id

更新任务。

### POST /api/tasks/:id/assign

分配任务执行者。

### POST /api/tasks/:id/start

开始执行任务。

### POST /api/tasks/:id/complete

完成任务。

### POST /api/tasks/:id/fail

标记任务失败。

---

## 可观测性 API

### GET /api/observability/logs

查询日志。

**参数：**
- `level`: 日志级别 (info/warn/error)
- `limit`: 返回数量
- `offset`: 偏移量
- `startTime`: 开始时间戳
- `endTime`: 结束时间戳

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "level": "info",
      "message": "Agent online",
      "timestamp": 1709548800000,
      "metadata": {
        "agentId": "agent-001"
      }
    }
  ],
  "count": 10
}
```

### GET /api/observability/metrics

查询指标。

**参数：**
- `name`: 指标名称
- `startTime`: 开始时间戳
- `endTime`: 结束时间戳
- `limit`: 返回数量

### GET /api/observability/stats

获取统计信息。

**响应：**

```json
{
  "success": true,
  "data": {
    "logs": {
      "total": 1000,
      "byLevel": [
        { "level": "info", "count": 800 },
        { "level": "warn", "count": 150 },
        { "level": "error", "count": 50 }
      ]
    },
    "metrics": {
      "total": 500,
      "topEndpoints": [
        { "endpoint": "/api/chat", "count": 200 },
        { "endpoint": "/api/agents", "count": 150 }
      ]
    }
  }
}
```

### GET /api/observability/health

健康检查。

### GET /api/observability/dashboard

仪表板数据（汇总）。

---

## Relay 数据中转 API

### POST /api/relay/register

注册实例，获取 Token。

**请求体：**

```json
{
  "instanceId": "instance-001",
  "name": "Chat-Hub Node 1",
  "type": "chat-hub"
}
```

**响应：**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": 1709635200000
}
```

### POST /api/relay/refresh

刷新 Token。

### GET /api/relay/instances

获取实例列表。

### GET /api/relay/status

获取服务状态。

### POST /api/relay/sync/message

同步消息。

### POST /api/relay/sync/file

同步文件。

### GET /api/relay/sse

SSE 连接端点（长连接）。

---

## 沙箱 API

### GET /api/sandbox

列出所有沙箱。

**参数：**
- `status`: 状态过滤
- `limit`: 返回数量
- `offset`: 偏移量

### POST /api/sandbox

创建沙箱。

**请求体：**

```json
{
  "name": "Python 环境",
  "image": "python:3.11-slim",
  "resources": {
    "cpu": 1,
    "memory": "512M"
  },
  "timeout": 60000
}
```

### GET /api/sandbox/:id

获取沙箱详情。

### POST /api/sandbox/:id/execute

在沙箱中执行命令。

**请求体：**

```json
{
  "command": "python script.py",
  "timeout": 30000
}
```

### DELETE /api/sandbox/:id

删除沙箱。

---

## 用户认证 API

### POST /api/auth/register

注册用户。

**请求体：**

```json
{
  "username": "user001",
  "nickname": "用户A",
  "email": "user@example.com",
  "password": "password123",
  "type": "human"
}
```

### POST /api/auth/login

登录。

**请求体：**

```json
{
  "username": "user001",
  "password": "password123"
}
```

**响应：**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-001",
    "username": "user001",
    "nickname": "用户A"
  }
}
```

### GET /api/auth/me

获取当前用户信息。

---

## 同步 API

### GET /api/sync/:participantId

获取参与者未同步的消息。

### POST /api/sync/:participantId

标记同步完成。

### GET /api/sync-status

获取所有参与者的同步状态。

---

## 图片 API

### POST /api/upload/image

上传图片。

**请求：** `multipart/form-data`
- `image`: 图片文件
- `sender`: 发送者
- `messageId`: 消息 ID（可选）

### GET /api/images/list

获取图片列表（分页）。

### GET /api/images/:filename

获取图片文件。

### DELETE /api/images/:imageId

删除图片。

---

## 表情回应 API

### POST /api/reactions

添加表情回应。

**请求体：**

```json
{
  "messageId": "msg-001",
  "reactorId": "user-001",
  "emoji": "👍"
}
```

### DELETE /api/reactions

删除表情回应。

### GET /api/reactions/:messageId

获取消息的表情统计。

---

## 已读 API

### POST /api/read/:messageId

标记单条消息已读。

### POST /api/read-all

批量标记已读。

### GET /api/unread/:readerId

获取未读消息。

### GET /api/unread-count/:readerId

获取未读消息数量。

---

## 健康检查

### GET /health

服务健康检查。

**响应：**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": 1709548800000,
  "uptime": 86400,
  "database": {
    "messages": 1000,
    "today": 50
  },
  "redis": {
    "status": "connected",
    "latency": 5
  },
  "memory": {
    "heapUsed": 128,
    "heapTotal": 256
  }
}
```

---

## 错误码

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-04 | 初始版本，包含核心 API |

---

*文档维护：Chat-Hub Team*
*最后更新：2026-03-04*