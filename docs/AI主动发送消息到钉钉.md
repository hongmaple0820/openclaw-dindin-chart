# AI 主动发送消息到钉钉群的方式

> 更新日期：2026-02-07  
> 作者：小琳 ✨

---

## ✅ 方式 1：chat-hub API（推荐，已配置）

### 使用方法

```bash
curl -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d '{"content":"消息内容","sender":"小琳","replier":"小琳"}'
```

### 完整流程

1. 调用 chat-hub `/api/reply` API
2. chat-hub 将消息发布到 Redis (`chat:replies` 频道)
3. chat-hub 订阅者收到消息
4. 检查 `sender == "小琳"`（只发送自己的消息）
5. 自动调用钉钉 Webhook
6. 消息发送到钉钉群

### 优势

- ✅ 自动发送到钉钉（无需额外配置）
- ✅ 消息持久化（存储到 SQLite）
- ✅ 多 AI 同步（通过 Redis）
- ✅ 支持 @ 功能（可选）
- ✅ 已经过测试验证

### 配置信息

**小琳的配置：** `~/.openclaw/openclaw-dindin-chart/chat-hub/config/local.json`
```json
{
  "bot": {
    "name": "小琳"
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=3ab840ed...",
    "secret": "SEC3db7f7176..."
  }
}
```

**小猪的配置：** 同样的结构，但 `bot.name` 和 `webhookBase` 不同

### 使用示例

#### 1. 简单消息
```bash
curl -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d '{"content":"你好，这是一条测试消息","sender":"小琳","replier":"小琳"}'
```

#### 2. 带 @ 的消息
```bash
curl -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d '{"content":"重要通知！","sender":"小琳","atTargets":["鸿枫"]}'
```

#### 3. Markdown 格式
```bash
curl -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d '{"content":"# 标题\n\n- 列表项 1\n- 列表项 2","sender":"小琳"}'
```

---

## ⚠️ 方式 2：OpenClaw message 工具（备用，功能受限）

### 当前状态

❌ **钉钉插件暂不支持主动发送到群**

错误信息：
```
DingTalk live group lookup not yet implemented
Error: Unknown target "cidsnvagww1qdtx8klcez7j4g==" for DingTalk
```

### 原因分析

钉钉插件目前的实现：
- ✅ 支持接收群消息（Webhook 接收）
- ✅ 支持回复群消息（在 monitor 中处理）
- ❌ 不支持主动发送到群（缺少群组查找功能）

### 可能的解决方案

#### 方案 A：等待官方支持

OpenClaw 钉钉插件可能在未来版本添加此功能。

#### 方案 B：修改插件代码

需要在 `clawdbot-dingtalk` 插件中添加：
1. 群组列表缓存
2. conversationId → target 映射
3. 主动发送 API 支持

#### 方案 C：使用 chat-hub（推荐）

chat-hub 已经完美支持主动发送，无需修改插件。

---

## 📊 对比

| 特性 | chat-hub API | OpenClaw message |
|---|---|---|
| 主动发送 | ✅ 可用 | ❌ 不支持群聊 |
| 消息持久化 | ✅ SQLite | ❌ 无 |
| 多 AI 同步 | ✅ Redis | ❌ 无 |
| 配置复杂度 | 简单 | 需要群 ID |
| @ 功能 | ✅ 支持 | ❓ 未知 |
| 测试状态 | ✅ 已验证 | ❌ 不可用 |

---

## 🎯 推荐使用场景

### 使用 chat-hub API（方式 1）

- ✅ 定时提醒
- ✅ 主动通知
- ✅ 异常告警
- ✅ 定期报告
- ✅ 所有需要主动发送的场景

### 使用 OpenClaw message（方式 2）

- ⏸️ 等待官方支持群聊功能
- ⏸️ 或者仅用于私聊（如果支持）

---

## 🔧 实际使用代码

### 在 HEARTBEAT 中主动发送

```bash
# HEARTBEAT.md
## 定时检查并通知

# 检查某个条件
if [ 需要通知 ]; then
  curl -s -X POST "http://localhost:3000/api/reply" \
    -H "Content-Type: application/json" \
    -d '{"content":"提醒内容","sender":"小琳","replier":"小琳"}'
fi
```

### 在脚本中发送告警

```bash
#!/bin/bash
# alert.sh

ERROR_MSG="$1"

curl -s -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"⚠️ 告警：${ERROR_MSG}\",\"sender\":\"小琳\",\"replier\":\"小琳\"}"
```

### 在 cron 任务中发送报告

```bash
# crontab
0 9 * * * cd ~/.openclaw/scripts && ./daily-report.sh
```

```bash
#!/bin/bash
# daily-report.sh

REPORT=$(生成报告逻辑)

curl -s -X POST "http://localhost:3000/api/reply" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"📊 每日报告\\n\\n${REPORT}\",\"sender\":\"小琳\"}"
```

---

## 📝 注意事项

### 1. 避免频繁发送

钉钉群机器人有频率限制：
- 建议：每分钟不超过 20 条
- 建议：使用队列或延迟发送

### 2. 消息长度限制

- 钉钉：单条消息最多 2048 字符
- 超长消息：自动分割或使用 Markdown 链接

### 3. @ 功能配置

需要在 chat-hub 配置中添加用户手机号映射：
```json
{
  "userPhones": {
    "鸿枫": "19976618156",
    "琳琳": "16670151072"
  }
}
```

### 4. 错误处理

```bash
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reply" ...)

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "发送成功"
else
  echo "发送失败: $RESPONSE"
fi
```

---

## ✅ 总结

**当前推荐方案：** 使用 **chat-hub API（方式 1）**

- ✅ 功能完善
- ✅ 已经测试验证
- ✅ 支持所有需要的功能
- ✅ 无需等待插件更新

**OpenClaw message 工具：** 作为备用方式，等待官方支持群聊功能。

---

**文档维护者：小琳 ✨**  
**最后更新：2026-02-07**
