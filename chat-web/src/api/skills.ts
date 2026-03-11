/**
 * Skills 系统 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, Skill } from '@/types';

interface GetSkillsParams {
  type?: 'built-in' | 'my' | 'market';
  q?: string;
  category?: string;
}

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export const skillApi = {
  getList(params: GetSkillsParams = {}): Promise<ApiResponse<{ skills: Skill[] }>> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get(`/skills?${query}`);
  },

  getDetail(skillId: string): Promise<ApiResponse<{ skill: Skill }>> {
    return api.get(`/skills/${skillId}`);
  },

  install(skillId: string, options: Record<string, unknown> = {}): Promise<ApiResponse> {
    return api.post(`/skills/${skillId}/install`, options);
  },

  uninstall(skillId: string): Promise<ApiResponse> {
    return api.delete(`/skills/${skillId}`);
  },

  updateConfig(skillId: string, config: Record<string, unknown>): Promise<ApiResponse> {
    return api.put(`/skills/${skillId}/config`, config);
  },

  getConfig(skillId: string): Promise<ApiResponse<{ config: Record<string, unknown> }>> {
    return api.get(`/skills/${skillId}/config`);
  },

  toggleEnabled(skillId: string, enabled: boolean): Promise<ApiResponse> {
    return api.put(`/skills/${skillId}/enabled`, { enabled });
  },

  testCall(skillId: string, params: Record<string, unknown> = {}): Promise<ApiResponse<{ result: unknown }>> {
    return api.post(`/skills/${skillId}/test`, params);
  },

  getHistory(skillId: string, params: Record<string, unknown> = {}): Promise<ApiResponse<{ history: unknown[] }>> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get(`/skills/${skillId}/history?${query}`);
  },

  getMCPServers(): Promise<ApiResponse<{ servers: MCPServer[] }>> {
    return api.get('/skills/mcp-servers');
  },

  addMCPServer(server: Partial<MCPServer>): Promise<ApiResponse<{ server: MCPServer }>> {
    return api.post('/skills/mcp-servers', server);
  },

  updateMCPServer(serverId: string, server: Partial<MCPServer>): Promise<ApiResponse> {
    return api.put(`/skills/mcp-servers/${serverId}`, server);
  },

  deleteMCPServer(serverId: string): Promise<ApiResponse> {
    return api.delete(`/skills/mcp-servers/${serverId}`);
  },

  testMCPServer(serverId: string): Promise<ApiResponse<{ status: string }>> {
    return api.post(`/skills/mcp-servers/${serverId}/test`);
  },

  searchMarket(query: string): Promise<ApiResponse<{ skills: Skill[] }>> {
    return api.get(`/skills/market/search?q=${encodeURIComponent(query)}`);
  },

  getCategories(): Promise<ApiResponse<{ categories: string[] }>> {
    return api.get('/skills/categories');
  },

  getRecommended(): Promise<ApiResponse<{ skills: Skill[] }>> {
    return api.get('/skills/recommended');
  }
};

export default skillApi;