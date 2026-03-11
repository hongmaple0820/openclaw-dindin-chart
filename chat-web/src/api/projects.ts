/**
 * 项目群 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';
import type { ApiResponse, Project, Task, Skill } from '@/types';

interface CreateProjectData {
  name: string;
  description?: string;
}

interface CreateSkillData {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
}

interface Board {
  id: string;
  name: string;
  order: number;
}

export const projectApi = {
  create: (data: CreateProjectData): Promise<ApiResponse<{ project: Project }>> => 
    api.post('/projects', data),

  getList: (): Promise<ApiResponse<{ projects: Project[] }>> => 
    api.get('/projects'),

  getDetail: (id: string): Promise<ApiResponse<{ project: Project }>> => 
    api.get(`/projects/${id}`),

  update: (id: string, data: Partial<CreateProjectData>): Promise<ApiResponse<{ project: Project }>> => 
    api.put(`/projects/${id}`, data),

  delete: (id: string): Promise<ApiResponse> => 
    api.delete(`/projects/${id}`),

  getSkills: (id: string): Promise<ApiResponse<{ skills: Skill[] }>> => 
    api.get(`/projects/${id}/skills`),

  createSkill: (id: string, data: CreateSkillData): Promise<ApiResponse<{ skill: Skill }>> => 
    api.post(`/projects/${id}/skills`, data),

  updateSkill: (id: string, skillId: string, data: Partial<CreateSkillData>): Promise<ApiResponse> => 
    api.put(`/projects/${id}/skills/${skillId}`, data),

  deleteSkill: (id: string, skillId: string): Promise<ApiResponse> => 
    api.delete(`/projects/${id}/skills/${skillId}`),

  getTasks: (id: string): Promise<ApiResponse<{ tasks: Task[] }>> => 
    api.get(`/projects/${id}/tasks`),

  createTask: (id: string, data: CreateTaskData): Promise<ApiResponse<{ task: Task }>> => 
    api.post(`/projects/${id}/tasks`, data),

  updateTask: (id: string, taskId: string, data: Partial<CreateTaskData>): Promise<ApiResponse> => 
    api.put(`/projects/${id}/tasks/${taskId}`, data),

  deleteTask: (id: string, taskId: string): Promise<ApiResponse> => 
    api.delete(`/projects/${id}/tasks/${taskId}`),

  addComment: (id: string, taskId: string, content: string): Promise<ApiResponse> => 
    api.post(`/projects/${id}/tasks/${taskId}/comments`, { content }),

  getBoards: (id: string): Promise<ApiResponse<{ boards: Board[] }>> => 
    api.get(`/projects/${id}/boards`),

  createBoard: (id: string, data: { name: string }): Promise<ApiResponse<{ board: Board }>> => 
    api.post(`/projects/${id}/boards`, data),

  reorderBoards: (id: string, data: { boardIds: string[] }): Promise<ApiResponse> => 
    api.put(`/projects/${id}/boards/reorder`, data),

  getMembers: (id: string): Promise<ApiResponse<{ members: unknown[] }>> => 
    api.get(`/projects/${id}/members`),

  addMember: (id: string, userId: string): Promise<ApiResponse> => 
    api.post(`/projects/${id}/members`, { userId }),

  removeMember: (id: string, userId: string): Promise<ApiResponse> => 
    api.delete(`/projects/${id}/members/${userId}`)
};

export default projectApi;