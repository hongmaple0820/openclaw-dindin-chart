/**
 * Prometheus 指标模块
 * 提供标准的 Prometheus 指标格式输出
 */

class PrometheusMetrics {
  constructor(options = {}) {
    this.options = {
      prefix: options.prefix || 'chat_hub_',
      defaultLabels: options.defaultLabels || {},
      ...options
    };
    
    // 指标存储
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    
    // 内置指标
    this.setupDefaultMetrics();
    
    // 请求统计
    this.requestStats = {
      total: 0,
      errors: 0,
      byMethod: {},
      byPath: {}
    };
    
    // 消息统计
    this.messageStats = {
      total: 0,
      bySource: {},
      bySender: {}
    };
    
    // 时间序列数据
    this.timeSeriesData = [];
    this.maxTimeSeriesPoints = 1000;
  }

  /**
   * 设置默认指标
   */
  setupDefaultMetrics() {
    // 系统指标
    this.registerGauge('process_cpu_seconds_total', 'Total CPU seconds');
    this.registerGauge('process_resident_memory_bytes', 'Resident memory size in bytes');
    this.registerGauge('process_virtual_memory_bytes', 'Virtual memory size in bytes');
    this.registerGauge('process_heap_bytes', 'Process heap size in bytes');
    this.registerGauge('process_open_fds', 'Number of open file descriptors');
    this.registerGauge('process_max_fds', 'Maximum file descriptors');
    
    // Node.js 特定指标
    this.registerGauge('nodejs_eventloop_lag_seconds', 'Event loop lag');
    this.registerGauge('nodejs_active_handles', 'Number of active handles');
    this.registerGauge('nodejs_active_requests', 'Number of active requests');
    this.registerGauge('nodejs_heap_size_total_bytes', 'Heap size total');
    this.registerGauge('nodejs_heap_size_used_bytes', 'Heap size used');
    this.registerGauge('nodejs_external_memory_bytes', 'External memory');
    
    // 应用指标
    this.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
    this.registerCounter('http_request_duration_seconds', 'HTTP request duration', ['method', 'path']);
    this.registerCounter('messages_total', 'Total messages processed', ['source', 'sender']);
    this.registerCounter('messages_errors_total', 'Total message errors', ['type']);
    this.registerGauge('connections_active', 'Active connections', ['type']);
    this.registerGauge('messages_unread', 'Unread messages count', ['user']);
    this.registerHistogram('response_time_seconds', 'Response time histogram', ['endpoint']);
  }

  /**
   * 注册计数器
   */
  registerCounter(name, help, labels = []) {
    this.counters.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      value: 0,
      labelValues: new Map()
    });
  }

  /**
   * 注册仪表
   */
  registerGauge(name, help, labels = []) {
    this.gauges.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      value: 0,
      labelValues: new Map()
    });
  }

  /**
   * 注册直方图
   */
  registerHistogram(name, help, labels = [], buckets = [0.1, 0.5, 1, 2, 5, 10]) {
    this.histograms.set(name, {
      name: this.options.prefix + name,
      help,
      labels,
      buckets,
      bucketValues: new Map()
    });
  }

  /**
   * 递增计数器
   */
  incrementCounter(name, labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (!counter) return;

    const labelKey = this.getLabelKey(labels);
    if (!counter.labelValues.has(labelKey)) {
      counter.labelValues.set(labelKey, { labels, value: 0 });
    }
    counter.labelValues.get(labelKey).value += value;
    counter.value += value;
  }

  /**
   * 设置仪表值
   */
  setGauge(name, value, labels = {}) {
    const gauge = this.gauges.get(name);
    if (!gauge) return;

    const labelKey = this.getLabelKey(labels);
    gauge.labelValues.set(labelKey, { labels, value });
    gauge.value = value;
  }

  /**
   * 观察直方图
   */
  observeHistogram(name, value, labels = {}) {
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

    const bucketData = histogram.bucketValues.get(labelKey);
    bucketData.sum += value;
    bucketData.count++;

    for (const bucket of bucketData.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * 生成标签键
   */
  getLabelKey(labels) {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * 更新系统指标
   */
  updateSystemMetrics() {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.setGauge('process_resident_memory_bytes', mem.rss);
    this.setGauge('process_virtual_memory_bytes', mem.external || 0);
    this.setGauge('process_heap_bytes', mem.heapTotal);
    this.setGauge('nodejs_heap_size_total_bytes', mem.heapTotal);
    this.setGauge('nodejs_heap_size_used_bytes', mem.heapUsed);
    this.setGauge('nodejs_external_memory_bytes', mem.external || 0);
    
    // CPU 时间（转换为秒）
    const cpuSeconds = (cpuUsage.user + cpuUsage.system) / 1000000;
    this.setGauge('process_cpu_seconds_total', cpuSeconds);
    
    // 事件循环延迟（简化估算）
    const start = Date.now();
    setImmediate(() => {
      const lag = (Date.now() - start) / 1000;
      this.setGauge('nodejs_eventloop_lag_seconds', lag);
    });
  }

  /**
   * 记录 HTTP 请求
   */
  recordRequest(method, path, status, durationMs) {
    this.requestStats.total++;
    
    // 按方法统计
    if (!this.requestStats.byMethod[method]) {
      this.requestStats.byMethod[method] = 0;
    }
    this.requestStats.byMethod[method]++;
    
    // 按路径统计（简化路径，移除动态参数）
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
    
    // 更新 Prometheus 指标
    this.incrementCounter('http_requests_total', { method, path: normalizedPath, status: String(status) });
    this.observeHistogram('response_time_seconds', durationMs / 1000, { endpoint: normalizedPath });
  }

  /**
   * 记录消息
   */
  recordMessage(source, sender) {
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

  /**
   * 规范化路径
   */
  normalizePath(path) {
    return path
      .replace(/\/[a-f0-9-]{36}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '');
  }

  /**
   * 生成 Prometheus 格式输出
   */
  export() {
    this.updateSystemMetrics();
    
    const lines = [];
    const defaultLabels = this.options.defaultLabels;
    const defaultLabelStr = Object.entries(defaultLabels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    // 导出计数器
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

    // 导出仪表
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

    // 导出直方图
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
        
        // +Inf bucket
        const infLabels = { ...data.labels, le: '+Inf', ...defaultLabels };
        const infLabelStr = Object.entries(infLabels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${histogram.name}_bucket{${infLabelStr}} ${data.count}`);
        
        // sum 和 count
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

  /**
   * 获取 JSON 格式的指标（用于调试）
   */
  toJSON() {
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

module.exports = PrometheusMetrics;