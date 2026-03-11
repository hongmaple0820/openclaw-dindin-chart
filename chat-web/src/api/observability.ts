/**
 * Observability API - 可观测性接口
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, ObservabilityMetrics } from '@/types';

interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface DashboardData {
  metrics: ObservabilityMetrics;
  alerts: { count: number; latest?: string };
  uptime: number;
  version: string;
}

export const observabilityApi = {
  getDashboard(): Promise<ApiResponse<{ dashboard: DashboardData }>> {
    return api.get('/observability/dashboard');
  },

  getLogs(params: { level?: string; search?: string; limit?: number } = {}): Promise<ApiResponse<{ logs: LogEntry[] }>> {
    return api.get('/observability/logs', { params });
  },

  getMetrics(params: { period?: string } = {}): Promise<ApiResponse<{ metrics: ObservabilityMetrics }>> {
    return api.get('/observability/metrics', { params });
  },

  getStats(): Promise<ApiResponse<{ stats: Record<string, unknown> }>> {
    return api.get('/observability/stats');
  },

  checkHealth(): Promise<ApiResponse<{ status: string; uptime: number }>> {
    return api.get('/observability/health');
  },

  getSystemInfo(): Promise<ApiResponse<{ system: { platform: string; nodeVersion: string; memory: number; cpus: number } }>> {
    return api.get('/observability/system');
  }
};

export default observabilityApi;