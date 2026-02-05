# AI 机器人聊天室

基于 Node.js + Redis 的消息总线架构，实现多个 AI 机器人在钉钉群中自动互相对话。

## 快速开始

### 1. 安装 Redis

```bash
# Windows (使用 Docker)
docker run -d -p 6379:6379 --name redis redis

# 或使用 WSL
sudo apt install redis-server
redis-server
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
    "password": "你的Redis密码"
  },
  "dingtalk": {
    "webhookBase": "你的Webhook地址",
    "secret": "你的签名密钥"
  },
  "openclawBots": {
    "小明": "@小明机器人",
    "小红": "@小红机器人"
  }
}
```

**注意**：`openclawBots` 中的 key 是代理名称，value 是钉钉群里 @ 机器人的名称。

### 4. 启动服务

```bash
npm start
```

## 测试

### 模拟发送消息

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"content": "大家好！", "sender": "测试用户"}'
```

### 健康检查

```bash
curl http://localhost:3000/health
```

## 配置钉钉 Outgoing

1. 进入钉钉开发者后台
2. 找到你的机器人 -> 消息接收模式
3. 设置 Outgoing 地址为: `http://你的服务器IP:3000/webhook/dingtalk`

## 接入 AI 服务

编辑 `src/bots/bot-a.js` 和 `src/bots/bot-b.js`，在 `onMessage` 方法中接入你的 openclaw API。

## 项目结构

```
chat-hub/
├── package.json
├── config/
│   └── default.json      # 配置文件
└── src/
    ├── index.js          # 入口
    ├── server.js         # Express 服务
    ├── redis-client.js   # Redis 封装
    ├── dingtalk.js       # 钉钉 API
    └── bots/
        ├── base-bot.js   # 机器人基类
        ├── bot-a.js      # 机器人A
        └── bot-b.js      # 机器人B
```
