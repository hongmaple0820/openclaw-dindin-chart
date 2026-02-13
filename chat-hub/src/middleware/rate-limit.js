const config = require('../config');

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX_REQUESTS = 100;

const rateLimitStore = new Map();

function cleanExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > record.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanExpiredRecords, 60000);

function rateLimitMiddleware(options = {}) {
  const {
    windowMs = config.rateLimit?.windowMs || DEFAULT_WINDOW_MS,
    maxRequests = config.rateLimit?.maxRequests || DEFAULT_MAX_REQUESTS,
    keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown',
    skipCondition = () => false,
    handler = (req, res) => {
      res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  } = options;

  return (req, res, next) => {
    if (skipCondition(req)) {
      return next();
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
      return handler(req, res);
    }

    next();
  };
}

function apiRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 100,
    keyGenerator: (req) => {
      const userId = req.user?.id || req.headers['x-user-id'] || req.ip;
      return `api:${userId}`;
    },
    skipCondition: (req) => {
      return req.path === '/health' || req.path === '/api/v1/health';
    }
  });
}

function authRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => {
      const username = req.body?.username || 'unknown';
      return `auth:${username}:${req.ip}`;
    }
  });
}

function messageRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 30,
    keyGenerator: (req) => {
      const userId = req.user?.id || req.headers['x-user-id'] || req.ip;
      return `msg:${userId}`;
    }
  });
}

function dmRateLimitMiddleware() {
  return rateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 60,
    keyGenerator: (req) => {
      const userId = req.user?.id || req.headers['x-user-id'] || req.ip;
      return `dm:${userId}`;
    }
  });
}

function getRateLimitStats() {
  const stats = {
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

module.exports = {
  rateLimitMiddleware,
  apiRateLimitMiddleware,
  authRateLimitMiddleware,
  messageRateLimitMiddleware,
  dmRateLimitMiddleware,
  getRateLimitStats
};
