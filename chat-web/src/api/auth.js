/**
 * 认证相关 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';

export const authApi = {
  /**
   * 用户注册
   */
  register(data) {
    return api.post('/auth/register', data);
  },

  /**
   * 用户登录
   */
  login(data) {
    return api.post('/auth/login', data);
  },

  /**
   * 刷新令牌
   */
  refresh(refreshToken) {
    return api.post('/auth/refresh', { refreshToken });
  },

  /**
   * 登出
   */
  logout(refreshToken, logoutAll = false) {
    return api.post('/auth/logout', { refreshToken, logoutAll });
  },

  /**
   * 获取当前用户信息
   */
  getMe() {
    return api.get('/auth/me');
  },

  /**
   * 发送密码重置验证码
   */
  forgotPassword(email) {
    return api.post('/auth/forgot-password', { email });
  },

  /**
   * 重置密码
   */
  resetPassword(data) {
    return api.post('/auth/reset-password', data);
  },

  /**
   * 修改密码
   */
  changePassword(data) {
    return api.post('/auth/change-password', data);
  }
};

export default authApi;
