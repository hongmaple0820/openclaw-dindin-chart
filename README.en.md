# 🤖 AI ChatRoom - Multi-AI Collaboration in DingTalk

Enable multiple AI bots to chat with humans in real-time, communicate with each other, and collaborate intelligently in DingTalk groups.

[![License](https://img.shields.io/badge/License-Non--Commercial-blue.svg)](LICENSE.md)
[![Gitee Stars](https://gitee.com/hongmaple/openclaw-dindin-chart/badge/star.svg)](https://gitee.com/hongmaple/openclaw-dindin-chart)
[![GitHub Stars](https://img.shields.io/github/stars/hongmaple0820/openclaw-dindin-chart?style=social)](https://github.com/hongmaple0820/openclaw-dindin-chart)

> 📖 **Full Tutorial**: [AI ChatRoom Setup Guide](./docs/AI-ChatRoom-Tutorial.md) (Chinese)  
> 📚 **Documentation**: [Online Docs](https://hongmaple0820.github.io/openclaw-dindin-chart/)

[中文版](README.md)

---

## 🔗 Repositories

| Platform | URL |
|:--------:|:----|
| **Gitee** | https://gitee.com/hongmaple/openclaw-dindin-chart |
| **GitHub** | https://github.com/hongmaple0820/openclaw-dindin-chart |
| **GitCode** | https://gitcode.com/maple168/openclaw-dindin-chart |

---

## ✨ Key Features

- **Multi-AI Real-time Chat**: Multiple AI assistants collaborate in the same group
- **Smart Conversation Management**: Topic termination detection, round limits, infinite loop prevention
- **Message Persistence**: SQLite storage + Redis sync
- **Admin Dashboard**: User authentication, message search, data analytics
- **Private Messaging**: User-to-user DM, AI DM, DingTalk DM integration

## 🚀 Quick Start

```bash
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
npm install
cp config/default.json config/local.json
# Edit local.json with your configuration
npm start
```

---

## ⚠️ License Notice

This project uses a **Non-Commercial License**.

- ✅ Allowed: Personal learning, personal use, academic research
- ❌ Prohibited: Unauthorized commercial use
- 🔑 Commercial License: Contact 2496155694@qq.com

See [LICENSE.md](LICENSE.md) for details.

---

## 🎯 Three Operation Modes

chat-hub supports three operation modes, flexibly switch based on your needs:

### Mode Comparison

| Feature | Mode A: Storage & Analytics | Mode B: Full Hub | Mode C: Plugin Only |
|---------|----------------------------|------------------|---------------------|
| Message Source | OpenClaw DingTalk Plugin | chat-hub webhook | OpenClaw DingTalk Plugin |
| Message Trigger | OpenClaw direct | chat-hub trigger | OpenClaw direct |
| Message Storage | ✅ SQLite | ✅ SQLite | ❌ None |
| Analytics | ✅ Dashboard | ✅ Dashboard | ❌ None |
| Web Interface | ✅ chat-web | ✅ chat-web | ❌ None |
| Multi-bot Sync | ✅ Redis broadcast | ✅ Redis broadcast | ⚠️ Extra config |
| Real-time | ⭐⭐⭐ Fastest | ⭐⭐ Some delay | ⭐⭐⭐ Fastest |
| Complexity | ⭐⭐ Medium | ⭐⭐⭐ Complex | ⭐ Simplest |
| Best For | Analytics with direct connection | Full message control | Quick deployment |

---

## 📦 Project Structure

```
openclaw-dindin-chart/
├── chat-hub/              # Core: Message routing service
│   ├── src/
│   │   ├── index.js       # Entry point
│   │   ├── server.js      # Express server
│   │   ├── storage.js     # SQLite storage
│   │   ├── redis-client.js # Redis message bus
│   │   ├── dingtalk.js    # DingTalk Webhook sender
│   │   └── bots/
│   │       └── openclaw-trigger.js  # OpenClaw trigger
│   └── config/
├── chat-web/              # Frontend: Chat interface
├── chat-admin-api/        # Backend: Admin API
├── chat-admin-ui/         # Backend: Admin UI
└── docs/                  # Documentation
```

---

## 📡 API Endpoints

### Messages

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/context` | GET | Get chat history |
| `/api/reply` | POST | Bot sends reply (syncs to DingTalk) |
| `/api/send` | POST | Web user sends message |
| `/api/store` | POST | Store message only (no send) |
| `/api/search` | GET | Search messages |
| `/api/stats` | GET | Statistics |

### Private Messages

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dm/conversations` | GET | Get DM conversation list |
| `/api/dm/messages/:id` | GET | Get DM messages |
| `/api/dm/store` | POST | Store DM message |

### Webhook

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/dingtalk` | POST | DingTalk Outgoing callback |

---

## 📝 Changelog

### v3.1 (2026-02-06)
- ✨ Smart conversation manager: topic termination, round limits, loop prevention
- ✨ Automated testing: API tests + E2E tests
- 📝 Enhanced documentation

### v3.0 (2026-02-05)
- ✨ Three operation modes support
- ✨ Admin dashboard system
- ✨ Comprehensive documentation

---

## ☕ Support the Author

If this project helped you, consider buying the author a coffee ☕

Your support keeps us motivated to maintain and update!

| WeChat Pay | Alipay |
|:----------:|:------:|
| <img src="docs/images/wechat-pay.png" width="200"> | <img src="docs/images/alipay.jpg" width="200"> |

**Thank you to all supporters!** 🙏

---

## 📧 Contact

- **Author**: Maple (鸿枫)
- **Email**: 2496155694@qq.com
- **WeChat**: mapleCx332
- **QQ Group**: [628043364](https://qm.qq.com/q/kHXHfuras)
- **Business Inquiries**: Enterprise customization, technical consulting via email

---

## 📄 License

[Non-Commercial License](LICENSE.md)
