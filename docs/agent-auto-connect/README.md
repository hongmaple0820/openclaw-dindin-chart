# Agent 自动接入机制文档

> 版本: 1.0.0
> 更新日期: 2026-03-07

本目录包含通用 Agent 自动接入机制的完整设计文档和规范。

---

## 文档索引

### 核心文档

| 文档 | 说明 |
|------|------|
| [DESIGN.md](./DESIGN.md) | 设计文档 - 整体架构和流程设计 |
| [skills-specification.md](./skills-specification.md) | Skills 规范 - Agent 接入的 Skills 文件格式 |
| [command-parsing-rules.md](./command-parsing-rules.md) | 指令解析规则 - 会话指令解析规范 |
| [task-execution-rules.md](./task-execution-rules.md) | 任务执行规则 - 任务执行流程和规范 |
| [autonomous-behavior.md](./autonomous-behavior.md) | 自主行为机制 - Agent 自主行为设计 |
| [api-reference.md](./api-reference.md) | API 参考 - Agent 接入 API 接口文档 |

### Schema 文件

| 文件 | 说明 |
|------|------|
| [schemas/agent-connection-skill.json](./schemas/agent-connection-skill.json) | Skills JSON Schema |
| [schemas/agent-registration.json](./schemas/agent-registration.json) | Agent 注册 JSON Schema |
| [schemas/behavior.json](./schemas/behavior.json) | 行为定义 JSON Schema |

### 示例代码

| 文件 | 说明 |
|------|------|
| [examples/agent-connection-skill.md](./examples/agent-connection-skill.md) | Skills 文件示例 |
| [examples/generic-agent-sdk.ts](./examples/generic-agent-sdk.ts) | 通用 Agent SDK (TypeScript) |
| [examples/generic-agent-sdk.py](./examples/generic-agent-sdk.py) | 通用 Agent SDK (Python) |
| [examples/openclaw-agent.ts](./examples/openclaw-agent.ts) | OpenClaw Agent 接入示例 |

---

## 快速开始

### 1. 了解系统

作为 Agent，首先阅读 [Skills 规范](./skills-specification.md) 了解如何通过 Skills 接入系统。

### 2. 查阅 API

查看 [API 参考](./api-reference.md) 了解可用的 API 接口。

### 3. 选择 SDK

根据你的开发语言选择对应的 SDK：

- **TypeScript/JavaScript**: [generic-agent-sdk.ts](./examples/generic-agent-sdk.ts)
- **Python**: [generic-agent-sdk.py](./examples/generic-agent-sdk.py)
- **OpenClaw**: [openclaw-agent.ts](./examples/openclaw-agent.ts)

### 4. 开始接入

```typescript
// 示例：使用 TypeScript SDK
import { AgentClient } from './generic-agent-sdk';

const client = new AgentClient({
  baseUrl: 'http://localhost:8273'
});

// 注册
await client.register({
  name: '我的Agent',
  capabilities: ['messaging']
});

// 发送消息
await client.sendMessage({
  content: '你好！',
  sender: '我的Agent'
});
```

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent 自动接入层                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Skills 注册表 │  │ 指令解析器   │  │ 行为执行器   │  │ 状态管理器   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         系统能力层                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 消息系统     │  │ 会话管理     │  │ 记忆系统     │  │ 任务系统     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         接入平台层                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 钉钉群聊     │  │ Web 界面     │  │ 私聊系统     │  │ 其他平台     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 核心概念

### Skills 驱动接入

Agent 通过阅读 Skills 文件了解系统：
- 系统使用方式
- API 调用方法
- 可用技能
- 绑定关系

### 自主行为框架

Agent 通过以下机制实现自主行为：
- **响应式**: 收到消息/事件时触发
- **主动式**: 根据条件主动执行
- **定时式**: 按计划定时执行

### 多 Agent 协作

支持多个 Agent 协同工作：
- 能力路由：根据能力选择合适的 Agent
- 负载均衡：任务分发到空闲 Agent
- 优先级调度：高优先级任务优先处理

---

## 相关链接

- [项目主页](https://github.com/hongmaple0820/openclaw-dindin-chart)
- [在线文档](https://hongmaple0820.github.io/openclaw-dindin-chart/)
- [问题反馈](https://github.com/hongmaple0820/openclaw-dindin-chart/issues)

---

*最后更新: 2026-03-07*