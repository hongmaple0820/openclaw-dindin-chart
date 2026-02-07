const ResilientRedisClient = require('./utils/resilient-redis');
const config = require('./config');
const Logger = require('./utils/logger');

const logger = new Logger('Redis');

class RedisClient {
  constructor() {
    // 使用弹性客户端
    this.resilientClient = new ResilientRedisClient({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxCacheSize: config.redis.maxCacheSize || 1000,
      healthCheckInterval: config.redis.healthCheckInterval || 30000,
    });

    this.isConnected = false;
    
    // 监听弹性客户端事件
    this.resilientClient.on('connected', () => {
      this.isConnected = true;
      logger.info('✅ Redis 弹性客户端已连接');
    });

    this.resilientClient.on('degraded', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis 进入降级模式（仅使用本地缓存）');
    });

    this.resilientClient.on('recovered', () => {
      this.isConnected = true;
      logger.info('✅ Redis 已从降级模式恢复');
    });

    this.resilientClient.on('error', ({ name, error }) => {
      logger.error(`Redis ${name} 错误`, error);
    });

    // 启动连接
    this.resilientClient.connect().catch(err => {
      logger.error('Redis 连接失败', err);
    });
  }

  /**
   * 检查连接状态
   */
  async checkConnection() {
    const status = this.resilientClient.getStatus();
    return status.connected && !status.degraded;
  }

  /**
   * 发布消息到指定频道
   */
  async publish(channel, message) {
    try {
      const payload = JSON.stringify(message);
      const success = await this.resilientClient.publish(channel, payload);
      
      if (success) {
        logger.debug(`发布到 ${channel}`, {
          sender: message.sender,
          preview: message.content?.substring(0, 50)
        });
      }
      
      return success;
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
      await this.resilientClient.subscribe(channel, (payload) => {
        try {
          const message = JSON.parse(payload);
          handler(message);
        } catch (e) {
          logger.error('消息解析失败', e);
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
      const exists = await this.resilientClient.get(key);
      if (exists) {
        logger.debug('重复消息，跳过', { msgId });
        return true;
      }
      await this.resilientClient.set(key, '1', config.dedup.ttlSeconds || 300);
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

      // 弹性客户端不直接支持 lpush/ltrim，使用原始客户端
      if (this.resilientClient.client) {
        await this.resilientClient.client.lpush(key, JSON.stringify(message));
        await this.resilientClient.client.ltrim(key, 0, maxSize - 1);
      }
      
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
      
      // 弹性客户端不直接支持 lrange，使用原始客户端
      if (this.resilientClient.client) {
        const items = await this.resilientClient.client.lrange(key, 0, limit - 1);
        return items.map(item => JSON.parse(item)).reverse();
      }
      
      return [];
    } catch (error) {
      logger.error('获取上下文失败', error);
      return [];
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return this.resilientClient.getStatus();
  }

  async close() {
    logger.info('关闭 Redis 连接...');
    await this.resilientClient.disconnect();
    this.isConnected = false;
  }
}

module.exports = new RedisClient();
