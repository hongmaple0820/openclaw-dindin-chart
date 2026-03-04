/**
 * Relay 数据中转服务 API 路由
 * 
 * 提供实例注册、Token 管理、数据同步和 SSE 连接等 API：
 * 
 * Token 管理：
 * - POST /api/relay/register      - 注册实例（获取Token）
 * - POST /api/relay/refresh       - 刷新 Token
 * - POST /api/relay/revoke        - 撤销 Token
 * 
 * 实例管理：
 * - GET  /api/relay/instances     - 获取实例列表
 * - GET  /api/relay/status        - 获取服务状态
 * 
 * 数据同步：
 * - POST /api/relay/sync/message  - 同步消息
 * - POST /api/relay/sync/file     - 同步文件
 * - POST /api/relay/sync/config   - 同步配置
 * 
 * 实时连接：
 * - GET  /api/relay/sse           - SSE 连接端点（长连接）
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 延迟加载 relay 模块（避免循环依赖）
let relayService = null;
let tokenAuth = null;
let connectionManager = null;

function getRelayService() {
  if (!relayService) {
    try {
      // 尝试从全局获取
      relayService = global.relayService;
      if (relayService) {
        tokenAuth = relayService.tokenAuth;
        connectionManager = relayService.connectionManager;
      }
    } catch (e) {
      console.error('[Relay Routes] 获取 RelayService 失败:', e.message);
    }
  }
  return relayService;
}

function getTokenAuth() {
  getRelayService();
  return tokenAuth;
}

function getConnectionManager() {
  getRelayService();
  return connectionManager;
}

// ==================== Token 认证中间件 ====================

/**
 * Token 认证中间件
 * 验证 Authorization header 中的 Bearer token
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authentication token'
    });
  }

  try {
    const auth = getTokenAuth();
    if (!auth) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    const tokenData = await auth.validateToken(token);
    
    if (!tokenData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.tokenData = tokenData;
    req.instanceId = tokenData.instanceId;
    next();
  } catch (error) {
    console.error('[Relay Routes] Token 验证失败:', error);
    res.status(500).json({
      success: false,
      error: 'Token validation failed'
    });
  }
}

/**
 * 权限检查中间件
 * @param {string|string[]} permissions - 需要的权限
 */
function requirePermission(permissions) {
  return async (req, res, next) => {
    const requiredPerms = Array.isArray(permissions) ? permissions : [permissions];
    const userPerms = req.tokenData?.permissions || [];

    const hasAll = requiredPerms.every(perm => userPerms.includes(perm));

    if (!hasAll) {
      const missing = requiredPerms.filter(p => !userPerms.includes(p));
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: requiredPerms,
        missing
      });
    }

    next();
  };
}

// ==================== Token 管理 API ====================

/**
 * 注册实例（获取Token）
 * POST /api/relay/register
 * 
 * Body:
 * {
 *   "instanceId": "optional-custom-id",
 *   "name": "实例名称",
 *   "role": "client|instance|admin",
 *   "relayUrl": "https://relay.example.com",
 *   "maxConnections": 100
 * }
 * 
 * 返回：
 * {
 *   "success": true,
 *   "token": "xxx",
 *   "refreshToken": "xxx",
 *   "tokenExpiry": 1234567890,
 *   "refreshExpiry": 1234567890,
 *   "role": "client",
 *   "instanceId": "xxx"
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const { instanceId, name, role = 'client', relayUrl, maxConnections } = req.body;
    const auth = getTokenAuth();

    if (!auth) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    // 生成实例 ID
    const finalInstanceId = instanceId || \`inst_\${uuidv4().replace(/-/g, '')}\`;
    const finalName = name || \`instance-\${finalInstanceId.substring(0, 8)}\`;

    // 生成 Token
    const tokenResult = await auth.generateToken(finalInstanceId, finalName, role);

    // 注册实例到连接管理器
    const connMgr = getConnectionManager();
    if (connMgr) {
      await connMgr.registerInstance(finalInstanceId, {
        name: finalName,
        relayUrl,
        token: tokenResult.token,
        maxConnections
      });
    }

    console.log(\`[Relay Routes] 实例已注册: \${finalInstanceId} (\${finalName})\`);

    res.json({
      success: true,
      instanceId: finalInstanceId,
      name: finalName,
      ...tokenResult
    });
  } catch (error) {
    console.error('[Relay Routes] 注册实例失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 刷新 Token
 * POST /api/relay/refresh
 * 
 * Body:
 * {
 *   "refreshToken": "xxx"
 * }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'refreshToken is required'
      });
    }

    const auth = getTokenAuth();
    if (!auth) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    const result = await auth.refreshToken(refreshToken);

    console.log('[Relay Routes] Token 已刷新');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Relay Routes] 刷新 Token 失败:', error);
    
    if (error.message.includes('expired') || error.message.includes('Invalid')) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 撤销 Token
 * POST /api/relay/revoke
 * 
 * 需要 Token 认证
 */
router.post('/revoke', authenticateToken, async (req, res) => {
  try {
    const auth = getTokenAuth();
    if (!auth) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    const revoked = await auth.revokeToken(req.tokenData.tokenHash);

    if (revoked) {
      // 从连接管理器注销实例
      const connMgr = getConnectionManager();
      if (connMgr) {
        await connMgr.unregisterInstance(req.instanceId);
      }

      console.log(\`[Relay Routes] Token 已撤销: \${req.instanceId}\`);
      res.json({
        success: true,
        message: 'Token revoked successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to revoke token'
      });
    }
  } catch (error) {
    console.error('[Relay Routes] 撤销 Token 失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 实例管理 API ====================

/**
 * 获取实例列表
 * GET /api/relay/instances
 * 
 * 可选查询参数：
 * - status: online|offline (筛选状态)
 * - role: client|instance|admin (筛选角色)
 */
router.get('/instances', authenticateToken, requirePermission('admin:manage'), (req, res) => {
  try {
    const connMgr = getConnectionManager();
    if (!connMgr) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    const { status, role } = req.query;
    let instances = connMgr.getInstances();

    // 筛选
    if (status) {
      instances = instances.filter(inst => inst.status === status);
    }
    if (role) {
      instances = instances.filter(inst => inst.role === role);
    }

    // 获取每个实例的连接数
    const instancesWithConnections = instances.map(inst => {
      const details = connMgr.getInstance(inst.instanceId);
      return {
        ...inst,
        connectionCount: details?.connectionCount || 0
      };
    });

    res.json({
      success: true,
      count: instancesWithConnections.length,
      instances: instancesWithConnections
    });
  } catch (error) {
    console.error('[Relay Routes] 获取实例列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取服务状态
 * GET /api/relay/status
 */
router.get('/status', (req, res) => {
  try {
    const service = getRelayService();
    const connMgr = getConnectionManager();
    const auth = getTokenAuth();

    if (!service || !connMgr || !auth) {
      return res.json({
        success: true,
        status: 'unavailable',
        message: 'Relay service not initialized'
      });
    }

    const loadStats = connMgr.getLoadStats();
    const health = connMgr.getHealth();
    const authStats = auth.getStats();

    res.json({
      success: true,
      status: health.status,
      uptime: process.uptime(),
      connections: {
        current: loadStats.totalConnections,
        max: loadStats.maxConnections,
        utilizationRate: (loadStats.totalConnections / loadStats.maxConnections * 100).toFixed(2) + '%'
      },
      instances: {
        online: health.onlineInstances,
        total: health.totalInstances,
        list: loadStats.instances
      },
      auth: authStats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Relay Routes] 获取服务状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 数据同步 API ====================

/**
 * 同步消息
 * POST /api/relay/sync/message
 * 
 * Body:
 * {
 *   "channel": "messages",
 *   "messages": [...],
 *   "lastSyncTime": 1234567890
 * }
 */
router.post('/sync/message', authenticateToken, requirePermission(['sync:push']), async (req, res) => {
  try {
    const { channel = 'messages', messages = [], lastSyncTime } = req.body;
    const connMgr = getConnectionManager();

    if (!connMgr) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    // 广播消息到所有连接
    let syncCount = 0;
    for (const msg of messages) {
      connMgr.broadcast(channel, {
        ...msg,
        _syncedAt: Date.now(),
        _syncedBy: req.instanceId
      });
      syncCount++;
    }

    // 更新实例最后同步时间
    await connMgr.updateInstancePing(req.instanceId);

    console.log(\`[Relay Routes] 同步消息: \${syncCount} 条 (实例: \${req.instanceId})\`);

    res.json({
      success: true,
      syncedCount: syncCount,
      channel,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Relay Routes] 同步消息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 同步文件
 * POST /api/relay/sync/file
 * 
 * Body:
 * {
 *   "fileId": "xxx",
 *   "fileName": "example.pdf",
 *   "fileSize": 12345,
 *   "mimeType": "application/pdf",
 *   "url": "https://...",
 *   "metadata": {}
 * }
 */
router.post('/sync/file', authenticateToken, requirePermission(['file:write']), async (req, res) => {
  try {
    const { fileId, fileName, fileSize, mimeType, url, metadata = {} } = req.body;
    const connMgr = getConnectionManager();

    if (!connMgr) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    if (!fileId || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'fileId and fileName are required'
      });
    }

    const fileData = {
      id: fileId,
      name: fileName,
      size: fileSize,
      mimeType,
      url,
      metadata,
      syncedBy: req.instanceId,
      syncedAt: Date.now()
    };

    // 广播文件同步事件
    connMgr.broadcast('files', {
      type: 'file_sync',
      data: fileData
    });

    // 更新实例活动时间
    await connMgr.updateInstancePing(req.instanceId);

    console.log(\`[Relay Routes] 同步文件: \${fileName} (\${fileId})\`);

    res.json({
      success: true,
      file: fileData
    });
  } catch (error) {
    console.error('[Relay Routes] 同步文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 同步配置
 * POST /api/relay/sync/config
 * 
 * Body:
 * {
 *   "configKey": "xxx",
 *   "configValue": {...},
 *   "version": "1.0.0"
 * }
 */
router.post('/sync/config', authenticateToken, requirePermission(['sync:full']), async (req, res) => {
  try {
    const { configKey, configValue, version } = req.body;
    const connMgr = getConnectionManager();

    if (!connMgr) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    if (!configKey) {
      return res.status(400).json({
        success: false,
        error: 'configKey is required'
      });
    }

    const configData = {
      key: configKey,
      value: configValue,
      version,
      updatedBy: req.instanceId,
      updatedAt: Date.now()
    };

    // 广播配置更新事件
    connMgr.broadcast('config', {
      type: 'config_update',
      data: configData
    });

    // 更新实例活动时间
    await connMgr.updateInstancePing(req.instanceId);

    console.log(\`[Relay Routes] 同步配置: \${configKey}\`);

    res.json({
      success: true,
      config: configData
    });
  } catch (error) {
    console.error('[Relay Routes] 同步配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== SSE 长连接端点 ====================

/**
 * SSE 连接端点
 * GET /api/relay/sse
 * 
 * 查询参数：
 * - token: 认证 token (可选，也可以通过 Authorization header)
 * - channels: 订阅频道，逗号分隔 (可选)
 * 
 * SSE 事件类型：
 * - event: connected      - 连接成功
 * - event: heartbeat      - 心跳
 * - event: message        - 新消息
 * - event: file           - 文件同步
 * - event: config         - 配置更新
 * - event: disconnect     - 断开连接
 */
router.get('/sse', async (req, res) => {
  // Token 验证
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing authentication token'
    });
  }

  try {
    const auth = getTokenAuth();
    if (!auth) {
      return res.status(503).json({
        success: false,
        error: 'Relay service not available'
      });
    }

    const tokenData = await auth.validateToken(token);
    if (!tokenData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // 检查权限
    if (!tokenData.permissions.includes('sync:pull')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions for SSE connection'
      });
    }

    const connMgr = getConnectionManager();
    if (!connMgr) {
      return res.status(503).json({
        success: false,
        error: 'Connection manager not available'
      });
    }

    // 解析订阅频道
    const channels = req.query.channels
      ? req.query.channels.split(',').map(c => c.trim())
      : ['messages'];

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin || '*'
    });

    // 生成连接 ID
    const connectionId = \`sse_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;

    // 添加连接
    const addResult = connMgr.addConnection(connectionId, tokenData.instanceId, {
      userId: tokenData.instanceId,
      channels,
      type: 'sse'
    });

    if (!addResult.success) {
      res.write(\`event: error\\ndata: \${JSON.stringify({ error: addResult.reason })}\\n\\n\`);
      return res.end();
    }

    // 发送连接成功事件
    const connectEvent = {
      connectionId,
      instanceId: tokenData.instanceId,
      channels,
      timestamp: Date.now(),
      message: 'SSE connection established'
    };
    res.write(\`event: connected\\ndata: \${JSON.stringify(connectEvent)}\\n\\n\`);

    console.log(\`[Relay Routes] SSE 连接建立: \${connectionId} (实例: \${tokenData.instanceId})\`);

    // 心跳定时器
    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }
      res.write(\`event: heartbeat\\ndata: \${JSON.stringify({ timestamp: Date.now() })}\\n\\n\`);
    }, 30000);

    // 监听频道消息
    const messageHandler = (message) => {
      if (res.writableEnded) return;
      res.write(\`event: message\\ndata: \${JSON.stringify(message)}\\n\\n\`);
    };

    // 订阅频道（如果 ConnectionManager 支持）
    if (typeof connMgr.subscribe === 'function') {
      for (const channel of channels) {
        connMgr.subscribe(channel, messageHandler);
      }
    }

    // 监听连接关闭
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      connMgr.removeConnection(connectionId, 'client-close');
      console.log(\`[Relay Routes] SSE 连接关闭: \${connectionId}\`);
    });

    // 监听错误
    req.on('error', (error) => {
      console.error(\`[Relay Routes] SSE 连接错误: \${connectionId}\`, error);
      clearInterval(heartbeatInterval);
      connMgr.removeConnection(connectionId, 'error');
    });

  } catch (error) {
    console.error('[Relay Routes] SSE 连接失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// ==================== 健康检查 ====================

/**
 * 健康检查端点
 * GET /api/relay/health
 */
router.get('/health', (req, res) => {
  const service = getRelayService();
  
  if (!service) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Relay service not available'
    });
  }

  const connMgr = getConnectionManager();
  const health = connMgr ? connMgr.getHealth() : { status: 'unknown' };

  res.json({
    status: health.status === 'healthy' ? 'healthy' : 'degraded',
    connections: health.currentConnections || 0,
    instances: health.onlineInstances || 0,
    timestamp: Date.now()
  });
});

module.exports = router;
  res.json({
    status: health.status === 'healthy' ? 'healthy' : 'degraded',
    connections: health.currentConnections || 0,
    instances: health.onlineInstances || 0,
    timestamp: Date.now()
  });
});

module.exports = router;
