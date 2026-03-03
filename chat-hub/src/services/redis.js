/**
 * Redis 服务 - 用于私聊消息通知
 * @author 小琳
 * @date 2026-02-06
 */
const Redis = require('ioredis');

// 从环境变量读取配置
const config = {
  host: process.env.REDIS_HOST || '47.96.248.176',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || 'maple168',
  lazyConnect: true
};

// 发布者连接
let publisher = null;

/**
 * 获取 Redis 发布者实例
 */
function getPublisher() {
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
 * @param {Object} message - 消息对象
 */
async function notifyNewDM(message) {
  try {
    const redis = getPublisher();
    const notification = {
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
    console.error('[Redis] 发送私信通知失败:', error.message);
  }
}

/**
 * 关闭 Redis 连接
 */
async function close() {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

module.exports = {
  getPublisher,
  notifyNewDM,
  close
};
