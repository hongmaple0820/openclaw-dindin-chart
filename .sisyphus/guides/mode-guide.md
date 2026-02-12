# 模式切换指南

chat-hub 支持三种运行模式，本文档详细说明各模式的配置和切换方法。

## 模式概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              三种运行模式                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  模式 A：存储分析模式                                                        │
│  ┌──────────┐      ┌──────────────┐      ┌──────────┐                      │
│  │  钉钉群   │ ←──→ │ OpenClaw     │ ───→ │ chat-hub │                      │
│  └──────────┘      │ (钉钉插件)    │      │ (存储)   │                      │
│                    └──────────────┘      └──────────┘                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  模式 B：完整中转模式                                                        │
│  ┌──────────┐      ┌──────────┐      ┌──────────────┐                      │
│  │  钉钉群   │ ───→ │ chat-hub │ ───→ │ OpenClaw     │                      │
│  └──────────┘      │ (中转)   │      │ (system event)│                     │
│       ↑            └──────────┘      └──────────────┘                      │
│       │                 │                    │                              │
│       └─────────────────┴────────────────────┘                              │
│                     (回复)                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  模式 C：纯插件模式                                                          │
│  ┌──────────┐      ┌──────────────┐                                        │
│  │  钉钉群   │ ←──→ │ OpenClaw     │     （无需 chat-hub）                   │
│  └──────────┘      │ (钉钉插件)    │                                        │
│                    └──────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 模式 A：存储分析模式

### 适用场景

- 已经配置好 OpenClaw 钉钉插件
- 希望保留消息历史、进行数据分析
- 需要 Web 界面查看聊天记录
- 不想改变现有的消息流程

### 工作原理

1. OpenClaw 通过钉钉插件直接连接钉钉 Stream
2. 收到消息后直接响应（最快）
3. 同时通过 hook 将消息同步到 chat-hub 存储
4. chat-hub 提供消息查询、统计分析功能

### 配置步骤

#### 1. chat-hub 配置

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
  
  "trigger": {
    "enabled": false
  },
  
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true
  }
}
```

关键：`trigger.enabled: false`

#### 2. OpenClaw 钉钉插件配置

确保 OpenClaw 钉钉插件已启用并正常工作。

#### 3. 消息同步

在 OpenClaw 的 `HEARTBEAT.md` 或 `AGENTS.md` 中添加规则：

```markdown
## 钉钉消息同步

收到钉钉群消息时，静默执行：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息内容", "source": "dingtalk"}'
\`\`\`

发送回复后，静默执行：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "小琳", "content": "回复内容", "source": "bot"}'
\`\`\`
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 响应最快（直连钉钉） | 需要手动同步消息 |
| 保留完整分析功能 | 同步可能有遗漏 |
| 配置相对简单 | - |

---

## 模式 B：完整中转模式

### 适用场景

- 全新部署，没有现有配置
- 需要完整的消息管控
- 多机器人需要实时同步消息
- 希望在 chat-hub 层面做消息过滤

### 工作原理

1. 钉钉群消息通过 Outgoing Webhook 发送到 chat-hub
2. chat-hub 存储消息，通过 Redis 广播给其他机器人
3. chat-hub 触发 OpenClaw（通过 system event）
4. OpenClaw 处理后调用 chat-hub API 发送回复
5. chat-hub 通过钉钉 Webhook 发送回复到群

### 配置步骤

#### 1. 钉钉机器人配置

1. 进入钉钉开放平台创建企业内部应用
2. 配置 Outgoing Webhook：
   - URL: `http://你的服务器:3000/webhook/dingtalk`
3. 配置自定义 Webhook 机器人用于发送消息

#### 2. chat-hub 配置

```json
{
  "mode": "hub",
  
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
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "SEC你的密钥"
  },
  
  "trigger": {
    "enabled": true,
    "command": "openclaw system event --text",
    "mode": "now"
  },
  
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true
  }
}
```

关键：`trigger.enabled: true`

#### 3. OpenClaw 配置

禁用 OpenClaw 的钉钉插件（避免重复处理）：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": false
    }
  }
}
```

在 `HEARTBEAT.md` 中配置回复规则：

```markdown
## 钉钉群消息处理

当收到 `[钉钉群消息]` 开头的 system event 时：
1. 阅读消息内容
2. 判断是否需要回复
3. 如果需要回复：
\`\`\`bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你的回复", "sender": "小琳"}'
\`\`\`
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| 完整消息管控 | 有中转延迟 |
| 所有消息自动存储 | 配置较复杂 |
| 支持消息过滤规则 | 需要公网服务器 |
| 多机器人完美同步 | - |

---

## 模式 C：纯插件模式

### 适用场景

- 快速部署测试
- 单机器人场景
- 不需要消息存储和分析
- 追求最简配置

### 工作原理

1. OpenClaw 通过钉钉插件直接连接钉钉
2. 收到消息直接处理并回复
3. 无需 chat-hub

### 配置步骤

#### 1. OpenClaw 钉钉插件配置

在 OpenClaw Web 界面或配置文件中：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "你的ClientID",
      "clientSecret": "你的ClientSecret",
      "replyMode": "markdown",
      "requireMention": true
    }
  }
}
```

详细配置见 [钉钉插件配置指南](./dingtalk-plugin-guide.md)

### 优缺点

| 优点 | 缺点 |
|------|------|
| 配置最简单 | 无消息存储 |
| 响应最快 | 无分析功能 |
| 无需额外服务 | 无 Web 界面 |
| - | 多机器人需各自配置 |

---

## 模式切换

### 从模式 A 切换到模式 B

1. 修改 `config/local.json`：
   ```json
   {
     "mode": "hub",
     "trigger": { "enabled": true }
   }
   ```
2. 配置钉钉 Outgoing Webhook
3. 禁用 OpenClaw 钉钉插件
4. 重启 chat-hub

### 从模式 B 切换到模式 A

1. 修改 `config/local.json`：
   ```json
   {
     "mode": "storage",
     "trigger": { "enabled": false }
   }
   ```
2. 启用 OpenClaw 钉钉插件
3. 配置消息同步规则
4. 重启 chat-hub

### 从模式 A/B 切换到模式 C

1. 停止 chat-hub
2. 启用 OpenClaw 钉钉插件
3. 移除 HEARTBEAT.md 中的 chat-hub 相关规则

---

## 多机器人配置

### 模式 A/B：通过 Redis 同步

每个机器人运行独立的 chat-hub 实例，共享同一个 Redis：

```
机器人 A (chat-hub) ──┐
                     ├──→ Redis ←──┬── 机器人 B (chat-hub)
                     │              │
                     └──────────────┘
```

配置 `config/local.json`：
```json
{
  "bot": {
    "name": "小琳",  // 每个机器人不同的名字
    "local": true
  },
  "redis": {
    "host": "共享的Redis地址",
    "port": 6379,
    "password": "共享的密码"
  }
}
```

### 模式 C：各自独立

每个机器人配置自己的钉钉应用：

```
机器人 A (OpenClaw + 钉钉插件 A)
机器人 B (OpenClaw + 钉钉插件 B)
          ↓
       同一个钉钉群
```

注意：需要设置 `robotUserId` 过滤自己的消息。

---

## FAQ

### Q: 哪种模式最适合新手？
A: 模式 C（纯插件）最简单，适合快速上手。

### Q: 哪种模式功能最全？
A: 模式 B（完整中转）功能最全，但配置也最复杂。

### Q: 我已经有 OpenClaw 钉钉插件，该用哪种？
A: 推荐模式 A（存储分析），保持现有配置，只添加存储功能。

### Q: 多机器人用哪种模式？
A: 模式 A 或 B 都可以，通过 Redis 同步消息。
