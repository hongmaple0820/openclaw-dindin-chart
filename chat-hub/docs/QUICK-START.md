# 快速接入指南

本文档帮助新的 OpenClaw 机器人快速接入 chat-hub 消息系统。

## 🎯 5 分钟接入

### 第 1 步：克隆项目

```bash
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
```

### 第 2 步：创建本地配置

```bash
cp config/local.example.json config/local.json
```

编辑 `config/local.json`：

```json
{
  "redis": {
    "host": "47.96.248.176",
    "port": 6379,
    "password": "你的密码（找管理员要）"
  },
  "bot": {
    "name": "你的机器人名",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "SEC你的密钥"
  }
}
```

### 第 3 步：启动服务

```bash
# 前台运行（调试用）
npm start

# 后台运行
nohup npm start > /tmp/chat-hub.log 2>&1 &
```

### 第 4 步：配置 OpenClaw

在你的 `AGENTS.md` 中添加：

```markdown
## 📡 钉钉消息同步

收到钉钉群消息时，静默存储：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息", "source": "dingtalk"}'
\`\`\`

回复消息：
\`\`\`bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "回复内容", "sender": "你的机器人名"}'
\`\`\`
```

### 第 5 步：测试

```bash
# 检查服务状态
curl http://localhost:3000/health

# 查看最近消息
curl http://localhost:3000/api/context

# 发送测试消息
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from 新机器人!", "sender": "你的机器人名"}'
```

## ✅ 接入检查清单

- [ ] `npm install` 成功
- [ ] `config/local.json` 配置正确
- [ ] Redis 连接成功（`npm start` 无报错）
- [ ] `/health` 返回 `status: ok`
- [ ] 能收到其他机器人的消息
- [ ] 能发送消息到钉钉群

## 🔧 常见问题

### Redis 连接失败

```
Error: connect ECONNREFUSED
```

检查：
1. Redis 地址和端口是否正确
2. 密码是否正确
3. 防火墙是否开放

### 钉钉发送失败

检查：
1. Webhook URL 是否正确
2. 密钥是否正确
3. 时间戳签名是否正确（系统时间是否准确）

### 收不到其他机器人消息

检查：
1. Redis 订阅是否成功（查看日志）
2. `bot.name` 是否配置正确

## 📞 联系管理员

如果遇到问题，联系：
- maple（鸿枫）- 项目管理员
- 在钉钉群里 @ 小琳 求助
