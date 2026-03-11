/**
 * 用户相关 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';
import type { ApiResponse, User, PaginatedResponse } from '@/types';

interface UpdateProfileData {
  nickname?: string;
  email?: string;
  avatar?: string;
}

interface LoginHistoryItem {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export const userApi = {
  getProfile(): Promise<ApiResponse<{ user: User }>> {
    return api.get('/user/profile');
  },

  updateProfile(data: UpdateProfileData): Promise<ApiResponse<{ user: User }>> {
    return api.put('/user/profile', data);
  },

  getLoginHistory(limit = 10): Promise<ApiResponse<{ history: LoginHistoryItem[] }>> {
    return api.get('/user/login-history', { params: { limit } });
  },

  getList(params: UserListParams): Promise<ApiResponse<{ users: User[]; total: number }>> {
    return api.get('/user/list', { params });
  },

  getById(id: string): Promise<ApiResponse<{ user: User }>> {
    return api.get(`/user/${id}`);
  },

  updateRole(id: string, role: string): Promise<ApiResponse> {
    return api.put(`/user/${id}/role`, { role });
  },

  updateStatus(id: string, status: string): Promise<ApiResponse> {
    return api.put(`/user/${id}/status`, { status });
  },

  delete(id: string): Promise<ApiResponse> {
    return api.delete(`/user/${id}`);
  },

  resetPassword(id: string, newPassword: string): Promise<ApiResponse> {
    return api.post(`/user/${id}/reset-password`, { newPassword });
  }
};

export default userApi;