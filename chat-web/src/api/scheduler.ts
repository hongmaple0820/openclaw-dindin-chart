/**
 * 定时任务 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, SchedulerJob } from '@/types';

interface CreateSchedulerData {
  name: string;
  cron: string;
  type: 'message' | 'command' | 'reminder' | 'webhook';
  config: Record<string, unknown>;
  enabled?: boolean;
}

interface ExecutionHistory {
  id: string;
  jobId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export const schedulerApi = {
  getList: (): Promise<ApiResponse<{ jobs: SchedulerJob[] }>> => 
    api.get('/scheduler'),

  getDetail: (id: string): Promise<ApiResponse<{ job: SchedulerJob }>> => 
    api.get(`/scheduler/${id}`),

  create: (data: CreateSchedulerData): Promise<ApiResponse<{ job: SchedulerJob }>> => 
    api.post('/scheduler', data),

  update: (id: string, data: Partial<CreateSchedulerData>): Promise<ApiResponse<{ job: SchedulerJob }>> => 
    api.put(`/scheduler/${id}`, data),

  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/scheduler/${id}`),

  toggle: (id: string): Promise<ApiResponse<{ enabled: boolean }>> => 
    api.put(`/scheduler/${id}/toggle`),

  runNow: (id: string): Promise<ApiResponse<{ executionId: string }>> => 
    api.post(`/scheduler/${id}/run`),

  getHistory: (params: { page?: number; limit?: number; status?: string } = {}): Promise<ApiResponse<{ history: ExecutionHistory[] }>> => 
    api.get('/scheduler/history', { params }),

  getTaskHistory: (id: string, params: Record<string, unknown> = {}): Promise<ApiResponse<{ history: ExecutionHistory[] }>> => 
    api.get(`/scheduler/${id}/history`, { params }),

  getExecution: (executionId: string): Promise<ApiResponse<{ execution: ExecutionHistory }>> => 
    api.get(`/scheduler/execution/${executionId}`),

  validateCron: (cron: string): Promise<ApiResponse<{ valid: boolean; error?: string }>> => 
    api.post('/scheduler/validate-cron', { cron }),

  getNextRuns: (cron: string, count = 5): Promise<ApiResponse<{ runs: string[] }>> => 
    api.post('/scheduler/next-runs', { cron, count })
};

export default schedulerApi;