/**
 * 告警规则模块
 * 定义和评估系统告警规则
 */

class AlertManager {
  constructor(options = {}) {
    this.options = {
      evaluationInterval: options.evaluationInterval || 60000, // 1分钟
      historyRetention: options.historyRetention || 3600000, // 1小时
      ...options
    };
    
    // 告警规则
    this.rules = new Map();
    
    // 活跃告警
    this.activeAlerts = new Map();
    
    // 告警历史
    this.alertHistory = [];
    
    // 告警状态
    this.alertState = {
      pending: new Map(), // 待触发
      firing: new Map(),  // 已触发
      resolved: new Map() // 已解决
    };
    
    // 回调函数
    this.callbacks = {
      onAlert: null,
      onResolve: null
    };
    
    // 初始化默认规则
    this.setupDefaultRules();
    
    // 开始评估循环
    this.startEvaluation();
  }

  /**
   * 设置默认告警规则
   */
  setupDefaultRules() {
    // 内存使用告警
    this.addRule({
      name: 'HighMemoryUsage',
      description: '内存使用率超过阈值',
      severity: 'warning',
      condition: (metrics) => {
        const mem = process.memoryUsage();
        const usagePercent = (mem.heapUsed / mem.heapTotal) * 100;
        return {
          firing: usagePercent > 80,
          value: Math.round(usagePercent),
          labels: { severity: usagePercent > 90 ? 'critical' : 'warning' }
        };
      },
      for: 60000, // 持续1分钟才触发
      labels: { component: 'memory' },
      annotations: {
        summary: '内存使用率过高',
        description: '当前内存使用率 {{value}}%，请检查是否存在内存泄漏'
      }
    });

    // CPU 负载告警
    this.addRule({
      name: 'HighCPULoad',
      description: 'CPU 负载过高',
      severity: 'warning',
      condition: () => {
        const os = require('os');
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        const loadPercent = (loadAvg[0] / cpuCount) * 100;
        
        return {
          firing: loadPercent > 70,
          value: Math.round(loadPercent),
          labels: { severity: loadPercent > 90 ? 'critical' : 'warning' }
        };
      },
      for: 120000, // 持续2分钟
      labels: { component: 'cpu' },
      annotations: {
        summary: 'CPU 负载过高',
        description: '当前 CPU 负载 {{value}}%，可能影响系统响应'
      }
    });

    // 错误率告警
    this.addRule({
      name: 'HighErrorRate',
      description: 'HTTP 请求错误率过高',
      severity: 'warning',
      condition: (metrics) => {
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

    // 响应时间告警
    this.addRule({
      name: 'SlowResponseTime',
      description: 'API 响应时间过慢',
      severity: 'warning',
      condition: (metrics) => {
        if (!metrics.requests || !metrics.requests.byPath) {
          return { firing: false, value: 0 };
        }
        
        // 计算平均响应时间
        let totalTime = 0;
        let totalCount = 0;
        for (const path of Object.values(metrics.requests.byPath)) {
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
      for: 300000, // 持续5分钟
      labels: { component: 'performance' },
      annotations: {
        summary: 'API 响应时间过慢',
        description: '平均响应时间 {{value}}ms，用户体验可能受影响'
      }
    });

    // Redis 连接告警
    this.addRule({
      name: 'RedisDisconnected',
      description: 'Redis 连接断开',
      severity: 'critical',
      condition: (metrics) => {
        const redisConnected = metrics.redis?.status === 'connected';
        return {
          firing: !redisConnected,
          value: metrics.redis?.status || 'unknown',
          labels: { severity: 'critical' }
        };
      },
      for: 0, // 立即触发
      labels: { component: 'redis' },
      annotations: {
        summary: 'Redis 连接断开',
        description: 'Redis 状态: {{value}}，消息同步功能可能受影响'
      }
    });

    // 消息积压告警
    this.addRule({
      name: 'MessageBacklog',
      description: '消息积压过多',
      severity: 'warning',
      condition: (metrics) => {
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

  /**
   * 添加告警规则
   */
  addRule(rule) {
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

  /**
   * 移除告警规则
   */
  removeRule(name) {
    this.rules.delete(name);
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 开始评估循环
   */
  startEvaluation() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    
    this.evaluationTimer = setInterval(() => {
      this.evaluateAll();
    }, this.options.evaluationInterval);
  }

  /**
   * 停止评估循环
   */
  stopEvaluation() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }

  /**
   * 评估所有规则
   */
  async evaluateAll(metrics = {}) {
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

  /**
   * 评估单个规则
   */
  async evaluateRule(rule, metrics, now) {
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

  /**
   * 处理告警状态转换
   */
  processAlertState(name, result, now) {
    const currentState = this.alertState.firing.has(name) ? 'firing' :
                         this.alertState.pending.has(name) ? 'pending' : 'inactive';

    if (result.firing) {
      if (currentState === 'inactive') {
        // 开始计时
        this.alertState.pending.set(name, {
          ...result,
          startedAt: now
        });
      } else if (currentState === 'pending') {
        const pendingAlert = this.alertState.pending.get(name);
        const duration = now - pendingAlert.startedAt;
        
        if (duration >= result.rule.for) {
          // 转换为 firing
          this.alertState.pending.delete(name);
          this.alertState.firing.set(name, {
            ...result,
            startedAt: pendingAlert.startedAt,
            firedAt: now
          });
          
          // 添加到历史
          this.addToHistory({
            ...result,
            state: 'firing',
            startedAt: pendingAlert.startedAt,
            firedAt: now
          });
          
          // 触发回调
          if (this.callbacks.onAlert) {
            this.callbacks.onAlert(this.alertState.firing.get(name));
          }
          
          console.log(`[Alerts] 告警触发: ${name} - ${result.value}`);
        }
      }
      // 更新 firing 状态的值
      else if (currentState === 'firing') {
        const existing = this.alertState.firing.get(name);
        this.alertState.firing.set(name, {
          ...existing,
          ...result
        });
      }
    } else {
      if (currentState === 'firing') {
        // 告警恢复
        const resolved = this.alertState.firing.get(name);
        this.alertState.firing.delete(name);
        this.alertState.resolved.set(name, {
          ...resolved,
          resolvedAt: now
        });
        
        // 添加到历史
        this.addToHistory({
          ...resolved,
          state: 'resolved',
          resolvedAt: now
        });
        
        // 触发回调
        if (this.callbacks.onResolve) {
          this.callbacks.onResolve(resolved);
        }
        
        console.log(`[Alerts] 告警恢复: ${name}`);
      } else if (currentState === 'pending') {
        // 取消待触发
        this.alertState.pending.delete(name);
      }
    }
  }

  /**
   * 添加到历史记录
   */
  addToHistory(alert) {
    this.alertHistory.push(alert);
    
    // 清理过期历史
    const cutoff = Date.now() - this.options.historyRetention;
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);
  }

  /**
   * 获取所有活跃告警
   */
  getActiveAlerts() {
    const alerts = [];
    
    for (const [name, alert] of this.alertState.firing) {
      alerts.push({
        ...alert,
        state: 'firing',
        duration: Date.now() - alert.startedAt
      });
    }
    
    for (const [name, alert] of this.alertState.pending) {
      alerts.push({
        ...alert,
        state: 'pending',
        duration: Date.now() - alert.startedAt
      });
    }
    
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取告警历史
   */
  getHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 获取告警统计
   */
  getStats() {
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

  /**
   * 手动触发告警
   */
  fireAlert(name, value, labels = {}) {
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
      this.callbacks.onAlert(this.alertState.firing.get(name));
    }
  }

  /**
   * 手动解决告警
   */
  resolveAlert(name) {
    if (!this.alertState.firing.has(name)) {
      return;
    }
    
    const now = Date.now();
    const resolved = this.alertState.firing.get(name);
    
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

  /**
   * 清理所有状态
   */
  reset() {
    this.alertState.pending.clear();
    this.alertState.firing.clear();
    this.alertState.resolved.clear();
    this.alertHistory = [];
  }
}

module.exports = AlertManager;