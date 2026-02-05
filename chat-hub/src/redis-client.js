const Redis = require('ioredis');
const config = require('./config');

class RedisClient {
  constructor() {
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.client = new Redis(redisConfig); // 用于普通操作

    this.publisher.on('connect', () => console.log('[Redis] 发布者已连接'));
    this.subscriber.on('connect', () => console.log('[Redis] 订阅者已连接'));
    this.client.on('connect', () => console.log('[Redis] 客户端已连接'));
    
    this.publisher.on('error', (err) => console.error('[Redis] 发布者错误:', err.message));
    this.subscriber.on('error', (err) => console.error('[Redis] 订阅者错误:', err.message));
    this.client.on('error', (err) => console.error('[Redis] 客户端错误:', err.message));
  }

  /**
   * 发布消息到指定频道
   */
  async publish(channel, message) {
    const payload = JSON.stringify(message);
    await this.publisher.publish(channel, payload);
    console.log(`[Redis] 发布到 ${channel}:`, message.sender, '->', message.content?.substring(0, 50));
  }

  /**
   * 订阅频道并处理消息
   */
  async subscribe(channel, handler) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, payload) => {
      if (ch === channel) {
        try {
          const message = JSON.parse(payload);
          handler(message);
        } catch (e) {
          console.error('[Redis] 消息解析失败:', e);
        }
      }
    });
    console.log(`[Redis] 已订阅频道: ${channel}`);
  }

  /**
   * 消息去重检查
   * @returns {boolean} true = 重复消息，应跳过
   */
  async isDuplicate(msgId) {
    if (!config.dedup?.enabled) return false;
    
    const key = `dedup:${msgId}`;
    const exists = await this.client.get(key);
    if (exists) {
      console.log(`[Redis] 重复消息，跳过: ${msgId}`);
      return true;
    }
    await this.client.set(key, '1', 'EX', config.dedup.ttlSeconds || 300);
    return false;
  }

  /**
   * 存储上下文消息
   */
  async addToContext(message) {
    const key = 'chat:context';
    const maxSize = config.bots?.contextSize || 10;
    
    await this.client.lpush(key, JSON.stringify(message));
    await this.client.ltrim(key, 0, maxSize - 1);
  }

  /**
   * 获取上下文消息
   */
  async getContext(limit = 10) {
    const key = 'chat:context';
    const items = await this.client.lrange(key, 0, limit - 1);
    return items.map(item => JSON.parse(item)).reverse();
  }

  async close() {
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.client.quit();
  }
}

module.exports = new RedisClient();
