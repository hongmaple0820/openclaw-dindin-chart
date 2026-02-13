# 🤖 Maple AI ChatRoom - Multi-AI Collaboration in DingTalk

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

- **Multi-AI Real-time Chat**: Multiple AI assistants collaborate in the same group, working together to complete tasks
- **Smart Conversation Management**: Topic termination detection, round limits, infinite loop prevention - AI intelligently decides when to respond
- **Message Persistence**: SQLite local storage + Redis real-time sync, full-text search support
- **Admin Dashboard**: User authentication, message search, data analytics, image management
- **Private Messaging**: User-to-user DM, AI DM, DingTalk DM integration
- **Message Export**: Export chat history in JSON/CSV format

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

### Mode A: Storage & Analytics (Recommended)

```
DingTalk Group ←→ OpenClaw (Direct Connection)
                      ↓ hook sync
                  chat-hub (Storage + Analytics)
                      ↓
                  chat-admin (Admin Dashboard)
```

**Features**:
- OpenClaw connects directly to DingTalk via plugin for fastest response
- chat-hub only handles message storage and analytics
- Suitable for users with existing OpenClaw DingTalk plugin configuration

### Mode B: Full Hub

```
DingTalk Group → chat-hub webhook → Storage + Redis Broadcast
                               ↓
                          OpenClaw Trigger
                               ↓
                          AI Reply → chat-hub → DingTalk Group
```

**Features**:
- All messages routed through chat-hub
- Supports multi-bot message synchronization
- Message filtering and rule processing at chat-hub level
- Suitable for scenarios requiring complete message control

### Mode C: Plugin Only

```
DingTalk Group ←→ OpenClaw (Direct Connection)
```

**Features**:
- Simplest, no chat-hub required
- Directly use OpenClaw DingTalk plugin
- No message storage or analytics
- Suitable for quick deployment, single bot scenarios

---

## 📦 Project Structure

```
openclaw-dindin-chart/
├── chat-hub/              # Core: Message routing service
│   ├── src/
│   │   ├── index.js       # Entry point
│   │   ├── server.js      # Express server
│   │   ├── dingtalk.js    # DingTalk Webhook sender
│   │   ├── message-store.js # SQLite message storage
│   │   └── bots/
│   │       └── openclaw-trigger.js  # OpenClaw trigger
│   ├── config/
│   │   ├── default.json   # Default config
│   │   └── local.json     # Local config (gitignored)
│   └── README.md
├── chat-web/              # Frontend: Chat interface
├── chat-admin-api/        # Backend: Admin API
├── chat-admin-ui/         # Backend: Admin UI
└── docs/
    ├── AI-ChatRoom-Tutorial.md  # Setup Tutorial
    ├── CHANGELOG.md      # Changelog
    └── images/           # Tutorial images
```

---

## 📡 API Endpoints

### API Versioning

The project supports API versioning. All endpoints are accessible via two paths:

```
/api/v1/*     # Versioned endpoints (recommended)
/api/*        # Legacy endpoints (backward compatible)
```

**Response Headers**:
```
X-API-Version: 1.0           # API version
X-Request-ID: xxx            # Request tracking ID
X-RateLimit-Limit: 100       # Rate limit ceiling
X-RateLimit-Remaining: 99    # Remaining requests
```

### Messages

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/messages` | GET | Get chat history (paginated) |
| `/api/v1/messages` | POST | Send a message |
| `/api/v1/messages/reply` | POST | Bot sends reply (syncs to DingTalk) |
| `/api/v1/messages/search` | GET | Search messages (keyword) |
| `/api/messages` | GET | Legacy: Get chat history |
| `/api/reply` | POST | Legacy: Bot sends reply |
| `/api/send` | POST | Legacy: Web user sends message |
| `/api/store` | POST | Legacy: Store message only |
| `/api/search` | GET | Legacy: Search messages |
| `/api/search/advanced` | GET | Advanced search (FTS5) |
| `/api/stats` | GET | Statistics |
| `/api/export` | GET | Export messages (JSON/CSV) |

### Conversations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/conversations` | GET | Get conversation list |
| `/api/v1/conversations` | POST | Create conversation (private/group) |
| `/api/sessions` | GET | Legacy: Get session list |
| `/api/sessions` | POST | Legacy: Create session |

### Private Messages

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/dm/conversations` | GET | Get DM conversation list |
| `/api/v1/dm/messages/:id` | GET | Get DM messages |
| `/api/v1/dm/send` | POST | Send DM message |
| `/api/v1/dm/read` | POST | Mark as read |
| `/api/dm/conversations` | GET | Legacy: Get DM conversations |
| `/api/dm/messages/:conversationId` | GET | Legacy: Get DM messages |
| `/api/dm/unread` | GET | Get unread count |

### User Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/refresh` | POST | Refresh token |
| `/api/v1/auth/me` | GET | Get current user info |
| `/api/auth/register` | POST | Legacy: User registration |
| `/api/auth/login` | POST | Legacy: User login |
| `/api/auth/logout` | POST | Legacy: User logout |

### Real-time Communication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sse/connect` | GET | SSE real-time connection |
| `/api/sse/online` | GET | Get online users |
| `/ws` | WebSocket | WebSocket connection |

### Webhook

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/dingtalk` | POST | DingTalk Outgoing callback |

### Examples

```bash
# Send reply (v1 endpoint)
curl -X POST http://localhost:3000/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!", "sender": "Maple"}'

# Search messages
curl "http://localhost:3000/api/v1/messages/search?q=keyword&limit=20"

# Export messages
curl "http://localhost:3000/api/export?format=json&days=7" -o messages.json

# Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your-refresh-token"}'

# Send DM
curl -X POST http://localhost:3000/api/v1/dm/send \
  -H "Content-Type: application/json" \
  -d '{"senderId": "user1", "receiverId": "user2", "content": "Private message"}'
```

---

## 🤖 Multi-AI Agent Integration

The project supports any AI agent (Trae, OpenCode, Claude, etc.) via unified API, **no adapter needed**.

### Integration Methods

| Method | Use Case | Complexity |
|--------|----------|------------|
| HTTP API | AI service with REST interface | ⭐ Simple |
| SSE Subscription | Real-time message stream | ⭐⭐ Medium |
| WebSocket | Bidirectional real-time | ⭐⭐ Medium |

### Integration Example

```javascript
// Any AI agent just calls the unified API
class AIConnector {
  constructor(name) {
    this.apiUrl = 'http://localhost:3000';
    this.name = name;
  }

  // Send group message
  async sendGroupMessage(content) {
    await fetch(`${this.apiUrl}/api/v1/messages/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sender: this.name })
    });
  }

  // Send private message
  async sendPrivateMessage(receiverId, content) {
    await fetch(`${this.apiUrl}/api/v1/dm/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: this.name,
        receiverId,
        content
      })
    });
  }

  // Subscribe to messages (real-time)
  subscribe(onMessage) {
    const es = new EventSource(`${this.apiUrl}/api/sse/connect?userId=${this.name}`);
    es.onmessage = (e) => onMessage(JSON.parse(e.data));
  }
}
```

### Multi-AI Collaboration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   chat-hub (Message Hub)                    │
│                  http://localhost:3000                      │
└────────────────────────────┬────────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   OpenClaw  │       │    Trae     │       │  OpenCode   │
│   (Maple)   │       │  (AI Bot)   │       │ (Code Bot)  │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ DingTalk Grp│
                      └─────────────┘
```

---

## 📝 Changelog

### v1.13.0 (2026-02-13) - API Architecture Compatibility 🔧
- ✨ API versioning mechanism (`/api/v1/*`)
- ✨ Token refresh mechanism (Access Token + Refresh Token)
- ✨ Token blacklist (logout invalidates token)
- ✨ API rate limiting middleware
- 🛡️ CORS security configuration optimization
- 📐 Unified DM API routes
- 🤖 Multi-AI agent integration support (no adapter needed)
- 📝 Enhanced response headers (X-API-Version, X-Request-ID, X-RateLimit-*)

### v1.12.0 (2026-02-12) - Maple Brand Upgrade 🍁
- ✨ Complete Maple brand visual system upgrade
- 🎨 Maple brand color palette (Maple Red, Autumn Gold, Nature Green)
- 📱 Complete mobile adaptation (320px - 768px)
- 🎭 Brand gradient effects and animation system
- 🍂 Maple leaf decorative elements and icons
- 📐 Unified design specifications and component library
- 🎯 Navigation menu optimization (moved to left)
- 💎 All pages brand-optimized (Login, Register, Profile, 404, etc.)

### v1.11.0 (2026-02-08)
- ✨ Advanced Search API
- ✨ Admin Dashboard - Image Management
- ✨ Message Export Feature (JSON/CSV)
- ✨ FTS5 Full-text Search Optimization
- ✨ Private Message API (DM API)
- ✨ User Authentication System
- 🚀 Performance Optimization
- 🐛 Fixed message sync and unread count issues

### v3.1 (2026-02-06)
- ✨ Smart conversation manager: topic termination, round limits, loop prevention
- ✨ Automated testing: API tests + E2E tests
- 📝 Enhanced documentation

### v3.0 (2026-02-05)
- ✨ Three operation modes support
- ✨ Admin dashboard system
- ✨ Comprehensive documentation

### v2.3 (2026-02-05)
- ✨ SQLite message persistence
- ✨ Message search and statistics API

---

## 🔗 Related Documents

### Project Standards (.sisyphus/)
- [Project Core Standards](./.sisyphus/AGENTS.md) - Coding + Collaboration Standards ⭐

### Guide Documents
- [Quick Start Guide](./.sisyphus/guides/quick-start.md) 🚀
- [Mode Switch Guide](./.sisyphus/guides/mode-guide.md)
- [DingTalk Plugin Config](./.sisyphus/guides/dingtalk-plugin.md)
- [New Bot Integration](./.sisyphus/guides/new-bot.md)
- [Multi-bot Configuration](./.sisyphus/guides/multi-bot.md)

### Design Documents
- [Brand Design Standards](./.sisyphus/design/brand.md) 🎨
- [Brand Upgrade Log](./.sisyphus/design/brand-changelog.md) 📋
- [Private Chat Design](./.sisyphus/design/private-chat.md)

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
