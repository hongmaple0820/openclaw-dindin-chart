/**
 * 用户状态管理
 * @author 小琳
 * @date 2026-02-06
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import type { User, LoginResponse, ApiResponse } from '@/types';

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string>(localStorage.getItem('accessToken') || '');
  const refreshToken = ref<string>(localStorage.getItem('refreshToken') || '');

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const username = computed(() => user.value?.username || '');
  const nickname = computed(() => user.value?.nickname || user.value?.username || '');

  async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = await authApi.login(credentials);
    if (res.success && res.user && res.accessToken && res.refreshToken) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  async function register(data: RegisterData): Promise<LoginResponse> {
    const res = await authApi.register(data);
    if (res.success && res.user && res.accessToken && res.refreshToken) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  function setAuth(userData: User, access: string, refresh: string): void {
    user.value = userData;
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  async function fetchUser(): Promise<User | null> {
    if (!accessToken.value) return null;
    try {
      const res = await authApi.getMe();
      if (res.success && res.data?.user) {
        user.value = res.data.user;
        return res.data.user;
      }
      return null;
    } catch {
      logout();
      return null;
    }
  }

  async function logout(logoutAll = false): Promise<void> {
    try {
      if (refreshToken.value) {
        await authApi.logout(refreshToken.value, logoutAll);
      }
    } catch {
      // 忽略错误
    } finally {
      clearAuth();
    }
  }

  function clearAuth(): void {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  function updateUser(data: Partial<User>): void {
    if (user.value) {
      user.value = { ...user.value, ...data };
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoggedIn,
    isAdmin,
    username,
    nickname,
    login,
    register,
    setAuth,
    fetchUser,
    logout,
    clearAuth,
    updateUser
  };
});