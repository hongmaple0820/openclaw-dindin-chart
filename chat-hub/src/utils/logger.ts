/**
 * 日志工具
 * 统一的日志管理，支持不同级别和格式化输出
 * @author 小琳
 * @date 2026-02-06
 */

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

const LOG_LEVELS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

interface LogMeta {
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

class Logger {
  private module: string;
  private level: LogLevel;

  constructor(module: string = 'App') {
    this.module = module;
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'INFO';
  }

  private _shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  private _format(level: LogLevel, message: string, meta: LogMeta = {}): string {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.module}] ${message}${metaStr}`;
  }

  error(message: string, error: Error | null = null): void {
    if (!this._shouldLog('ERROR')) return;
    const meta: LogMeta = error ? { error: error.message, stack: error.stack } : {};
    console.error(this._format('ERROR', message, meta));
  }

  warn(message: string, meta: LogMeta = {}): void {
    if (!this._shouldLog('WARN')) return;
    console.warn(this._format('WARN', message, meta));
  }

  info(message: string, meta: LogMeta = {}): void {
    if (!this._shouldLog('INFO')) return;
    console.log(this._format('INFO', message, meta));
  }

  debug(message: string, meta: LogMeta = {}): void {
    if (!this._shouldLog('DEBUG')) return;
    console.log(this._format('DEBUG', message, meta));
  }
}

export = Logger;