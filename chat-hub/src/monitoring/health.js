/**
 * 健康检查模块
 * 提供系统各组件的健康状态检查
 */

const os = require('os');

class HealthChecker {
  constructor(options = {}) {
    this.options = {
      memoryThresholdMB: options.memoryThresholdMB || 500,
      memoryWarningPercent: options.memoryWarningPercent || 80,
      diskThresholdPercent: options.diskThresholdPercent || 90,
      ...options
    };
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  /**
   * 注册默认检查项
   */
  registerDefaultChecks() {
    // 内存检查
    this.registerCheck('memory', async () => {
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const usagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

      const status = heapUsedMB < this.options.memoryThresholdMB ? 'healthy' : 
                     heapUsedMB < this.options.memoryThresholdMB * 1.2 ? 'degraded' : 'unhealthy';

      return {
        status,
        details: {
          heapUsedMB,
          heapTotalMB,
          usagePercent,
          rssMB: Math.round(mem.rss / 1024 / 1024),
          externalMB: Math.round(mem.external / 1024 / 1024)
        },
        message: status === 'healthy' ? 'Memory usage is normal' : 
                 `Memory usage high: ${heapUsedMB}MB (${usagePercent}%)`
      };
    });

    // CPU 检查
    this.registerCheck('cpu', async () => {
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const load1Min = loadAvg[0] / cpuCount;
      
      const status = load1Min < 0.7 ? 'healthy' : 
                     load1Min < 1.0 ? 'degraded' : 'unhealthy';

      return {
        status,
        details: {
          loadAvg1: loadAvg[0].toFixed(2),
          loadAvg5: loadAvg[1].toFixed(2),
          loadAvg15: loadAvg[2].toFixed(2),
          cpuCount,
          loadPercent: Math.round(load1Min * 100)
        },
        message: status === 'healthy' ? 'CPU load is normal' : 
                 `CPU load high: ${Math.round(load1Min * 100)}%`
      };
    });

    // 运行时间检查
    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      const uptimeHours = Math.floor(uptime / 3600);
      const uptimeMins = Math.floor((uptime % 3600) / 60);
      
      return {
        status: 'healthy',
        details: {
          uptimeSeconds: Math.floor(uptime),
          uptimeHours,
          uptimeMins,
          startedAt: new Date(Date.now() - uptime * 1000).toISOString()
        },
        message: `Running for ${uptimeHours}h ${uptimeMins}m`
      };
    });

    // Node.js 版本检查
    this.registerCheck('node', async () => {
      return {
        status: 'healthy',
        details: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        },
        message: `Node.js ${process.version}`
      };
    });
  }

  /**
   * 注册自定义检查项
   * @param {string} name - 检查项名称
   * @param {Function} checkFn - 检查函数，返回 { status, details, message }
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * 移除检查项
   * @param {string} name - 检查项名称
   */
  removeCheck(name) {
    this.checks.delete(name);
  }

  /**
   * 执行单个检查
   * @param {string} name - 检查项名称
   */
  async runCheck(name) {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return {
        status: 'unknown',
        message: `Check '${name}' not found`
      };
    }

    try {
      const startTime = Date.now();
      const result = await checkFn();
      const duration = Date.now() - startTime;

      return {
        ...result,
        name,
        duration,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        name,
        message: error.message,
        error: error.stack,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 执行所有检查
   * @param {string[]} checks - 可选，指定要执行的检查项
   */
  async runAllChecks(checks) {
    const checkNames = checks || Array.from(this.checks.keys());
    const results = {};
    const startTime = Date.now();

    for (const name of checkNames) {
      results[name] = await this.runCheck(name);
    }

    const totalDuration = Date.now() - startTime;
    
    // 计算整体状态
    const statuses = Object.values(results).map(r => r.status);
    const overallStatus = statuses.includes('unhealthy') ? 'unhealthy' :
                          statuses.includes('degraded') ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      checks: results,
      summary: {
        total: checkNames.length,
        healthy: statuses.filter(s => s === 'healthy').length,
        degraded: statuses.filter(s => s === 'degraded').length,
        unhealthy: statuses.filter(s => s === 'unhealthy').length
      },
      duration: totalDuration,
      timestamp: Date.now()
    };
  }

  /**
   * 快速健康检查（仅检查关键项）
   */
  async quickCheck() {
    return this.runAllChecks(['memory', 'uptime']);
  }

  /**
   * 完整健康检查（所有项）
   */
  async fullCheck() {
    return this.runAllChecks();
  }

  /**
   * 检查 Redis 连接
   * @param {Object} transportManager - 传输管理器
   */
  async checkRedis(transportManager) {
    const startTime = Date.now();
    try {
      await transportManager.healthCheck();
      const duration = Date.now() - startTime;
      
      return {
        status: 'healthy',
        details: {
          latency: duration
        },
        message: `Redis connected (${duration}ms)`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis connection failed: ${error.message}`,
        error: error.stack
      };
    }
  }

  /**
   * 检查数据库连接
   * @param {Object} db - 数据库实例
   */
  async checkDatabase(db) {
    const startTime = Date.now();
    try {
      // 执行简单查询
      const result = db.prepare('SELECT 1 as test').get();
      const duration = Date.now() - startTime;
      
      if (result && result.test === 1) {
        return {
          status: 'healthy',
          details: {
            latency: duration
          },
          message: `Database connected (${duration}ms)`
        };
      }
      
      return {
        status: 'unhealthy',
        message: 'Database query returned unexpected result'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        error: error.stack
      };
    }
  }
}

module.exports = HealthChecker;