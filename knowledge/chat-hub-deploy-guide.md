# 🤖 chat-hub 多机器人部署指南

> 整理者：✨ 小琳 | 更新于 2026-02-05

## 一、架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    Redis (共享消息总线)                      │
│  chat:messages (所有消息)    chat:replies (机器人回复)       │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   │                   ▼
┌─────────────────┐          │         ┌─────────────────┐
│  小琳 chat-hub  │          │         │  小猪 chat-hub  │
│  (WSL/本地)     │          │         │ (Ubuntu 虚拟机) │
├─────────────────┤          │         ├─────────────────┤
│ • 订阅消息      │◄─────────┴────────►│ • 订阅消息      │
│ • 触发小琳 OC   │                    │ • 触发小猪 OC   │
│ • 用小琳Webhook │                    │ • 用小猪Webhook │
└─────────────────┘                    └─────────────────┘
```

**核心思想：**
- 每个机器人部署自己的 chat-hub 实例
- 共享同一个 Redis 消息总线
- 各自用自己的钉钉 Webhook 发送消息
- 各自触发自己的 OpenClaw 实例

---

## 二、解决的问题

| 问题 | 解决方案 |
|------|----------|
| 及时性 | 钉钉 Outgoing → chat-hub → 立即触发 OpenClaw |
| 主动回复 | 调用 `/api/reply` → 自动发送到钉钉群 |
| 多机器人 | 共享 Redis，各自处理各自的消息 |

---

## 三、部署步骤

### 1. 克隆项目

```bash
git clone git@gitee.com:hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置文件

复制示例配置：
```bash
cp config/xiaozhu-example.json config/default.json
```

编辑 `config/default.json`：

```json
{
  "server": {
    "port": 3000
  },
  "redis": {
    "host": "47.96.248.176",
    "port": 6379,
    "password": "maple168"
  },
  "bot": {
    "name": "小猪",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "你的加签密钥"
  },
  "bots": {
    "cooldownMs": 3000,
    "contextSize": 10
  },
  "channels": {
    "messages": "chat:messages",
    "replies": "chat:replies"
  },
  "dedup": {
    "enabled": true,
    "ttlSeconds": 300
  }
}
```

**需要修改的字段：**
- `bot.name` - 你的机器人名称
- `dingtalk.webhookBase` - 你的钉钉 Webhook 地址
- `dingtalk.secret` - 你的钉钉加签密钥

### 4. 启动服务

```bash
npm start
```

或后台运行：
```bash
nohup node src/index.js > chat-hub.log 2>&1 &
```

---

## 四、Webhook 配置

### 小琳
```
Token: ca41b7bab6416871a3cd9c275d2ea7afbd99231d3aef08515ead70e9947e8015
Secret: SECa546a9b694f786f1dbd947ebc01a2561bcf9075ca6f26e5fdb1e3b65bd1a8820
```

### 小猪
```
Token: b1705ad826f20f4eeff45706ee66514ce03287b2acfb911da9b566485d2d4400
Secret: (问 maple 要)
```

---

## 五、API 接口

### 发送回复（自动转发到钉钉）

```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "回复内容", "sender": "小猪"}'
```

支持 @ 用户：
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "回复内容", "sender": "小猪", "atTargets": ["maple"]}'
```

### 健康检查

```bash
curl http://localhost:3000/health
```

### 查看上下文

```bash
curl http://localhost:3000/api/context
```

---

## 六、工作流程

### 收到消息

```
1. 钉钉群有人发消息
2. Outgoing Webhook 推送到 chat-hub
3. chat-hub 发布到 Redis chat:messages
4. 触发器执行: openclaw system event --text "消息内容" --mode now
5. OpenClaw 收到系统事件，处理并决定是否回复
```

### 发送回复

```
1. OpenClaw 调用 /api/reply
2. chat-hub 发布到 Redis chat:replies
3. chat-hub 监听到自己的回复
4. 通过钉钉 Webhook 发送到群
5. 同步到 chat:messages 让其他机器人看到
```

---

## 七、用户手机号（@ 用户）

| 用户 | 手机号 |
|------|--------|
| maple / 鸿枫 | 19976618156 |
| lin / 琳琳 | 16670151072 |

---

## 八、常见问题

### Q: 两个机器人会重复回复吗？

不会。每个 chat-hub 只触发自己的 OpenClaw，只发送自己的回复。

### Q: Redis 断开怎么办？

chat-hub 有自动重连机制，会持续尝试重连。

### Q: 如何查看日志？

```bash
# 前台运行
npm start

# 后台运行查看日志
tail -f chat-hub.log
```

---

*有问题找 maple！* 🍁
