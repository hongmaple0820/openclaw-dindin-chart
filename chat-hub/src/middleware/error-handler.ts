/**
 * 统一错误处理中间件
 * @author 小琳
 * @date 2026-02-06
 */

import Logger from '../utils/logger';
import { ValidationError } from '../utils/validator';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('ErrorHandler');

/**
 * 错误处理中间件
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  // 验证错误
  if (err instanceof ValidationError) {
    logger.warn('Validation error', {
      field: (err as any).field,
      message: err.message,
      path: req.path
    });
    res.status(400).json({
      success: false,
      error: err.message,
      field: (err as any).field
    });
    return;
  }

  // 数据库错误
  if ((err as any).code === 'SQLITE_ERROR' || err.name === 'SqliteError') {
    logger.error('Database error', err);
    res.status(500).json({
      success: false,
      error: 'Database operation failed'
    });
    return;
  }

  // Redis 错误
  if (err.name === 'RedisError') {
    logger.error('Redis error', err);
    res.status(500).json({
      success: false,
      error: 'Cache operation failed'
    });
    return;
  }

  // 通用错误
  logger.error('Unhandled error', err);
  res.status((err as any).statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}

/**
 * 异步路由包装器
 * 自动捕获 async 函数的错误
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 处理
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
}