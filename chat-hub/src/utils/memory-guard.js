/**
 * 内存监控和防护
 * 功能：
 * - 内存使用监控
 * - 内存泄漏检测
 * - 内存限制
 * - 自动 GC
 */
class MemoryGuard {
  constructor(config = {}) {
    this.maxMemoryMB = config.maxMemoryMB || 500; // 最大内存 500MB
    this.warningThresholdPercent = config.warningThresholdPercent || 80; // 警告阈值 80%
    this.checkIntervalMs = config.checkIntervalMs || 30000; // 检查间隔 30s
    this.gcThresholdPercent = config.gcThresholdPercent || 90; // GC 阈值 90%
    
    this.history = []; // 内存使用历史
    this.maxHistorySize = 100;
    
    this.isMonitoring = false;
    this.monitorTimer = null;
  }

  /**
   * 启动监控
   */
  start() {
    if (this.isMonitoring) {
      console.log('[MemoryGuard] 监控已在运行');
      return;
    }

    this.isMonitoring = true;
    console.log('[MemoryGuard] 启动内存监控');
    console.log(`[MemoryGuard] 限制: ${this.maxMemoryMB}MB, 警告: ${this.warningThresholdPercent}%, GC: ${this.gcThresholdPercent}%`);

    // 立即检查一次
    this.check();

    // 定期检查
    this.monitorTimer = setInterval(() => {
      this.check();
    }, this.checkIntervalMs);
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
    console.log('[MemoryGuard] 停止内存监控');
  }

  /**
   * 检查内存使用
   */
  check() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);
    
    const usagePercent = Math.round((heapUsedMB / this.maxMemoryMB) * 100);

    // 记录历史
    const record = {
      timestamp: Date.now(),
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: rssMB,
      external: externalMB,
      percent: usagePercent,
    };

    this.history.push(record);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // 检查是否需要 GC
    if (usagePercent >= this.gcThresholdPercent) {
      console.warn(`[MemoryGuard] ⚠️ 内存使用过高 (${usagePercent}%)，触发 GC`);
      this.forceGC();
    } else if (usagePercent >= this.warningThresholdPercent) {
      console.warn(`[MemoryGuard] ⚠️ 内存使用警告 (${usagePercent}%): ${heapUsedMB}MB / ${this.maxMemoryMB}MB`);
    } else {
      console.log(`[MemoryGuard] 内存使用正常 (${usagePercent}%): ${heapUsedMB}MB / ${this.maxMemoryMB}MB`);
    }

    // 检查内存泄漏
    this.detectLeak();

    return record;
  }

  /**
   * 强制垃圾回收
   */
  forceGC() {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = Math.round((before - after) / 1024 / 1024);
      console.log(`[MemoryGuard] GC 完成，释放 ${freed}MB`);
    } else {
      console.warn('[MemoryGuard] GC 不可用（需启动时加 --expose-gc）');
    }
  }

  /**
   * 检测内存泄漏
   */
  detectLeak() {
    if (this.history.length < 10) return;

    // 取最近 10 次记录
    const recent = this.history.slice(-10);
    const trend = this.calculateTrend(recent.map(r => r.heapUsed));

    // 如果内存持续增长 > 50MB，可能有泄漏
    if (trend > 50) {
      console.warn(`[MemoryGuard] ⚠️ 可能存在内存泄漏（趋势: +${trend}MB）`);
      this.forceGC();
    }
  }

  /**
   * 计算趋势（线性回归）
   */
  calculateTrend(data) {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Math.round(slope * n); // 总增长量
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const usagePercent = Math.round((heapUsedMB / this.maxMemoryMB) * 100);

    return {
      current: {
        heapUsed: heapUsedMB,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        percent: usagePercent,
      },
      limit: this.maxMemoryMB,
      history: this.history.slice(-10), // 最近 10 次
      isMonitoring: this.isMonitoring,
    };
  }

  /**
   * 获取历史记录
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }
}

module.exports = MemoryGuard;
