# 钉钉插件配置指南

本文档详细说明 OpenClaw 钉钉插件的配置方法。

## 概述

OpenClaw 内置了钉钉渠道插件，支持：
- 通过钉钉 Stream 协议实时接收消息
- 自动回复群聊和私聊消息
- 支持 Markdown 格式回复
- 支持 @提及 触发

## 前置条件

1. 钉钉企业/组织管理员权限
2. OpenClaw 已安装并运行
3. 公网可访问的服务器（可选，用于 Webhook 模式）

---

## 创建钉钉应用

### 1. 登录钉钉开放平台

访问 [钉钉开放平台](https://open.dingtalk.com/) 并登录。

### 2. 创建企业内部应用

1. 进入「应用开发」→「企业内部开发」
2. 点击「创建应用」
3. 填写应用信息：
   - 应用名称：如 "小琳AI助手"
   - 应用描述：AI 智能助手
   - 应用图标：上传头像

### 3. 获取凭证

在应用详情页获取：
- **Client ID (AppKey)**：如 `dingxxxxxxxx`
- **Client Secret (AppSecret)**：如 `xxxxxxxxxxxxxx`

### 4. 配置机器人能力

1. 进入「应用能力」→「机器人」
2. 开启机器人能力
3. 配置：
   - 机器人名称
   - 消息接收模式：选择 **Stream 模式**（推荐）
   - 或配置 Webhook 地址

### 5. 发布应用

1. 进入「版本管理与发布」
2. 创建新版本并发布
3. 在组织内可见范围设置

---

## OpenClaw 配置

### 方式一：Web 界面配置（推荐）

1. 打开 OpenClaw Web 界面
2. 进入「Channels」→「DingTalk」
3. 填写配置项

### 方式二：配置文件

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxxxxxxx",
      "clientSecret": "你的AppSecret",
      "replyMode": "markdown",
      "requireMention": true,
      "tableMode": "code"
    }
  }
}
```

---

## 配置项详解

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | false | 是否启用钉钉渠道 |
| `clientId` | string | - | 钉钉应用的 Client ID (AppKey) |
| `clientSecret` | string | - | 钉钉应用的 Client Secret (AppSecret) |
| `clientSecretFile` | string | - | 存储 Secret 的文件路径（替代直接配置） |

### 消息配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `replyMode` | string | "text" | 回复格式：`text` 或 `markdown` |
| `maxChars` | number | 1800 | 单条消息最大字符数（超出分段） |
| `replyPrefix` | string | "" | 回复前缀，如 `✨小琳：` |
| `tableMode` | string | "off" | 表格处理：`off`(保留) 或 `code`(转代码块) |

### 触发配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `requireMention` | boolean | true | 群聊中需要 @机器人 才响应 |
| `triggerPrefix` | string | "" | 触发前缀，如 `/` 或 `小琳` |
| `mentionExemptUserIds` | array | [] | 无需 @ 即可触发的用户 ID 列表 |
| `allowedSenders` | array | [] | 允许发送消息的用户 ID（空=全部） |

### 高级配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `robotUserId` | string | "" | 机器人自身的用户 ID，用于过滤自己消息 |
| `apiBase` | string | "https://api.dingtalk.com" | API 基础地址 |
| `openPath` | string | "/v1.0/gateway/connections/open" | Stream 连接路径 |
| `subscriptionConfig` | object | {} | 自定义订阅配置 JSON |

---

## 推荐配置

### 单机器人场景

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxxxxxxx",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": true,
      "tableMode": "code",
      "replyPrefix": "✨"
    }
  }
}
```

### 多机器人场景

每个机器人需要设置 `robotUserId` 避免回复自己：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxxxxxxx",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": false,
      "robotUserId": "机器人的用户ID",
      "tableMode": "code"
    }
  }
}
```

### 私聊 + 群聊

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "dingxxxxxxxx",
      "clientSecret": "你的Secret",
      "replyMode": "markdown",
      "requireMention": true,
      "dmPolicy": "pairing",
      "mentionExemptUserIds": ["管理员用户ID"]
    }
  }
}
```

---

## 获取用户 ID

### 获取机器人用户 ID

1. 在钉钉群中 @机器人 发送一条消息
2. 查看 OpenClaw 日志，找到消息中的 `senderStaffId` 或 `robotCode`
3. 或使用钉钉 API 查询

### 获取人类用户 ID

1. 在钉钉开放平台 → 应用管理 → 查看用户信息
2. 或通过钉钉 API 获取通讯录

---

## 常见问题

### Q: 连接失败怎么办？

1. 检查 `clientId` 和 `clientSecret` 是否正确
2. 确认应用已发布并在组织内可见
3. 检查网络是否能访问钉钉 API

### Q: 群聊收不到消息？

1. 确认机器人已添加到群
2. 检查 `requireMention` 设置
3. 如果开启了，确保消息中 @了机器人

### Q: Markdown 格式不生效？

1. 确认 `replyMode` 设置为 `markdown`
2. 钉钉 Markdown 支持有限，参考 [钉钉 Markdown 语法](https://open.dingtalk.com/document/orgapp/message-types-and-data-format#title-6gx-smu-67z)
3. 表格可能不支持，设置 `tableMode: "code"` 转为代码块

### Q: 消息被截断？

默认 `maxChars: 1800`，超出会分段发送。可以调大这个值，但钉钉有消息长度限制。

### Q: 机器人回复自己的消息？

设置 `robotUserId` 为机器人的用户 ID，会自动过滤。

---

## 与 chat-hub 集成

### 模式 A：存储分析模式

保持钉钉插件启用，添加消息同步到 chat-hub：

在 `AGENTS.md` 中添加：

```markdown
## 钉钉消息同步

收到钉钉群消息时，静默执行存储：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息", "source": "dingtalk"}'
\`\`\`
```

### 模式 B：完整中转模式

禁用钉钉插件，改由 chat-hub 触发：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": false
    }
  }
}
```

---

## 安全建议

1. **不要将 Secret 提交到 Git**
   - 使用 `clientSecretFile` 指向单独的文件
   - 或使用环境变量

2. **限制允许的发送者**
   - 设置 `allowedSenders` 白名单
   - 避免未授权用户触发机器人

3. **设置触发前缀**
   - 使用 `triggerPrefix` 避免误触发
   - 如设置为 `/ai` 则只有 `/ai 问题` 才触发

---

## 参考资料

- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [钉钉机器人开发指南](https://open.dingtalk.com/document/orgapp/robot-overview)
- [OpenClaw 文档](https://docs.openclaw.ai)
