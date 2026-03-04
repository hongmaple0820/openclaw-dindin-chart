/**
 * 管理后台 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const adminApi = {
  // ==================== 用户管理 ====================
  
  /**
   * 获取用户列表
   */
  getUsers(params = {}) {
    return api.get('/admin/users', { params });
  },

  /**
   * 获取待审核用户
   */
  getPendingUsers() {
    return api.get('/admin/users/pending');
  },

  /**
   * 审批用户
   */
  approveUser(userId) {
    return api.post(`/admin/users/${userId}/approve`);
  },

  /**
   * 拒绝用户
   */
  rejectUser(userId, reason = '') {
    return api.post(`/admin/users/${userId}/reject`, { reason });
  },

  /**
   * 封禁用户
   */
  banUser(userId, reason = '') {
    return api.post(`/admin/users/${userId}/ban`, { reason });
  },

  /**
   * 解封用户
   */
  unbanUser(userId) {
    return api.post(`/admin/users/${userId}/unban`);
  },

  /**
   * 获取用户详情
   */
  getUserDetail(userId) {
    return api.get(`/admin/users/${userId}`);
  },

  /**
   * 更新用户信息
   */
  updateUser(userId, data) {
    return api.put(`/admin/users/${userId}`, data);
  },

  // ==================== 技能管理 ====================

  /**
   * 获取所有技能列表（管理员视角）
   */
  getAllSkills(params = {}) {
    return api.get('/admin/skills', { params });
  },

  /**
   * 启用/禁用技能
   */
  toggleSkill(skillId, enabled) {
    return api.post(`/admin/skills/${skillId}/toggle`, { enabled });
  },

  /**
   * 删除技能
   */
  deleteSkill(skillId) {
    return api.delete(`/admin/skills/${skillId}`);
  },

  /**
   * 更新技能配置
   */
  updateSkillConfig(skillId, config) {
    return api.put(`/admin/skills/${skillId}/config`, config);
  },

  // ==================== MCP 管理 ====================

  /**
   * 获取 MCP 服务器列表
   */
  getMCPServers(params = {}) {
    return api.get('/admin/mcp/servers', { params });
  },

  /**
   * 添加 MCP 服务器
   */
  addMCPServer(data) {
    return api.post('/admin/mcp/servers', data);
  },

  /**
   * 更新 MCP 服务器
   */
  updateMCPServer(serverId, data) {
    return api.put(`/admin/mcp/servers/${serverId}`, data);
  },

  /**
   * 删除 MCP 服务器
   */
  deleteMCPServer(serverId) {
    return api.delete(`/admin/mcp/servers/${serverId}`);
  },

  /**
   * 启用/禁用 MCP 服务器
   */
  toggleMCPServer(serverId, enabled) {
    return api.post(`/admin/mcp/servers/${serverId}/toggle`, { enabled });
  },

  /**
   * 获取 MCP 服务器状态
   */
  getMCPStatus(serverId) {
    return api.get(`/admin/mcp/servers/${serverId}/status`);
  },

  /**
   * 获取 MCP 工具列表
   */
  getMCPTools(serverId) {
    return api.get(`/admin/mcp/servers/${serverId}/tools`);
  },

  // ==================== 系统监控 ====================

  /**
   * 获取系统概览
   */
  getSystemOverview() {
    return api.get('/admin/system/overview');
  },

  /**
   * 获取系统资源使用情况
   */
  getResourceUsage() {
    return api.get('/admin/system/resources');
  },

  /**
   * 获取服务状态
   */
  getServicesStatus() {
    return api.get('/admin/system/services');
  },

  /**
   * 获取系统日志
   */
  getSystemLogs(params = {}) {
    return api.get('/admin/system/logs', { params });
  },

  /**
   * 获取系统配置
   */
  getSystemConfig() {
    return api.get('/admin/system/config');
  },

  /**
   * 更新系统配置
   */
  updateSystemConfig(data) {
    return api.put('/admin/system/config', data);
  },

  /**
   * 重启服务
   */
  restartService(serviceName) {
    return api.post(`/admin/system/services/${serviceName}/restart`);
  },

  /**
   * 清理缓存
   */
  clearCache(cacheType = 'all') {
    return api.post('/admin/system/cache/clear', { type: cacheType });
  },

  // ==================== 统计数据 ====================

  /**
   * 获取统计数据
   */
  getStatistics(params = {}) {
    return api.get('/admin/statistics', { params });
  },

  /**
   * 获取活跃用户统计
   */
  getActiveUsers(days = 7) {
    return api.get('/admin/statistics/active-users', { params: { days } });
  },

  /**
   * 获取消息统计
   */
  getMessageStats(days = 7) {
    return api.get('/admin/statistics/messages', { params: { days } });
  }
};

export default adminApi;