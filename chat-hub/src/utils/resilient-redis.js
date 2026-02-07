const Redis = require('ioredis');
const EventEmitter = require('events');

/**
 * Redis 弹性客户端
 * 功能：
 * - 自动重连
 * - 降级模式（Redis 不可用时）
 * - 本地缓存
 * - 健康检查
 */
class ResilientRedisClient extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || null,
      db: config.db || 0,
      retryStrategy: (times) => {
        // 重连延迟：1s, 2s, 4s, 8s, 16s, 最多 30s
        const delay = Math.min(times * 1000, 30000);
        console.log(`[Redis] 重连中... (${times}次，${delay}ms后重试)`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: true, // 手动连接
    };
    
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    
    this.isConnected = false;
    this.isDegraded = false; // 降级模式
    this.cache = new Map(); // 本地缓存
    this.offlineQueue = []; // 离线队列
    
    this.maxCacheSize = config.maxCacheSize || 1000;
    this.healthCheckInterval = config.healthCheckInterval || 30000; // 30s
  }

  /**
   * 连接 Redis
   */
  async connect() {
    try {
      // 创建客户端
      this.client = new Redis(this.config);
      this.subscriber = new Redis(this.config);
      this.publisher = new Redis(this.config);

      // 事件监听
      this.setupEventHandlers(this.client, 'client');
      this.setupEventHandlers(this.subscriber, 'subscriber');
      this.setupEventHandlers(this.publisher, 'publisher');

      // 连接
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      this.isConnected = true;
      this.isDegraded = false;
      
      console.log('[Redis] ✅ 弹性客户端已连接');
      this.emit('connected');

      // 启动健康检查
      this.startHealthCheck();

      // 处理离线队列
      await this.flushOfflineQueue();

    } catch (error) {
      console.error('[Redis] ❌ 连接失败:', error.message);
      this.enterDegradedMode();
    }
  }

  /**
   * 设置事件处理
   */
  setupEventHandlers(client, name) {
    client.on('connect', () => {
      console.log(`[Redis] ${name} 已连接`);
    });

    client.on('ready', () => {
      console.log(`[Redis] ${name} 就绪`);
      this.isConnected = true;
      this.isDegraded = false;
      this.emit('ready', name);
    });

    client.on('error', (error) => {
      console.error(`[Redis] ${name} 错误:`, error.message);
      this.emit('error', { name, error });
    });

    client.on('close', () => {
      console.log(`[Redis] ${name} 连接关闭`);
      this.isConnected = false;
    });

    client.on('reconnecting', (ms) => {
      console.log(`[Redis] ${name} 重连中... (${ms}ms)`);
    });

    client.on('end', () => {
      console.log(`[Redis] ${name} 连接终止`);
      this.isConnected = false;
    });
  }

  /**
   * 进入降级模式
   */
  enterDegradedMode() {
    this.isDegraded = true;
    this.isConnected = false;
    console.warn('[Redis] ⚠️ 进入降级模式（仅使用本地缓存）');
    this.emit('degraded');
  }

  /**
   * 健康检查
   */
  startHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        if (!this.client) return;
        
        const start = Date.now();
        await this.client.ping();
        const latency = Date.now() - start;
        
        if (latency > 1000) {
          console.warn(`[Redis] 健康检查：延迟较高 (${latency}ms)`);
        }
        
        // 恢复正常
        if (this.isDegraded) {
          this.isDegraded = false;
          console.log('[Redis] ✅ 已从降级模式恢复');
          this.emit('recovered');
          await this.flushOfflineQueue();
        }
        
      } catch (error) {
        console.error('[Redis] 健康检查失败:', error.message);
        if (!this.isDegraded) {
          this.enterDegradedMode();
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * 订阅频道（带降级）
   */
  async subscribe(channel, handler) {
    if (this.isDegraded) {
      console.warn(`[Redis] 降级模式：无法订阅频道 ${channel}`);
      return;
    }

    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          handler(message);
        }
      });
      console.log(`[Redis] 已订阅频道: ${channel}`);
    } catch (error) {
      console.error(`[Redis] 订阅失败 (${channel}):`, error.message);
      this.enterDegradedMode();
    }
  }

  /**
   * 发布消息（带降级）
   */
  async publish(channel, message) {
    if (this.isDegraded) {
      // 降级模式：加入离线队列
      this.offlineQueue.push({ type: 'publish', channel, message });
      console.warn(`[Redis] 降级模式：消息已加入离线队列 (${this.offlineQueue.length})`);
      return false;
    }

    try {
      await this.publisher.publish(channel, message);
      return true;
    } catch (error) {
      console.error(`[Redis] 发布失败 (${channel}):`, error.message);
      this.enterDegradedMode();
      this.offlineQueue.push({ type: 'publish', channel, message });
      return false;
    }
  }

  /**
   * GET（带缓存）
   */
  async get(key) {
    // 优先从缓存读取
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.isDegraded) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      
      // 写入缓存
      if (value !== null) {
        this.setCache(key, value);
      }
      
      return value;
    } catch (error) {
      console.error(`[Redis] GET 失败 (${key}):`, error.message);
      this.enterDegradedMode();
      return null;
    }
  }

  /**
   * SET（带缓存）
   */
  async set(key, value, ttl = null) {
    // 写入缓存
    this.setCache(key, value);

    if (this.isDegraded) {
      // 降级模式：仅使用缓存
      return true;
    }

    try {
      if (ttl) {
        await this.client.set(key, value, 'EX', ttl);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] SET 失败 (${key}):`, error.message);
      this.enterDegradedMode();
      return false;
    }
  }

  /**
   * 设置缓存（LRU）
   */
  setCache(key, value) {
    // 如果缓存满了，删除最旧的
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * 刷新离线队列
   */
  async flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    console.log(`[Redis] 处理离线队列 (${this.offlineQueue.length} 条)`);
    
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      try {
        if (item.type === 'publish') {
          await this.publish(item.channel, item.message);
        }
      } catch (error) {
        console.error('[Redis] 离线队列处理失败:', error.message);
        // 重新加入队列
        this.offlineQueue.push(item);
      }
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.client) await this.client.quit();
    if (this.subscriber) await this.subscriber.quit();
    if (this.publisher) await this.publisher.quit();

    this.isConnected = false;
    console.log('[Redis] 已断开连接');
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      connected: this.isConnected,
      degraded: this.isDegraded,
      cacheSize: this.cache.size,
      offlineQueueSize: this.offlineQueue.length,
    };
  }
}

module.exports = ResilientRedisClient;
