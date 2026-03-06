/**
 * 监控模块入口
 * 整合健康检查、指标收集、告警管理
 */

import HealthChecker from './health';
import PrometheusMetrics from './metrics';
import AlertManager from './alerts';

interface MonitoringServiceOptions {
  serviceName?: string;
  serviceVersion?: string;
  metricsPrefix?: string;
  health?: any;
  alerts?: any;
}

interface Dependencies {
  transportManager?: any;
  db?: any;
  messageStore?: any;
}

interface AlertData {
  rule?: any;
  annotations?: { summary?: string; description?: string };
  value?: any;
}

class MonitoringService {
  private options: {
    serviceName: string;
    serviceVersion: string;
    metricsPrefix: string;
  };
  public health: HealthChecker;
  public metrics: PrometheusMetrics;
  public alerts: AlertManager;
  private transportManager: any = null;
  private db: any = null;
  private messageStore: any = null;

  constructor(options: MonitoringServiceOptions = {}) {
    this.options = {
      serviceName: options.serviceName || 'chat-hub',
      serviceVersion: options.serviceVersion || '2.0.0',
      metricsPrefix: options.metricsPrefix || 'chat_hub_',
      ...options
    };
    
    this.health = new HealthChecker(options.health);
    this.metrics = new PrometheusMetrics({
      prefix: this.options.metricsPrefix,
      defaultLabels: {
        service: this.options.serviceName,
        version: this.options.serviceVersion
      }
    });
    this.alerts = new AlertManager(options.alerts);
    
    this.alerts.setCallbacks({
      onAlert: (alert: AlertData) => this.handleAlert(alert),
      onResolve: (alert: AlertData) => this.handleResolve(alert)
    });
    
    this.registerDependencyChecks();
  }

  setDependencies(deps: Dependencies): void {
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

  registerDependencyChecks(): void {
    this.health.registerCheck('redis', async () => {
      if (!this.transportManager) {
        return {
          status: 'unknown' as const,
          message: 'TransportManager not configured'
        };
      }
      return this.health.checkRedis(this.transportManager);
    });

    this.health.registerCheck('database', async () => {
      if (!this.db) {
        return {
          status: 'unknown' as const,
          message: 'Database not configured'
        };
      }
      return this.health.checkDatabase(this.db);
    });
  }

  async getHealth(checks?: string[]): Promise<any> {
    const result = await this.health.runAllChecks(checks);
    return result;
  }

  async getQuickHealth(): Promise<any> {
    return this.health.quickCheck();
  }

  getMetrics(): string {
    return this.metrics.export();
  }

  getMetricsJSON(): any {
    return this.metrics.toJSON();
  }

  getAlerts(): { active: any[]; history: any[]; stats: any } {
    return {
      active: this.alerts.getActiveAlerts(),
      history: this.alerts.getHistory(50),
      stats: this.alerts.getStats()
    };
  }

  getAlertRules(): any[] {
    const rules: any[] = [];
    for (const [name, rule] of (this.alerts as any).rules) {
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

  addAlertRule(rule: any): void {
    this.alerts.addRule(rule);
  }

  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    this.metrics.recordRequest(method, path, status, durationMs);
  }

  recordMessage(source: string, sender: string): void {
    this.metrics.recordMessage(source, sender);
  }

  updateActiveConnections(type: string, count: number): void {
    this.metrics.setGauge('connections_active', count, { type });
  }

  updateUnreadCount(user: string, count: number): void {
    this.metrics.setGauge('messages_unread', count, { user });
  }

  async evaluateAlerts(): Promise<void> {
    const metrics = {
      requests: (this.metrics as any).requestStats,
      messages: (this.metrics as any).messageStats,
      redis: this.transportManager ? {
        status: this.transportManager.getStatus().connected ? 'connected' : 'disconnected'
      } : null
    };
    
    await this.alerts.evaluateAll(metrics);
  }

  handleAlert(alert: AlertData): void {
    const message = this.formatAlertMessage(alert);
    console.warn(`[Monitoring] 🚨 告警: ${message}`);
  }

  handleResolve(alert: AlertData): void {
    const message = this.formatAlertMessage(alert);
    console.log(`[Monitoring] ✅ 告警恢复: ${message}`);
  }

  formatAlertMessage(alert: AlertData): string {
    let message = alert.annotations?.summary || (alert.rule as any)?.name;
    
    if (alert.annotations?.description) {
      message += ` - ${alert.annotations.description.replace('{{value}}', String(alert.value))}`;
    }
    
    return message;
  }

  middleware(): (req: any, res: any, next: () => void) => void {
    return (req: any, res: any, next: () => void): void => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.recordRequest(req.method, req.path, res.statusCode, duration);
      });
      
      next();
    };
  }

  async getStatusReport(): Promise<any> {
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

export { MonitoringService, HealthChecker, PrometheusMetrics, AlertManager };