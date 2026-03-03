/**
 * 项目群 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';

export const projectApi = {
  // ==================== 项目群 ====================
  
  /**
   * 创建项目群
   */
  create: (data) => api.post('/projects', data),

  /**
   * 获取项目群列表
   */
  getList: () => api.get('/projects'),

  /**
   * 获取项目群详情
   */
  getDetail: (id) => api.get(`/projects/${id}`),

  /**
   * 更新项目群
   */
  update: (id, data) => api.put(`/projects/${id}`, data),

  /**
   * 删除项目群
   */
  delete: (id) => api.delete(`/projects/${id}`),

  // ==================== 技能管理 ====================

  /**
   * 获取项目群技能列表
   */
  getSkills: (id) => api.get(`/projects/${id}/skills`),

  /**
   * 创建技能
   */
  createSkill: (id, data) => api.post(`/projects/${id}/skills`, data),

  /**
   * 更新技能
   */
  updateSkill: (id, skillId, data) => api.put(`/projects/${id}/skills/${skillId}`, data),

  /**
   * 删除技能
   */
  deleteSkill: (id, skillId) => api.delete(`/projects/${id}/skills/${skillId}`),

  // ==================== 任务管理 ====================

  /**
   * 获取项目群任务列表
   */
  getTasks: (id) => api.get(`/projects/${id}/tasks`),

  /**
   * 创建任务
   */
  createTask: (id, data) => api.post(`/projects/${id}/tasks`, data),

  /**
   * 更新任务
   */
  updateTask: (id, taskId, data) => api.put(`/projects/${id}/tasks/${taskId}`, data),

  /**
   * 删除任务
   */
  deleteTask: (id, taskId) => api.delete(`/projects/${id}/tasks/${taskId}`),

  /**
   * 添加任务评论
   */
  addComment: (id, taskId, content) => api.post(`/projects/${id}/tasks/${taskId}/comments`, { content }),

  // ==================== 看板管理 ====================

  /**
   * 获取看板列表
   */
  getBoards: (id) => api.get(`/projects/${id}/boards`),

  /**
   * 创建看板列
   */
  createBoard: (id, data) => api.post(`/projects/${id}/boards`, data),

  /**
   * 重新排序看板列
   */
  reorderBoards: (id, data) => api.put(`/projects/${id}/boards/reorder`, data),

  // ==================== 成员管理 ====================

  /**
   * 获取项目群成员
   */
  getMembers: (id) => api.get(`/projects/${id}/members`),

  /**
   * 添加成员
   */
  addMember: (id, userId) => api.post(`/projects/${id}/members`, { userId }),

  /**
   * 移除成员
   */
  removeMember: (id, userId) => api.delete(`/projects/${id}/members/${userId}`)
};

export default projectApi;
