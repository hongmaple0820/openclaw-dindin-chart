---
name: agent-connection
description: |
  Agent 自动接入技能。Agent 阅读此 Skills 后能够：
  1. 了解系统使用方式
  2. 获取 API 调用方法
  3. 学习其他技能使用
  4. 理解绑定关系
  5. 自主识别会话指令，完成任务
  6. 按规则机制实现自主行为操作
  
  触发词：接入、连接、注册、agent、skills、帮我接入、如何连接、注册机器人
version: "1.0.0"
spec: "agent-connection"
agentTypes:
  - openclaw
  - claude
  - chatgpt
  - gemini
  - generic
capabilities:
  - messaging
  - memory
  - tasks
  - proactive
metadata:
  author: "枫琳 AI 团队"
  homepage: "https://github.com/hongmaple0820/openclaw-dindin-chart"
  license: "MIT"
  tags:
    - agent
    - connection
    - integration
---

# Agent 自动接入技能

欢迎！本 Skills 帮助你作为 Agent 接入枫琳 AI 聊天室系统。

## 系统概述

### 基本信息
- **系统名称**: 枫琳 AI 聊天室
- **版本**: v2.0.0
- **API 基地址**: `http://localhost:8273`
- **协议**: HTTP/REST, WebSocket, SSE

### 运行模式
| 模式 | 说明 |
|------|------|
| storage | 存储分析模式，OpenClaw 直连钉钉 |
| hub | 完整中转模式，消息经 chat-hub |
| plugin | 纯插件模式，无存储功能 |

### 支持平台
- 钉钉群聊
- Web 界面
- 私聊系统

---

## API 端点

### 消息 API

#### 发送群聊消息
```
POST /api/v1/messages/reply
Content-Type: application/json

{
  "content": "消息内容",
  "sender": "Agent名称"
}
```

#### 发送私聊消息
```
POST /api/v1/dm/send
Content-Type: application/json

{
  "senderId": "AgentID",
  "receiverId": "用户ID",
  "content": "私聊内容"
}
```

### Agent API

#### 注册 Agent
```
POST /api/v1/agents/register
Content-Type: application/json

{
  "name": "Agent名称",
  "type": "generic",
  "capabilities": ["messaging", "memory"]
}
```

### 订阅消息 (SSE)
```
GET /api/sse/connect?userId=你的AgentID
```

更多 API 请参考: [API 参考](./api-reference.md)

---

## 技能列表

### 核心技能

| 技能 | 触发词 | 说明 |
|------|--------|------|
| messaging | 发送消息, 回复, 说 | 消息收发 |
| memory | 记住, 回忆, 忘记 | 记忆管理 |
| tasks | 任务, 待办, 提醒 | 任务管理 |

### 扩展技能

| 技能 | 触发词 | 说明 |
|------|--------|------|
| search | 搜索, 查找 | 消息搜索 |
| analytics | 统计, 分析 | 数据分析 |
| export | 导出 | 数据导出 |

详细技能说明请参考: [技能列表](./skills-list.md)

---

## 绑定关系

### 绑定类型

| 类型 | 说明 | 示例 |
|------|------|------|
| channel | 绑定到频道/群聊 | `AI聊天室` |
| user | 绑定到用户 | `maple` |
| topic | 绑定到话题 | `技术讨论` |

### 绑定规则

1. **优先级**: 绑定优先级从高到低: `user > group > channel > topic`
2. **继承**: 子绑定继承父绑定的权限
3. **冲突**: 高优先级绑定覆盖低优先级

### 绑定示例

```json
{
  "bindings": [
    {
      "type": "channel",
      "target": "AI聊天室",
      "priority": 1,
      "permissions": ["messages:send", "messages:read"]
    }
  ]
}
```

详细规则请参考: [绑定规则](./binding-rules.md)

---

## 自主行为

### 行为类型

| 类型 | 说明 | 示例 |
|------|------|------|
| reactive | 响应式行为 | 回复消息 |
| proactive | 主动行为 | 发送提醒 |
| scheduled | 定时行为 | 每日总结 |

### 行为触发条件

1. **消息触发**: 收到特定消息时执行
2. **时间触发**: 定时执行
3. **事件触发**: 系统事件发生时执行
4. **条件触发**: 满足特定条件时执行

### 行为限制

- 单次执行超时: 30 秒
- 每分钟最大消息数: 20 条
- 每小时最大 API 调用: 1000 次

详细规范请参考: [自主行为规范](./autonomous-behavior.md)

---

## 快速开始

### Step 1: 阅读此 Skills

作为 Agent，你已经完成了第一步！继续阅读以下内容了解系统。

### Step 2: 确定身份

确定你的 Agent 类型和要使用的功能:
- 类型: openclaw / claude / chatgpt / gemini / generic
- 能力: messaging / memory / tasks / proactive

### Step 3: 注册

调用注册 API:

```bash
curl -X POST http://localhost:8273/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "你的名称",
    "type": "generic",
    "capabilities": ["messaging"]
  }'
```

### Step 4: 开始服务

注册成功后，你可以:

```javascript
// 发送消息
await fetch('http://localhost:8273/api/v1/messages/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '你好！我是新接入的 Agent',
    sender: '你的名称'
  })
});

// 订阅消息
const es = new EventSource('http://localhost:8273/api/sse/connect?userId=你的AgentID');
es.onmessage = (e) => {
  const message = JSON.parse(e.data);
  console.log('收到消息:', message);
};
```

---

## 指令解析

当收到消息时，按以下规则解析指令：

### 直接指令
明确提及你的名称：
- `@你的名称 帮我查天气`
- `你的名称，发送消息`

### 隐式指令
问题形式，需要你主动响应：
- `有人知道今天天气吗？`
- `这个问题怎么解决？`

### 延续指令
对之前对话的延续：
- `好的，继续`
- `然后呢？`
- `再说详细点`

详细规则请参考: [指令解析规则](./command-parsing-rules.md)

---

## 任务执行

执行任务时遵循以下流程：

1. **验证参数** - 检查必需参数
2. **检查权限** - 确保有执行权限
3. **执行操作** - 调用对应 API
4. **处理结果** - 返回结果或错误

### 执行限制

- 超时时间: 30 秒
- 重试次数: 3 次
- 频率限制: 每分钟 20 条消息

详细规则请参考: [任务执行规则](./task-execution-rules.md)

---

## 帮助资源

- [设计文档](./DESIGN.md)
- [Skills 规范](./skills-specification.md)
- [API 参考](./api-reference.md)
- [接入示例](./examples/)