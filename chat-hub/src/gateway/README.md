# Gateway 多平台支持

## 概述

Gateway 网关层已扩展支持企业微信 (WeCom) 和飞书 (Feishu) 平台，与现有的钉钉 (DingTalk) 平台形成统一的多平台消息收发能力。

## 文件结构

```
src/gateway/
├── index.ts                  # 主入口，类型定义，Gateway 类，MessageRouter 类
├── dingtalk-connection.ts    # 钉钉连接实现
├── wecom-connection.ts       # 企业微信连接实现 (新增)
├── feishu-connection.ts      # 飞书连接实现 (新增)
└── message-converter.ts      # 消息格式转换工具 (新增)
```

## 支持平台

### 1. 钉钉 (DingTalk)

- **Webhook**: 支持 Webhook 发送消息
- **消息类型**: text, markdown, image
- **安全**: HMAC-SHA256 签名
- **特性**: @ 手机号提及

### 2. 企业微信 (WeCom)

- **Webhook**: 支持 Webhook 发送消息
- **消息类型**: text, markdown, image, news
- **安全**: HMAC-SHA256 签名
- **回调**: 支持回调消息接收，AES-256-CBC 解密
- **特性**: @ 用户ID 和手机号提及

### 3. 飞书 (Feishu)

- **Webhook**: 支持 Webhook 发送消息
- **API**: 支持通过 API 发送消息 (需要 appId/appSecret)
- **消息类型**: text, post (富文本), interactive (卡片), image
- **安全**: HMAC-SHA256 签名
- **事件订阅**: 支持事件订阅消息接收
- **特性**: 富文本、交互式卡片

## 统一消息格式

```typescript
interface UnifiedMessage {
  id: string;                    // 消息ID
  platform: Platform;            // 平台: dingtalk | wecom | feishu | slack | discord | webchat
  direction: MessageDirection;   // 方向: inbound | outbound
  type: MessageType;             // 类型: text | image | file | audio | video | markdown | action
  content: string;               // 内容
  sender: MessageSender;         // 发送者
  recipient: MessageRecipient;   // 接收者
  replyTo?: string;              // 回复消息ID
  metadata?: Record<string, unknown>;  // 元数据
  timestamp: number;             // 时间戳
}
```

## 使用示例

### 创建 Gateway

```typescript
import { Gateway, WeComConnection, FeishuConnection } from './gateway';

const gateway = new Gateway({
  connections: [],
  messageQueue: { enabled: true, maxSize: 100 },
  rateLimit: { enabled: true, maxPerMinute: 60 }
});

// 创建并注册连接
const wecomConfig = {
  platform: 'wecom' as const,
  enabled: true,
  credentials: {
    webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
    secret: 'your-secret'
  },
  options: {
    groups: {
      'dev-team': {
        webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        secret: 'your-secret'
      }
    }
  }
};

const feishuConfig = {
  platform: 'feishu' as const,
  enabled: true,
  credentials: {
    webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
    secret: 'your-secret',
    appId: 'cli_xxx',
    appSecret: 'xxx'
  },
  options: {
    groups: {
      'alerts': {
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
      }
    }
  }
};

gateway.createAndRegisterConnection(wecomConfig);
gateway.createAndRegisterConnection(feishuConfig);

await gateway.start();
```

### 发送消息

```typescript
const message = {
  id: 'msg_001',
  platform: 'wecom' as const,
  direction: 'outbound' as const,
  type: 'markdown' as const,
  content: '# Alert\n\n**CPU Usage**: 95%',
  sender: { id: 'system', name: 'System', type: 'system' as const },
  recipient: { id: 'dev-team', type: 'group' as const },
  timestamp: Date.now()
};

await gateway.send(message);
```

### 接收消息

```typescript
// 通过回调接收
gateway.on('message:received', (message) => {
  console.log('收到消息:', message);
});

// 或直接调用连接的 receiveMessage 方法
const wecomConn = gateway.getConnection('wecom');
wecomConn.receiveMessage({
  senderId: 'user123',
  senderName: '张三',
  groupId: 'dev-team',
  groupName: '开发团队',
  content: 'Hello!',
  msgtype: 'text'
});
```

### 消息格式转换

```typescript
import { convertMessage, PLATFORM_FEATURES } from './gateway';

// 查看平台特性
const features = PLATFORM_FEATURES['feishu'];
console.log('飞书支持 Markdown:', features.supportsMarkdown);
console.log('飞书最大文本长度:', features.maxTextLength);

// 转换消息格式
const dingtalkMessage = {
  // ... 钉钉消息
};

const converted = convertMessage(dingtalkMessage, 'feishu');
console.log('转换后的消息:', converted);
```

## API 文档

### WeComConnection

| 方法 | 说明 |
|------|------|
| `connect()` | 连接（Webhook 无需持久连接） |
| `disconnect()` | 断开连接 |
| `send(message)` | 发送消息 |
| `receiveMessage(rawMessage)` | 接收消息 |
| `handleCallback(data)` | 处理企业微信回调 |
| `verifyCallback(token, key, sig, ts, nonce)` | 验证回调签名 (静态方法) |
| `decryptMessage(key, encrypted)` | 解密回调消息 (静态方法) |

### FeishuConnection

| 方法 | 说明 |
|------|------|
| `connect()` | 连接（自动获取 access token） |
| `disconnect()` | 断开连接 |
| `send(message)` | 发送消息 (Webhook) |
| `sendViaAPI(chatId, message)` | 发送消息 (API) |
| `receiveMessage(rawMessage)` | 接收消息 |
| `handleEventSubscription(event)` | 处理事件订阅 |
| `verifyEventSignature(key, sig, ts, nonce, body)` | 验证事件签名 (静态方法) |
| `decryptEvent(key, encrypted)` | 解密事件消息 (静态方法) |
| `createCard(options)` | 创建交互式卡片 (静态方法) |

### MessageConverter

| 方法 | 说明 |
|------|------|
| `convert(message, options)` | 转换消息格式 |
| `markdownToText(markdown)` | Markdown 转纯文本 |
| `getPlatformFeatures(platform)` | 获取平台特性 |
| `needsConversion(message, platform)` | 检查是否需要转换 |
| `validateMessage(message, platform)` | 验证消息格式 |

## 安全机制

### 签名验证

所有平台都支持签名验证，确保消息来源可信：

- **钉钉/企业微信**: `timestamp + secret` -> HMAC-SHA256 -> Base64
- **飞书**: `timestamp + secret` -> HMAC-SHA256 -> Base64

### 回调加密

- **企业微信**: AES-256-CBC 加密回调消息
- **飞书**: AES-256-CBC 加密事件订阅消息

## 平台特性对比

| 特性 | 钉钉 | 企业微信 | 飞书 |
|------|------|----------|------|
| Webhook | ✅ | ✅ | ✅ |
| API 发送 | ❌ | ❌ | ✅ |
| Markdown | ✅ | ✅ | ❌ (富文本) |
| 富文本 | ❌ | ❌ | ✅ |
| 交互式卡片 | ✅ | ✅ | ✅ |
| @ 提及 | 手机号 | 用户ID/手机号 | 用户ID |
| 最大文本 | 20000 | 4096 | 30000 |
| 事件订阅 | ❌ | ✅ | ✅ |

## 后续扩展

1. **Slack 支持**: 添加 SlackConnection 类
2. **Discord 支持**: 添加 DiscordConnection 类
3. **WebSocket 支持**: 实时消息推送
4. **消息存储**: 持久化消息记录
5. **消息队列**: 集成 Redis 或 RabbitMQ

## 更新日期

2026-03-06