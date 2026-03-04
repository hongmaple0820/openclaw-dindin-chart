/**
 * 任务系统 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const taskApi = {
  // ==================== 任务列表 ====================
  
  /**
   * 获取任务列表
   * @param {Object} params - 查询参数
   * @param {string} params.status - 状态筛选 (pending/in_progress/completed)
   * @param {string} params.priority - 优先级筛选 (high/medium/low)
   * @param {string} params.assignee - 执行者ID
   * @param {string} params.search - 搜索关键词
   * @param {boolean} params.pinned - 仅置顶
   */
  getList: (params = {}) => api.get('/tasks', { params }),

  /**
   * 获取置顶任务
   */
  getPinned: () => api.get('/tasks/pinned'),

  /**
   * 获取任务详情
   */
  getDetail: (id) => api.get(`/tasks/${id}`),

  /**
   * 创建任务
   */
  create: (data) => api.post('/tasks', data),

  /**
   * 更新任务
   */
  update: (id, data) => api.put(`/tasks/${id}`, data),

  /**
   * 删除任务
   */
  delete: (id) => api.delete(`/tasks/${id}`),

  // ==================== 任务状态 ====================

  /**
   * 更新任务状态
   */
  updateStatus: (id, status) => api.put(`/tasks/${id}/status`, { status }),

  /**
   * 置顶/取消置顶任务
   */
  togglePin: (id) => api.put(`/tasks/${id}/pin`),

  // ==================== 执行者 ====================

  /**
   * 添加执行者
   */
  addAssignee: (taskId, userId) => api.post(`/tasks/${taskId}/assignees`, { userId }),

  /**
   * 移除执行者
   */
  removeAssignee: (taskId, userId) => api.delete(`/tasks/${taskId}/assignees/${userId}`),

  /**
   * 替换执行者列表
   */
  setAssignees: (taskId, userIds) => api.put(`/tasks/${taskId}/assignees`, { userIds }),

  // ==================== 上下文 ====================

  /**
   * 更新任务上下文
   */
  updateContext: (taskId, context) => api.put(`/tasks/${taskId}/context`, { context }),

  // ==================== 日志 ====================

  /**
   * 获取任务日志
   */
  getLogs: (taskId, params = {}) => api.get(`/tasks/${taskId}/logs`, { params }),

  /**
   * 添加任务日志
   */
  addLog: (taskId, content) => api.post(`/tasks/${taskId}/logs`, { content }),

  // ==================== 评论 ====================

  /**
   * 获取任务评论
   */
  getComments: (taskId, params = {}) => api.get(`/tasks/${taskId}/comments`, { params }),

  /**
   * 添加任务评论
   */
  addComment: (taskId, content) => api.post(`/tasks/${taskId}/comments`, { content }),

  /**
   * 删除任务评论
   */
  deleteComment: (taskId, commentId) => api.delete(`/tasks/${taskId}/comments/${commentId}`),

  // ==================== 批量操作 ====================

  /**
   * 批量更新任务状态
   */
  batchUpdateStatus: (taskIds, status) => api.put('/tasks/batch/status', { taskIds, status }),

  /**
   * 批量删除任务
   */
  batchDelete: (taskIds) => api.delete('/tasks/batch', { data: { taskIds } })
};

export default taskApi;
