/**
 * Observability - 可观测性模块
 * 
 * 功能：
 * - 结构化日志
 * - 指标收集
 * - 健康检查
 * - 简单可视化 API
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { Database } from 'better-sqlite3';
import { Request, Response, NextFunction } from 'express';

interface ObservabilityConfig {
  logPath?: string;
  maxLogSize?: number;
  metricsRetention?: number;
}

interface LogEntry {
  level: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  iso: string;
}

interface MetricValue {
  value: number;
  tags: Record<string, unknown>;
  timestamp: number;
}

interface LogQueryOptions {
  level?: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}

interface MetricQueryOptions {
  name?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

class Observability {
  private db: Database;
  private config: {
    logPath: string;
    maxLogSize: number;
    metricsRetention: number;
  };

  // 指标存储
  private metrics: {
    apiCalls: Map<string, number>;
    responseTimes: Map<string, number[]>;
    errors: Map<string, number>;
    customMetrics: Map<string, MetricValue[]>;
  };

  // 日志缓冲
  private logBuffer: LogEntry[];
  private flushInterval: NodeJS.Timeout | null;

  constructor(db: Database, options: ObservabilityConfig = {}) {
    this.db = db;
    this.config = {
      logPath: options.logPath || path.join(os.homedir(), '.openclaw', 'logs', 'chat-hub.jsonl'),
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      metricsRetention: options.metricsRetention || 3600000, // 1小时
      ...options
    };

    // 指标存储
    this.metrics = {
      apiCalls: new Map(),
      responseTimes: new Map(),
      errors: new Map(),
      customMetrics: new Map()
    };

    // 日志缓冲
    this.logBuffer = [];
    this.flushInterval = null;

    // 确保日志目录存在
    const logDir = path.dirname(this.config.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 创建指标表
    this.initDB();

    // 启动定时刷新
    this.startFlushTimer();
  }

  initDB(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS observability_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS observability_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        tags TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_logs_level ON observability_logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON observability_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON observability_metrics(name);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON observability_metrics(timestamp);
    `);
  }

  // ==================== 日志 ====================

  log(level: string, message: string, data: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
      iso: new Date().toISOString()
    };

    // 写入缓冲
    this.logBuffer.push(entry);

    // 同时输出到控制台
    const consoleMsg = `[${entry.iso}] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
      console.error(consoleMsg, data);
    } else {
      console.log(consoleMsg, data);
    }

    // 缓冲区满时刷新
    if (this.logBuffer.length >= 100) {
      this.flushLogs();
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  flushLogs(): void {
    if (this.logBuffer.length === 0) return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    // 写入数据库
    const stmt = this.db.prepare(`
      INSERT INTO observability_logs (level, message, data, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    for (const log of logs) {
      stmt.run(log.level, log.message, JSON.stringify(log.data), log.timestamp);
    }

    // 追加到文件
    const logLines = logs.map(l => JSON.stringify(l)).join('\n') + '\n';
    fs.appendFileSync(this.config.logPath, logLines);
  }

  // ==================== 指标 ====================

  recordMetric(name: string, value: number, tags: Record<string, unknown> = {}): void {
    // 内存存储
    if (!this.metrics.customMetrics.has(name)) {
      this.metrics.customMetrics.set(name, []);
    }
    this.metrics.customMetrics.get(name)!.push({
      value,
      tags,
      timestamp: Date.now()
    });

    // 清理旧数据
    this.cleanOldMetrics();

    // 写入数据库
    this.db.prepare(`
      INSERT INTO observability_metrics (name, value, tags, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(name, value, JSON.stringify(tags), Date.now());
  }

  incrementCounter(name: string, tags: Record<string, unknown> = {}): void {
    const key = `${name}:${JSON.stringify(tags)}`;
    const current = this.metrics.apiCalls.get(key) || 0;
    this.metrics.apiCalls.set(key, current + 1);
  }

  recordResponseTime(endpoint: string, duration: number): void {
    if (!this.metrics.responseTimes.has(endpoint)) {
      this.metrics.responseTimes.set(endpoint, []);
    }
    this.metrics.responseTimes.get(endpoint)!.push(duration);
  }

  recordError(endpoint: string, error: { message: string }): void {
    const key = `${endpoint}:${error.message}`;
    this.metrics.errors.set(key, (this.metrics.errors.get(key) || 0) + 1);
  }

  cleanOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetention;
    
    for (const [name, values] of this.metrics.customMetrics) {
      const filtered = values.filter(v => v.timestamp > cutoff);
      this.metrics.customMetrics.set(name, filtered);
    }
  }

  // ==================== 查询 API ====================

  getLogs(options: LogQueryOptions = {}): unknown[] {
    const { level, limit = 100, offset = 0, startTime, endTime } = options;
    
    let query = 'SELECT * FROM observability_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(query).all(...params);
  }

  getMetrics(options: MetricQueryOptions = {}): unknown[] {
    const { name, startTime, endTime, limit = 100 } = options;
    
    let query = 'SELECT * FROM observability_metrics WHERE 1=1';
    const params: (string | number)[] = [];

    if (name) {
      query += ' AND name = ?';
      params.push(name);
    }
    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params);
  }

  getStats(): {
    logs: { total: number; byLevel: unknown[] };
    metrics: { total: number; topEndpoints: unknown[] };
    memory: { apiCalls: number; responseTimes: number; errors: number };
  } {
    const totalLogs = this.db.prepare('SELECT COUNT(*) as count FROM observability_logs').get() as { count: number };
    const totalMetrics = this.db.prepare('SELECT COUNT(*) as count FROM observability_metrics').get() as { count: number };
    
    const logsByLevel = this.db.prepare(`
      SELECT level, COUNT(*) as count 
      FROM observability_logs 
      GROUP BY level
    `).all();

    const topEndpoints = this.db.prepare(`
      SELECT name, COUNT(*) as count, AVG(value) as avgValue
      FROM observability_metrics
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return {
      logs: {
        total: totalLogs.count,
        byLevel: logsByLevel
      },
      metrics: {
        total: totalMetrics.count,
        topEndpoints
      },
      memory: {
        apiCalls: this.metrics.apiCalls.size,
        responseTimes: this.metrics.responseTimes.size,
        errors: this.metrics.errors.size
      }
    };
  }

  // ==================== 中间件 ====================

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const start = Date.now();
      
      // 请求日志
      this.info('Request', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });

      // 响应处理
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        // 记录指标
        this.recordResponseTime(req.path, duration);
        this.incrementCounter(`api:${req.method}:${req.path}`);
        this.recordMetric(`response_time:${req.path}`, duration);
        
        if (res.statusCode >= 400) {
          this.recordError(req.path, { message: `HTTP ${res.statusCode}` });
        }

        // 响应日志
        this.info('Response', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration
        });
      });

      next();
    };
  }

  // ==================== 生命周期 ====================

  startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000); // 每 5 秒刷新
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushLogs();
  }
}

export { Observability };