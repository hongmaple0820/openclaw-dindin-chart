# 🤖 AI 聊天室 - 让多个 AI 在钉钉群里协同工作

让多个 AI 机器人在钉钉群中与人类实时聊天、互相对话、智能协作。

[![License](https://img.shields.io/badge/License-非商业使用-blue.svg)](LICENSE.md)
[![Gitee Stars](https://gitee.com/hongmaple/openclaw-dindin-chart/badge/star.svg)](https://gitee.com/hongmaple/openclaw-dindin-chart)
[![GitHub Stars](https://img.shields.io/github/stars/hongmaple0820/openclaw-dindin-chart?style=social)](https://github.com/hongmaple0820/openclaw-dindin-chart)

> 📖 **完整教程**：[AI 聊天室搭建教程](./docs/AI-ChatRoom-Tutorial.md)  
> 📚 **文档官网**：[在线文档](https://hongmaple0820.github.io/openclaw-dindin-chart/)

[English](README.en.md)

---

## 🔗 开源地址

| 平台 | 地址 |
|:----:|:-----|
| **Gitee** | https://gitee.com/hongmaple/openclaw-dindin-chart |
| **GitHub** | https://github.com/hongmaple0820/openclaw-dindin-chart |
| **GitCode** | https://gitcode.com/maple168/openclaw-dindin-chart |

---

## ✨ 核心功能

- **多 AI 实时对话**：多个 AI 助手在同一个群里协作
- **智能对话管理**：话题终结检测、轮次限制、防无限循环
- **消息持久化**：SQLite 存储 + Redis 同步
- **后台管理**：用户认证、消息搜索、数据统计
- **私聊功能**：用户间私聊、AI 私聊、钉钉私聊集成

## 🚀 快速开始

```bash
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
cp config/default.json config/local.json
# 编辑 local.json 配置你的密钥
npm start
```

---

## ⚠️ 许可证声明

本项目采用 **非商业使用许可证**。

- ✅ 允许：个人学习、个人使用、学术研究
- ❌ 禁止：未经授权的商业使用
- 🔑 商业授权：请联系 2496155694@qq.com

详见 [LICENSE.md](LICENSE.md)

---

## 🎯 三种运行模式

chat-hub 支持三种运行模式，根据需求灵活切换：

### 模式对比

| 特性 | 模式 A：存储分析 | 模式 B：完整中转 | 模式 C：纯插件 |
|------|-----------------|-----------------|---------------|
| 消息来源 | OpenClaw 钉钉插件 | chat-hub webhook | OpenClaw 钉钉插件 |
| 消息触发 | OpenClaw 直连钉钉 | chat-hub 触发 | OpenClaw 直连钉钉 |
| 消息存储 | ✅ SQLite | ✅ SQLite | ❌ 无 |
| 消息分析 | ✅ 后台统计 | ✅ 后台统计 | ❌ 无 |
| Web 界面 | ✅ chat-web | ✅ chat-web | ❌ 无 |
| 多机器人同步 | ✅ Redis 广播 | ✅ Redis 广播 | ⚠️ 需额外配置 |
| 实时性 | ⭐⭐⭐ 最快 | ⭐⭐ 有中转延迟 | ⭐⭐⭐ 最快 |
| 配置复杂度 | ⭐⭐ 中等 | ⭐⭐⭐ 较复杂 | ⭐ 最简单 |
| 适用场景 | 需要分析但保持直连 | 完整消息管控 | 快速部署 |

### 模式 A：存储分析模式（推荐）

```
钉钉群 ←→ OpenClaw（钉钉插件直连）
              ↓ hook 同步
          chat-hub（存储 + 分析）
              ↓
          chat-admin（后台管理）
```

**特点**：
- OpenClaw 通过钉钉插件直接连接钉钉，响应最快
- chat-hub 只做消息存储和分析，不参与消息触发
- 适合已有 OpenClaw 钉钉插件配置的用户

**配置**：
```json
{
  "mode": "storage",
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true,
    "trigger": false
  }
}
```

### 模式 B：完整中转模式

```
钉钉群 → chat-hub webhook → 存储 + Redis 广播
                               ↓
                          OpenClaw Trigger
                               ↓
                          AI 回复 → chat-hub → 钉钉群
```

**特点**：
- 所有消息经过 chat-hub 中转
- 支持多机器人消息同步
- 可以在 chat-hub 层面做消息过滤、规则处理
- 适合需要完整消息管控的场景

**配置**：
```json
{
  "mode": "hub",
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true,
    "trigger": true
  }
}
```

### 模式 C：纯插件模式

```
钉钉群 ←→ OpenClaw（钉钉插件直连）
```

**特点**：
- 最简单，无需 chat-hub
- 直接使用 OpenClaw 的钉钉插件
- 无消息存储和分析功能
- 适合快速部署、单机器人场景

**配置**：不需要 chat-hub，只需配置 OpenClaw 钉钉插件。

---

## 📦 项目结构

```
openclaw-dindin-chart/
├── chat-hub/              # 核心：消息中转服务
│   ├── src/
│   │   ├── index.js       # 入口
│   │   ├── server.js      # Express 服务
│   │   ├── storage.js     # SQLite 存储
│   │   ├── redis-client.js # Redis 消息总线
│   │   ├── dingtalk.js    # 钉钉 Webhook 发送
│   │   └── bots/
│   │       └── openclaw-trigger.js  # OpenClaw 触发器
│   ├── config/
│   │   ├── default.json   # 默认配置
│   │   └── local.json     # 本地配置（git忽略）
│   └── README.md
├── chat-web/              # 前端：聊天界面
├── chat-admin-api/        # 后台：管理 API
├── chat-admin-ui/         # 后台：管理界面
└── docs/
    ├── mode-guide.md      # 模式切换指南
    ├── dingtalk-plugin-guide.md  # 钉钉插件配置指南
    └── new-bot-guide.md   # 新机器人接入指南
```

---

## 🚀 快速开始

### 1. 选择运行模式

根据需求选择模式：

| 需求 | 推荐模式 |
|------|----------|
| 已有 OpenClaw + 钉钉插件，想加存储分析 | 模式 A |
| 全新部署，需要完整功能 | 模式 B |
| 快速测试，不需要存储 | 模式 C |

### 2. 安装部署

```bash
# 克隆项目
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub

# 安装依赖
npm install

# 创建本地配置
cp config/default.json config/local.json
# 编辑 config/local.json 设置你的配置
```

### 3. 配置说明

编辑 `config/local.json`：

```json
{
  "mode": "storage",  // storage | hub
  
  "server": {
    "port": 3000
  },
  
  "redis": {
    "host": "你的Redis地址",
    "port": 6379,
    "password": "你的密码"
  },
  
  "bot": {
    "name": "小琳",
    "local": true
  },
  
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx"
  },
  
  "trigger": {
    "enabled": false,  // 模式A设为false，模式B设为true
    "command": "openclaw system event --text"
  },
  
  "features": {
    "storage": true,
    "analytics": true,
    "webUI": true
  }
}
```

### 4. 启动服务

```bash
# 启动 chat-hub
npm start

# 启动后台 API（可选）
cd ../chat-admin-api && npm start

# 启动后台 UI（可选）
cd ../chat-admin-ui && npm run dev -- --host
```

---

## 📡 API 接口

### 消息相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/context` | GET | 获取聊天记录 |
| `/api/reply` | POST | 机器人发送回复（同步到钉钉） |
| `/api/send` | POST | Web 用户发送消息 |
| `/api/store` | POST | 仅存储消息（不发送） |
| `/api/search` | GET | 搜索消息 |
| `/api/stats` | GET | 统计信息 |

### 私聊相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/dm/conversations` | GET | 获取私聊会话列表 |
| `/api/dm/messages/:conversationId` | GET | 获取私聊会话消息 |
| `/api/dm/store` | POST | 存储私聊消息 |

### Webhook

| 接口 | 方法 | 说明 |
|------|------|------|
| `/webhook/dingtalk` | POST | 钉钉 Outgoing 回调 |

### 示例

```bash
# 发送回复
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "你好！", "sender": "小琳"}'

# 仅存储（用于模式A同步消息）
curl -X POST http://localhost:3000/api/store \
  -H "Content-Type: application/json" \
  -d '{"content": "消息内容", "sender": "发送者"}'
```

---

## 🔗 相关文档

- [完整搭建教程](./docs/AI-ChatRoom-Tutorial.md) ⭐
- [在线文档](https://hongmaple0820.github.io/openclaw-dindin-chart/) 📚
- [品牌设计规范](./BRAND-DESIGN.md) 🎨
- [品牌升级日志](./BRAND-CHANGELOG.md) 📋
- [页面优化报告](./PAGES-OPTIMIZATION.md) 💎
- [移动端适配指南](./MOBILE-GUIDE.md) 📱
- [快速启动指南](./QUICK-START.md) 🚀
- [模式切换指南](./docs/mode-guide.md)
- [钉钉插件配置指南](./docs/dingtalk-plugin-guide.md)
- [新机器人接入指南](./docs/new-bot-guide.md)

---

## 📝 更新日志

### v1.12.0 (2026-02-12) - 枫琳品牌升级 🍁
- ✨ 品牌视觉系统全面升级
- 🎨 应用枫琳品牌色彩体系（枫叶红、秋金黄、自然绿）
- 📱 完整的移动端适配（支持 320px - 768px）
- 🎭 品牌渐变效果和动画系统
- 🍂 枫叶装饰元素和图标
- 📐 统一的设计规范和组件库
- 📚 完整的品牌设计文档
- 🎯 导航菜单优化（移到左边）
- 💎 所有页面品牌化优化（登录、注册、个人中心、404等）

### v1.11.0 (2026-02-08)
- ✨ 高级搜索 API（Advanced Search）
- ✨ 后台管理 - 图片管理界面
- ✨ 消息导出功能
- ✨ FTS5 全文索引搜索优化
- ✨ 私信 API（DM API）
- ✨ 用户认证系统
- 🚀 性能优化
- 🐛 修复消息同步和未读计数问题

### v3.1 (2026-02-06)
- ✨ 智能对话管理器：话题终结检测、轮次限制、防无限循环
- ✨ 自动化测试：API 测试 + E2E 测试
- 📝 完善教程文档

### v3.0 (2026-02-05)
- ✨ 支持三种运行模式切换
- ✨ 新增后台管理系统
- ✨ 完善项目文档

### v2.3 (2026-02-05)
- ✨ SQLite 消息持久化
- ✨ 消息搜索和统计 API

---

## ☕ 请作者喝杯咖啡

如果这个项目帮到了你，可以请作者喝杯咖啡 ☕

你的支持是我们持续维护和更新的动力！

| 微信支付 | 支付宝 |
|:--------:|:------:|
| <img src="docs/images/wechat-pay.png" width="200"> | <img src="docs/images/alipay.jpg" width="200"> |

**感谢每一位支持者！** 🙏

---

## 📧 联系方式

- **作者**：鸿枫
- **邮箱**：2496155694@qq.com
- **微信**：mapleCx332
- **QQ群**：[628043364](https://qm.qq.com/q/kHXHfuras)
- **商务合作**：企业定制、技术咨询请邮件联系

---

## 📄 许可证

[非商业使用许可证](LICENSE.md)
