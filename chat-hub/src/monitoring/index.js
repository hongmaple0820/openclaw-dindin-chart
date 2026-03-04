/**
 * 监控模块入口
 * 整合健康检查、指标收集、告警管理
 */

const HealthChecker = require('./health');
const PrometheusMetrics = require('./metrics');
const AlertManager = require('./alerts');

class MonitoringService {
  constructor(options = {}) {
    this.options = {
      serviceName: options.serviceName || 'chat-hub',
      serviceVersion: options.serviceVersion || '2.0.0',
      metricsPrefix: options.metricsPrefix || 'chat_hub_',
      ...options
    };
    
    // 初始化各模块
    this.health = new HealthChecker(options.health);
    this.metrics = new PrometheusMetrics({
      prefix: this.options.metricsPrefix,
      defaultLabels: {
        service: this.options.serviceName,
        version: this.options.serviceVersion
      }
    });
    this.alerts = new AlertManager(options.alerts);
    
    // 依赖注入
    this.transportManager = null;
    this.db = null;
    this.messageStore = null;
    
    // 设置告警回调
    this.alerts.setCallbacks({
      onAlert: (alert) => this.handleAlert(alert),
      onResolve: (alert) => this.handleResolve(alert)
    });
    
    // 注册额外检查
    this.registerDependencyChecks();
  }

  /**
   * 设置依赖
   */
  setDependencies(deps) {
    if (deps.transportManager) {
      this.transportManager = deps.transportManager;
    }
    if (deps.db) {
      this.db = deps.db;
    }
    if (deps.messageStore) {
      this.messageStore = deps.messageStore;
    }
  }

  /**
   * 注册依赖检查
   */
  registerDependencyChecks() {
    // Redis 检查
    this.health.registerCheck('redis', async () => {
      if (!this.transportManager) {
        return {
          status: 'unknown',
          message: 'TransportManager not configured'
        };
      }
      return this.health.checkRedis(this.transportManager);
    });

    // 数据库检查
    this.health.registerCheck('database', async () => {
      if (!this.db) {
        return {
          status: 'unknown',
          message: 'Database not configured'
        };
      }
      return this.health.checkDatabase(this.db);
    });
  }

  /**
   * 获取健康状态
   */
  async getHealth(checks) {
    const result = await this.health.runAllChecks(checks);
    return result;
  }

  /**
   * 获取快速健康状态
   */
  async getQuickHealth() {
    return this.health.quickCheck();
  }

  /**
   * 获取 Prometheus 指标
   */
  getMetrics() {
    return this.metrics.export();
  }

  /**
   * 获取指标 JSON（调试用）
   */
  getMetricsJSON() {
    return this.metrics.toJSON();
  }

  /**
   * 获取告警列表
   */
  getAlerts() {
    return {
      active: this.alerts.getActiveAlerts(),
      history: this.alerts.getHistory(50),
      stats: this.alerts.getStats()
    };
  }

  /**
   * 获取告警规则
   */
  getAlertRules() {
    const rules = [];
    for (const [name, rule] of this.alerts.rules) {
      rules.push({
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        for: rule.for,
        labels: rule.labels,
        lastEvaluation: rule.lastEvaluation,
        evaluationCount: rule.evaluationCount
      });
    }
    return rules;
  }

  /**
   * 添加自定义告警规则
   */
  addAlertRule(rule) {
    this.alerts.addRule(rule);
  }

  /**
   * 记录请求
   */
  recordRequest(method, path, status, durationMs) {
    this.metrics.recordRequest(method, path, status, durationMs);
  }

  /**
   * 记录消息
   */
  recordMessage(source, sender) {
    this.metrics.recordMessage(source, sender);
  }

  /**
   * 更新活跃连接数
   */
  updateActiveConnections(type, count) {
    this.metrics.setGauge('connections_active', count, { type });
  }

  /**
   * 更新未读消息数
   */
  updateUnreadCount(user, count) {
    this.metrics.setGauge('messages_unread', count, { user });
  }

  /**
   * 执行告警评估
   */
  async evaluateAlerts() {
    const metrics = {
      requests: this.metrics.requestStats,
      messages: this.metrics.messageStats,
      redis: this.transportManager ? {
        status: this.transportManager.getStatus().connected ? 'connected' : 'disconnected'
      } : null
    };
    
    await this.alerts.evaluateAll(metrics);
  }

  /**
   * 处理告警触发
   */
  handleAlert(alert) {
    const message = this.formatAlertMessage(alert);
    console.warn(`[Monitoring] 🚨 告警: ${message}`);
    
    // 可以在这里添加通知逻辑
    // 例如：发送到钉钉、邮件、Webhook 等
  }

  /**
   * 处理告警恢复
   */
  handleResolve(alert) {
    const message = this.formatAlertMessage(alert);
    console.log(`[Monitoring] ✅ 告警恢复: ${message}`);
  }

  /**
   * 格式化告警消息
   */
  formatAlertMessage(alert) {
    let message = alert.annotations?.summary || alert.rule?.name;
    
    if (alert.annotations?.description) {
      message += ` - ${alert.annotations.description.replace('{{value}}', alert.value)}`;
    }
    
    return message;
  }

  /**
   * 获取监控中间件
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      // 监听响应完成
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.recordRequest(req.method, req.path, res.statusCode, duration);
      });
      
      next();
    };
  }

  /**
   * 获取完整状态报告
   */
  async getStatusReport() {
    const health = await this.getHealth();
    const alerts = this.getAlerts();
    const metrics = this.getMetricsJSON();
    
    return {
      timestamp: Date.now(),
      service: {
        name: this.options.serviceName,
        version: this.options.serviceVersion
      },
      health,
      alerts,
      metrics: {
        requests: metrics.requestStats,
        messages: metrics.messageStats
      }
    };
  }
}

// 导出所有模块
module.exports = {
  MonitoringService,
  HealthChecker,
  PrometheusMetrics,
  AlertManager
};