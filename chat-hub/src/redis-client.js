const Redis = require('ioredis');
const config = require('./config');
const Logger = require('./utils/logger');

const logger = new Logger('Redis');

class RedisClient {
  constructor() {
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;

    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      retryStrategy: (times) => {
        if (times > this.maxReconnectAttempts) {
          logger.error(`Redis 重连失败，已尝试 ${times} 次`);
          return null; // 停止重连
        }
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis 重连中... (${times}/${this.maxReconnectAttempts})`, { delay });
        return delay;
      },
      reconnectOnError: (err) => {
        logger.error('Redis 连接错误，尝试重连', err);
        return true;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    };

    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.client = new Redis(redisConfig);

    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    // Publisher 事件
    this.publisher.on('connect', () => {
      logger.info('发布者已连接');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });
    this.publisher.on('ready', () => logger.info('发布者就绪'));
    this.publisher.on('error', (err) => logger.error('发布者错误', err));
    this.publisher.on('close', () => {
      logger.warn('发布者连接关闭');
      this.isConnected = false;
    });
    this.publisher.on('reconnecting', () => {
      this.reconnectAttempts++;
      logger.info(`发布者重连中... (${this.reconnectAttempts})`);
    });

    // Subscriber 事件
    this.subscriber.on('connect', () => logger.info('订阅者已连接'));
    this.subscriber.on('ready', () => logger.info('订阅者就绪'));
    this.subscriber.on('error', (err) => logger.error('订阅者错误', err));
    this.subscriber.on('close', () => logger.warn('订阅者连接关闭'));
    this.subscriber.on('reconnecting', () => logger.info('订阅者重连中...'));

    // Client 事件
    this.client.on('connect', () => logger.info('客户端已连接'));
    this.client.on('ready', () => logger.info('客户端就绪'));
    this.client.on('error', (err) => logger.error('客户端错误', err));
    this.client.on('close', () => logger.warn('客户端连接关闭'));
    this.client.on('reconnecting', () => logger.info('客户端重连中...'));
  }

  /**
   * 检查连接状态
   */
  async checkConnection() {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis 连接检查失败', error);
      return false;
    }
  }

  /**
   * 发布消息到指定频道
   */
  async publish(channel, message) {
    try {
      if (!this.isConnected) {
        logger.warn('Redis 未连接，跳过发布');
        return false;
      }

      const payload = JSON.stringify(message);
      await this.publisher.publish(channel, payload);
      logger.debug(`发布到 ${channel}`, {
        sender: message.sender,
        preview: message.content?.substring(0, 50)
      });
      return true;
    } catch (error) {
      logger.error('发布消息失败', error);
      return false;
    }
  }

  /**
   * 订阅频道并处理消息
   */
  async subscribe(channel, handler) {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, payload) => {
        if (ch === channel) {
          try {
            const message = JSON.parse(payload);
            handler(message);
          } catch (e) {
            logger.error('消息解析失败', e);
          }
        }
      });
      logger.info(`已订阅频道: ${channel}`);
    } catch (error) {
      logger.error(`订阅频道失败: ${channel}`, error);
      throw error;
    }
  }

  /**
   * 消息去重检查
   * @returns {boolean} true = 重复消息，应跳过
   */
  async isDuplicate(msgId) {
    try {
      if (!config.dedup?.enabled) return false;
      if (!this.isConnected) return false;

      const key = `dedup:${msgId}`;
      const exists = await this.client.get(key);
      if (exists) {
        logger.debug('重复消息，跳过', { msgId });
        return true;
      }
      await this.client.set(key, '1', 'EX', config.dedup.ttlSeconds || 300);
      return false;
    } catch (error) {
      logger.error('去重检查失败', error);
      return false; // 失败时不阻止消息
    }
  }

  /**
   * 存储上下文消息
   */
  async addToContext(message) {
    try {
      if (!this.isConnected) return false;

      const key = 'chat:context';
      const maxSize = config.bots?.contextSize || 10;

      await this.client.lpush(key, JSON.stringify(message));
      await this.client.ltrim(key, 0, maxSize - 1);
      return true;
    } catch (error) {
      logger.error('存储上下文失败', error);
      return false;
    }
  }

  /**
   * 获取上下文消息
   */
  async getContext(limit = 10) {
    try {
      if (!this.isConnected) return [];

      const key = 'chat:context';
      const items = await this.client.lrange(key, 0, limit - 1);
      return items.map(item => JSON.parse(item)).reverse();
    } catch (error) {
      logger.error('获取上下文失败', error);
      return [];
    }
  }

  async close() {
    logger.info('关闭 Redis 连接...');
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.client.quit();
    this.isConnected = false;
  }
}

module.exports = new RedisClient();
