/**
 * 管理后台 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, User, Skill } from '@/types';

interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status?: string;
}

interface SystemOverview {
  users: { total: number; active: number };
  messages: { total: number; today: number };
  groups: { total: number };
  agents: { total: number; active: number };
}

interface SystemResources {
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  uptime: number;
}

export const adminApi = {
  getUsers(params: GetUsersParams = {}): Promise<ApiResponse<{ users: User[]; total: number }>> {
    return api.get('/admin/users', { params });
  },

  getPendingUsers(): Promise<ApiResponse<{ users: User[] }>> {
    return api.get('/admin/users/pending');
  },

  approveUser(userId: string): Promise<ApiResponse> {
    return api.post(`/admin/users/${userId}/approve`);
  },

  rejectUser(userId: string, reason = ''): Promise<ApiResponse> {
    return api.post(`/admin/users/${userId}/reject`, { reason });
  },

  banUser(userId: string, reason = ''): Promise<ApiResponse> {
    return api.post(`/admin/users/${userId}/ban`, { reason });
  },

  unbanUser(userId: string): Promise<ApiResponse> {
    return api.post(`/admin/users/${userId}/unban`);
  },

  getUserDetail(userId: string): Promise<ApiResponse<{ user: User }>> {
    return api.get(`/admin/users/${userId}`);
  },

  updateUser(userId: string, data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return api.put(`/admin/users/${userId}`, data);
  },

  getAllSkills(params: Record<string, unknown> = {}): Promise<ApiResponse<{ skills: Skill[] }>> {
    return api.get('/admin/skills', { params });
  },

  toggleSkill(skillId: string, enabled: boolean): Promise<ApiResponse> {
    return api.post(`/admin/skills/${skillId}/toggle`, { enabled });
  },

  deleteSkill(skillId: string): Promise<ApiResponse> {
    return api.delete(`/admin/skills/${skillId}`);
  },

  updateSkillConfig(skillId: string, config: Record<string, unknown>): Promise<ApiResponse> {
    return api.put(`/admin/skills/${skillId}/config`, config);
  },

  getMCPServers(params: Record<string, unknown> = {}): Promise<ApiResponse<{ servers: MCPServer[] }>> {
    return api.get('/admin/mcp/servers', { params });
  },

  addMCPServer(data: Partial<MCPServer>): Promise<ApiResponse<{ server: MCPServer }>> {
    return api.post('/admin/mcp/servers', data);
  },

  updateMCPServer(serverId: string, data: Partial<MCPServer>): Promise<ApiResponse> {
    return api.put(`/admin/mcp/servers/${serverId}`, data);
  },

  deleteMCPServer(serverId: string): Promise<ApiResponse> {
    return api.delete(`/admin/mcp/servers/${serverId}`);
  },

  toggleMCPServer(serverId: string, enabled: boolean): Promise<ApiResponse> {
    return api.post(`/admin/mcp/servers/${serverId}/toggle`, { enabled });
  },

  getMCPStatus(serverId: string): Promise<ApiResponse<{ status: string }>> {
    return api.get(`/admin/mcp/servers/${serverId}/status`);
  },

  getMCPTools(serverId: string): Promise<ApiResponse<{ tools: unknown[] }>> {
    return api.get(`/admin/mcp/servers/${serverId}/tools`);
  },

  getSystemOverview(): Promise<ApiResponse<{ overview: SystemOverview }>> {
    return api.get('/admin/system/overview');
  },

  getResourceUsage(): Promise<ApiResponse<{ resources: SystemResources }>> {
    return api.get('/admin/system/resources');
  },

  getServicesStatus(): Promise<ApiResponse<{ services: { name: string; status: string }[] }>> {
    return api.get('/admin/system/services');
  },

  getSystemLogs(params: Record<string, unknown> = {}): Promise<ApiResponse<{ logs: string[] }>> {
    return api.get('/admin/system/logs', { params });
  },

  getSystemConfig(): Promise<ApiResponse<{ config: Record<string, unknown> }>> {
    return api.get('/admin/system/config');
  },

  updateSystemConfig(data: Record<string, unknown>): Promise<ApiResponse> {
    return api.put('/admin/system/config', data);
  },

  restartService(serviceName: string): Promise<ApiResponse> {
    return api.post(`/admin/system/services/${serviceName}/restart`);
  },

  clearCache(cacheType = 'all'): Promise<ApiResponse> {
    return api.post('/admin/system/cache/clear', { type: cacheType });
  },

  getStatistics(params: Record<string, unknown> = {}): Promise<ApiResponse<{ statistics: Record<string, unknown> }>> {
    return api.get('/admin/statistics', { params });
  },

  getActiveUsers(days = 7): Promise<ApiResponse<{ users: { date: string; count: number }[] }>> {
    return api.get('/admin/statistics/active-users', { params: { days } });
  },

  getMessageStats(days = 7): Promise<ApiResponse<{ messages: { date: string; count: number }[] }>> {
    return api.get('/admin/statistics/messages', { params: { days } });
  }
};

export default adminApi;