/**
 * 统一错误处理中间件
 * @author 小琳
 * @date 2026-02-06
 */

const Logger = require('../utils/logger');
const { ValidationError } = require('../utils/validator');

const logger = new Logger('ErrorHandler');

/**
 * 错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 验证错误
  if (err instanceof ValidationError) {
    logger.warn('Validation error', {
      field: err.field,
      message: err.message,
      path: req.path
    });
    return res.status(400).json({
      success: false,
      error: err.message,
      field: err.field
    });
  }

  // 数据库错误
  if (err.code === 'SQLITE_ERROR' || err.name === 'SqliteError') {
    logger.error('Database error', err);
    return res.status(500).json({
      success: false,
      error: 'Database operation failed'
    });
  }

  // Redis 错误
  if (err.name === 'RedisError') {
    logger.error('Redis error', err);
    return res.status(500).json({
      success: false,
      error: 'Cache operation failed'
    });
  }

  // 通用错误
  logger.error('Unhandled error', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}

/**
 * 异步路由包装器
 * 自动捕获 async 函数的错误
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 处理
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};
