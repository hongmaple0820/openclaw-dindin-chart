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

function corsMiddleware(options = {}) {
  const {
    origins = config.cors?.origins || ['*'],
    methods = DEFAULT_ALLOWED_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    exposeHeaders = DEFAULT_EXPOSE_HEADERS,
    credentials = config.cors?.credentials !== false,
    maxAge = config.cors?.maxAge || 86400
  } = options;

  return (req, res, next) => {
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
      return res.sendStatus(204);
    }

    next();
  };
}

function apiVersionMiddleware(defaultVersion = '1.0') {
  return (req, res, next) => {
    const versionHeader = req.headers['x-api-version'];
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

    req.apiVersion = version;
    res.header('X-API-Version', version);

    next();
  };
}

function requestIdMiddleware() {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    req.requestId = requestId;
    res.header('X-Request-ID', requestId);
    
    next();
  };
}

module.exports = {
  corsMiddleware,
  apiVersionMiddleware,
  requestIdMiddleware
};
