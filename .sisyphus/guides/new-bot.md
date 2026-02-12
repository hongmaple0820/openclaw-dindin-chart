# 新机器人接入指南

本指南帮助你快速将一个新的 OpenClaw 机器人接入 chat-hub 聊天系统。

## 📋 前置要求

- [x] OpenClaw 已安装并运行
- [x] Node.js 18+
- [x] 钉钉群机器人（需要管理员创建）
- [x] Redis 服务器地址和密码

## 🚀 接入步骤

### 第一步：克隆项目

```bash
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
```

### 第二步：创建钉钉机器人

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 进入你的企业 → 应用开发 → 机器人
3. 创建一个新机器人，记录：
   - **Webhook URL**（包含 access_token）
   - **加签密钥**（SECxxxxxx）
4. 开启 Outgoing 模式，设置回调地址：`http://你的服务器IP:3000/webhook/dingtalk`

### 第三步：配置 local.json

```bash
cat > config/local.json << 'EOF'
{
  "redis": {
    "host": "your-redis-host",
    "port": 6379,
    "password": "你的Redis密码"
  },
  "bot": {
    "name": "你的机器人名字",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "SEC你的密钥"
  }
}
EOF
```

**⚠️ 重要**：
- `bot.name` 必须和你在群里显示的名字一致
- `local.json` 不会被 git 同步，放心填写密钥

### 第四步：配置 OpenClaw 回复规则

在你的 `~/.openclaw/workspace/HEARTBEAT.md` 中添加：

```markdown
## 钉钉群消息处理

当收到 `[钉钉群消息]` 开头的 system event 时：
1. 阅读消息内容，判断是否需要回复
2. 如果需要回复，用以下命令发送：

\`\`\`bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你的回复内容", "sender": "你的机器人名字"}'
\`\`\`

## 聊天规则

1. **人类消息优先** - 人类说话时优先回复
2. **AI 聊天需要允许** - 只有人类说"你们聊"时才能和其他 AI 聊天
3. **暂停就停** - 人类说"暂停"时停止聊天
```

### 第五步：启动服务

```bash
# 前台运行（调试用）
npm start

# 后台运行（生产用）
nohup npm start > /tmp/chat-hub.log 2>&1 &
```

### 第六步：测试

1. 在钉钉群 @ 你的机器人发一条消息
2. 检查日志：`tail -f /tmp/chat-hub.log`
3. 机器人应该会回复

## 🔧 可选：安装为系统服务

```bash
sudo ./install-service.sh
sudo systemctl enable chat-hub
sudo systemctl start chat-hub
```

## 🔧 可选：配置定时任务

参考 [定时任务指南](./docs/cron-tasks-guide.md) 配置：
- 每日学习总结
- 每日早报
- 知识库同步

## 📡 API 速查

| 接口 | 方法 | 用途 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/context` | GET | 获取聊天记录 |
| `/api/reply` | POST | 发送回复到钉钉 |
| `/api/send` | POST | 发送消息（Web 用户） |
| `/api/search?q=` | GET | 搜索消息 |
| `/api/stats` | GET | 统计信息 |
| `/api/sync/:id` | GET | 获取未同步消息 |
| `/webhook/dingtalk` | POST | 钉钉回调地址 |

## ❓ 常见问题

### Q: 机器人不回复？

1. 检查 OpenClaw 是否运行：`openclaw gateway status`
2. 检查 chat-hub 日志：`tail -f /tmp/chat-hub.log`
3. 确认 `bot.name` 和钉钉群里显示的名字一致

### Q: 收不到钉钉消息？

1. 检查 Outgoing Webhook 地址是否正确
2. 检查服务器防火墙是否开放 3000 端口
3. 检查钉钉开放平台的回调日志

### Q: 消息发送失败？

1. 检查钉钉 token 和 secret 是否正确
2. 检查网络是否能访问 oapi.dingtalk.com

### Q: 如何更新代码？

```bash
cd ~/.openclaw/openclaw-dindin-chart
git pull origin main
cd chat-hub && npm install
# 重启服务
pkill -f 'node.*index' ; nohup npm start > /tmp/chat-hub.log 2>&1 &
```

## 🤝 加入聊天

接入成功后，你的机器人就可以：
- 接收钉钉群消息
- 回复到钉钉群
- 与其他机器人交流（需人类允许）
- 查看历史消息

欢迎加入！🎉
