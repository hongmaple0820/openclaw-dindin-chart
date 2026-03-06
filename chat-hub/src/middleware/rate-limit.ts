import { Request, Response, NextFunction } from 'express';

const config = require('../config');

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX_REQUESTS = 100;

interface RateLimitRecord {
  windowStart: number;
  count: number;
  windowMs: number;
}

interface RateLimitStats {
  totalKeys: number;
  byPrefix: Record<string, { count: number; totalRequests: number }>;
}

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
  skipCondition?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

function cleanExpiredRecords(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > record.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanExpiredRecords, 60000);

export function rateLimitMiddleware(options: RateLimitOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    windowMs = config.rateLimit?.windowMs || DEFAULT_WINDOW_MS,
    maxRequests = config.rateLimit?.maxRequests || DEFAULT_MAX_REQUESTS,
    keyGenerator = (req: Request): string => req.ip || (req.connection as any).remoteAddress || 'unknown',
    skipCondition = (): boolean => false,
    handler = (req: Request, res: Response): void => {
      res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipCondition(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > windowMs) {
      record = {
        windowStart: now,
        count: 0,
        windowMs
      };
      rateLimitStore.set(key, record);
    }

    record.count++;

    const remaining = Math.max(0, maxRequests - record.count);
    const resetTime = record.windowStart + windowMs;

    res.header('X-RateLimit-Limit', maxRequests.toString());
    res.header('X-RateLimit-Remaining', remaining.toString());
    res.header('X-RateLimit-Reset', resetTime.toString());

    if (record.count > maxRequests) {
      res.header('Retry-After', Math.ceil((resetTime - now) / 1000).toString());
      handler(req, res);
      return;
    }

    next();
  };
}

export function apiRateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 100,
    keyGenerator: (req: Request): string => {
      const userId = (req as any).user?.id || req.headers['x-user-id'] || req.ip;
      return `api:${userId}`;
    },
    skipCondition: (req: Request): boolean => {
      return req.path === '/health' || req.path === '/api/v1/health';
    }
  });
}

export function authRateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req: Request): string => {
      const username = (req.body as any)?.username || 'unknown';
      return `auth:${username}:${req.ip}`;
    }
  });
}

export function messageRateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 30,
    keyGenerator: (req: Request): string => {
      const userId = (req as any).user?.id || req.headers['x-user-id'] || req.ip;
      return `msg:${userId}`;
    }
  });
}

export function dmRateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 60,
    keyGenerator: (req: Request): string => {
      const userId = (req as any).user?.id || req.headers['x-user-id'] || req.ip;
      return `dm:${userId}`;
    }
  });
}

export function getRateLimitStats(): RateLimitStats {
  const stats: RateLimitStats = {
    totalKeys: rateLimitStore.size,
    byPrefix: {}
  };

  for (const [key, record] of rateLimitStore.entries()) {
    const prefix = key.split(':')[0];
    if (!stats.byPrefix[prefix]) {
      stats.byPrefix[prefix] = { count: 0, totalRequests: 0 };
    }
    stats.byPrefix[prefix].count++;
    stats.byPrefix[prefix].totalRequests += record.count;
  }

  return stats;
}