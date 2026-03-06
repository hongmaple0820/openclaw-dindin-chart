/**
 * Observability Routes - 可观测性 API
 */

const express = require('express');
const router = express.Router();

// Observability 实例将在 server.js 中注入
let observability = null;

router.setObservability = (obs) => {
  observability = obs;
};

/**
 * GET /api/observability/logs
 * 查询日志
 */
router.get('/logs', (req, res) => {
  if (!observability) {
    return res.status(503).json({ error: 'Observability not initialized' });
  }

  const { level, limit, offset, startTime, endTime } = req.query;
  
  const logs = observability.getLogs({
    level,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
    startTime: startTime ? parseInt(startTime) : undefined,
    endTime: endTime ? parseInt(endTime) : undefined
  });

  res.json({
    success: true,
    data: logs,
    count: logs.length
  });
});

/**
 * GET /api/observability/metrics
 * 查询指标
 */
router.get('/metrics', (req, res) => {
  if (!observability) {
    return res.status(503).json({ error: 'Observability not initialized' });
  }

  const { name, startTime, endTime, limit } = req.query;

  const metrics = observability.getMetrics({
    name,
    startTime: startTime ? parseInt(startTime) : undefined,
    endTime: endTime ? parseInt(endTime) : undefined,
    limit: parseInt(limit) || 100
  });

  res.json({
    success: true,
    data: metrics,
    count: metrics.length
  });
});

/**
 * GET /api/observability/stats
 * 获取统计信息
 */
router.get('/stats', (req, res) => {
  if (!observability) {
    return res.status(503).json({ error: 'Observability not initialized' });
  }

  const stats = observability.getStats();

  res.json({
    success: true,
    data: stats
  });
});

/**
 * GET /api/observability/health
 * 健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: Date.now()
  });
});

/**
 * GET /api/observability/dashboard
 * 简单仪表板数据
 */
router.get('/dashboard', (req, res) => {
  if (!observability) {
    return res.status(503).json({ error: 'Observability not initialized' });
  }

  const stats = observability.getStats();
  const recentLogs = observability.getLogs({ limit: 20 });
  const recentMetrics = observability.getMetrics({ limit: 20 });

  // 计算响应时间分布
  const responseTimeData = {};
  for (const [endpoint, times] of observability.metrics.responseTimes) {
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      responseTimeData[endpoint] = {
        count: times.length,
        avg: Math.round(avg),
        min: Math.min(...times),
        max: Math.max(...times)
      };
    }
  }

  res.json({
    success: true,
    data: {
      summary: {
        totalLogs: stats.logs.total,
        totalMetrics: stats.metrics.total,
        errorCount: stats.logs.byLevel.find(l => l.level === 'error')?.count || 0
      },
      logsByLevel: stats.logs.byLevel,
      topEndpoints: stats.metrics.topEndpoints,
      responseTimes: responseTimeData,
      recentLogs: recentLogs.slice(0, 10),
      recentMetrics: recentMetrics.slice(0, 10)
    }
  });
});

module.exports = router;
// Make this a module
export {};
