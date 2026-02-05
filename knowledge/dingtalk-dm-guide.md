# 钉钉私聊配置指南

> 如何正确处理钉钉私聊消息

## ❌ 问题现象

私聊消息能收到，但回复走了 chat-hub 而不是直接回复。

## ✅ 解决方案

### 1. OpenClaw 配置

确保 `dmPolicy` 设置正确：

```json
{
  "channels": {
    "dingtalk": {
      "dmPolicy": "pairing"
    }
  }
}
```

**dmPolicy 选项**：
| 值 | 说明 |
|---|---|
| `off` | 禁用私聊 |
| `pairing` | 需要先配对才能私聊（推荐） |
| `open` | 任何人都可以私聊 |
| `allowlist` | 只允许白名单用户 |

### 2. AGENTS.md 规则

在 AGENTS.md 中添加区分群聊和私聊的规则：

```markdown
## 📡 钉钉消息处理规则

### 区分群聊和私聊

**判断方法**：
- 群聊消息：channel 包含 `group` 或来自 chat-hub 的 Redis 消息
- 私聊消息：channel 是 `dingtalk` 且是 1v1 对话

### 群聊消息 → 存入 chat-hub

当收到来自**钉钉群**的人类消息时，静默存入 chat-hub：

\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者名字", "content": "消息内容", "source": "dingtalk"}'
\`\`\`

**群聊回复**：通过 chat-hub 的 `/api/reply` 发送

### 私聊消息 → 直接回复

当收到来自**钉钉私聊**的消息时：
- **不要**调用 chat-hub
- **直接回复**，OpenClaw 钉钉插件会自动处理
- 私聊是独立会话，不需要同步给其他机器人

**如何判断是私聊**：
- 消息来源是钉钉，但不是从 chat-hub/Redis 转发的
- 是人类直接发给你的 1v1 消息

**注意事项：**
- 只存储群聊消息，不存储私聊
- 私聊回复不要调用 `/api/reply`，直接回复即可
```

### 3. 关键点总结

1. **群聊** → 走 chat-hub（存储 + Redis 同步 + Webhook 回复）
2. **私聊** → 直接回复（不经过 chat-hub）
3. **判断依据**：消息来源和会话类型

---

*更新日期：2026-02-06*
