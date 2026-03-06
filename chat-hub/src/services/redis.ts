/**
 * Redis 服务 - 用于私聊消息通知
 * @author 小琳
 * @date 2026-02-06
 */
import Redis from 'ioredis';

// ==================== 类型定义 ====================

interface RedisConfig {
  host: string;
  port: number;
  password: string;
  lazyConnect: boolean;
}

interface DMMessage {
  id: string;
  receiverId: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  content?: string;
}

interface Notification {
  type: 'new_dm';
  receiverId: string;
  senderId: string;
  senderName: string;
  messageId: string;
  conversationId: string;
  preview: string;
  timestamp: number;
}

// ==================== 配置 ====================

// 从环境变量读取配置
const config: RedisConfig = {
  host: process.env.REDIS_HOST || '47.96.248.176',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'maple168',
  lazyConnect: true
};

// 发布者连接
let publisher: Redis | null = null;

/**
 * 获取 Redis 发布者实例
 */
function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(config);
    publisher.on('connect', () => {
      console.log('[Redis] 私信通知发布者已连接');
    });
    publisher.on('error', (err) => {
      console.error('[Redis] 发布者错误:', err.message);
    });
  }
  return publisher;
}

/**
 * 发送私信通知
 * @param message - 消息对象
 */
async function notifyNewDM(message: DMMessage): Promise<void> {
  try {
    const redis = getPublisher();
    const notification: Notification = {
      type: 'new_dm',
      receiverId: message.receiverId,
      senderId: message.senderId,
      senderName: message.senderName,
      messageId: message.id,
      conversationId: message.conversationId,
      preview: (message.content || '').substring(0, 50),
      timestamp: Date.now()
    };
    
    await redis.publish('dm:notification', JSON.stringify(notification));
    console.log('[Redis] 已发送私信通知:', notification.receiverId);
  } catch (error) {
    console.error('[Redis] 发送私信通知失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 关闭 Redis 连接
 */
async function close(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

export { getPublisher, notifyNewDM, close };
export type { DMMessage, Notification, RedisConfig };