/**
 * 任务系统 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';
import type { ApiResponse, Task } from '@/types';

interface GetTasksParams {
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  pinned?: boolean;
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  projectId?: string;
  tags?: string[];
}

interface TaskLog {
  id: string;
  content: string;
  createdAt: string;
}

interface TaskComment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export const taskApi = {
  getList: (params: GetTasksParams = {}): Promise<ApiResponse<{ tasks: Task[] }>> => 
    api.get('/tasks', { params }),

  getPinned: (): Promise<ApiResponse<{ tasks: Task[] }>> => 
    api.get('/tasks/pinned'),

  getDetail: (id: string): Promise<ApiResponse<{ task: Task }>> => 
    api.get(`/tasks/${id}`),

  create: (data: CreateTaskData): Promise<ApiResponse<{ task: Task }>> => 
    api.post('/tasks', data),

  update: (id: string, data: Partial<CreateTaskData>): Promise<ApiResponse<{ task: Task }>> => 
    api.put(`/tasks/${id}`, data),

  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/tasks/${id}`),

  updateStatus: (id: string, status: string): Promise<ApiResponse> => 
    api.put(`/tasks/${id}/status`, { status }),

  togglePin: (id: string): Promise<ApiResponse<{ pinned: boolean }>> => 
    api.put(`/tasks/${id}/pin`),

  addAssignee: (taskId: string, userId: string): Promise<ApiResponse> => 
    api.post(`/tasks/${taskId}/assignees`, { userId }),

  removeAssignee: (taskId: string, userId: string): Promise<ApiResponse> => 
    api.delete(`/tasks/${taskId}/assignees/${userId}`),

  setAssignees: (taskId: string, userIds: string[]): Promise<ApiResponse> => 
    api.put(`/tasks/${taskId}/assignees`, { userIds }),

  updateContext: (taskId: string, context: Record<string, unknown>): Promise<ApiResponse> => 
    api.put(`/tasks/${taskId}/context`, { context }),

  getLogs: (taskId: string, params: Record<string, unknown> = {}): Promise<ApiResponse<{ logs: TaskLog[] }>> => 
    api.get(`/tasks/${taskId}/logs`, { params }),

  addLog: (taskId: string, content: string): Promise<ApiResponse<{ log: TaskLog }>> => 
    api.post(`/tasks/${taskId}/logs`, { content }),

  getComments: (taskId: string, params: Record<string, unknown> = {}): Promise<ApiResponse<{ comments: TaskComment[] }>> => 
    api.get(`/tasks/${taskId}/comments`, { params }),

  addComment: (taskId: string, content: string): Promise<ApiResponse<{ comment: TaskComment }>> => 
    api.post(`/tasks/${taskId}/comments`, { content }),

  deleteComment: (taskId: string, commentId: string): Promise<ApiResponse> => 
    api.delete(`/tasks/${taskId}/comments/${commentId}`),

  batchUpdateStatus: (taskIds: string[], status: string): Promise<ApiResponse> => 
    api.put('/tasks/batch/status', { taskIds, status }),

  batchDelete: (taskIds: string[]): Promise<ApiResponse> => 
    api.delete('/tasks/batch', { data: { taskIds } })
};

export default taskApi;