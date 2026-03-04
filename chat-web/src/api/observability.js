/**
 * Observability API - 可观测性接口
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const observabilityApi = {
  /**
   * 获取仪表板概览
   */
  getDashboard() {
    return api.get('/observability/dashboard');
  },

  /**
   * 获取日志
   */
  getLogs(params = {}) {
    return api.get('/observability/logs', { params });
  },

  /**
   * 获取指标
   */
  getMetrics(params = {}) {
    return api.get('/observability/metrics', { params });
  },

  /**
   * 获取统计
   */
  getStats() {
    return api.get('/observability/stats');
  },

  /**
   * 健康检查
   */
  checkHealth() {
    return api.get('/observability/health');
  },

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return api.get('/observability/system');
  }
};

export default observabilityApi;