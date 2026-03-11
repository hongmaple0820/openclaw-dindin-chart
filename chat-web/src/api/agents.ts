/**
 * Agent 管理 API
 * @author 小琳
 * @date 2026-03-04
 * @updated 2026-03-07 - 添加供应商字段支持、自动接入功能
 */
import api from './index';
import type { ApiResponse, Agent, PaginatedResponse } from '@/types';

interface GetAgentsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  visibility?: string;
}

interface CreateAgentData {
  name: string;
  description?: string;
  avatar?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  visibility?: 'public' | 'private';
  providerId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatOptions {
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface MemoryData {
  content: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

interface ImportAgentsData {
  serverUrl: string;
  token: string;
  agentIds?: string[];
}

export const agentsApi = {
  getList: (params: GetAgentsParams = {}): Promise<ApiResponse<{ agents: Agent[]; total: number }>> => 
    api.get('/agents', { params }),
  
  getPublicList: (params: GetAgentsParams = {}): Promise<ApiResponse<{ agents: Agent[]; total: number }>> => 
    api.get('/agents/public', { params }),
  
  getMyList: (params: GetAgentsParams = {}): Promise<ApiResponse<{ agents: Agent[]; total: number }>> => 
    api.get('/agents/my', { params }),
  
  getDetail: (id: string): Promise<ApiResponse<{ agent: Agent }>> => 
    api.get(`/agents/${id}`),
  
  create: (data: CreateAgentData): Promise<ApiResponse<{ agent: Agent }>> => 
    api.post('/agents', data),
  
  update: (id: string, data: Partial<CreateAgentData>): Promise<ApiResponse<{ agent: Agent }>> => 
    api.put(`/agents/${id}`, data),
  
  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/agents/${id}`),
  
  toggleStatus: (id: string): Promise<ApiResponse<{ enabled: boolean }>> => 
    api.patch(`/agents/${id}/status`),
  
  getMemories: (id: string, params = {}): Promise<ApiResponse<{ memories: MemoryData[] }>> => 
    api.get(`/agents/${id}/memories`, { params }),
  
  addMemory: (id: string, data: MemoryData): Promise<ApiResponse> => 
    api.post(`/agents/${id}/memories`, data),
  
  deleteMemory: (id: string, memoryId: string): Promise<ApiResponse> => 
    api.delete(`/agents/${id}/memories/${memoryId}`),
  
  searchMemories: (id: string, query: string, params = {}): Promise<ApiResponse<{ memories: MemoryData[] }>> => 
    api.get(`/agents/${id}/memories/search`, { params: { q: query, ...params } }),
  
  chat: (id: string, messages: ChatMessage[], options: ChatOptions = {}): Promise<Response> => {
    const token = localStorage.getItem('accessToken');
    return fetch(`/api/agents/${id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ messages, ...options })
    });
  },
  
  chatSync: (id: string, messages: ChatMessage[], options: ChatOptions = {}): Promise<ApiResponse<{ response: string }>> => 
    api.post(`/agents/${id}/chat/sync`, { messages, ...options }),
  
  getChatHistory: (id: string, params = {}): Promise<ApiResponse<{ history: ChatMessage[] }>> => 
    api.get(`/agents/${id}/chat/history`, { params }),
  
  clearChatHistory: (id: string): Promise<ApiResponse> => 
    api.delete(`/agents/${id}/chat/history`),
  
  duplicate: (id: string): Promise<ApiResponse<{ agent: Agent }>> => 
    api.post(`/agents/${id}/duplicate`),
  
  getCapabilityTemplates: (): Promise<ApiResponse<{ templates: unknown[] }>> => 
    api.get('/agents/capabilities/templates'),
  
  test: (id: string, input: string): Promise<ApiResponse<{ response: string }>> => 
    api.post(`/agents/${id}/test`, { input }),
  
  getStats: (id: string): Promise<ApiResponse<{ stats: Record<string, unknown> }>> => 
    api.get(`/agents/${id}/stats`),
  
  getAvailableForImport: (serverUrl: string, token: string): Promise<ApiResponse<{ agents: Agent[] }>> => 
    api.post('/agents/import/available', { serverUrl, token }),
  
  importAgents: (data: ImportAgentsData): Promise<ApiResponse<{ agents: Agent[] }>> => 
    api.post('/agents/import', data),
  
  generateSkill: (agentId: string): Promise<ApiResponse<{ skillPath: string }>> => 
    api.post(`/agents/${agentId}/generate-skill`),
  
  generateSkills: (agentIds: string[]): Promise<ApiResponse<{ skills: string[] }>> => 
    api.post('/agents/generate-skills', { agentIds }),
  
  getProviders: (): Promise<ApiResponse<{ providers: unknown[] }>> => 
    api.get('/agents/providers'),
  
  getProviderModels: (provider: string): Promise<ApiResponse<{ models: unknown[] }>> => 
    api.get(`/agents/providers/${provider}/models`)
};

export default agentsApi;