/**
 * 监控 API 路由
 * 提供健康检查、指标、告警端点
 */

const express = require('express');
const router = express.Router();

// 监控服务实例（由 server.js 注入）
let monitoring = null;

/**
 * 设置监控服务实例
 */
function setMonitoring(monitoringService) {
  monitoring = monitoringService;
}

/**
 * 健康检查端点
 * GET /api/monitoring/health
 * 
 * Query params:
 * - checks: comma-separated list of checks (optional)
 * - quick: if 'true', only run quick checks
 */
router.get('/health', async (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    let health;
    
    if (req.query.quick === 'true') {
      health = await monitoring.getQuickHealth();
    } else {
      const checks = req.query.checks ? req.query.checks.split(',') : undefined;
      health = await monitoring.getHealth(checks);
    }

    // 根据 overall 状态设置 HTTP 状态码
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('[Monitoring] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      status: 'unhealthy'
    });
  }
});

/**
 * 快速健康检查（用于负载均衡器）
 * GET /api/monitoring/health/quick
 */
router.get('/health/quick', async (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).send('unhealthy');
    }

    const health = await monitoring.getQuickHealth();
    
    if (health.status === 'healthy') {
      res.status(200).send('healthy');
    } else {
      res.status(503).send(health.status);
    }
  } catch (error) {
    res.status(503).send('unhealthy');
  }
});

/**
 * Prometheus 指标端点
 * GET /api/monitoring/metrics
 */
router.get('/metrics', (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const format = req.query.format || 'prometheus';
    
    if (format === 'json') {
      res.json({
        success: true,
        metrics: monitoring.getMetricsJSON()
      });
    } else {
      // Prometheus 格式
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(monitoring.getMetrics());
    }
  } catch (error) {
    console.error('[Monitoring] Metrics export failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 告警列表端点
 * GET /api/monitoring/alerts
 * 
 * Query params:
 * - state: filter by state (active, history, all)
 * - limit: limit history results (default: 50)
 */
router.get('/alerts', (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const state = req.query.state || 'active';
    const limit = parseInt(req.query.limit) || 50;
    
    const alerts = monitoring.getAlerts();
    
    let result;
    switch (state) {
      case 'active':
        result = {
          success: true,
          alerts: alerts.active
        };
        break;
      case 'history':
        result = {
          success: true,
          alerts: alerts.history.slice(-limit)
        };
        break;
      case 'all':
      default:
        result = {
          success: true,
          ...alerts
        };
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Monitoring] Get alerts failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 告警规则列表
 * GET /api/monitoring/alerts/rules
 */
router.get('/alerts/rules', (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const rules = monitoring.getAlertRules();
    
    res.json({
      success: true,
      count: rules.length,
      rules
    });
  } catch (error) {
    console.error('[Monitoring] Get alert rules failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 手动触发告警测试
 * POST /api/monitoring/alerts/test
 * Body: { rule: "ruleName", value: 123 }
 */
router.post('/alerts/test', (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const { rule, value, labels } = req.body;
    
    if (!rule) {
      return res.status(400).json({
        success: false,
        error: 'rule name is required'
      });
    }
    
    monitoring.alerts.fireAlert(rule, value || 1, labels || {});
    
    res.json({
      success: true,
      message: `Alert ${rule} fired successfully`
    });
  } catch (error) {
    console.error('[Monitoring] Test alert failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 解决告警
 * POST /api/monitoring/alerts/:name/resolve
 */
router.post('/alerts/:name/resolve', (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const { name } = req.params;
    
    monitoring.alerts.resolveAlert(name);
    
    res.json({
      success: true,
      message: `Alert ${name} resolved`
    });
  } catch (error) {
    console.error('[Monitoring] Resolve alert failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 完整状态报告
 * GET /api/monitoring/status
 */
router.get('/status', async (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    const report = await monitoring.getStatusReport();
    
    res.json({
      success: true,
      ...report
    });
  } catch (error) {
    console.error('[Monitoring] Status report failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * 触发告警评估
 * POST /api/monitoring/evaluate
 */
router.post('/evaluate', async (req, res) => {
  try {
    if (!monitoring) {
      return res.status(503).json({
        success: false,
        error: 'Monitoring service not initialized'
      });
    }

    await monitoring.evaluateAlerts();
    
    const alerts = monitoring.getAlerts();
    
    res.json({
      success: true,
      message: 'Alert evaluation completed',
      activeAlerts: alerts.active.length
    });
  } catch (error) {
    console.error('[Monitoring] Evaluation failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

module.exports = {
  router,
  setMonitoring
};
// Make this a module
export {};
