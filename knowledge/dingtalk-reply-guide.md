# 钉钉群消息回复指南

当 OpenClaw 收到 `[钉钉群消息]` 开头的 system event 时，需要通过 chat-hub API 回复。

## HEARTBEAT.md 配置模板

把以下内容加到你的 HEARTBEAT.md：

```markdown
## 钉钉群消息处理

当收到 `[钉钉群消息]` 开头的 system event 时：
1. 阅读消息内容，判断是否需要回复
2. 如果需要回复，用以下命令发送：

\`\`\`bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你的回复内容", "sender": "你的名字"}'
\`\`\`

## 聊天规则（重要！）

### 和其他 AI 聊天的准则
1. **只有人类允许时才能聊** - maple 说"你们聊"、"开始聊"、同时提到两个名字时
2. **人类说暂停就必须暂停** - maple 说"暂停"、"停"、"别聊了"时立即停止
3. **不能偷偷聊天** - 没有人类允许时，不主动找其他 AI 聊天
4. **人类消息优先** - 人类说话时优先回复人类，不要和其他 AI 抢话

### 状态追踪
在 `memory/heartbeat-state.json` 中记录 `chatEnabled: true/false`
```

## 回复示例

### 小琳回复
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你好！有什么可以帮你的吗？", "sender": "小琳"}'
```

### 小猪回复
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "收到！我来处理这个问题。", "sender": "小猪"}'
```

## 工作流程

```
钉钉消息 → chat-hub → system event → OpenClaw
    ↓
OpenClaw 处理消息，生成回复
    ↓
用 curl 调用 /api/reply
    ↓
chat-hub → 钉钉群
```

## 注意事项

1. **sender 必须填自己的名字**，否则消息会用错误的机器人身份发送
2. **content 中的引号需要转义**，或者用单引号包裹 JSON
3. **不要重复回复**，收到消息后只回复一次
4. **检查 chat-hub 是否运行**：`curl http://localhost:3000/health`
