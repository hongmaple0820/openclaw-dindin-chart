# API 接口文档

## 概述

chat-hub 提供 RESTful API，用于消息的存储、发送、查询和同步。

基础 URL：`http://localhost:3000`

## 认证

当前版本无认证要求。生产环境建议添加认证机制。

---

## 消息相关 API

### POST /api/store

**仅存储消息，不发送到钉钉**

用于 OpenClaw 转存从其他渠道收到的消息。

**请求体：**

```json
{
  "sender": "发送者名字",
  "content": "消息内容",
  "source": "dingtalk",    // 可选，默认 "openclaw"
  "timestamp": 1234567890  // 可选，默认当前时间戳（毫秒）
}
```

**响应：**

```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "type": "human",
    "sender": "发送者名字",
    "content": "消息内容",
    "timestamp": 1234567890,
    "source": "dingtalk",
    "replyTo": null
  }
}
```

---

### POST /api/reply

**机器人发送回复（会发送到钉钉群）**

```json
{
  "content": "回复内容",
  "sender": "小琳",
  "atTargets": ["@某人"]  // 可选，@ 某人
}
```

**响应：**

```json
{
  "success": true,
  "message": { ... }
}
```

---

### POST /api/send

**Web 前端发送消息（会发送到钉钉群）**

```json
{
  "content": "消息内容",
  "sender": "WebUser"
}
```

---

### GET /api/context

**获取最近消息列表**

**参数：**
- `limit`：返回条数，默认 50

**响应：**

```json
{
  "success": true,
  "context": [
    {
      "id": "uuid",
      "type": "human|bot",
      "sender": "发送者",
      "content": "内容",
      "timestamp": 1234567890,
      "source": "dingtalk|web|bot|redis"
    }
  ]
}
```

---

### GET /api/search

**搜索消息**

**参数：**
- `q`：搜索关键词（必填）
- `limit`：返回条数，默认 50

**响应：**

```json
{
  "success": true,
  "count": 5,
  "messages": [ ... ]
}
```

---

### GET /api/stats

**获取统计信息**

**响应：**

```json
{
  "success": true,
  "stats": {
    "total": 100,
    "today": 20,
    "bySender": [
      { "sender": "小琳", "count": 50 },
      { "sender": "小猪", "count": 30 },
      { "sender": "鸿枫", "count": 20 }
    ]
  }
}
```

---

### DELETE /api/message/:messageId

**删除指定消息**

**响应：**

```json
{
  "success": true
}
```

---

## 同步相关 API

### GET /api/sync/:participantId

**获取参与者未同步的消息**

用于离线后重新上线时获取错过的消息。

**响应：**

```json
{
  "success": true,
  "count": 5,
  "messages": [ ... ]
}
```

---

### POST /api/sync/:participantId

**标记同步完成**

**请求体：**

```json
{
  "timestamp": 1234567890  // 可选，默认当前时间
}
```

---

### GET /api/sync-status

**获取所有参与者的同步状态**

---

## Webhook 回调

### POST /webhook/dingtalk

**接收钉钉 Outgoing 消息**

钉钉会自动发送 POST 请求到此地址。

---

## 健康检查

### GET /health

**服务健康检查**

**响应：**

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "messageCount": 100,
  "todayCount": 20,
  "config": {
    "bot": "小琳",
    "storeDir": "/home/user/.openclaw/chat-data",
    "dbPath": "/home/user/.openclaw/chat-data/messages.db"
  }
}
```

---

## 错误响应

所有 API 在出错时返回：

```json
{
  "success": false,
  "error": "错误描述"
}
```

HTTP 状态码：
- `400`：请求参数错误
- `404`：资源不存在
- `500`：服务器内部错误
