/**
 * Tracking Routes - 埋点 API 路由
 */

const express = require('express');
const router = express.Router();

let trackingService = null;

router.setTrackingService = (service) => {
  trackingService = service;
};

/**
 * POST /api/tracking/event
 * 记录埋点事件
 */
router.post('/event', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { name, category, properties, userId, sessionId } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Event name is required' });
  }

try {
    trackingService.track({
      name,
      category: category || 'custom',
      properties,
      userId,
      sessionId,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tracking/batch
 * 批量记录埋点事件
 */
router.post('/batch', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ success: false, error: 'Events array is required' });
  }

  try {
    for (const event of events) {
      trackingService.track({
        ...event,
        timestamp: event.timestamp || Date.now()
      });
    }

    res.json({ success: true, count: events.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tracking/events
 * 获取事件统计
 */
router.get('/events', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { startTime, endTime } = req.query;

  const stats = trackingService.getEventStats(
    startTime ? parseInt(startTime) : undefined,
    endTime ? parseInt(endTime) : undefined
  );

  res.json({ success: true, stats });
});

/**
 * GET /api/tracking/funnel/:name
 * 获取漏斗分析
 */
router.get('/funnel/:name', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { name } = req.params;
  const { startTime, endTime } = req.query;

  const analysis = trackingService.getFunnelAnalysis(
    name,
    startTime ? parseInt(startTime) : undefined,
    endTime ? parseInt(endTime) : undefined
  );

  res.json({ success: true, funnel: name, analysis });
});

/**
 * GET /api/tracking/metrics
 * 获取指标值
 */
router.get('/metrics', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { name } = req.query;

  if (name) {
    const value = trackingService.getMetricValue(name);
    res.json({ success: true, name, value });
  } else {
    const dashboard = trackingService.getDashboardData();
    res.json({ success: true, metrics: dashboard.metrics });
  }
});

/**
 * GET /api/tracking/dashboard
 * 获取仪表板数据
 */
router.get('/dashboard', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const data = trackingService.getDashboardData();

  res.json({ success: true, data });
});

/**
 * GET /api/tracking/definitions
 * 获取事件定义列表
 */
router.get('/definitions', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const definitions = trackingService.getEventDefinitions();

  res.json({ success: true, definitions, count: definitions.length });
});

/**
 * POST /api/tracking/definitions
 * 注册新事件定义
 */
router.post('/definitions', (req, res) => {
  if (!trackingService) {
    return res.status(503).json({ success: false, error: 'Tracking service not initialized' });
  }

  const { name, category, description, properties } = req.body;

  if (!name || !category) {
    return res.status(400).json({ success: false, error: 'name and category are required' });
  }

  try {
    trackingService.registerEvent({ name, category, description, properties });
    res.json({ success: true, message: `Event ${name} registered` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
export {};