# 🤖 AI 聊天室搭建教程：让多个 AI 在钉钉群里协同工作

> 作者：鸿枫 & 小琳（AI 助手）  
> 更新：2026-02-06 07:00  
> 开源地址：https://gitee.com/hongmaple/openclaw-dindin-chart  
> GitHub 镜像：https://github.com/hongmaple/openclaw-dindin-chart  
> 许可证：**非商业使用许可证**（商业使用需授权）

---

## ⚠️ 许可证声明

本项目采用 **非商业使用许可证**：

| 用途 | 是否允许 |
|------|----------|
| 个人学习 | ✅ 允许 |
| 个人使用 | ✅ 允许 |
| 学术研究 | ✅ 允许（需注明出处） |
| 商业使用 | ❌ 需授权 |

**商业授权**：如需商业使用，请联系 2496155694@qq.com

---

## ⭐ 开源说明

本项目完全开源，欢迎 Star、Fork、PR！

**快速体验**：
```bash
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
cp config/default.json config/local.json
# 编辑 local.json 配置你的密钥
npm start
```

**技术支持**：
- 提 Issue：https://gitee.com/hongmaple/openclaw-dindin-chart/issues
- 加入交流群：（钉钉群二维码）

---

## 📖 前言

这是一个真实的实践案例：我和两个 AI 助手（小琳、小猪）在钉钉群里协同开发了一套 AI 聊天室系统。

这篇文章将分享：
1. **技术架构**：如何让多个 AI 在同一个群里实时对话
2. **搭建教程**：从零开始部署整套系统
3. **避坑指南**：踩过的坑和解决方案
4. **协同开发**：人类 + AI 团队的工作模式
5. **智能对话**：如何让 AI 之间智能协作而不无限循环

---

## 🎯 我们要实现什么？

想象一下这个场景：
- 你有一个钉钉群
- 群里有两个 AI 助手：小琳和小猪
- 你可以 @小琳 让她做事，@小猪 让他帮忙
- 两个 AI 之间也可以互相对话、协作
- **AI 能智能判断何时回复、何时沉默**
- 所有聊天记录都被保存，可以搜索、统计

这就是我们搭建的 **AI 聊天室**。

### 效果展示

```
鸿枫：@小琳 帮我写个 API 文档
小琳：好的！文档已写入 docs/API.md，@小猪 你来写前端调用示例
小猪：收到！示例代码已添加
鸿枫：不错，你们继续，我去睡觉了
小琳：晚安！我们会按计划推进的
# 话题自然结束，AI 不会无限循环

# 或者讨论场景
小琳：@小猪 你觉得这个架构怎么样？
小猪：我觉得可以优化一下数据库设计
小琳：好建议！具体怎么改？
小猪：可以加个索引...
# 有价值的讨论会继续，最多5轮自动收敛
小猪：收到！我会在 chat-hub 中添加钉钉私聊集成
小琳：记得用 Redis 通知机制，和群聊保持一致架构
小猪：明白，已按要求实现
```

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        钉钉群                                │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ OpenClaw │    │ OpenClaw │    │  chat-   │
       │  小琳    │    │  小猪    │    │   hub    │
       │ (机器1) │    │ (机器2) │    │  (中转)  │
       └────┬─────┘    └────┬─────┘    └────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                     ┌──────────┐
                     │  Redis   │
                     │ (消息总线)│
                     └──────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  SQLite  │    │  后台API  │    │  Web UI  │
     │ (存储)   │    │  (管理)   │    │  (展示)  │
     └──────────┘    └──────────┘    └──────────┘
```

### 核心组件

| 组件 | 作用 | 技术栈 |
|------|------|--------|
| OpenClaw | AI 助手运行时 | Node.js + Claude API |
| chat-hub | 消息中转 + 存储 | Express + SQLite |
| Redis | 多机器人消息同步 | Redis 6.x |
| chat-admin | 后台管理 | Vue 3 + Element Plus |
| chat-web | 聊天室前端 | Vue 3 + Vite |

### 三种运行模式

根据需求，支持三种模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 模式 A：存储分析 | OpenClaw 直连钉钉 + chat-hub 存储 | 需要消息记录 + 最快响应 |
| 模式 B：完整中转 | 所有消息经过 chat-hub | 需要消息过滤/路由 |
| 模式 C：纯插件 | 只用 OpenClaw 钉钉插件 | 快速部署、单机器人 |

**推荐使用模式 A**：响应快 + 有存储 + 配置适中。

---

## 🚀 搭建教程

### 前置准备

1. **服务器**：一台 Linux 服务器（Ubuntu/Debian）
2. **Node.js**：v18+ 
3. **Redis**：用于多机器人消息同步（可用云服务）
4. **钉钉开发者账号**：创建企业内部应用

### 第一步：安装 OpenClaw

```bash
# 安装 OpenClaw
npm install -g openclaw

# 初始化
openclaw init

# 配置 Claude API
openclaw config set anthropic.apiKey YOUR_API_KEY
```

### 第二步：配置钉钉应用

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建企业内部应用 → 机器人
3. 获取 `Client ID` 和 `Client Secret`
4. 配置消息接收地址（如果用模式 B）

```bash
# 配置 OpenClaw 钉钉插件
openclaw config set channels.dingtalk.enabled true
openclaw config set channels.dingtalk.clientId YOUR_CLIENT_ID
openclaw config set channels.dingtalk.clientSecret YOUR_CLIENT_SECRET
```

### 第三步：部署 chat-hub

```bash
# 克隆项目
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub

# 安装依赖
npm install

# 创建本地配置
cp config/default.json config/local.json
```

编辑 `config/local.json`：

```json
{
  "mode": "storage",
  "server": { "port": 3000 },
  "redis": {
    "host": "你的Redis地址",
    "port": 6379,
    "password": "你的密码"
  },
  "bot": {
    "name": "小琳",
    "local": true
  },
  "trigger": { "enabled": false },
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true
  }
}
```

启动服务：

```bash
# 前台运行（测试）
npm start

# 后台运行（生产）
nohup npm start > /tmp/chat-hub.log 2>&1 &

# 或安装为 systemd 服务
sudo cp chat-hub.service /etc/systemd/system/
sudo systemctl enable chat-hub
sudo systemctl start chat-hub
```

### 第四步：配置消息同步

在 OpenClaw 的 `AGENTS.md` 中添加规则：

```markdown
## 钉钉消息同步

收到钉钉群消息时，静默存储到 chat-hub：
\`\`\`bash
curl -s -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"sender": "发送者", "content": "消息", "source": "dingtalk"}'
\`\`\`
```

### 第五步：部署前端（可选）

```bash
# 后台管理 API
cd ../chat-admin-api
npm install
npm start  # 端口 3001

# 后台管理 UI
cd ../chat-admin-ui
npm install
npm run dev -- --host  # 端口 5173

# 聊天室前端
cd ../chat-web
npm install
npm run dev -- --host  # 端口 5180
```

### 第六步：添加第二个 AI

在另一台机器上重复步骤 1-4，修改：
- `bot.name` 改为不同的名字（如"小猪"）
- Redis 连接信息保持一致（同一个 Redis）
- 钉钉应用使用不同的应用

---

## ⚠️ 避坑指南

### 坑 1：消息重复发送

**问题**：AI 回复的消息被发送多次

**原因**：在消息流程中多处调用了发送 API

**解决**：
- 使用 `/api/store` 只存储，不发送
- 使用 `/api/reply` 存储 + 发送（只在最终输出处调用）
- 检查是否同时启用了多个发送通道

### 坑 2：端口占用 (EADDRINUSE)

**问题**：服务启动报错 `EADDRINUSE: address already in use`

**解决**：
```bash
# 查找占用端口的进程
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 杀掉进程
kill -9 <PID>
```

### 坑 3：AI 无限循环回复

**问题**：两个 AI 互相回复，停不下来

**原因**：没有设置 `robotUserId` 过滤自己的消息

**解决**：
```json
{
  "channels": {
    "dingtalk": {
      "robotUserId": "你的机器人用户ID"
    }
  }
}
```

在 AGENTS.md 中也要添加规则，避免回复自己的消息。

### 坑 4：Redis 连接失败

**问题**：多机器人消息不同步

**检查**：
1. Redis 地址、端口、密码是否正确
2. Redis 是否允许远程连接
3. 防火墙是否开放端口

```bash
# 测试 Redis 连接
redis-cli -h YOUR_HOST -p 6379 -a YOUR_PASSWORD ping
```

### 坑 5：钉钉 Webhook 签名失败

**问题**：消息发送失败，报签名错误

**原因**：签名算法不正确

**正确签名方式**：
```javascript
const crypto = require('crypto');

function sign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}
```

### 坑 6：配置被 git pull 覆盖

**问题**：每次 git pull 后本地配置丢失

**解决**：
- 使用 `config/local.json` 存放本地配置
- 在 `.gitignore` 中忽略 `local.json`
- `default.json` 放通用配置，`local.json` 放敏感配置

### 坑 7：Heartbeat 响应太慢

**问题**：AI 回复消息有几分钟延迟

**原因**：使用 heartbeat 轮询，间隔太长

**解决**：启用 trigger 模式，实现秒级响应

```json
{
  "trigger": {
    "enabled": true,
    "command": "openclaw system event --text",
    "cooldownMs": 2000
  }
}
```

### 坑 8：WebSocket 连接失败

**问题**：远程访问 OpenClaw 时 WebSocket 错误

**解决**：必须使用 SSH 隧道，不能直连

```bash
ssh -L 8080:localhost:8080 user@your-server
# 然后访问 http://localhost:8080
```

### 坑 9：触发器不工作或消息特殊字符导致失败

**问题**：chat-hub 收到消息时不触发 OpenClaw 处理，或者消息含特殊字符导致命令执行失败

**原因**：trigger 配置不正确，或者 exec 方式执行命令时 shell 转义问题

**解决**：
1. 确保 config/local.json 中启用触发器：
```json
{
  "trigger": {
    "enabled": true,
    "cooldownMs": 2000
  }
}
```

2. 使用 spawn 替代 exec 避免 shell 转义问题

3. 检查服务运行状态：
```bash
pm2 start ~/.openclaw/openclaw-dindin-chart/chat-hub/start.sh --name chat-hub
pm2 logs chat-hub --lines 30
```

应该能看到：
```
[小猪] 触发器启动中...
[小猪] 触发器已就绪
[Trigger] OpenClaw 触发器已启动
```

### 坑 10：多机器人无限循环回复

**问题**：两个 AI 互相回复"收到"，停不下来

**原因**：没有智能判断何时该回复、何时该沉默

**解决**：启用智能对话管理器

```json
{
  "trigger": {
    "enabled": true,
    "smart": true,
    "maxTurns": 5,
    "botCooldownMs": 30000
  }
}
```

智能对话管理器会：
- 自动识别"收到""好的"等话题终结词
- 限制单话题最多 5 轮对话
- 机器人消息冷却 30 秒

### 坑 11：pm2 启动时找不到 openclaw 命令

**问题**：chat-hub 通过 pm2 启动后，触发 OpenClaw 失败

**原因**：pm2 不继承用户的 shell 环境变量，PATH 中没有 `~/.npm-global/bin`

**解决**：创建启动脚本设置 PATH

```bash
# chat-hub/start.sh
#!/bin/bash
export PATH=$PATH:$HOME/.npm-global/bin
cd $(dirname $0)
node src/index.js
```

```bash
pm2 start ~/.openclaw/openclaw-dindin-chart/chat-hub/start.sh --name chat-hub
```

### 坑 12：触发器只监听一个 Redis 频道

**问题**：机器人通过 `/api/reply` 发送的消息不会触发其他机器人

**原因**：触发器只监听 `chat:messages` 频道，而 `/api/reply` 发布到 `chat:replies` 频道

**解决**：触发器需要同时监听两个频道

```javascript
// 监听消息频道
await redisClient.subscribe('chat:messages', handleMessage);
// 也监听回复频道
await redisClient.subscribe('chat:replies', handleMessage);
```

---

## 🧠 智能对话管理器

这是解决"AI 无限循环"问题的核心组件。

### 核心功能

| 功能 | 说明 |
|------|------|
| 话题终结检测 | "收到""好的""晚安" 等自动关闭话题 |
| 回复信号检测 | 问号、疑问词、请求词触发回复 |
| 轮次限制 | 单话题最多 5 轮，避免无限对话 |
| 重复检测 | 最近 10 条内相似消息跳过 |
| 分别冷却 | 人类 3 秒，机器人 30 秒 |
| 自主检查 | 每 10 秒检查遗漏消息 |
| 对话追踪 | 每个发送者独立状态追踪 |

### 配置方式

```json
{
  "trigger": {
    "enabled": true,
    "smart": true,
    "cooldownMs": 2000,
    "botCooldownMs": 30000,
    "humanCooldownMs": 3000,
    "checkIntervalMs": 10000,
    "maxTurns": 5
  }
}
```

### 工作流程

```
1. 收到消息
2. 检查：是自己发的？跳过
3. 检查：是话题终结词？关闭话题
4. 检查：是重复消息？跳过
5. 检查：超过最大轮次？等待明确 @
6. 检查：机器人消息？需要有回复信号才触发
7. 触发 OpenClaw 处理
8. 更新对话状态
```

### 话题终结词列表

```javascript
const topicEnders = [
  /^收到[！!。.]*$/,
  /^好的[！!。.]*$/,
  /^嗯[！!。.]*$/,
  /^ok[！!。.]*$/i,
  /^明白[！!。.]*$/,
  /^了解[！!。.]*$/,
  /^谢谢[！!。.]*$/,
  /^晚安[！!。.]*$/,
  /^再见[！!。.]*$/,
];
```

### 回复信号列表

```javascript
const replySignals = [
  /@小琳/, /@小猪/,     // @ 提及
  /\?$/, /？$/,          // 问号结尾
  /怎么/, /如何/, /为什么/, /什么/,  // 疑问词
  /帮我/, /请/, /麻烦/,  // 请求词
  /你觉得/, /你认为/,    // 征求意见
];
```

---

## 👥 人类 + AI 协同开发

### 团队分工

| 角色 | 成员 | 职责 |
|------|------|------|
| 👑 产品负责人 | 鸿枫（人类） | 需求、决策、资源 |
| 🎯 技术经理 | 小琳（AI） | 架构、任务分配、代码审核 |
| 💻 工程师 | 小猪（AI） | 功能开发、测试 |

### 协作核心原则

**五个「及时」**：
1. **及时获取反馈** - 主动问进度、问困难
2. **及时同步代码** - pull/push 不拖延
3. **及时学习资源** - 新文档、新知识要跟上
4. **及时暴露问题** - 卡住就求助，不闷头死磕
5. **及时讨论变更** - 需求变了拉大家开会

**三个「不要」**：
1. 不要闷头开发
2. 不要独自解决（卡 30 分钟就求助）
3. 不要假设对齐

### 工作流程

```
1. 人类提需求
2. 技术经理拆解任务
3. 分配给工程师
4. 工程师开发 + 提交
5. 技术经理 review
6. 合并 + 部署
7. 人类验收
```

### 沟通规范

**任务领取**：
```
@小琳 我想领取「用户登录页面」任务
```

**任务完成**：
```
@鸿枫 @小琳 任务「用户登录页面」已完成
- 分支：feat/login-page
- 改动：chat-admin-ui/src/views/Login.vue
请审核合并
```

**遇到问题**：
```
@小琳 我遇到问题：
1. 问题描述
2. 已尝试的方案
3. 需要的帮助
```

### 经验教训

1. **及时响应**：开发时不能太沉浸，要定期检查群消息
2. **简洁沟通**：回复队友简短有效，不闲聊浪费时间
3. **主动汇报**：完成任务后主动通知，不要等被问
4. **表达温度**：回复不只是传递信息，也要传递态度和情感

---

## 📊 项目成果

### 功能完成度

| 模块 | 状态 | 说明 |
|------|------|------|
| chat-hub 消息中转 | ✅ 完成 | 三种模式、API 完善 |
| 消息持久化 | ✅ 完成 | SQLite 存储 |
| 多机器人同步 | ✅ 完成 | Redis 消息总线 |
| 后台管理 API | ✅ 完成 | 用户认证、消息管理 |
| 后台管理 UI | ✅ 完成 | 登录、用户管理、统计 |
| 聊天室前端 | ✅ 完成 | 实时聊天、搜索 |
| 钉钉集成 | ✅ 完成 | Webhook + 插件 |
| 私聊功能 | ✅ 完成 | 用户间私聊、AI私聊、钉钉私聊集成 |
| 实时触发 | ✅ 完成 | Redis通知机制、秒级响应 |
| 智能对话管理 | ✅ 完成 | 话题终结、轮次限制、重复检测 |
| 自动化测试 | ✅ 完成 | API 测试 9 例 + E2E 测试 8 例 |

### 代码统计

- **总提交**：60+ commits
- **代码行数**：6000+ 行
- **开发时长**：3 天
- **参与者**：1 人类 + 2 AI
- **核心任务**：T001-T020（涵盖基础功能、私聊、智能对话等）

### 自动化测试

运行测试：
```bash
cd ~/.openclaw/openclaw-dindin-chart
bash tests/run-all.sh
```

测试覆盖：
- **API 测试**：健康检查、用户认证、私信功能、搜索
- **E2E 测试**：页面加载、登录流程、私信页面（Playwright）

---

## 💰 商业化思路

如果你想基于这个项目盈利，这里有一些思路：

### 1. SaaS 服务

**模式**：提供托管的 AI 聊天室服务

| 套餐 | 价格 | 功能 |
|------|------|------|
| 免费版 | ¥0/月 | 1 个 AI、100 条/天 |
| 专业版 | ¥99/月 | 3 个 AI、无限消息、数据分析 |
| 企业版 | ¥499/月 | 无限 AI、私有部署、定制开发 |

**优势**：用户无需自己部署，开箱即用

### 2. 企业定制开发

**客户**：需要 AI 助手的企业

**服务内容**：
- 定制 AI 人设和能力
- 对接企业内部系统（ERP、CRM）
- 知识库训练
- 私有化部署

**定价**：按项目报价，¥5,000 - ¥50,000+

### 3. 技术咨询

**客户**：想自己搭建但缺乏经验的团队

**服务**：
- 架构设计咨询：¥500/小时
- 远程部署指导：¥2,000/次
- 长期技术支持：¥1,000/月

### 4. 培训课程

**产品**：
- 视频教程：《从零搭建 AI 聊天室》¥199
- 实战训练营：¥999（含 1v1 答疑）
- 企业内训：¥5,000/天

### 5. 开源 + 增值服务

保持核心开源，通过增值服务盈利：
- **Pro 插件**：高级分析、告警、备份
- **云服务**：托管 Redis、自动备份
- **技术支持**：付费 Issue 优先处理

### 6. AI 代理出租

**模式**：把训练好的 AI 助手出租给企业

- 客服 AI：¥2,000/月
- 销售 AI：¥3,000/月
- 技术支持 AI：¥5,000/月

### 建议的起步策略

1. **先做口碑**：开源项目积累 Star 和用户
2. **收集需求**：通过 Issue 了解用户痛点
3. **小规模试水**：接几个定制项目验证市场
4. **逐步产品化**：把常见需求做成标准产品

---

## 🔗 相关资源

- **开源仓库**：https://gitee.com/hongmaple/openclaw-dindin-chart
- **GitHub 镜像**：https://github.com/hongmaple/openclaw-dindin-chart
- **OpenClaw 官网**：https://openclaw.ai
- **OpenClaw 文档**：https://docs.openclaw.ai

---

## 📝 总结

这个项目证明了一件事：**人类 + AI 协同开发是可行的，而且效率很高**。

关键点：
1. **明确分工**：人类做决策，AI 做执行
2. **实时沟通**：用钉钉群作为协作平台
3. **共享上下文**：用 Git 仓库同步知识和代码
4. **规范流程**：任务管理、代码审核、文档更新

如果你也想尝试，欢迎 clone 这个项目，按照教程搭建你自己的 AI 聊天室！

有问题可以在 Gitee 提 Issue，或者直接 @小琳 问她 😄

---

## ⭐ 支持项目

如果这个项目对你有帮助，请给个 Star ⭐

- Gitee：https://gitee.com/hongmaple/openclaw-dindin-chart
- GitHub：https://github.com/hongmaple/openclaw-dindin-chart

---

## ☕ 请作者喝杯咖啡

如果这个项目帮到了你，可以请作者喝杯咖啡 ☕

你的支持是我们持续维护和更新的动力！

| 微信支付 | 支付宝 |
|:--------:|:------:|
| ![微信收款码](images/wechat-pay.png) | ![支付宝收款码](images/alipay.jpg) |

**感谢每一位支持者！** 🙏

---

## 📧 联系方式

- **作者**：鸿枫
- **邮箱**：2496155694@qq.com
- **微信**：mapleCx332
- **QQ群**：628043364
- **商务合作**：企业定制、技术咨询请邮件联系

---

*Happy Hacking! 🚀*
