const Redis = require('ioredis');
const config = require('../config/default.json');

class RedisClient {
  constructor() {
    this.publisher = new Redis(config.redis);
    this.subscriber = new Redis(config.redis);

    this.publisher.on('connect', () => console.log('[Redis] 发布者已连接'));
    this.subscriber.on('connect', () => console.log('[Redis] 订阅者已连接'));
    this.publisher.on('error', (err) => console.error('[Redis] 发布者错误:', err));
    this.subscriber.on('error', (err) => console.error('[Redis] 订阅者错误:', err));
  }

  /**
   * 发布消息到指定频道
   * @param {string} channel - 频道名
   * @param {object} message - 消息对象
   */
  async publish(channel, message) {
    const payload = JSON.stringify(message);
    await this.publisher.publish(channel, payload);
    console.log(`[Redis] 发布到 ${channel}:`, message.sender, '->', message.content?.substring(0, 50));
  }

  /**
   * 订阅频道并处理消息
   * @param {string} channel - 频道名
   * @param {function} handler - 消息处理函数
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

  async close() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

module.exports = new RedisClient();
