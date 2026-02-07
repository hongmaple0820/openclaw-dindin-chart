/**
 * 日志工具
 * 统一的日志管理，支持不同级别和格式化输出
 * @author 小琳
 * @date 2026-02-06
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(module = 'App') {
    this.module = module;
    this.level = process.env.LOG_LEVEL || 'INFO';
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  _format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.module}] ${message}${metaStr}`;
  }

  error(message, error = null) {
    if (!this._shouldLog('ERROR')) return;
    const meta = error ? { error: error.message, stack: error.stack } : {};
    console.error(this._format('ERROR', message, meta));
  }

  warn(message, meta = {}) {
    if (!this._shouldLog('WARN')) return;
    console.warn(this._format('WARN', message, meta));
  }

  info(message, meta = {}) {
    if (!this._shouldLog('INFO')) return;
    console.log(this._format('INFO', message, meta));
  }

  debug(message, meta = {}) {
    if (!this._shouldLog('DEBUG')) return;
    console.log(this._format('DEBUG', message, meta));
  }
}

module.exports = Logger;
