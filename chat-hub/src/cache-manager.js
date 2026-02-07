/**
 * 缓存管理器
 * 提供 Redis 缓存和内存缓存双层机制
 */

const redisClient = require('./redis-client');

class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // 内存缓存（降级方案）
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存
   * @param {string} key 缓存键
   * @returns {Promise<any>} 缓存值
   */
  async get(key) {
    try {
      // 先尝试 Redis
      const redisValue = await redisClient.get(key);
      if (redisValue) {
        this.stats.hits++;
        return JSON.parse(redisValue);
      }

      // Redis 未命中，尝试内存缓存
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (cached.expireAt > Date.now()) {
          this.stats.hits++;
          return cached.value;
        } else {
          this.memoryCache.delete(key);
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('[Cache] 获取失败:', error.message);
      // 降级到内存缓存
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (cached.expireAt > Date.now()) {
          return cached.value;
        }
      }
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {any} value 缓存值
   * @param {number} ttl 过期时间（秒）
   */
  async set(key, value, ttl = 60) {
    try {
      const jsonValue = JSON.stringify(value);

      // 写入 Redis
      await redisClient.setex(key, ttl, jsonValue);

      // 同时写入内存缓存（双保险）
      this.memoryCache.set(key, {
        value,
        expireAt: Date.now() + ttl * 1000
      });

      // 定时清理过期内存缓存
      this.scheduleCleanup();
    } catch (error) {
      console.error('[Cache] 设置失败:', error.message);
      // 降级：只写内存
      this.memoryCache.set(key, {
        value,
        expireAt: Date.now() + ttl * 1000
      });
    }
  }

  /**
   * 删除缓存
   * @param {string} key 缓存键
   */
  async delete(key) {
    try {
      await redisClient.del(key);
      this.memoryCache.delete(key);
    } catch (error) {
      console.error('[Cache] 删除失败:', error.message);
      this.memoryCache.delete(key);
    }
  }

  /**
   * 批量删除缓存（支持通配符）
   * @param {string} pattern 模式（如 chat:messages:*）
   */
  async deletePattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }

      // 清理内存缓存
      for (const key of this.memoryCache.keys()) {
        if (this.matchPattern(key, pattern)) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error('[Cache] 批量删除失败:', error.message);
    }
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    try {
      await redisClient.flushdb();
      this.memoryCache.clear();
      console.log('[Cache] 已清空所有缓存');
    } catch (error) {
      console.error('[Cache] 清空失败:', error.message);
      this.memoryCache.clear();
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 定时清理过期的内存缓存
   */
  scheduleCleanup() {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, cached] of this.memoryCache.entries()) {
        if (cached.expireAt <= now) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cache] 清理了 ${cleaned} 个过期缓存`);
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 匹配模式（简单版）
   */
  matchPattern(str, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(str);
  }

  /**
   * 停止定时器
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// 单例
const cacheManager = new CacheManager();

module.exports = cacheManager;
