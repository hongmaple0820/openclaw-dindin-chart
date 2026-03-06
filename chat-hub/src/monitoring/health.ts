/**
 * 健康检查模块
 * 提供系统各组件的健康状态检查
 */

import * as os from 'os';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  name?: string;
  details?: Record<string, any>;
  message: string;
  duration?: number;
  timestamp?: number;
  error?: string;
}

interface HealthCheckSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

interface FullHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheckResult>;
  summary: HealthCheckSummary;
  duration: number;
  timestamp: number;
}

interface HealthCheckerOptions {
  memoryThresholdMB?: number;
  memoryWarningPercent?: number;
  diskThresholdPercent?: number;
}

type CheckFunction = () => Promise<HealthCheckResult>;

class HealthChecker {
  private options: {
    memoryThresholdMB: number;
    memoryWarningPercent: number;
    diskThresholdPercent: number;
  };
  private checks: Map<string, CheckFunction>;

  constructor(options: HealthCheckerOptions = {}) {
    this.options = {
      memoryThresholdMB: options.memoryThresholdMB || 500,
      memoryWarningPercent: options.memoryWarningPercent || 80,
      diskThresholdPercent: options.diskThresholdPercent || 90,
      ...options
    };
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  registerDefaultChecks(): void {
    this.registerCheck('memory', async (): Promise<HealthCheckResult> => {
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

    this.registerCheck('cpu', async (): Promise<HealthCheckResult> => {
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

    this.registerCheck('uptime', async (): Promise<HealthCheckResult> => {
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

    this.registerCheck('node', async (): Promise<HealthCheckResult> => {
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

  registerCheck(name: string, checkFn: CheckFunction): void {
    this.checks.set(name, checkFn);
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
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
    } catch (error: any) {
      return {
        status: 'unhealthy',
        name,
        message: error.message,
        error: error.stack,
        timestamp: Date.now()
      };
    }
  }

  async runAllChecks(checks?: string[]): Promise<FullHealthResult> {
    const checkNames = checks || Array.from(this.checks.keys());
    const results: Record<string, HealthCheckResult> = {};
    const startTime = Date.now();

    for (const name of checkNames) {
      results[name] = await this.runCheck(name);
    }

    const totalDuration = Date.now() - startTime;
    
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

  async quickCheck(): Promise<FullHealthResult> {
    return this.runAllChecks(['memory', 'uptime']);
  }

  async fullCheck(): Promise<FullHealthResult> {
    return this.runAllChecks();
  }

  async checkRedis(transportManager: any): Promise<HealthCheckResult> {
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
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Redis connection failed: ${error.message}`,
        error: error.stack
      };
    }
  }

  async checkDatabase(db: any): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
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
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        error: error.stack
      };
    }
  }
}

export default HealthChecker;