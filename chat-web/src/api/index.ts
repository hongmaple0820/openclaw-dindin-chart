/**
 * API 配置和 axios 实例
 * @author 小琳
 * @date 2026-02-06
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.code === 'TOKEN_EXPIRED' && 
        !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          
          if (res.data.success) {
            localStorage.setItem('accessToken', res.data.accessToken);
            localStorage.setItem('refreshToken', res.data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

export const configApi = {
  getStatus: () => api.get<ApiResponse>('/config/status')
};

export default api as {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
};