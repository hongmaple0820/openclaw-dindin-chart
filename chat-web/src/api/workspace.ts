/**
 * 工作区 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, Workspace, WorkspaceFile } from '@/types';

interface CreateWorkspaceData {
  name: string;
  description?: string;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

export const workspaceApi = {
  getList: (params?: Record<string, unknown>): Promise<ApiResponse<{ workspaces: Workspace[] }>> => 
    api.get('/workspaces', { params }),

  getDetail: (id: string): Promise<ApiResponse<{ workspace: Workspace }>> => 
    api.get(`/workspaces/${id}`),

  create: (data: CreateWorkspaceData): Promise<ApiResponse<{ workspace: Workspace }>> => 
    api.post('/workspaces', data),

  update: (id: string, data: Partial<CreateWorkspaceData>): Promise<ApiResponse<{ workspace: Workspace }>> => 
    api.put(`/workspaces/${id}`, data),

  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/workspaces/${id}`),

  getStats: (id: string): Promise<ApiResponse<{ stats: Record<string, unknown> }>> => 
    api.get(`/workspaces/${id}/stats`),

  getFileTree: (id: string, path = '/'): Promise<ApiResponse<{ tree: FileTreeItem[] }>> => 
    api.get(`/workspaces/${id}/files/tree`, { params: { path } }),

  getFiles: (id: string, params?: Record<string, unknown>): Promise<ApiResponse<{ files: WorkspaceFile[] }>> => 
    api.get(`/workspaces/${id}/files`, { params }),

  getFileContent: (id: string, filePath: string): Promise<ApiResponse<{ content: string }>> => 
    api.get(`/workspaces/${id}/files/content`, { params: { path: filePath } }),

  saveFileContent: (id: string, filePath: string, content: string): Promise<ApiResponse> => 
    api.put(`/workspaces/${id}/files/content`, { path: filePath, content }),

  createFile: (id: string, path: string, type: 'file' | 'directory' = 'file', content = ''): Promise<ApiResponse> => 
    api.post(`/workspaces/${id}/files`, { path, type, content }),

  deleteFile: (id: string, filePath: string): Promise<ApiResponse> => 
    api.delete(`/workspaces/${id}/files`, { params: { path: filePath } }),

  renameFile: (id: string, oldPath: string, newPath: string): Promise<ApiResponse> => 
    api.put(`/workspaces/${id}/files/rename`, { oldPath, newPath }),

  moveFile: (id: string, sourcePath: string, targetPath: string): Promise<ApiResponse> => 
    api.put(`/workspaces/${id}/files/move`, { sourcePath, targetPath }),

  copyFile: (id: string, sourcePath: string, targetPath: string): Promise<ApiResponse> => 
    api.post(`/workspaces/${id}/files/copy`, { sourcePath, targetPath }),

  uploadFile: (id: string, formData: FormData, onProgress?: unknown): Promise<ApiResponse> => 
    api.post(`/workspaces/${id}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress as never
    }),

  downloadFile: (id: string, filePath: string): Promise<unknown> => 
    api.get(`/workspaces/${id}/files/download`, { 
      params: { path: filePath },
      responseType: 'blob'
    }),

  downloadMultiple: (id: string, paths: string[]): Promise<unknown> => 
    api.post(`/workspaces/${id}/files/download-multiple`, { paths }, {
      responseType: 'blob'
    }),

  searchFiles: (id: string, query: string, options?: Record<string, unknown>): Promise<ApiResponse<{ files: WorkspaceFile[] }>> => 
    api.get(`/workspaces/${id}/files/search`, { params: { query, ...options } }),

  searchContent: (id: string, query: string, options?: Record<string, unknown>): Promise<ApiResponse<{ results: unknown[] }>> => 
    api.get(`/workspaces/${id}/files/search-content`, { params: { query, ...options } })
};

export default workspaceApi;