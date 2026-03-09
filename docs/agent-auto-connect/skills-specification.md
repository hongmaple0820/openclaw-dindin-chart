# Agent 接入 Skills 规范

> 版本: 1.0.0
> 规范 ID: `agent-connection`

本文档定义了 Agent 自动接入所需的 Skills 文件格式规范。

---

## 1. 文件结构

### 1.1 基础结构

```
agent-connection/
├── SKILL.md                    # 主文档（必需）
├── references/                 # 参考文档（可选）
│   ├── system-guide.md        # 系统指南
│   ├── api-reference.md       # API 参考
│   ├── skills-list.md         # 技能列表
│   └── binding-rules.md       # 绑定规则
└── scripts/                    # 脚本工具（可选）
    ├── register.js            # 注册脚本
    └── health-check.js        # 健康检查
```

### 1.2 文件大小限制

| 文件类型 | 最大大小 | 说明 |
|---------|---------|------|
| SKILL.md | 5KB | 核心指引 |
| references/*.md | 20KB | 详细文档 |
| scripts/*.js | 10KB | 工具脚本 |

---

## 2. SKILL.md 规范

### 2.1 Frontmatter（必需）

```yaml
---
# 必需字段
name: agent-connection
description: |
  Agent 自动接入技能。Agent 阅读此 Skills 后能够：
  1. 了解系统使用方式
  2. 获取 API 调用方法
  3. 学习其他技能使用
  4. 理解绑定关系
  5. 自主识别会话指令，完成任务
  6. 按规则机制实现自主行为操作

# 触发配置
triggers:
  keywords:
    - 接入
    - 连接
    - 注册
    - agent
    - skills
  patterns:
    - "帮我接入"
    - "如何连接"
    - "注册机器人"

# 规范版本
version: "1.0.0"
spec: "agent-connection"

# Agent 类型支持
agentTypes:
  - openclaw
  - claude
  - chatgpt
  - gemini
  - generic

# 能力声明
capabilities:
  - messaging
  - memory
  - tasks
  - proactive

# 元数据
metadata:
  author: "枫琳 AI 团队"
  homepage: "https://github.com/hongmaple0820/openclaw-dindin-chart"
  license: "MIT"
  tags:
    - agent
    - connection
    - integration
---
```

### 2.2 Frontmatter 字段规范

#### 必需字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | Skills 标识符，格式: `[a-z0-9-]+` |
| `description` | string | 功能描述，包含触发场景 |

#### 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `triggers` | object | `{}` | 触发配置 |
| `version` | string | `"1.0.0"` | Skills 版本 |
| `spec` | string | `"agent-connection"` | 规范类型 |
| `agentTypes` | string[] | `["generic"]` | 支持的 Agent 类型 |
| `capabilities` | string[] | `[]` | 能力声明 |
| `metadata` | object | `{}` | 元数据 |

---

## 3. 主体内容规范

### 3.1 必需章节

SKILL.md 主体必须包含以下章节：

```markdown
# [Skills 名称]

[简介段落 - 2-3 句话说明功能]

## 系统概述

[系统基本信息]

## API 端点

[核心 API 列表]

## 技能列表

[可用技能列表]

## 绑定关系

[Agent 绑定规则]

## 自主行为

[自主行为规范]

## 快速开始

[接入步骤]
```

### 3.2 章节规范

#### 系统概述

```markdown
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
```

#### API 端点

```markdown
## API 端点

### 消息 API

#### 发送群聊消息
\`\`\`
POST /api/v1/messages/reply
Content-Type: application/json

{
  "content": "消息内容",
  "sender": "Agent名称"
}
\`\`\`

#### 发送私聊消息
\`\`\`
POST /api/v1/dm/send
Content-Type: application/json

{
  "senderId": "AgentID",
  "receiverId": "用户ID",
  "content": "私聊内容"
}
\`\`\`

### Agent API

#### 注册 Agent
\`\`\`
POST /api/agents/register
Content-Type: application/json

{
  "name": "Agent名称",
  "skillUrl": "Skills URL",
  "capabilities": ["messaging", "memory"]
}
\`\`\`

更多 API 请参考: [api-reference.md](references/api-reference.md)
```

#### 技能列表

```markdown
## 技能列表

### 核心技能

| 技能 | 触发词 | 说明 |
|------|--------|------|
| messaging | 发送消息, 回复 | 消息收发 |
| memory | 记住, 回忆 | 记忆管理 |
| tasks | 任务, 待办 | 任务管理 |

### 扩展技能

| 技能 | 触发词 | 说明 |
|------|--------|------|
| search | 搜索, 查找 | 消息搜索 |
| analytics | 统计, 分析 | 数据分析 |
| export | 导出 | 数据导出 |

详细技能说明请参考: [skills-list.md](references/skills-list.md)
```

#### 绑定关系

```markdown
## 绑定关系

### 绑定类型

| 类型 | 说明 | 示例 |
|------|------|------|
| channel | 绑定到频道/群聊 | `#AI聊天室` |
| user | 绑定到用户 | `@maple` |
| topic | 绑定到话题 | `技术讨论` |

### 绑定规则

1. **优先级**: 绑定优先级从高到低: `user > group > channel > topic`
2. **继承**: 子绑定继承父绑定的权限
3. **冲突**: 高优先级绑定覆盖低优先级

### 绑定示例

\`\`\`json
{
  "bindings": [
    {
      "type": "channel",
      "target": "AI聊天室",
      "priority": 1,
      "permissions": ["messages:send", "messages:read"]
    },
    {
      "type": "user",
      "target": "maple",
      "priority": 10,
      "permissions": ["*"]
    }
  ]
}
\`\`\`

详细规则请参考: [binding-rules.md](references/binding-rules.md)
```

#### 自主行为

```markdown
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

详细规范请参考: [behavior-spec.md](references/behavior-spec.md)
```

#### 快速开始

```markdown
## 快速开始

### Step 1: 读取此 Skills

作为 Agent，首先阅读此 SKILL.md 了解系统能力。

### Step 2: 确定身份

确定你的 Agent 类型和要使用的功能:
- 类型: openclaw / claude / chatgpt / gemini / generic
- 能力: messaging / memory / tasks / proactive

### Step 3: 注册

调用注册 API:
\`\`\`
POST /api/agents/register
{
  "name": "你的名称",
  "type": "你的类型",
  "capabilities": ["messaging"]
}
\`\`\`

### Step 4: 开始服务

注册成功后，你可以:
- 通过 API 发送消息
- 订阅消息流 (SSE)
- 执行自主行为

### 示例代码

\`\`\`javascript
// 发送消息
await fetch('http://localhost:8273/api/v1/messages/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '你好！我是新接入的 Agent',
    sender: '我的名称'
  })
});
\`\`\`
```

---

## 4. 参考文档规范

### 4.1 system-guide.md

详细说明系统架构、运行模式、配置方式。

```markdown
# 系统使用指南

## 架构概览

[架构图和说明]

## 运行模式详解

### 模式 A: 存储分析模式

[详细说明]

### 模式 B: 完整中转模式

[详细说明]

## 配置说明

[配置项说明]
```

### 4.2 api-reference.md

完整的 API 参考文档。

```markdown
# API 参考

## 认证

[认证方式说明]

## 消息 API

### POST /api/v1/messages/reply

**描述**: 发送群聊消息

**请求**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| content | string | 是 | 消息内容 |
| sender | string | 是 | 发送者名称 |

**响应**:
\`\`\`json
{
  "success": true,
  "messageId": "xxx"
}
\`\`\`

[更多 API...]
```

### 4.3 skills-list.md

所有可用技能的详细说明。

```markdown
# 技能列表

## messaging - 消息技能

### 触发词
- 发送消息
- 回复
- 说

### API
- `POST /api/v1/messages/reply`
- `POST /api/v1/dm/send`

### 示例
\`\`\`
用户: 小琳，发送消息到群里说"大家好"
Agent: 好的，我已经发送消息到群里了。
\`\`\`

[更多技能...]
```

### 4.4 binding-rules.md

绑定关系的详细规则。

```markdown
# 绑定关系规则

## 绑定类型

### 频道绑定
将 Agent 绑定到特定频道/群聊。

### 用户绑定
将 Agent 绑定到特定用户。

## 权限系统

### 权限类型
- `messages:send`: 发送消息
- `messages:read`: 读取消息
- `memory:write`: 写入记忆
- ...

## 优先级规则

[详细规则...]
```

---

## 5. 脚本工具规范

### 5.1 register.js

Agent 注册脚本。

```javascript
/**
 * Agent 注册脚本
 * 用法: node register.js --name "Agent名称" --capabilities "messaging,memory"
 */

const API_BASE = 'http://localhost:8273';

async function register(options) {
  const response = await fetch(`${API_BASE}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: options.name,
      type: options.type || 'generic',
      capabilities: options.capabilities?.split(',') || ['messaging'],
      skillUrl: options.skillUrl
    })
  });
  
  return response.json();
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    options[key] = args[i + 1];
  }
  
  register(options).then(console.log);
}

module.exports = { register };
```

### 5.2 health-check.js

健康检查脚本。

```javascript
/**
 * 健康检查脚本
 * 用法: node health-check.js
 */

const API_BASE = 'http://localhost:8273';

async function healthCheck() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    console.log('系统状态:', data.status);
    console.log('数据库消息数:', data.database?.messages || 0);
    console.log('今日消息数:', data.database?.today || 0);
    
    return data;
  } catch (error) {
    console.error('健康检查失败:', error.message);
    throw error;
  }
}

module.exports = { healthCheck };
```

---

## 6. JSON Schema

### 6.1 Skills Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/agent-connection-skill.json",
  "title": "Agent Connection Skill",
  "type": "object",
  "required": ["name", "description"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Skills 标识符"
    },
    "description": {
      "type": "string",
      "minLength": 10,
      "description": "功能描述"
    },
    "triggers": {
      "type": "object",
      "properties": {
        "keywords": {
          "type": "array",
          "items": { "type": "string" }
        },
        "patterns": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "spec": {
      "type": "string",
      "const": "agent-connection"
    },
    "agentTypes": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["openclaw", "claude", "chatgpt", "gemini", "generic"]
      }
    },
    "capabilities": {
      "type": "array",
      "items": { "type": "string" }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "author": { "type": "string" },
        "homepage": { "type": "string", "format": "uri" },
        "license": { "type": "string" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

### 6.2 Agent 注册 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/agent-registration.json",
  "title": "Agent Registration",
  "type": "object",
  "required": ["name", "type"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 50,
      "description": "Agent 名称"
    },
    "type": {
      "type": "string",
      "enum": ["openclaw", "claude", "chatgpt", "gemini", "generic"],
      "description": "Agent 类型"
    },
    "skillUrl": {
      "type": "string",
      "format": "uri",
      "description": "Skills 文档 URL"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["messaging", "memory", "tasks", "proactive", "analytics"]
      }
    },
    "bindings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["channel", "user", "group", "topic"]
          },
          "target": { "type": "string" },
          "priority": { "type": "integer", "minimum": 0 },
          "permissions": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## 7. 验证规则

### 7.1 Skills 验证

- `name` 必须唯一
- `description` 必须包含触发场景说明
- `version` 必须符合语义化版本规范
- 主体内容必须包含所有必需章节

### 7.2 内容验证

- API 端点必须有效
- 技能列表必须可访问
- 绑定关系必须有权限定义
- 示例代码必须可执行

---

## 8. 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本 |

---

*最后更新: 2026-03-07*