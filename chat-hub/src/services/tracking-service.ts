/**
 * Tracking Service - 产品埋点服务
 * 
 * 功能：
 * - 事件追踪（用户行为、系统事件）
 * - 漏斗分析
 * - 指标计算
 * - 告警触发
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

interface TrackEvent {
  name: string;
  category: string;
  properties?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
}

interface EventDefinition {
  name: string;
  category: string;
  description: string;
  properties: Record<string, { type: string; required: boolean; description: string }>;
}

interface FunnelStep {
  name: string;
  event: string;
  order: number;
}

interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  alertThreshold?: {
    operator: '>' | '<' | '=' | '>=' | '<=';
    value: number;
    severity: 'info' | 'warning' | 'critical';
  };
}

class TrackingService {
  private db: any;
  private eventsPath: string;
  private events: Map<string, EventDefinition>;
  private funnels: Map<string, FunnelStep[]>;
  private metrics: Map<string, MetricConfig>;
  private alertCallbacks: Array<(alert: { metric: string; value: number; threshold: number; severity: string }) => void>;

  constructor(db?: any) {
    const storeDir = path.join(os.homedir(), '.openclaw', 'chat-data');
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    
    this.db = db || new Database(path.join(storeDir, 'tracking.db'));
    this.eventsPath = path.join(storeDir, 'events.jsonl');
    this.events = new Map();
    this.funnels = new Map();
    this.metrics = new Map();
    this.alertCallbacks = [];
    
    this.initDB();
    this.registerDefaultEvents();
    this.registerDefaultFunnels();
    this.registerDefaultMetrics();
  }

  private initDB(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracking_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        properties TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS tracking_funnels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        funnel_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        step_name TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS tracking_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        tags TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_name ON tracking_events(name);
      CREATE INDEX IF NOT EXISTS idx_events_user ON tracking_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tracking_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_funnels_name ON tracking_funnels(funnel_name);
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON tracking_metrics(name);
    `);
  }

  private registerDefaultEvents(): void {
    const defaultEvents: EventDefinition[] = [
      { name: 'user_register', category: 'user', description: '用户注册', properties: { user_id: { type: 'string', required: true, description: '用户ID' }, source: { type: 'string', required: false, description: '注册来源' } } },
      { name: 'user_login', category: 'user', description: '用户登录', properties: { user_id: { type: 'string', required: true, description: '用户ID' }, device: { type: 'string', required: false, description: '设备类型' } } },
      { name: 'session_create', category: 'session', description: '创建会话', properties: { session_id: { type: 'string', required: true, description: '会话ID' }, agent_id: { type: 'string', required: false, description: 'Agent ID' } } },
      { name: 'message_send', category: 'message', description: '发送消息', properties: { session_id: { type: 'string', required: true, description: '会话ID' }, message_type: { type: 'string', required: false, description: '消息类型' }, token_count: { type: 'number', required: false, description: 'Token数量' } } },
      { name: 'message_receive', category: 'message', description: '接收消息', properties: { session_id: { type: 'string', required: true, description: '会话ID' }, response_time: { type: 'number', required: false, description: '响应时间(ms)' }, token_count: { type: 'number', required: false, description: 'Token数量' } } },
      { name: 'agent_select', category: 'agent', description: '选择Agent', properties: { agent_id: { type: 'string', required: true, description: 'Agent ID' }, user_id: { type: 'string', required: true, description: '用户ID' } } },
      { name: 'page_view', category: 'page', description: '页面访问', properties: { page_name: { type: 'string', required: true, description: '页面名称' }, referrer: { type: 'string', required: false, description: '来源页面' } } },
      { name: 'button_click', category: 'interaction', description: '按钮点击', properties: { button_id: { type: 'string', required: true, description: '按钮ID' }, page_name: { type: 'string', required: true, description: '页面名称' } } },
      { name: 'search_query', category: 'search', description: '搜索查询', properties: { query: { type: 'string', required: true, description: '搜索关键词' }, result_count: { type: 'number', required: false, description: '结果数量' } } },
      { name: 'error_occurred', category: 'error', description: '错误发生', properties: { error_code: { type: 'string', required: true, description: '错误码' }, error_message: { type: 'string', required: true, description: '错误信息' }, stack_trace: { type: 'string', required: false, description: '堆栈信息' } } },
      { name: 'file_upload', category: 'file', description: '文件上传', properties: { file_type: { type: 'string', required: true, description: '文件类型' }, file_size: { type: 'number', required: true, description: '文件大小' } } },
      { name: 'reaction_add', category: 'interaction', description: '添加表情回应', properties: { message_id: { type: 'string', required: true, description: '消息ID' }, emoji: { type: 'string', required: true, description: '表情' } } },
      { name: 'dm_send', category: 'dm', description: '发送私信', properties: { conversation_id: { type: 'string', required: true, description: '会话ID' }, user_id: { type: 'string', required: true, description: '用户ID' } } },
      { name: 'notification_view', category: 'notification', description: '查看通知', properties: { notification_type: { type: 'string', required: true, description: '通知类型' }, user_id: { type: 'string', required: true, description: '用户ID' } } },
      { name: 'settings_change', category: 'settings', description: '修改设置', properties: { setting_key: { type: 'string', required: true, description: '设置项' }, old_value: { type: 'any', required: false, description: '旧值' }, new_value: { type: 'any', required: false, description: '新值' } } },
    ];
    
    for (const event of defaultEvents) {
      this.events.set(event.name, event);
    }
  }

  private registerDefaultFunnels(): void {
    this.funnels.set('registration', [
      { name: '访问首页', event: 'page_view', order: 1 },
      { name: '点击注册', event: 'button_click', order: 2 },
      { name: '填写信息', event: 'user_register', order: 3 },
      { name: '完成注册', event: 'user_login', order: 4 },
    ]);
    
    this.funnels.set('conversation', [
      { name: '选择Agent', event: 'agent_select', order: 1 },
      { name: '发起对话', event: 'session_create', order: 2 },
      { name: '发送消息', event: 'message_send', order: 3 },
      { name: '获得回复', event: 'message_receive', order: 4 },
    ]);
    
    this.funnels.set('engagement', [
      { name: '登录', event: 'user_login', order: 1 },
      { name: '查看消息', event: 'page_view', order: 2 },
      { name: '发送消息', event: 'message_send', order: 3 },
    ]);
  }

  private registerDefaultMetrics(): void {
    this.metrics.set('daily_active_users', {
      name: 'daily_active_users',
      type: 'counter',
      description: '日活用户数',
      alertThreshold: { operator: '<', value: 10, severity: 'warning' }
    });
    
    this.metrics.set('message_send_count', {
      name: 'message_send_count',
      type: 'counter',
      description: '消息发送数',
    });
    
    this.metrics.set('response_time_p99', {
      name: 'response_time_p99',
      type: 'gauge',
      description: '响应时间P99(ms)',
      alertThreshold: { operator: '>', value: 3000, severity: 'warning' }
    });
    
    this.metrics.set('error_rate', {
      name: 'error_rate',
      type: 'gauge',
      description: '错误率(%)',
      alertThreshold: { operator: '>', value: 1, severity: 'critical' }
    });
    
    this.metrics.set('session_duration_avg', {
      name: 'session_duration_avg',
      type: 'gauge',
      description: '平均会话时长(s)',
    });
  }

  track(event: TrackEvent): void {
    const timestamp = event.timestamp || Date.now();
    const properties = event.properties ? JSON.stringify(event.properties) : null;
    
    this.db.prepare(`
      INSERT INTO tracking_events (name, category, user_id, session_id, properties, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(event.name, event.category, event.userId || null, event.sessionId || null, properties, timestamp);
    
    this.appendToEventLog(event);
    this.updateFunnelProgress(event);
    this.checkAlerts();
  }

  private appendToEventLog(event: TrackEvent): void {
    const logEntry = JSON.stringify({
      ...event,
      timestamp: event.timestamp || Date.now()
    }) + '\n';
    
    fs.appendFileSync(this.eventsPath, logEntry);
  }

  private updateFunnelProgress(event: TrackEvent): void {
    for (const [funnelName, steps] of this.funnels) {
      const matchingStep = steps.find(s => s.event === event.name);
      if (matchingStep && event.userId) {
        this.db.prepare(`
          INSERT INTO tracking_funnels (funnel_name, user_id, step_name, step_order, completed, timestamp)
          VALUES (?, ?, ?, ?, 1, ?)
        `).run(funnelName, event.userId, matchingStep.name, matchingStep.order, Date.now());
      }
    }
  }

  private checkAlerts(): void {
    for (const [metricName, config] of this.metrics) {
      if (!config.alertThreshold) continue;
      
      const value = this.calculateMetric(metricName);
      if (value === null) continue;
      
      const { operator, value: threshold, severity } = config.alertThreshold;
      let shouldAlert = false;
      
      switch (operator) {
        case '>': shouldAlert = value > threshold; break;
        case '<': shouldAlert = value < threshold; break;
        case '>=': shouldAlert = value >= threshold; break;
        case '<=': shouldAlert = value <= threshold; break;
        case '=': shouldAlert = value === threshold; break;
      }
      
      if (shouldAlert) {
        for (const callback of this.alertCallbacks) {
          callback({ metric: metricName, value, threshold, severity });
        }
      }
    }
  }

  private calculateMetric(name: string): number | null {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    switch (name) {
      case 'daily_active_users': {
        const result = this.db.prepare(`
          SELECT COUNT(DISTINCT user_id) as count FROM tracking_events 
          WHERE timestamp >= ? AND user_id IS NOT NULL
        `).get(oneDayAgo) as { count: number };
        return result?.count || 0;
      }
      case 'message_send_count': {
        const result = this.db.prepare(`
          SELECT COUNT(*) as count FROM tracking_events 
          WHERE name = 'message_send' AND timestamp >= ?
        `).get(oneDayAgo) as { count: number };
        return result?.count || 0;
      }
      case 'error_rate': {
        const total = this.db.prepare(`
          SELECT COUNT(*) as count FROM tracking_events WHERE timestamp >= ?
        `).get(oneDayAgo) as { count: number };
        const errors = this.db.prepare(`
          SELECT COUNT(*) as count FROM tracking_events 
          WHERE name = 'error_occurred' AND timestamp >= ?
        `).get(oneDayAgo) as { count: number };
        return total?.count > 0 ? (errors?.count || 0) / total.count * 100 : 0;
      }
      default:
        return null;
    }
  }

  onAlert(callback: (alert: { metric: string; value: number; threshold: number; severity: string }) => void): void {
    this.alertCallbacks.push(callback);
  }

  getFunnelAnalysis(funnelName: string, startTime?: number, endTime?: number): { step: string; count: number; conversion: number }[] {
    const start = startTime || Date.now() - 7 * 24 * 60 * 60 * 1000;
    const end = endTime || Date.now();
    
    const steps = this.funnels.get(funnelName);
    if (!steps) return [];
    
    const results: { step: string; count: number; conversion: number }[] = [];
    let previousCount = 0;
    
    for (const step of steps) {
      const result = this.db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count FROM tracking_funnels
        WHERE funnel_name = ? AND step_name = ? AND timestamp >= ? AND timestamp <= ?
      `).get(funnelName, step.name, start, end) as { count: number };
      
      const count = result?.count || 0;
      const conversion = previousCount > 0 ? (count / previousCount * 100) : 100;
      
      results.push({ step: step.name, count, conversion: Math.round(conversion * 100) / 100 });
      previousCount = count;
    }
    
    return results;
  }

  getEventStats(startTime?: number, endTime?: number): { event: string; count: number }[] {
    const start = startTime || Date.now() - 24 * 60 * 60 * 1000;
    const end = endTime || Date.now();
    
    const results = this.db.prepare(`
      SELECT name as event, COUNT(*) as count 
      FROM tracking_events 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY name
      ORDER BY count DESC
    `).all(start, end) as { event: string; count: number }[];
    
    return results;
  }

  getMetricValue(name: string): number | null {
    return this.calculateMetric(name);
  }

  getDashboardData(): {
    events: { event: string; count: number }[];
    funnels: Record<string, { step: string; count: number; conversion: number }[]>;
    metrics: Record<string, number | null>;
  } {
    return {
      events: this.getEventStats(),
      funnels: Object.fromEntries(
        Array.from(this.funnels.keys()).map(name => [name, this.getFunnelAnalysis(name)])
      ),
      metrics: Object.fromEntries(
        Array.from(this.metrics.keys()).map(name => [name, this.getMetricValue(name)])
      )
    };
  }

  getEventDefinitions(): EventDefinition[] {
    return Array.from(this.events.values());
  }

  registerEvent(event: EventDefinition): void {
    this.events.set(event.name, event);
  }

  registerFunnel(name: string, steps: FunnelStep[]): void {
    this.funnels.set(name, steps);
  }

  registerMetric(metric: MetricConfig): void {
    this.metrics.set(metric.name, metric);
  }
}

export { TrackingService };
export type { TrackEvent, EventDefinition, FunnelStep, MetricConfig };