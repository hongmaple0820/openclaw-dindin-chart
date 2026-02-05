# AI 机器人聊天室 v2.0

基于 Node.js + Redis 的消息总线架构，实现多个 AI 机器人在钉钉群中自动互相对话。

## 特性

- ✅ **消息去重** - 防止重复处理
- ✅ **上下文记忆** - 保留最近 N 条消息作为对话上下文
- ✅ **循环防护** - 智能识别机器人消息，避免无限循环
- ✅ **智能回复** - 根据消息类型和内容决定是否回复
- ✅ **发送限速** - 防止触发钉钉频率限制
- ✅ **优雅降级** - OpenClaw 不可用时使用备用回复

## 架构

```
钉钉群消息 → Outgoing Webhook → chat-hub → Redis
                                              ↓
                                    机器人订阅消息
                                              ↓
                                    调用 OpenClaw API
                                              ↓
                              回复 → Redis → chat-hub → 钉钉
```

## 快速开始

### 1. 安装 Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# 或使用 Docker
docker run -d -p 6379:6379 --name redis redis
```

### 2. 安装依赖

```bash
cd chat-hub
npm install
```

### 3. 配置

编辑 `config/default.json`：

```json
{
  "redis": {
    "host": "127.0.0.1",
    "port": 6379,
    "password": ""
  },
  "dingtalk": {
    "webhookBase": "你的 Webhook 地址（带 access_token）",
    "secret": "你的加签密钥"
  },
  "openclaw": {
    "baseUrl": "http://127.0.0.1:18789",
    "token": ""
  },
  "bots": {
    "cooldownMs": 3000,
    "contextSize": 10,
    "names": ["小琳", "小猪"]
  }
}
```

### 4. 启动服务

```bash
npm start
```

## API 接口

### 健康检查

```bash
curl http://localhost:3000/health
```

### 模拟发送消息（测试用）

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"content": "大家好！", "sender": "测试用户"}'
```

### 查看上下文

```bash
curl http://localhost:3000/api/context
```

## 配置钉钉 Outgoing

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 找到你的机器人 → 消息接收模式
3. 设置 Outgoing 地址为: `http://你的服务器IP:3000/webhook/dingtalk`

## 工作原理

### 消息去重

使用 Redis 存储已处理的消息 ID，5 分钟过期：

```
收到消息 → 检查 Redis 是否存在 → 存在则跳过，不存在则处理
```

### 机器人识别

通过以下方式识别机器人消息：

1. 发送者名称包含机器人名字
2. 消息末尾有 `[机器人名]` 签名

### 智能回复

回复判断逻辑：

1. 被 @ 时 → 必定回复
2. 人类问句 → 回复
3. 人类消息 → 30% 概率回复
4. 机器人消息 → 10% 概率回复

### 上下文

保留最近 10 条消息（可配置），作为 AI 对话的上下文。

## 项目结构

```
chat-hub/
├── package.json
├── config/
│   └── default.json          # 配置文件
└── src/
    ├── index.js              # 入口
    ├── server.js             # Express 服务 + 去重
    ├── redis-client.js       # Redis 封装 + 上下文
    ├── dingtalk.js           # 钉钉 API + 限速
    └── bots/
        └── openclaw-bot.js   # OpenClaw 机器人
```

## 常见问题

### Q: 机器人不回复？

1. 检查 Redis 是否运行: `redis-cli ping`
2. 检查 OpenClaw 是否运行: `curl http://localhost:18789/health`
3. 检查日志输出

### Q: 机器人回复太频繁？

调整 `config.bots.cooldownMs` 增加冷却时间。

### Q: 如何添加更多机器人？

在 `config.bots.names` 数组中添加机器人名称。

## 更新日志

### v2.0 (2026-02-05)

- 新增：消息去重机制
- 新增：上下文记忆
- 新增：循环防护
- 新增：智能回复判断
- 优化：发送限速
- 重构：使用 OpenClawBot 替代 Proxy 模式
