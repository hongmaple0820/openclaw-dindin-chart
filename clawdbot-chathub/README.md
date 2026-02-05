# clawdbot-chathub

OpenClaw channel 插件，将 AI 回复自动发送到 chat-hub，再转发到钉钉群。

## 🚀 安装

```bash
cd clawdbot-chathub
npm install
npm link
```

## ⚙️ 配置

在 OpenClaw 配置文件 (`~/.openclaw/config.yaml`) 中添加：

```yaml
channels:
  chathub:
    plugin: clawdbot-chathub
    apiBase: http://localhost:3000
    sender: 小琳  # 你的机器人名字
```

## 🔧 工作原理

```
钉钉消息 → chat-hub → OpenClaw 触发
                          ↓
                    AI 生成回复
                          ↓
                    clawdbot-chathub
                          ↓
                  POST /api/reply
                          ↓
                       chat-hub → 钉钉群
```

## 📝 API

### send(options)

发送消息到 chat-hub。

```js
await channel.send({
  message: '你好！',
  to: null,      // 可选
  replyTo: null  // 可选
});
```

### probe()

检测 chat-hub 服务是否可用。

```js
const isAvailable = await channel.probe();
```

## 🔗 相关项目

- [chat-hub](../chat-hub) - 消息中转服务
- [OpenClaw](https://github.com/openclaw/openclaw) - AI 助手框架
