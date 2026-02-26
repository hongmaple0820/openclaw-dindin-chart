const Redis = require('ioredis');
const EventEmitter = require('events');

/**
 * Redis 弹性客户端
 * 功能：
 * - 自动重连（指数退避）
 * - 降级模式（Redis 不可用时使用本地缓存）
 * - 连接超时处理
 * - 健康检查
 * - 优雅关闭
 */
class ResilientRedisClient extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || null,
      db: config.db || 0,
      connectTimeout: config.connectTimeout || 10000, // 10s 连接超时
      commandTimeout: config.commandTimeout || 5000, // 5s 命令超时
      retryStrategy: (times) => {
        // 重连延迟：指数退避，最多 60s
        const delay = Math.min(Math.pow(2, times) * 1000, 60000);
        console.log(`[Redis] 重连中... (第${times}次，${delay}ms后重试)`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: true,
      // 保持连接活跃
      keepAlive: 10000,
      // 重试
      retryUnfulfilledCommands: true,
    };
    
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    
    this.isConnected = false;
    this.isDegraded = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    
    this.cache = new Map();
    this.offlineQueue = [];
    
    this.maxCacheSize = config.maxCacheSize || 1000;
    this.healthCheckInterval = config.healthCheckInterval || 30000;
    this.healthCheckTimer = null;
    
    // 绑定错误处理，防止未捕获异常
    this._handleUnhandledError = this._handleUnhandledError.bind(this);
  }

  /**
   * 处理未捕获的错误
   */
  _handleUnhandledError(error) {
    // 检查是否是 Redis 相关错误
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || 
        error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.error('[Redis] 未处理的连接错误:', error.code, error.message);
      this.enterDegradedMode();
      this._scheduleReconnect();
      return;
    }
    
    // 其他错误继续抛出
    throw error;
  }

  /**
   * 连接 Redis
   */
  async connect() {
    if (this.isConnecting) {
      console.log('[Redis] 连接进行中，等待...');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      // 创建客户端
      this.client = this._createClient('client');
      this.subscriber = this._createClient('subscriber');
      this.publisher = this._createClient('publisher');

      // 并行连接，带超时
      const connectWithTimeout = (client, name) => {
        return Promise.race([
          client.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${name} 连接超时`)), this.config.connectTimeout)
          )
        ]);
      };

      await Promise.all([
        connectWithTimeout(this.client, 'client'),
        connectWithTimeout(this.subscriber, 'subscriber'),
        connectWithTimeout(this.publisher, 'publisher'),
      ]);

      this.isConnected = true;
      this.isDegraded = false;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      console.log('[Redis] ✅ 弹性���户端已连接');
      this.emit('connected');

      // 启动健康检查
      this.startHealthCheck();

      // 处理离线队列
      await this.flushOfflineQueue();

    } catch (error) {
      console.error('[Redis] ❌ 连接失败:', error.message);
      this.isConnecting = false;
      this.enterDegradedMode();
      this._scheduleReconnect();
    }
  }

  /**
   * 创建 Redis 客户端
   */
  _createClient(name) {
    const client = new Redis(this.config);
    
    // 事件监听
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
      // 特殊处理 ETIMEDOUT
      if (error.code === 'ETIMEDOUT') {
        console.error(`[Redis] ${name} 连接超时 (ETIMEDOUT)`);
        if (!this.isDegraded) {
          this.enterDegradedMode();
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.error(`[Redis] ${name} 连接被拒绝`);
      } else {
        console.error(`[Redis] ${name} 错误:`, error.message);
      }
      this.emit('error', { name, error });
    });

    client.on('close', () => {
      console.log(`[Redis] ${name} 连接关闭`);
      this.isConnected = false;
    });

    client.on('reconnecting', (ms) => {
      console.log(`[Redis] ${name} 重连中... (${ms}ms)`);
      this.reconnectAttempts++;
    });

    client.on('end', () => {
      console.log(`[Redis] ${name} 连接终止`);
      this.isConnected = false;
    });
    
    return client;
  }

  /**
   * 计划重连
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Redis] 已达最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
      return;
    }
    
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 60000);
    console.log(`[Redis] ${delay}ms 后尝试重连 (第 ${this.reconnectAttempts + 1} 次)`);
    
    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
    }, delay);
  }

  /**
   * 进入降级模式
   */
  enterDegradedMode() {
    if (this.isDegraded) return;
    
    this.isDegraded = true;
    this.isConnected = false;
    console.warn('[Redis] ⚠️ 进入降级模式（仅使用本地缓存）');
    this.emit('degraded');
  }

  /**
   * 健康检查
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      await this._performHealthCheck();
    }, this.healthCheckInterval);
    
    // 立即执行一次
    this._performHealthCheck();
  }

  /**
   * 执行健康检查
   */
  async _performHealthCheck() {
    try {
      if (!this.client) {
        this._scheduleReconnect();
        return;
      }
      
      const start = Date.now();
      await Promise.race([
        this.client.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PING 超时')), 5000)
        )
      ]);
      const latency = Date.now() - start;
      
      if (latency > 1000) {
        console.warn(`[Redis] 健康检查：延迟较高 (${latency}ms)`);
      }
      
      // 恢复正常
      if (this.isDegraded) {
        this.isDegraded = false;
        this.isConnected = true;
        console.log('[Redis] ✅ 已从降级模式恢复');
        this.emit('recovered');
        await this.flushOfflineQueue();
      }
      
    } catch (error) {
      console.error('[Redis] 健康检查失败:', error.message);
      if (!this.isDegraded) {
        this.enterDegradedMode();
      }
      this._scheduleReconnect();
    }
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
          try {
            handler(message);
          } catch (err) {
            console.error(`[Redis] 消息处理错误 (${channel}):`, err.message);
          }
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
      this.offlineQueue.push({ type: 'publish', channel, message });
      console.warn(`[Redis] 降级模式：消息已加入离线队列 (${this.offlineQueue.length})`);
      return false;
    }

    try {
      await Promise.race([
        this.publisher.publish(channel, message),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('发布超时')), this.config.commandTimeout)
        )
      ]);
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
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.isDegraded) {
      return null;
    }

    try {
      const value = await Promise.race([
        this.client.get(key),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('GET 超时')), this.config.commandTimeout)
        )
      ]);
      
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
    this.setCache(key, value);

    if (this.isDegraded) {
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
    if (this.isDegraded) return;

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
      this.healthCheckTimer = null;
    }

    const clients = [this.client, this.subscriber, this.publisher];
    
    await Promise.all(clients.map(async (client) => {
      if (client) {
        try {
          await client.quit();
        } catch (e) {
          // 忽略关闭错误
        }
      }
    }));

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
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      cacheSize: this.cache.size,
      offlineQueueSize: this.offlineQueue.length,
    };
  }
}

module.exports = ResilientRedisClient;
