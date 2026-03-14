# MapleClaw 快速测试清单

**测试时间**: 2026-03-13 17:16

---

## 一、服务检查

```bash
# 1. 检查后端
curl http://localhost:8273/api/observability/health

# 2. 检查前端
curl http://localhost:5273
```

---

## 二、用户流程测试

### 1. 注册新用户

```bash
curl -X POST http://localhost:8273/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser2", "password": "test123456", "nickname": "测试用户2"}'
```

### 2. 管理员审核

```bash
# 查看待审核用户
curl http://localhost:8273/api/admin/users/pending \
  -H "x-admin-token: admin123"

# 审核通过（替换 USER_ID）
curl -X POST http://localhost:8273/api/admin/users/USER_ID/approve \
  -H "x-admin-token: admin123"
```

### 3. 登录

```bash
curl -X POST http://localhost:8273/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

---

## 三、好友系统测试

```bash
# 设置 TOKEN
TOKEN="你的accessToken"

# 搜索用户
curl "http://localhost:8273/api/friends/search?q=test" \
  -H "Authorization: Bearer $TOKEN"

# 发送好友申请（替换 USER_ID）
curl -X POST http://localhost:8273/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toUserId": "USER_ID", "message": "交个朋友吧"}'

# 查看好友申请
curl http://localhost:8273/api/friends/requests \
  -H "Authorization: Bearer $TOKEN"

# 接受申请（替换 REQUEST_ID）
curl -X PUT http://localhost:8273/api/friends/requests/REQUEST_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "accept"}'

# 查看好友列表
curl http://localhost:8273/api/friends \
  -H "Authorization: Bearer $TOKEN"
```

---

## 四、消息系统测试

```bash
# 查看消息列表
curl "http://localhost:8273/api/v1/messages?limit=10"

# 发送消息
curl -X POST http://localhost:8273/api/v1/messages/reply \
  -H "Content-Type: application/json" \
  -d '{"content": "测试消息", "sender": "测试用户"}'

# 搜索消息
curl "http://localhost:8273/api/v1/messages/search?q=%E6%B5%8B%E8%AF%95"
```

---

## 五、Agent 系统测试

```bash
# 查看 Agent 列表
curl http://localhost:8273/api/agents

# 查看公开 Agent
curl "http://localhost:8273/api/agents?isPublic=true"

# 创建 Agent
curl -X POST http://localhost:8273/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "测试助手",
    "description": "用于测试的Agent",
    "model": "gpt-3.5-turbo",
    "isPublic": true
  }'
```

---

## 六、WebSocket 测试

```bash
# 使用 wscat 或在线工具测试
# 连接: ws://localhost:8273/ws
# 发送: {"type": "ping"}
# 期望: {"type": "pong", "timestamp": ...}
```

---

## 七、前端测试

打开浏览器访问: **http://localhost:5273**

### 测试流程

1. **登录页面**
   - 输入 admin / admin123
   - 点击登录

2. **主页**
   - 查看消息列表
   - 发送测试消息

3. **好友页面**
   - 搜索用户
   - 发送好友申请

4. **Agent 页面**
   - 查看 Agent 列表
   - 创建新 Agent

---

## 八、常见问题

| 问题 | 解决方案 |
|------|----------|
| 服务未运行 | `cd chat-hub && npm start` |
| 前端未运行 | `cd chat-web && npm run dev` |
| Token 过期 | 重新登录获取新 Token |
| Agent 无法对话 | 需配置 API Key |

---

**祝测试顺利！** 🚀