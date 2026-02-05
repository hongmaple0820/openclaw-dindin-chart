/**
 * 用户相关 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';

export const userApi = {
  /**
   * 获取个人信息
   */
  getProfile() {
    return api.get('/user/profile');
  },

  /**
   * 更新个人信息
   */
  updateProfile(data) {
    return api.put('/user/profile', data);
  },

  /**
   * 获取登录历史
   */
  getLoginHistory(limit = 10) {
    return api.get('/user/login-history', { params: { limit } });
  },

  // ========== 管理员接口 ==========

  /**
   * 获取用户列表
   */
  getList(params) {
    return api.get('/user/list', { params });
  },

  /**
   * 获取用户详情
   */
  getById(id) {
    return api.get(`/user/${id}`);
  },

  /**
   * 更新用户角色
   */
  updateRole(id, role) {
    return api.put(`/user/${id}/role`, { role });
  },

  /**
   * 更新用户状态
   */
  updateStatus(id, status) {
    return api.put(`/user/${id}/status`, { status });
  },

  /**
   * 删除用户
   */
  delete(id) {
    return api.delete(`/user/${id}`);
  },

  /**
   * 重置用户密码
   */
  resetPassword(id, newPassword) {
    return api.post(`/user/${id}/reset-password`, { newPassword });
  }
};

export default userApi;
