import { Request, Response, NextFunction } from 'express';

const config = require('../config');

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'x-admin-token',
  'X-Requested-With',
  'Accept',
  'X-API-Version',
  'X-Request-ID'
];
const DEFAULT_EXPOSE_HEADERS = [
  'X-Total-Count',
  'X-Page-Size',
  'X-Current-Page',
  'X-Request-ID',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining'
];

interface CorsOptions {
  origins?: (string | RegExp)[];
  methods?: string[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function corsMiddleware(options: CorsOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    origins = config.cors?.origins || ['http://localhost:5173', 'http://127.0.0.1:5173', '*'],
    methods = DEFAULT_ALLOWED_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    exposeHeaders = DEFAULT_EXPOSE_HEADERS,
    credentials = config.cors?.credentials !== false,
    maxAge = config.cors?.maxAge || 86400
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.headers.origin;

    if (origins.includes('*')) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && origins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    } else if (requestOrigin && origins.some(o => o instanceof RegExp && o.test(requestOrigin))) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    }

    res.header('Access-Control-Allow-Methods', methods.join(', '));
    res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.header('Access-Control-Expose-Headers', exposeHeaders.join(', '));

    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header('Access-Control-Max-Age', maxAge.toString());

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

export function apiVersionMiddleware(defaultVersion = '1.0'): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionHeader = req.headers['x-api-version'] as string | undefined;
    const acceptHeader = req.headers.accept;

    let version = defaultVersion;

    if (versionHeader) {
      version = versionHeader;
    } else if (acceptHeader && acceptHeader.includes('application/vnd.chat-hub.v')) {
      const match = acceptHeader.match(/application\/vnd\.chat-hub\.v(\d+(\.\d+)?)\+json/);
      if (match) {
        version = match[1];
      }
    }

    (req as any).apiVersion = version;
    res.header('X-API-Version', version);

    next();
  };
}

export function requestIdMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    (req as any).requestId = requestId;
    res.header('X-Request-ID', requestId);
    
    next();
  };
}