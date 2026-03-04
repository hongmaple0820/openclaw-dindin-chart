# Chat-Hub 使用示例

> 版本: 1.0.0
> 更新时间: 2026-03-04

本文档提供 Chat-Hub API 的完整使用示例，涵盖 Agent 对话、会话管理、可观测性等核心功能。

## 目录

1. [Agent API 使用示例](#agent-api-使用示例)
2. [会话管理示例](#会话管理示例)
3. [可观测性 API 示例](#可观测性-api-示例)
4. [消息 API 示例](#消息-api-示例)
5. [技能 API 示例](#技能-api-示例)
6. [Webhook 集成示例](#webhook-集成示例)

---

## Agent API 使用示例

### 1. 注册 Agent

```bash
curl -X POST http://localhost:8273/api/agents \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "nickname": "小琳",
    "description": "AI 助手，擅长聊天和解答问题",
    "type": "system",
    "isPublic": true,
    "apiEndpoint": "https://api.openai.com/v1",
    "apiKey": "sk-your-api-key",
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
    }
  }'
```

**响应：**

```json
{
  "success": true,
  "agent": {
    "id": "agent-abc123",
    "nickname": "小琳",
    "description": "AI 助手，擅长聊天和解答问题",
    "type": "system",
    "isPublic": true,
    "model": "gpt-4",
    "status": "offline",
    "createdAt": 1709548800000
  }
}
```

### 2. 获取 Agent 列表

```bash
# 获取所有公开的 Agent
curl http://localhost:8273/api/agents?isPublic=true

# 获取特定用户的 Agent
curl http://localhost:8273/api/agents?ownerId=user-001

# 获取在线的 Agent
curl http://localhost:8273/api/agents?status=online
```

**响应：**

```json
{
  "success": true,
  "count": 3,
  "agents": [
    {
      "id": "agent-abc123",
      "nickname": "小琳",
      "avatar": null,
      "description": "AI 助手",
      "type": "system",
      "isPublic": true,
      "model": "gpt-4",
      "capabilities": { "chat": true },
      "status": "online",
      "lastActive": 1709548800000,
      "totalRequests": 1234
    }
  ]
}
```

### 3. 与 Agent 对话（非流式）

```bash
curl -X POST http://localhost:8273/api/agents/agent-abc123/chat \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "messages": [
      { "role": "system", "content": "你是一个有帮助的AI助手。" },
      { "role": "user", "content": "你好，请介绍一下自己" }
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

**响应（OpenAI 格式）：**

```json
{
  "id": "chatcmpl-xyz789",
  "object": "chat.completion",
  "created": 1709548800,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是小琳，一个AI助手。我可以帮助你回答问题、聊天、写代码等各种任务。有什么我可以帮你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 45,
    "total_tokens": 70
  }
}
```

### 4. 流式对话（SSE）

使用 curl 测试：

```bash
curl -N http://localhost:8273/api/agents/agent-abc123/chat/stream \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "messages": [
      { "role": "user", "content": "给我讲一个简短的故事" }
    ]
  }'
```

**响应（SSE 流）：**

```
data: {"id":"chatcmpl-xyz","choices":[{"index":0,"delta":{"content":"很"},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","choices":[{"index":0,"delta":{"content":"久"},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","choices":[{"index":0,"delta":{"content":"以"},"finish_reason":null}]}

...

data: {"id":"chatcmpl-xyz","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

JavaScript 客户端示例：

```javascript
async function streamChat(agentId, messages) {
  const response = await fetch(`http://localhost:8273/api/agents/${agentId}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': 'user-001'
    },
    body: JSON.stringify({ messages })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('Stream complete');
          return result;
        }

        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content || '';
        result += content;
        process.stdout.write(content); // 实时输出
      }
    }
  }

  return result;
}

// 使用示例
streamChat('agent-abc123', [
  { role: 'user', content: '给我讲一个故事' }
]).then(console.log);
```

Python 客户端示例：

```python
import httpx

async def stream_chat(agent_id: str, messages: list):
    url = f"http://localhost:8273/api/agents/{agent_id}/chat/stream"
    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "user-001"
    }
    data = {"messages": messages}

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=data, headers=headers) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    import json
                    parsed = json.loads(chunk)
                    content = parsed["choices"][0].get("delta", {}).get("content", "")
                    if content:
                        print(content, end="", flush=True)

# 使用示例
import asyncio
asyncio.run(stream_chat("agent-abc123", [
    {"role": "user", "content": "你好"}
]))
```

### 5. 管理 Agent 记忆

添加记忆：

```bash
curl -X POST http://localhost:8273/api/agents/agent-abc123/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "用户喜欢喝咖啡，特别是拿铁",
    "type": "long-term",
    "importance": 0.8,
    "metadata": {
      "source": "conversation",
      "topic": "preferences"
    }
  }'
```

获取记忆：

```bash
# 获取长期记忆
curl "http://localhost:8273/api/agents/agent-abc123/memories?type=long-term&limit=10"

# 获取高重要性记忆
curl "http://localhost:8273/api/agents/agent-abc123/memories?minImportance=0.7"
```

**响应：**

```json
{
  "success": true,
  "count": 2,
  "memories": [
    {
      "id": "mem-xyz",
      "content": "用户喜欢喝咖啡，特别是拿铁",
      "type": "long-term",
      "importance": 0.8,
      "createdAt": 1709548800000,
      "lastAccessedAt": 1709548800000
    }
  ]
}
```

### 6. OpenAI 协议兼容

Chat-Hub 的 Agent API 兼容 OpenAI 格式，可以直接使用 OpenAI SDK：

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8273/v1',
  apiKey: 'not-needed', // 通过 X-Agent-ID 指定 Agent
  dangerouslyAllowBrowser: true
});

// 使用 OpenAI SDK 调用
const response = await client.chat.completions.create({
  model: 'gpt-4', // 任意值，实际使用 Agent 配置
  messages: [
    { role: 'user', content: '你好' }
  ],
  headers: {
    'X-Agent-ID': 'agent-abc123'
  }
});

console.log(response.choices[0].message.content);
```

---

## 会话管理示例

### 1. 创建私聊会话

```bash
curl -X POST http://localhost:8273/api/session \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "type": "private",
    "participants": [
      { "id": "user-001", "name": "鸿枫" },
      { "id": "agent-abc123", "name": "小琳" }
    ]
  }'
```

**响应：**

```json
{
  "success": true,
  "session": {
    "id": "session-xyz",
    "type": "private",
    "participants": [
      { "id": "user-001", "name": "鸿枫" },
      { "id": "agent-abc123", "name": "小琳" }
    ],
    "createdAt": 1709548800000,
    "lastMessageAt": null,
    "unreadCount": 0
  }
}
```

### 2. 创建群聊会话

```bash
curl -X POST http://localhost:8273/api/session \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "type": "group",
    "name": "项目讨论组",
    "ownerId": "user-001",
    "ownerName": "鸿枫",
    "participants": [
      { "id": "user-002", "name": "小明" },
      { "id": "agent-abc123", "name": "小琳" }
    ]
  }'
```

### 3. 获取会话列表

```bash
# 获取所有会话
curl -H "X-User-ID: user-001" \
  http://localhost:8273/api/session

# 获取群聊会话
curl -H "X-User-ID: user-001" \
  "http://localhost:8273/api/session?type=group"
```

**响应：**

```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-xyz",
      "type": "private",
      "name": null,
      "participants": [...],
      "lastMessage": {
        "content": "好的，收到！",
        "senderName": "小琳",
        "timestamp": 1709548800000
      },
      "unreadCount": 2
    }
  ]
}
```

### 4. 发送消息到会话

```bash
curl -X POST http://localhost:8273/api/session/session-xyz/messages \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "content": "你好，请帮我分析一下这个问题",
    "senderId": "user-001",
    "senderName": "鸿枫"
  }'
```

### 5. 获取会话消息

```bash
# 获取最近消息
curl -H "X-User-ID: user-001" \
  "http://localhost:8273/api/session/session-xyz/messages?limit=50"

# 获取特定时间范围的消息
curl -H "X-User-ID: user-001" \
  "http://localhost:8273/api/session/session-xyz/messages?after=1709540000000"
```

**响应：**

```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-001",
      "sessionId": "session-xyz",
      "content": "你好，请帮我分析一下这个问题",
      "senderId": "user-001",
      "senderName": "鸿枫",
      "timestamp": 1709548800000,
      "type": "text"
    },
    {
      "id": "msg-002",
      "sessionId": "session-xyz",
      "content": "好的，我来帮你分析...",
      "senderId": "agent-abc123",
      "senderName": "小琳",
      "timestamp": 1709548801000,
      "type": "text"
    }
  ],
  "hasMore": false
}
```

### 6. 标记已读

```bash
curl -X POST http://localhost:8273/api/session/session-xyz/read \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-001" \
  -d '{
    "lastReadMessageId": "msg-002"
  }'
```

---

## 可观测性 API 示例

### 1. 查询日志

```bash
# 获取最近日志
curl http://localhost:8273/api/observability/logs?limit=100

# 获取错误日志
curl "http://localhost:8273/api/observability/logs?level=error&limit=50"

# 获取时间范围内的日志
curl "http://localhost:8273/api/observability/logs?startTime=1709540000000&endTime=1709550000000"
```

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "level": "info",
      "message": "Agent online: agent-abc123",
      "timestamp": 1709548800000,
      "metadata": {
        "agentId": "agent-abc123",
        "type": "system"
      }
    },
    {
      "level": "error",
      "message": "API request failed",
      "timestamp": 1709548801000,
      "metadata": {
        "endpoint": "/api/agents/agent-abc123/chat",
        "error": "Rate limit exceeded"
      }
    }
  ],
  "count": 2
}
```

### 2. 查询指标

```bash
# 获取所有指标
curl http://localhost:8273/api/observability/metrics

# 获取特定指标
curl "http://localhost:8273/api/observability/metrics?name=api_latency"

# 获取时间范围内的指标
curl "http://localhost:8273/api/observability/metrics?startTime=1709540000000&limit=100"
```

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "name": "api_latency",
      "value": 125,
      "timestamp": 1709548800000,
      "tags": {
        "endpoint": "/api/agents/agent-abc123/chat"
      }
    }
  ],
  "count": 1
}
```

### 3. 获取统计信息

```bash
curl http://localhost:8273/api/observability/stats
```

**响应：**

```json
{
  "success": true,
  "data": {
    "logs": {
      "total": 15420,
      "byLevel": [
        { "level": "info", "count": 12000 },
        { "level": "warn", "count": 3000 },
        { "level": "error", "count": 420 }
      ]
    },
    "metrics": {
      "total": 8500,
      "topEndpoints": [
        { "endpoint": "/api/agents", "count": 2500 },
        { "endpoint": "/api/session", "count": 1800 },
        { "endpoint": "/api/chat", "count": 1500 }
      ]
    }
  }
}
```

### 4. 获取仪表板数据

```bash
curl http://localhost:8273/api/observability/dashboard
```

**响应：**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalLogs": 15420,
      "totalMetrics": 8500,
      "errorCount": 420
    },
    "logsByLevel": [
      { "level": "info", "count": 12000 },
      { "level": "warn", "count": 3000 },
      { "level": "error", "count": 420 }
    ],
    "topEndpoints": [
      { "endpoint": "/api/agents", "count": 2500 }
    ],
    "responseTimes": {
      "/api/agents": {
        "count": 2500,
        "avg": 85,
        "min": 12,
        "max": 450
      }
    },
    "recentLogs": [...],
    "recentMetrics": [...]
  }
}
```

### 5. 健康检查

```bash
curl http://localhost:8273/api/observability/health
```

**响应：**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1709548800000
}
```

---

## 消息 API 示例

### 1. 存储消息

```bash
curl -X POST http://localhost:8273/api/store \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "鸿枫",
    "content": "大家好，今天天气不错",
    "source": "dingtalk",
    "timestamp": 1709548800000
  }'
```

### 2. 发送回复

```bash
curl -X POST http://localhost:8273/api/reply \
  -H "Content-Type: application/json" \
  -d '{
    "content": "确实是个好天气~",
    "sender": "小琳",
    "atTargets": ["鸿枫"]
  }'
```

### 3. 搜索消息

```bash
# 基础搜索
curl "http://localhost:8273/api/search?q=天气"

# 高级搜索
curl "http://localhost:8273/api/search?q=项目&sender=小琳&startTime=1709500000000&highlight=true"
```

**响应：**

```json
{
  "success": true,
  "count": 3,
  "messages": [
    {
      "id": "msg-001",
      "content": "今天天气不错，<mark>项目</mark>进展如何？",
      "sender": "鸿枫",
      "timestamp": 1709548800000,
      "highlighted": true
    }
  ],
  "query": "项目",
  "options": {
    "sender": "小琳",
    "highlight": true
  }
}
```

### 4. 获取消息上下文

```bash
curl "http://localhost:8273/api/context?limit=100"
```

### 5. 获取统计数据

```bash
curl http://localhost:8273/api/stats
```

**响应：**

```json
{
  "success": true,
  "stats": {
    "total": 12500,
    "today": 150,
    "bySender": [
      { "sender": "小琳", "count": 4500 },
      { "sender": "小猪", "count": 3200 },
      { "sender": "鸿枫", "count": 2800 }
    ],
    "bySource": [
      { "source": "dingtalk", "count": 8000 },
      { "source": "web", "count": 3000 },
      { "source": "bot", "count": 1500 }
    ]
  }
}
```

---

## 技能 API 示例

### 1. 注册技能

```bash
curl -X POST http://localhost:8273/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "天气查询",
    "description": "查询指定城市的天气情况",
    "category": "utility",
    "version": "1.0.0",
    "enabled": true,
    "inputs": {
      "city": {
        "type": "string",
        "description": "城市名称",
        "required": true
      }
    },
    "outputs": {
      "temperature": "number",
      "condition": "string",
      "humidity": "number"
    }
  }'
```

### 2. 执行技能

```bash
curl -X POST http://localhost:8273/api/skills/execute \
  -H "Content-Type: application/json" \
  -d '{
    "skillId": "skill-weather",
    "inputs": {
      "city": "北京"
    },
    "context": {
      "userId": "user-001"
    }
  }'
```

**响应：**

```json
{
  "success": true,
  "result": {
    "temperature": 25,
    "condition": "晴",
    "humidity": 45,
    "city": "北京"
  },
  "executionTime": 1250
}
```

### 3. 绑定技能到用户

```bash
curl -X POST http://localhost:8273/api/skills/user/user-001 \
  -H "Content-Type: application/json" \
  -d '{
    "skillId": "skill-weather"
  }'
```

---

## Webhook 集成示例

### 钉钉 Webhook

钉钉群机器人发送消息到 Chat-Hub：

```bash
# 钉钉自动发送到这个端点
# POST /webhook/dingtalk
# Content-Type: application/json

{
  "msgtype": "text",
  "text": {
    "content": "用户消息内容"
  },
  "senderNick": "发送者昵称",
  "senderId": "sender-id",
  "createAt": 1709548800000,
  "conversationType": "1",
  "msgId": "msg-uuid"
}
```

Chat-Hub 处理并存储消息，同时通过 Redis 发布给订阅的 Agent。

### SSE 实时推送

客户端通过 SSE 接收实时消息：

```javascript
const eventSource = new EventSource('http://localhost:8273/api/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New message:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

---

## 完整工作流示例

### 场景：用户与 Agent 进行多轮对话

```javascript
// 1. 获取或创建 Agent
const agentId = 'agent-abc123';

// 2. 创建会话
const sessionResponse = await fetch('http://localhost:8273/api/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user-001'
  },
  body: JSON.stringify({
    type: 'private',
    participants: [
      { id: 'user-001', name: '鸿枫' },
      { id: agentId, name: '小琳' }
    ]
  })
});
const { session } = await sessionResponse.json();

// 3. 发送消息
const messageResponse = await fetch(`http://localhost:8273/api/session/${session.id}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user-001'
  },
  body: JSON.stringify({
    content: '你好，请帮我写一段代码',
    senderId: 'user-001',
    senderName: '鸿枫'
  })
});

// 4. 获取 Agent 回复（流式）
const streamResponse = await fetch(`http://localhost:8273/api/agents/${agentId}/chat/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user-001'
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: '你好，请帮我写一段代码' }
    ]
  })
});

// 5. 处理流式响应
const reader = streamResponse.body.getReader();
// ... 处理流

// 6. 添加到记忆（可选）
await fetch(`http://localhost:8273/api/agents/${agentId}/memories`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '用户需要帮助写代码',
    type: 'short-term',
    importance: 0.6
  })
});
```

---

## 错误处理示例

```javascript
async function callAgent(agentId, messages) {
  try {
    const response = await fetch(`http://localhost:8273/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'user-001'
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Agent call failed:', error.message);
    throw error;
  }
}

// 使用
try {
  const result = await callAgent('agent-abc123', [
    { role: 'user', content: 'Hello' }
  ]);
  console.log(result.choices[0].message.content);
} catch (error) {
  console.error('Failed:', error);
}
```

---

*文档维护：Chat-Hub Team*
*最后更新：2026-03-04*