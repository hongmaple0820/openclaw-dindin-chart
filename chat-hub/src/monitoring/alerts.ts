/**
 * 告警规则模块
 * 定义和评估系统告警规则
 */

import * as os from 'os';

interface AlertRule {
  name: string;
  description: string;
  severity: string;
  condition: (metrics: any) => { firing: boolean; value: any; labels?: Record<string, string> };
  for: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  lastEvaluation: number | null;
  evaluationCount: number;
}

interface AlertData {
  rule?: AlertRule;
  firing?: boolean;
  value?: any;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  timestamp?: number;
  startedAt?: number;
  firedAt?: number;
  resolvedAt?: number;
  state?: string;
}

interface AlertManagerOptions {
  evaluationInterval?: number;
  historyRetention?: number;
}

interface AlertManagerCallbacks {
  onAlert: ((alert: AlertData) => void) | null;
  onResolve: ((alert: AlertData) => void) | null;
}

class AlertManager {
  private options: { evaluationInterval: number; historyRetention: number };
  private rules: Map<string, AlertRule>;
  private activeAlerts: Map<string, AlertData>;
  private alertHistory: AlertData[];
  private alertState: {
    pending: Map<string, AlertData>;
    firing: Map<string, AlertData>;
    resolved: Map<string, AlertData>;
  };
  private callbacks: AlertManagerCallbacks;
  private evaluationTimer: NodeJS.Timeout | null = null;

  constructor(options: AlertManagerOptions = {}) {
    this.options = {
      evaluationInterval: options.evaluationInterval || 60000,
      historyRetention: options.historyRetention || 3600000,
      ...options
    };
    
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    
    this.alertState = {
      pending: new Map(),
      firing: new Map(),
      resolved: new Map()
    };
    
    this.callbacks = {
      onAlert: null,
      onResolve: null
    };
    
    this.setupDefaultRules();
    this.startEvaluation();
  }

  setupDefaultRules(): void {
    this.addRule({
      name: 'HighMemoryUsage',
      description: '内存使用率超过阈值',
      severity: 'warning',
      condition: (metrics: any): { firing: boolean; value: number; labels: Record<string, string> } => {
        const mem = process.memoryUsage();
        const usagePercent = (mem.heapUsed / mem.heapTotal) * 100;
        return {
          firing: usagePercent > 80,
          value: Math.round(usagePercent),
          labels: { severity: usagePercent > 90 ? 'critical' : 'warning' }
        };
      },
      for: 60000,
      labels: { component: 'memory' },
      annotations: {
        summary: '内存使用率过高',
        description: '当前内存使用率 {{value}}%，请检查是否存在内存泄漏'
      }
    });

    this.addRule({
      name: 'HighCPULoad',
      description: 'CPU 负载过高',
      severity: 'warning',
      condition: (): { firing: boolean; value: number; labels: Record<string, string> } => {
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        const loadPercent = (loadAvg[0] / cpuCount) * 100;
        
        return {
          firing: loadPercent > 70,
          value: Math.round(loadPercent),
          labels: { severity: loadPercent > 90 ? 'critical' : 'warning' }
        };
      },
      for: 120000,
      labels: { component: 'cpu' },
      annotations: {
        summary: 'CPU 负载过高',
        description: '当前 CPU 负载 {{value}}%，可能影响系统响应'
      }
    });

    this.addRule({
      name: 'HighErrorRate',
      description: 'HTTP 请求错误率过高',
      severity: 'warning',
      condition: (metrics: any): { firing: boolean; value: number; labels?: Record<string, string> } => {
        if (!metrics.requests || metrics.requests.total === 0) {
          return { firing: false, value: 0 };
        }
        
        const errorRate = (metrics.requests.errors / metrics.requests.total) * 100;
        return {
          firing: errorRate > 5,
          value: Math.round(errorRate * 10) / 10,
          labels: { severity: errorRate > 10 ? 'critical' : 'warning' }
        };
      },
      for: 60000,
      labels: { component: 'http' },
      annotations: {
        summary: 'HTTP 错误率过高',
        description: '当前错误率 {{value}}%，请检查服务健康状态'
      }
    });

    this.addRule({
      name: 'SlowResponseTime',
      description: 'API 响应时间过慢',
      severity: 'warning',
      condition: (metrics: any): { firing: boolean; value: number; labels?: Record<string, string> } => {
        if (!metrics.requests || !metrics.requests.byPath) {
          return { firing: false, value: 0 };
        }
        
        let totalTime = 0;
        let totalCount = 0;
        for (const path of Object.values(metrics.requests.byPath) as any[]) {
          totalTime += path.totalTime || 0;
          totalCount += path.count || 0;
        }
        
        const avgResponseTime = totalCount > 0 ? totalTime / totalCount : 0;
        return {
          firing: avgResponseTime > 1000,
          value: Math.round(avgResponseTime),
          labels: { severity: avgResponseTime > 3000 ? 'critical' : 'warning' }
        };
      },
      for: 300000,
      labels: { component: 'performance' },
      annotations: {
        summary: 'API 响应时间过慢',
        description: '平均响应时间 {{value}}ms，用户体验可能受影响'
      }
    });

    this.addRule({
      name: 'RedisDisconnected',
      description: 'Redis 连接断开',
      severity: 'critical',
      condition: (metrics: any): { firing: boolean; value: string; labels: Record<string, string> } => {
        const redisConnected = metrics.redis?.status === 'connected';
        return {
          firing: !redisConnected,
          value: metrics.redis?.status || 'unknown',
          labels: { severity: 'critical' }
        };
      },
      for: 0,
      labels: { component: 'redis' },
      annotations: {
        summary: 'Redis 连接断开',
        description: 'Redis 状态: {{value}}，消息同步功能可能受影响'
      }
    });

    this.addRule({
      name: 'MessageBacklog',
      description: '消息积压过多',
      severity: 'warning',
      condition: (metrics: any): { firing: boolean; value: number; labels: Record<string, string> } => {
        const unreadCount = metrics.messages?.unreadCount || 0;
        return {
          firing: unreadCount > 100,
          value: unreadCount,
          labels: { severity: unreadCount > 500 ? 'critical' : 'warning' }
        };
      },
      for: 300000,
      labels: { component: 'messaging' },
      annotations: {
        summary: '消息积压告警',
        description: '当前有 {{value}} 条未处理消息'
      }
    });
  }

  addRule(rule: any): void {
    this.rules.set(rule.name, {
      name: rule.name,
      description: rule.description,
      severity: rule.severity || 'warning',
      condition: rule.condition,
      for: rule.for || 0,
      labels: rule.labels || {},
      annotations: rule.annotations || {},
      lastEvaluation: null,
      evaluationCount: 0
    });
  }

  removeRule(name: string): void {
    this.rules.delete(name);
  }

  setCallbacks(callbacks: Partial<AlertManagerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  startEvaluation(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    
    this.evaluationTimer = setInterval(() => {
      this.evaluateAll();
    }, this.options.evaluationInterval);
  }

  stopEvaluation(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }

  async evaluateAll(metrics: any = {}): Promise<void> {
    const now = Date.now();
    
    for (const [name, rule] of this.rules) {
      try {
        const result = await this.evaluateRule(rule, metrics, now);
        
        if (result) {
          this.processAlertState(name, result, now);
        }
      } catch (error) {
        console.error(`[Alerts] 规则评估失败: ${name}`, error);
      }
    }
  }

  async evaluateRule(rule: AlertRule, metrics: any, now: number): Promise<AlertData | null> {
    rule.lastEvaluation = now;
    rule.evaluationCount++;

    try {
      const result = rule.condition(metrics);
      
      return {
        rule,
        firing: result.firing,
        value: result.value,
        labels: { ...rule.labels, ...result.labels },
        annotations: rule.annotations,
        timestamp: now
      };
    } catch (error) {
      console.error(`[Alerts] 规则条件执行失败: ${rule.name}`, error);
      return null;
    }
  }

  processAlertState(name: string, result: AlertData, now: number): void {
    const currentState = this.alertState.firing.has(name) ? 'firing' :
                         this.alertState.pending.has(name) ? 'pending' : 'inactive';

    if (result.firing) {
      if (currentState === 'inactive') {
        this.alertState.pending.set(name, {
          ...result,
          startedAt: now
        });
      } else if (currentState === 'pending') {
        const pendingAlert = this.alertState.pending.get(name)!;
        const duration = now - pendingAlert.startedAt!;
        
        if (duration >= result.rule!.for) {
          this.alertState.pending.delete(name);
          this.alertState.firing.set(name, {
            ...result,
            startedAt: pendingAlert.startedAt,
            firedAt: now
          });
          
          this.addToHistory({
            ...result,
            state: 'firing',
            startedAt: pendingAlert.startedAt,
            firedAt: now
          });
          
          if (this.callbacks.onAlert) {
            this.callbacks.onAlert(this.alertState.firing.get(name)!);
          }
          
          console.log(`[Alerts] 告警触发: ${name} - ${result.value}`);
        }
      } else if (currentState === 'firing') {
        const existing = this.alertState.firing.get(name)!;
        this.alertState.firing.set(name, {
          ...existing,
          ...result
        });
      }
    } else {
      if (currentState === 'firing') {
        const resolved = this.alertState.firing.get(name)!;
        this.alertState.firing.delete(name);
        this.alertState.resolved.set(name, {
          ...resolved,
          resolvedAt: now
        });
        
        this.addToHistory({
          ...resolved,
          state: 'resolved',
          resolvedAt: now
        });
        
        if (this.callbacks.onResolve) {
          this.callbacks.onResolve(resolved);
        }
        
        console.log(`[Alerts] 告警恢复: ${name}`);
      } else if (currentState === 'pending') {
        this.alertState.pending.delete(name);
      }
    }
  }

  addToHistory(alert: AlertData): void {
    this.alertHistory.push(alert);
    
    const cutoff = Date.now() - this.options.historyRetention;
    this.alertHistory = this.alertHistory.filter(a => (a.timestamp || 0) > cutoff);
  }

  getActiveAlerts(): (AlertData & { state: string; duration: number })[] {
    const alerts: (AlertData & { state: string; duration: number })[] = [];
    
    for (const [name, alert] of this.alertState.firing) {
      alerts.push({
        ...alert,
        state: 'firing',
        duration: Date.now() - (alert.startedAt || 0)
      });
    }
    
    for (const [name, alert] of this.alertState.pending) {
      alerts.push({
        ...alert,
        state: 'pending',
        duration: Date.now() - (alert.startedAt || 0)
      });
    }
    
    return alerts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  getHistory(limit = 100): AlertData[] {
    return this.alertHistory.slice(-limit);
  }

  getStats(): { rules: number; active: number; pending: number; historyCount: number; lastEvaluation: number | null } {
    return {
      rules: this.rules.size,
      active: this.alertState.firing.size,
      pending: this.alertState.pending.size,
      historyCount: this.alertHistory.length,
      lastEvaluation: Math.max(
        ...Array.from(this.rules.values()).map(r => r.lastEvaluation || 0)
      ) || null
    };
  }

  fireAlert(name: string, value: any, labels: Record<string, string> = {}): void {
    const rule = this.rules.get(name);
    if (!rule) {
      console.warn(`[Alerts] 规则不存在: ${name}`);
      return;
    }
    
    const now = Date.now();
    this.alertState.firing.set(name, {
      rule,
      firing: true,
      value,
      labels: { ...rule.labels, ...labels },
      annotations: rule.annotations,
      startedAt: now,
      firedAt: now
    });
    
    this.addToHistory({
      rule,
      state: 'firing',
      value,
      labels: { ...rule.labels, ...labels },
      startedAt: now,
      firedAt: now
    });
    
    if (this.callbacks.onAlert) {
      this.callbacks.onAlert(this.alertState.firing.get(name)!);
    }
  }

  resolveAlert(name: string): void {
    if (!this.alertState.firing.has(name)) {
      return;
    }
    
    const now = Date.now();
    const resolved = this.alertState.firing.get(name)!;
    
    this.alertState.firing.delete(name);
    this.alertState.resolved.set(name, {
      ...resolved,
      resolvedAt: now
    });
    
    this.addToHistory({
      ...resolved,
      state: 'resolved',
      resolvedAt: now
    });
    
    if (this.callbacks.onResolve) {
      this.callbacks.onResolve(resolved);
    }
  }

  reset(): void {
    this.alertState.pending.clear();
    this.alertState.firing.clear();
    this.alertState.resolved.clear();
    this.alertHistory = [];
  }
}

export default AlertManager;