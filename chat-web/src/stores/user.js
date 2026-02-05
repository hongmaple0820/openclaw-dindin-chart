/**
 * 用户状态管理
 * @author 小琳
 * @date 2026-02-06
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref(null);
  const accessToken = ref(localStorage.getItem('accessToken') || '');
  const refreshToken = ref(localStorage.getItem('refreshToken') || '');

  // 计算属性
  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const username = computed(() => user.value?.username || '');
  const nickname = computed(() => user.value?.nickname || user.value?.username || '');

  // 登录
  async function login(credentials) {
    const res = await authApi.login(credentials);
    if (res.success) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  // 注册
  async function register(data) {
    const res = await authApi.register(data);
    if (res.success) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  // 设置认证信息
  function setAuth(userData, access, refresh) {
    user.value = userData;
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  // 获取当前用户信息
  async function fetchUser() {
    if (!accessToken.value) return null;
    try {
      const res = await authApi.getMe();
      if (res.success) {
        user.value = res.user;
      }
      return res.user;
    } catch (error) {
      logout();
      return null;
    }
  }

  // 登出
  async function logout(logoutAll = false) {
    try {
      if (refreshToken.value) {
        await authApi.logout(refreshToken.value, logoutAll);
      }
    } catch (error) {
      // 忽略错误
    } finally {
      clearAuth();
    }
  }

  // 清除认证信息
  function clearAuth() {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // 更新用户信息
  function updateUser(data) {
    if (user.value) {
      user.value = { ...user.value, ...data };
    }
  }

  return {
    // 状态
    user,
    accessToken,
    refreshToken,
    // 计算属性
    isLoggedIn,
    isAdmin,
    username,
    nickname,
    // 方法
    login,
    register,
    setAuth,
    fetchUser,
    logout,
    clearAuth,
    updateUser
  };
});
