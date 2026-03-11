/**
 * 认证相关 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';
import type { ApiResponse, LoginResponse, User } from '@/types';

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
}

interface LoginData {
  username: string;
  password: string;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
}

interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
}

export const authApi = {
  register(data: RegisterData): Promise<LoginResponse> {
    return api.post('/auth/register', data);
  },

  login(data: LoginData): Promise<LoginResponse> {
    return api.post('/auth/login', data);
  },

  refresh(refreshToken: string): Promise<LoginResponse> {
    return api.post('/auth/refresh', { refreshToken });
  },

  logout(refreshToken: string, logoutAll = false): Promise<ApiResponse> {
    return api.post('/auth/logout', { refreshToken, logoutAll });
  },

  getMe(): Promise<ApiResponse<{ user: User }>> {
    return api.get('/auth/me');
  },

  forgotPassword(email: string): Promise<ApiResponse> {
    return api.post('/auth/forgot-password', { email });
  },

  resetPassword(data: ResetPasswordData): Promise<ApiResponse> {
    return api.post('/auth/reset-password', data);
  },

  changePassword(data: ChangePasswordData): Promise<ApiResponse> {
    return api.post('/auth/change-password', data);
  }
};

export default authApi;