/**
 * Prometheus 指标模块
 * 提供标准的 Prometheus 指标格式输出
 */

interface CounterData {
  name: string;
  help: string;
  labels: string[];
  value: number;
  labelValues: Map<string, { labels: Record<string, string>; value: number }>;
}

interface GaugeData {
  name: string;
  help: string;
  labels: string[];
  value: number;
  labelValues: Map<string, { labels: Record<string, string>; value: number }>;
}

interface HistogramData {
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  bucketValues: Map<string, {
    labels: Record<string, string>;
    buckets: { le: number; count: number }[];
    sum: number;
    count: number;
  }>;
}

interface PrometheusMetricsOptions {
  prefix?: string;
  defaultLabels?: Record<string, string>;
}

interface RequestStats {
  total: number;
  errors: number;
  byMethod: Record<string, number>;
  byPath: Record<string, { count: number; errors: number; totalTime: number }>;
}

interface MessageStats {
  total: number;
  bySource: Record<string, number>;
  bySender: Record<string, number>;
}

class PrometheusMetrics {
  private options: { prefix: string; defaultLabels: Record<string, string> };
  private counters: Map<string, CounterData>;
  private gauges: Map<string, GaugeData>;
  private histograms: Map<string, HistogramData>;
  public requestStats: RequestStats;
  public messageStats: MessageStats;

  constructor(options: PrometheusMetricsOptions = {}) {
    this.options = {
      prefix: options.prefix || 'chat_hub_',
      defaultLabels: options.defaultLabels || {},
      ...options
    };
    
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    
    this.setupDefaultMetrics();
    
    this.requestStats = {
      total: 0,
      errors: 0,
      byMethod: {},
      byPath: {}
    };
    
    this.messageStats = {
      total: 0,
      bySource: {},
      bySender: {}
    };
  }

  setupDefaultMetrics(): void {
    this.registerGauge('process_cpu_seconds_total', 'Total CPU seconds');
    this.registerGauge('process_resident_memory_bytes', 'Resident memory size in bytes');
    this.registerGauge('process_virtual_memory_bytes', 'Virtual memory size in bytes');
    this.registerGauge('process_heap_bytes', 'Process heap size in bytes');
    this.registerGauge('process_open_fds', 'Number of open file descriptors');
    this.registerGauge('process_max_fds', 'Maximum file descriptors');
    
    this.registerGauge('nodejs_eventloop_lag_seconds', 'Event loop lag');
    this.registerGauge('nodejs_active_handles', 'Number of active handles');
    this.registerGauge('nodejs_active_requests', 'Number of active requests');
    this.registerGauge('nodejs_heap_size_total_bytes', 'Heap size total');
    this.registerGauge('nodejs_heap_size_used_bytes', 'Heap size used');
    this.registerGauge('nodejs_external_memory_bytes', 'External memory');
    
    this.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
    this.registerCounter('http_request_duration_seconds', 'HTTP request duration', ['method', 'path']);
    this.registerCounter('messages_total', 'Total messages processed', ['source', 'sender']);
    this.registerCounter('messages_errors_total', 'Total message errors', ['type']);
    this.registerGauge('connections_active', 'Active connections', ['type']);
    this.registerGauge('messages_unread', 'Unread messages count', ['user']);
    this.registerHistogram('response_time_seconds', 'Response time histogram', ['endpoint']);
  }

  registerCounter(name: string, help: string, labels: string[] = []): void {
    this.counters.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      value: 0,
      labelValues: new Map()
    });
  }

  registerGauge(name: string, help: string, labels: string[] = []): void {
    this.gauges.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      value: 0,
      labelValues: new Map()
    });
  }

  registerHistogram(name: string, help: string, labels: string[] = [], buckets = [0.1, 0.5, 1, 2, 5, 10]): void {
    this.histograms.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      buckets,
      bucketValues: new Map()
    });
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;

    const labelKey = this.getLabelKey(labels);
    if (!counter.labelValues.has(labelKey)) {
      counter.labelValues.set(labelKey, { labels, value: 0 });
    }
    counter.labelValues.get(labelKey)!.value += value;
    counter.value += value;
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;

    const labelKey = this.getLabelKey(labels);
    gauge.labelValues.set(labelKey, { labels, value });
    gauge.value = value;
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const histogram = this.histograms.get(name);
    if (!histogram) return;

    const labelKey = this.getLabelKey(labels);
    if (!histogram.bucketValues.has(labelKey)) {
      histogram.bucketValues.set(labelKey, {
        labels,
        buckets: histogram.buckets.map(b => ({ le: b, count: 0 })),
        sum: 0,
        count: 0
      });
    }

    const bucketData = histogram.bucketValues.get(labelKey)!;
    bucketData.sum += value;
    bucketData.count++;

    for (const bucket of bucketData.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  getLabelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  updateSystemMetrics(): void {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.setGauge('process_resident_memory_bytes', mem.rss);
    this.setGauge('process_virtual_memory_bytes', mem.external || 0);
    this.setGauge('process_heap_bytes', mem.heapTotal);
    this.setGauge('nodejs_heap_size_total_bytes', mem.heapTotal);
    this.setGauge('nodejs_heap_size_used_bytes', mem.heapUsed);
    this.setGauge('nodejs_external_memory_bytes', mem.external || 0);
    
    const cpuSeconds = (cpuUsage.user + cpuUsage.system) / 1000000;
    this.setGauge('process_cpu_seconds_total', cpuSeconds);
    
    const start = Date.now();
    setImmediate(() => {
      const lag = (Date.now() - start) / 1000;
      this.setGauge('nodejs_eventloop_lag_seconds', lag);
    });
  }

  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    this.requestStats.total++;
    
    if (!this.requestStats.byMethod[method]) {
      this.requestStats.byMethod[method] = 0;
    }
    this.requestStats.byMethod[method]++;
    
    const normalizedPath = this.normalizePath(path);
    if (!this.requestStats.byPath[normalizedPath]) {
      this.requestStats.byPath[normalizedPath] = { count: 0, errors: 0, totalTime: 0 };
    }
    this.requestStats.byPath[normalizedPath].count++;
    this.requestStats.byPath[normalizedPath].totalTime += durationMs;
    
    if (status >= 400) {
      this.requestStats.errors++;
      this.requestStats.byPath[normalizedPath].errors++;
    }
    
    this.incrementCounter('http_requests_total', { method, path: normalizedPath, status: String(status) });
    this.observeHistogram('response_time_seconds', durationMs / 1000, { endpoint: normalizedPath });
  }

  recordMessage(source: string, sender: string): void {
    this.messageStats.total++;
    
    if (!this.messageStats.bySource[source]) {
      this.messageStats.bySource[source] = 0;
    }
    this.messageStats.bySource[source]++;
    
    if (!this.messageStats.bySender[sender]) {
      this.messageStats.bySender[sender] = 0;
    }
    this.messageStats.bySender[sender]++;
    
    this.incrementCounter('messages_total', { source, sender });
  }

  normalizePath(path: string): string {
    return path
      .replace(/\/[a-f0-9-]{36}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '');
  }

  export(): string {
    this.updateSystemMetrics();
    
    const lines: string[] = [];
    const defaultLabels = this.options.defaultLabels;
    const defaultLabelStr = Object.entries(defaultLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    for (const [name, counter] of this.counters) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      
      if (counter.labelValues.size === 0) {
        const labelStr = defaultLabelStr ? `{${defaultLabelStr}}` : '';
        lines.push(`${counter.name}${labelStr} ${counter.value}`);
      } else {
        for (const [labelKey, data] of counter.labelValues) {
          const allLabels = { ...data.labels, ...defaultLabels };
          const labelStr = Object.entries(allLabels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          lines.push(`${counter.name}{${labelStr}} ${data.value}`);
        }
      }
      lines.push('');
    }

    for (const [name, gauge] of this.gauges) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      
      if (gauge.labelValues.size === 0) {
        const labelStr = defaultLabelStr ? `{${defaultLabelStr}}` : '';
        lines.push(`${gauge.name}${labelStr} ${gauge.value}`);
      } else {
        for (const [labelKey, data] of gauge.labelValues) {
          const allLabels = { ...data.labels, ...defaultLabels };
          const labelStr = Object.entries(allLabels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          lines.push(`${gauge.name}{${labelStr}} ${data.value}`);
        }
      }
      lines.push('');
    }

    for (const [name, histogram] of this.histograms) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`);
      lines.push(`# TYPE ${histogram.name} histogram`);
      
      for (const [labelKey, data] of histogram.bucketValues) {
        let cumulativeCount = 0;
        for (const bucket of data.buckets) {
          cumulativeCount += bucket.count;
          const allLabels = { ...data.labels, le: String(bucket.le), ...defaultLabels };
          const labelStr = Object.entries(allLabels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          lines.push(`${histogram.name}_bucket{${labelStr}} ${cumulativeCount}`);
        }
        
        const infLabels = { ...data.labels, le: '+Inf', ...defaultLabels };
        const infLabelStr = Object.entries(infLabels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${histogram.name}_bucket{${infLabelStr}} ${data.count}`);
        
        const sumLabels = { ...data.labels, ...defaultLabels };
        const sumLabelStr = Object.entries(sumLabels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${histogram.name}_sum{${sumLabelStr}} ${data.sum}`);
        lines.push(`${histogram.name}_count{${sumLabelStr}} ${data.count}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  toJSON(): {
    counters: Record<string, { value: number; labelValues: Record<string, { labels: Record<string, string>; value: number }> }>;
    gauges: Record<string, { value: number; labelValues: Record<string, { labels: Record<string, string>; value: number }> }>;
    requestStats: RequestStats;
    messageStats: MessageStats;
  } {
    this.updateSystemMetrics();
    
    return {
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([name, data]) => [
          name,
          {
            value: data.value,
            labelValues: Object.fromEntries(data.labelValues)
          }
        ])
      ),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([name, data]) => [
          name,
          {
            value: data.value,
            labelValues: Object.fromEntries(data.labelValues)
          }
        ])
      ),
      requestStats: this.requestStats,
      messageStats: this.messageStats
    };
  }
}

export default PrometheusMetrics;