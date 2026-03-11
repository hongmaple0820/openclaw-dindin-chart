/**
 * 沙箱 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, Sandbox } from '@/types';

interface CreateSandboxData {
  name: string;
  image?: string;
}

interface SandboxFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
}

export const sandboxApi = {
  getList: (): Promise<ApiResponse<{ sandboxes: Sandbox[] }>> => 
    api.get('/sandboxes'),

  getDetail: (id: string): Promise<ApiResponse<{ sandbox: Sandbox }>> => 
    api.get(`/sandboxes/${id}`),

  create: (data: CreateSandboxData): Promise<ApiResponse<{ sandbox: Sandbox }>> => 
    api.post('/sandboxes', data),

  stop: (id: string): Promise<ApiResponse> => 
    api.post(`/sandboxes/${id}/stop`),

  start: (id: string): Promise<ApiResponse> => 
    api.post(`/sandboxes/${id}/start`),

  restart: (id: string): Promise<ApiResponse> => 
    api.post(`/sandboxes/${id}/restart`),

  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/sandboxes/${id}`),

  getFiles: (id: string, path = '/'): Promise<ApiResponse<{ files: SandboxFile[] }>> => 
    api.get(`/sandboxes/${id}/files`, { params: { path } }),

  getFileContent: (id: string, filePath: string): Promise<ApiResponse<{ content: string }>> => 
    api.get(`/sandboxes/${id}/files/content`, { params: { path: filePath } }),

  saveFileContent: (id: string, filePath: string, content: string): Promise<ApiResponse> => 
    api.put(`/sandboxes/${id}/files/content`, { path: filePath, content }),

  createFile: (id: string, path: string, type: 'file' | 'directory' = 'file'): Promise<ApiResponse> => 
    api.post(`/sandboxes/${id}/files`, { path, type }),

  deleteFile: (id: string, filePath: string): Promise<ApiResponse> => 
    api.delete(`/sandboxes/${id}/files`, { params: { path: filePath } }),

  uploadFile: (id: string, formData: FormData): Promise<ApiResponse> => 
    api.post(`/sandboxes/${id}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  downloadFile: (id: string, filePath: string): Promise<unknown> => 
    api.get(`/sandboxes/${id}/files/download`, { 
      params: { path: filePath },
      responseType: 'blob'
    }),

  executeCommand: (id: string, command: string): Promise<ApiResponse<{ output: string }>> => 
    api.post(`/sandboxes/${id}/execute`, { command }),

  getTerminalHistory: (id: string): Promise<ApiResponse<{ history: string[] }>> => 
    api.get(`/sandboxes/${id}/terminal/history`),

  getResourceUsage: (id: string): Promise<ApiResponse<{ usage: ResourceUsage }>> => 
    api.get(`/sandboxes/${id}/resources`),

  getResourceHistory: (id: string, period = '1h'): Promise<ApiResponse<{ history: ResourceUsage[] }>> => 
    api.get(`/sandboxes/${id}/resources/history`, { params: { period } }),

  getProcesses: (id: string): Promise<ApiResponse<{ processes: Process[] }>> => 
    api.get(`/sandboxes/${id}/processes`),

  killProcess: (id: string, pid: number): Promise<ApiResponse> => 
    api.delete(`/sandboxes/${id}/processes/${pid}`)
};

export default sandboxApi;