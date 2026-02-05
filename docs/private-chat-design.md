# AI 聊天室私聊功能设计

> 需求：支持用户之间的私聊，聊天记录要保存

## 📋 功能需求

1. **用户私聊**：用户之间可以 1v1 私聊
2. **AI 私聊**：用户可以和 AI 单独对话
3. **钉钉私聊**：钉钉私聊消息也要存储
4. **历史记录**：所有私聊记录都要保存和检索

## 🏗️ 技术设计

### 1. 数据库设计

新增 `private_messages` 表：

```sql
CREATE TABLE private_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,     -- 会话 ID（两人唯一）
  sender_id TEXT NOT NULL,           -- 发送者 ID
  sender_name TEXT NOT NULL,         -- 发送者名称
  receiver_id TEXT NOT NULL,         -- 接收者 ID
  receiver_name TEXT NOT NULL,       -- 接收者名称
  content TEXT NOT NULL,             -- 消息内容
  message_type TEXT DEFAULT 'text',  -- text/image/file
  source TEXT DEFAULT 'web',         -- web/dingtalk/api
  read_at INTEGER,                   -- 已读时间
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_pm_conversation ON private_messages(conversation_id);
CREATE INDEX idx_pm_sender ON private_messages(sender_id);
CREATE INDEX idx_pm_receiver ON private_messages(receiver_id);
CREATE INDEX idx_pm_created ON private_messages(created_at);
```

会话 ID 生成规则：`conversation_id = sort([user1_id, user2_id]).join('_')`

### 2. API 设计

```
POST   /api/dm/send              发送私信
GET    /api/dm/conversations     获取会话列表
GET    /api/dm/messages/:id      获取会话消息
POST   /api/dm/read/:id          标记已读
DELETE /api/dm/message/:id       删除消息
```

### 3. 钉钉私聊集成

在 chat-hub 中添加钉钉私聊存储：

```javascript
// 判断是否是私聊
function isDM(message) {
  return message.conversationType === '1' || 
         message.chatType === 'singleChat';
}

// 存储私聊消息
async function storeDM(message) {
  const dm = {
    sender_id: message.senderId,
    sender_name: message.senderNick,
    receiver_id: message.robotCode, // 或对方 ID
    receiver_name: '小琳',
    content: message.text?.content || '',
    source: 'dingtalk'
  };
  await db.run('INSERT INTO private_messages ...', dm);
}
```

### 4. 前端页面

新增页面：
- `/dm` - 私信列表页
- `/dm/:conversationId` - 私信对话页

组件：
- `ConversationList.vue` - 会话列表
- `DMChat.vue` - 私聊窗口
- `MessageItem.vue` - 复用现有组件

### 5. 实时通知

使用 WebSocket 推送新私信：

```javascript
// 服务端
io.to(receiverId).emit('new_dm', message);

// 客户端
socket.on('new_dm', (message) => {
  // 显示通知
  showNotification(message);
});
```

## 📝 实现步骤

### Phase 1: 基础私聊
- [ ] 创建 private_messages 表
- [ ] 实现 PrivateMessageModel
- [ ] 实现私信 API
- [ ] 前端私信页面

### Phase 2: 钉钉私聊
- [ ] chat-hub 识别钉钉私聊
- [ ] 存储钉钉私聊记录
- [ ] 钉钉私聊历史查询

### Phase 3: 实时通知
- [ ] WebSocket 集成
- [ ] 新消息推送
- [ ] 未读数角标

### Phase 4: AI 私聊
- [ ] AI 私聊会话管理
- [ ] 上下文记忆
- [ ] 与 OpenClaw 集成

## 🔗 相关文件

- `chat-admin-api/src/models/private-message.js`
- `chat-admin-api/src/routes/dm.js`
- `chat-web/src/views/DM.vue`
- `chat-hub/src/dm-handler.js`

---

*创建日期：2026-02-06*
