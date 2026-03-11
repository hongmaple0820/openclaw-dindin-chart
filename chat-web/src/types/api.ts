/**
 * API 响应类型定义
 * @author 小琳
 * @date 2026-03-11
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface LoginResponse extends ApiResponse {
  user?: import('./models').User;
  accessToken?: string;
  refreshToken?: string;
}

export interface RegisterResponse extends ApiResponse {
  user?: import('./models').User;
  accessToken?: string;
  refreshToken?: string;
}