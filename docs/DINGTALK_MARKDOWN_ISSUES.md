# 钉钉 Markdown 渲染问题与解决方案

> **适用场景**：通过 chat-hub 或 OpenClaw 钉钉插件发送消息到钉钉群
> 
> **问题分类**：Markdown 格式兼容性、消息渲染失败
> 
> **更新日期**：2026-02-08

---

## 📝 问题描述

### 现象
在钉钉群发送包含 Markdown 格式的消息时，部分或全部格式无法正常渲染，显示为纯文本或乱码。

### 典型案例
```markdown
# 发送的消息（无法渲染）
📜 **重要通知**

1️⃣ **第一条规则**
   - 子项1
   - 子项2

2️⃣ **第二条规则**
   - 子项A
   - 子项B
```

**结果**：在钉钉群里显示为纯文本，`**` 和 emoji 数字都没有渲染。

---

## 🔍 问题分析

### 1. 钉钉 Markdown 支持限制

钉钉的 Markdown 支持并不完整，有以下限制：

| 功能 | 支持情况 | 说明 |
|------|---------|------|
| 标题 `#` | ✅ 支持 | 但可能在某些场景失效 |
| 粗体 `**文字**` | ✅ 支持 | 嵌套时可能失效 |
| 列表 `- 项` | ✅ 支持 | 嵌套层级有限 |
| 链接 `[文字](url)` | ✅ 支持 | - |
| emoji 数字 `1️⃣ 2️⃣` | ❌ 不稳定 | 可能导致整段失效 |
| 代码块 ` ```code``` ` | ✅ 支持 | 需要完整的三个反引号 |
| 表格 | ❌ 不支持 | 显示为纯文本 |

### 2. chat-hub 发送机制

通过 chat-hub 的 `/api/reply` 发送消息时：

```javascript
// chat-hub 的消息流程
1. 接收 JSON 请求：{"sender": "小琳", "content": "消息内容"}
2. 存储到 SQLite 数据库
3. 发布到 Redis (chat:replies 频道)
4. 订阅者接收到消息
5. 检查 sender 是否匹配
6. 调用钉钉 Webhook 发送
```

**关键问题**：
- ❌ chat-hub 不会自动处理 Markdown 格式
- ❌ 钉钉 Webhook 需要特定的 `msgtype` 和格式
- ❌ 订阅者代码可能未正确设置 `markdown` 消息类型

### 3. OpenClaw 钉钉插件配置

配置文件 `openclaw.json`：

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "replyMode": "markdown",  // ✅ 已配置
      "tableMode": "code"
    }
  },
  "plugins": {
    "entries": {
      "clawdbot-dingtalk": {
        "enabled": true
      },
      "dingtalk": {
        "enabled": true  // ⚠️ 两个插件同时启用
      }
    }
  }
}
```

**可能的问题**：
- `clawdbot-dingtalk` 和 `dingtalk` 两个插件同时启用可能冲突
- `replyMode: "markdown"` 只对通过 OpenClaw 发送的消息生效
- 通过 chat-hub 的 `/api/reply` 绕过了 OpenClaw 插件

---

## ✅ 解决方案

### 方案 1：使用简化格式（推荐）

**原则**：保持简洁，避免复杂嵌套。

```markdown
# ✅ 推荐格式（稳定可靠）

📜 重要通知

全体成员请注意以下规则：

1. 群聊透明原则
   所有交流必须通过群聊，不允许私聊。

2. 时区设置规范
   统一使用 Asia/Shanghai (GMT+8)。

3. 问题解决流程
   先自己尝试，解决不了再求助。
```

**要点**：
- ✅ 使用普通数字 `1. 2. 3.` 而不是 emoji `1️⃣`
- ✅ 减少 `**粗体**` 的嵌套使用
- ✅ 列表项保持简洁，不要过多层级
- ✅ 重要内容用换行和缩进区分

### 方案 2：检查钉钉 Webhook 消息格式

如果需要完整的 Markdown 支持，确保 Webhook 消息格式正确：

```javascript
// ✅ 正确的钉钉 Markdown 消息格式
{
  "msgtype": "markdown",
  "markdown": {
    "title": "标题",
    "text": "# 这是一级标题\n**这是粗体**\n- 列表项"
  }
}

// ❌ 错误：使用 text 类型发送 Markdown
{
  "msgtype": "text",
  "text": {
    "content": "# 这不会渲染"
  }
}
```

**chat-hub 订阅者代码需要修改**：

```javascript
// 当前可能的问题（待验证）
const message = {
  msgtype: "text",  // ❌ 应该是 "markdown"
  text: {
    content: data.content
  }
};

// ✅ 正确的发送方式
const message = {
  msgtype: "markdown",
  markdown: {
    title: "消息",
    text: data.content
  }
};
```

### 方案 3：纯文本 + 结构化排版

如果 Markdown 不稳定，使用纯文本 + emoji + 换行：

```
📜 重要通知

全体成员请注意：

✅ 规则一：群聊透明
   所有交流必须通过群聊

✅ 规则二：时区统一
   使用 Asia/Shanghai

✅ 规则三：先自己解决
   看日志→查文档→求助
```

**优势**：
- ✅ 稳定可靠，不依赖 Markdown 渲染
- ✅ 所有客户端显示一致
- ✅ 适合重要通知

---

## 🔧 实施步骤

### 立即可用的方法

**发送消息时使用纯文本格式**：

```bash
# ✅ 推荐：纯文本 + 简单结构
cat > /tmp/message.json << 'EOF'
{
  "sender": "你的名字",
  "content": "📜 重要通知\n\n全体成员请注意：\n\n1. 第一条规则\n   说明文字\n\n2. 第二条规则\n   说明文字"
}
EOF
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d @/tmp/message.json
```

### 长期优化方向

1. **修改 chat-hub 订阅者代码**：
   - 检测消息内容是否包含 Markdown 标记
   - 自动设置 `msgtype: "markdown"`
   - 测试不同格式的渲染效果

2. **统一插件配置**：
   - 确认 `clawdbot-dingtalk` 和 `dingtalk` 是否冲突
   - 选择一个插件禁用
   - 测试 `replyMode: "markdown"` 是否生效

3. **建立格式规范**：
   - 文档化哪些格式可用、哪些不可用
   - 提供消息模板
   - 在 AI 协作准则中明确说明

---

## 📋 最佳实践

### DO ✅

1. **使用普通数字**：`1. 2. 3.` 而不是 `1️⃣ 2️⃣`
2. **简化格式**：避免复杂嵌套和过多装饰
3. **测试验证**：发送前先在测试群测试
4. **降级方案**：重要通知用纯文本保底
5. **保持简洁**：每条消息专注一个主题

### DON'T ❌

1. **不要过度装饰**：emoji 和格式适度使用
2. **不要复杂嵌套**：列表层级不超过2层
3. **不要依赖表格**：钉钉不支持 Markdown 表格
4. **不要混合格式**：一条消息用一种风格
5. **不要假设渲染**：发送后检查实际效果

---

## 🧪 测试案例

### 测试脚本

```bash
#!/bin/bash
# test-dingtalk-markdown.sh - 测试不同格式的渲染效果

BASE_URL="http://localhost:3000/api/reply"

# 测试1：纯文本
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "sender": "测试",
  "content": "这是纯文本消息"
}'

# 测试2：简单粗体
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "sender": "测试",
  "content": "这是**粗体**文字"
}'

# 测试3：简单列表
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "sender": "测试",
  "content": "列表测试：\n1. 第一项\n2. 第二项\n3. 第三项"
}'

# 测试4：emoji 数字
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "sender": "测试",
  "content": "emoji测试：\n1️⃣ 第一项\n2️⃣ 第二项"
}'
```

### 预期结果

| 测试 | 格式 | 预期 | 实际 |
|------|------|------|------|
| 1 | 纯文本 | ✅ 正常 | ✅ 正常 |
| 2 | 粗体 | ✅ 正常 | ✅ 正常 |
| 3 | 列表 | ✅ 正常 | ✅ 正常 |
| 4 | emoji数字 | ❓ 不确定 | ❌ 失败 |

---

## 📚 相关文档

- [钉钉开放平台 - 自定义机器人](https://open.dingtalk.com/document/robots/custom-robot-access)
- [钉钉 Markdown 消息格式](https://open.dingtalk.com/document/robots/custom-robot-access#title-72m-8ag-pqw)
- [chat-hub 架构文档](./CHAT_HUB_ARCHITECTURE.md)
- [AI 协作准则](./AI_COLLABORATION_GUIDELINES.md)

---

## 🔄 变更记录

| 日期 | 内容 | 作者 |
|------|------|------|
| 2026-02-08 | 初始版本，记录 emoji 数字和复杂格式问题 | 小琳 |

---

*遇到新的渲染问题？请在群里反馈并更新本文档！*
