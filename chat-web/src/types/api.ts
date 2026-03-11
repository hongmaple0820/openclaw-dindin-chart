import type { User } from './models';

export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  error?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse {
  total: number;
  page: number;
  limit: number;
  items?: T[];
}

export interface LoginResponse extends ApiResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

export interface RegisterResponse extends ApiResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}