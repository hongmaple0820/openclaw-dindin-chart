# 多机器人统一配置指南

本文档说明如何让多个机器人使用同一种模式运行，保持配置同步。

---

## 🎯 核心原则

**所有机器人必须使用相同模式**，否则会出现：
- 消息重复处理
- 回复冲突
- 消息丢失

---

## 📋 三种模式的配置差异

### 模式 A：存储分析模式

```
┌─────────┐     ┌──────────────┐     ┌──────────┐
│ 钉钉群   │ ←─→ │ OpenClaw     │ ──→ │ chat-hub │
└─────────┘     │ (钉钉插件)    │     │ (存储)   │
                └──────────────┘     └──────────┘
```

#### OpenClaw 钉钉插件配置

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "你的ClientID",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": true,
      "tableMode": "code",
      "robotUserId": "机器人用户ID"
    }
  }
}
```

#### chat-hub 配置 (config/local.json)

```json
{
  "mode": "storage",
  "trigger": { "enabled": false },
  "bot": { "name": "小琳" },
  "dingtalk": { "enabled": false }
}
```

#### AGENTS.md 规则

```markdown
## 钉钉消息同步（模式A）

收到钉钉群消息时，静默存储到 chat-hub：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息", "source": "dingtalk"}'
\`\`\`
```

---

### 模式 B：完整中转模式

```
┌─────────┐     ┌──────────┐     ┌──────────────┐
│ 钉钉群   │ ──→ │ chat-hub │ ──→ │ OpenClaw     │
└─────────┘     │ (中转)   │     │ (system event)│
     ↑          └──────────┘     └──────────────┘
     │               │                  │
     └───────────────┴──────────────────┘
                  (回复)
```

#### OpenClaw 钉钉插件配置

```json
{
  "channels": {
    "dingtalk": {
      "enabled": false
    }
  }
}
```

⚠️ **必须禁用钉钉插件**，否则会重复处理！

#### chat-hub 配置 (config/local.json)

```json
{
  "mode": "hub",
  "trigger": {
    "enabled": true,
    "command": "openclaw system event --text",
    "mode": "now"
  },
  "bot": { "name": "小琳" },
  "dingtalk": {
    "enabled": true,
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx"
  }
}
```

#### AGENTS.md 规则

```markdown
## 钉钉群消息处理（模式B）

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

---

### 模式 C：纯插件模式

```
┌─────────┐     ┌──────────────┐
│ 钉钉群   │ ←─→ │ OpenClaw     │
└─────────┘     │ (钉钉插件)    │
                └──────────────┘
```

#### OpenClaw 钉钉插件配置

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "你的ClientID",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": false,
      "tableMode": "code",
      "robotUserId": "机器人用户ID"
    }
  }
}
```

#### chat-hub 配置

不需要 chat-hub。

---

## 🤖 新机器人接入流程

### 第一步：确认当前使用的模式

询问管理员或查看现有机器人的配置：
- 模式 A：OpenClaw 钉钉插件启用 + chat-hub 存储
- 模式 B：OpenClaw 钉钉插件禁用 + chat-hub 中转
- 模式 C：OpenClaw 钉钉插件启用 + 无 chat-hub

### 第二步：获取必要凭证

| 模式 | 需要的凭证 |
|------|-----------|
| A | 钉钉 ClientID/Secret + Redis 连接信息 |
| B | Redis 连接信息 + 钉钉 Webhook Token/Secret |
| C | 钉钉 ClientID/Secret |

### 第三步：配置 OpenClaw

根据模式配置 `~/.openclaw/openclaw.json`：

```json
// 模式 A 和 C
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "你的ClientID",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": true,
      "tableMode": "code",
      "robotUserId": "你的机器人用户ID"
    }
  }
}

// 模式 B
{
  "channels": {
    "dingtalk": {
      "enabled": false
    }
  }
}
```

### 第四步：配置 chat-hub（模式 A/B）

1. 克隆仓库：
```bash
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
```

2. 创建本地配置：
```bash
cp config/default.json config/local.json
```

3. 编辑 `config/local.json`：
```json
{
  "mode": "storage",  // 或 "hub"
  "bot": {
    "name": "你的机器人名",
    "local": true
  },
  "redis": {
    "host": "共享的Redis地址",
    "port": 6379,
    "password": "共享密码"
  },
  "trigger": {
    "enabled": false  // 模式A: false, 模式B: true
  },
  "dingtalk": {
    "enabled": false,  // 模式A: false, 模式B: true
    "webhookBase": "",
    "secret": ""
  }
}
```

### 第五步：配置 AGENTS.md

根据模式添加对应的消息处理规则（见上文各模式说明）。

### 第六步：配置 HEARTBEAT.md

添加 chat-hub 消息检查规则：

```markdown
## 检查 chat-hub 未读消息

1. 读取 `memory/heartbeat-state.json` 获取 `lastReadTimestamp`
2. 调用 `curl -s "http://localhost:3000/api/context?limit=20"`
3. 筛选 `timestamp > lastReadTimestamp` 的新消息
4. 处理后更新 `lastReadTimestamp`
```

### 第七步：启动服务

```bash
# 启动 chat-hub（模式 A/B）
cd chat-hub && npm start

# 重启 OpenClaw
openclaw gateway restart
```

---

## 🔄 模式切换流程

### 从模式 C 切换到模式 A

**所有机器人同时执行：**

1. 部署 chat-hub
2. 配置 Redis 连接（所有机器人用同一个 Redis）
3. 在 AGENTS.md 添加消息同步规则
4. 保持钉钉插件启用

### 从模式 A 切换到模式 B

**所有机器人同时执行：**

1. 禁用 OpenClaw 钉钉插件
2. 修改 chat-hub 配置：`mode: "hub"`, `trigger.enabled: true`
3. 配置钉钉 Outgoing Webhook 指向一个 chat-hub 实例
4. 每个机器人配置自己的钉钉 Webhook（用于发送）
5. 更新 AGENTS.md 规则

### 从模式 B 切换到模式 A

**所有机器人同时执行：**

1. 启用 OpenClaw 钉钉插件
2. 修改 chat-hub 配置：`mode: "storage"`, `trigger.enabled: false`
3. 更新 AGENTS.md 规则

---

## ⚠️ 注意事项

### 1. 机器人用户 ID

每个机器人必须设置 `robotUserId`，用于过滤自己发的消息，避免无限循环。

### 2. Redis 必须共享

模式 A/B 中，所有机器人必须连接同一个 Redis，才能收到其他机器人的消息。

### 3. 钉钉应用独立

每个机器人需要独立的钉钉应用（ClientID/Secret），不能共用。

### 4. 命名区分

每个机器人的 `bot.name` 必须不同，用于区分消息来源。

### 5. 时钟同步

所有机器人的系统时间必须同步，否则消息时间戳比较会出错。

---

## 📊 配置对比表

| 配置项 | 模式 A | 模式 B | 模式 C |
|--------|--------|--------|--------|
| OpenClaw 钉钉插件 | ✅ 启用 | ❌ 禁用 | ✅ 启用 |
| chat-hub | ✅ 需要 | ✅ 需要 | ❌ 不需要 |
| chat-hub mode | storage | hub | - |
| chat-hub trigger | ❌ 禁用 | ✅ 启用 | - |
| chat-hub dingtalk | ❌ 禁用 | ✅ 启用 | - |
| Redis | ✅ 需要 | ✅ 需要 | ❌ 不需要 |
| 钉钉 ClientID/Secret | ✅ 需要 | ❌ 不需要 | ✅ 需要 |
| 钉钉 Webhook | ❌ 不需要 | ✅ 需要 | ❌ 不需要 |
| AGENTS.md 同步规则 | ✅ 需要 | ✅ 需要 | ❌ 不需要 |

---

## 🚀 推荐方案

| 场景 | 推荐模式 | 理由 |
|------|----------|------|
| 单机器人快速测试 | C | 配置最简单 |
| 多机器人 + 需要消息记录 | A | 响应快 + 有存储 |
| 需要消息过滤/路由 | B | 完整控制 |
| 已有 OpenClaw 配置 | A | 改动最小 |

---

*文档版本：v1.0*
*更新日期：2026-02-06*
