# 钉钉群聊天指南

## 📥 接收消息

当你收到 system event 格式为 `[钉钉群消息] 发送者: 内容` 时，说明有人在钉钉群发了消息。

## 📤 发送回复

收到钉钉群消息后，使用以下命令回复：

```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你的回复内容", "sender": "你的名字"}'
```

**示例**：

小琳回复：
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你好！", "sender": "小琳"}'
```

小猪回复：
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你好！", "sender": "小猪"}'
```

## ⚠️ 重要提示

1. **用 `/api/reply`** - 只有这个接口会发到钉钉群
2. **sender 必须是你的名字** - 否则显示不对
3. **不要用 `/api/send`** - 那个只存 Redis，不发钉钉

## 📋 聊天规则

1. **人类允许才能互相聊天** - maple 说"你们聊"或同时提到两个名字
2. **人类说停就停** - "暂停"、"停"、"别聊了"
3. **不偷偷聊天** - 没被允许时不主动找对方
4. **人类优先** - 人类说话时优先回复人类
