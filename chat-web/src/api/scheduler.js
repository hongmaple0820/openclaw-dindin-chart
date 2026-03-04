/**
 * 定时任务 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const schedulerApi = {
  // ==================== 定时任务管理 ====================
  
  /**
   * 获取定时任务列表
   */
  getList: () => api.get('/scheduler'),

  /**
   * 获取定时任务详情
   */
  getDetail: (id) => api.get(`/scheduler/${id}`),

  /**
   * 创建定时任务
   * @param {Object} data - 任务数据
   * @param {string} data.name - 任务名称
   * @param {string} data.cron - Cron 表达式
   * @param {string} data.type - 任务类型 (message/command/reminder/webhook)
   * @param {Object} data.config - 任务配置
   * @param {boolean} data.enabled - 是否启用
   */
  create: (data) => api.post('/scheduler', data),

  /**
   * 更新定时任务
   */
  update: (id, data) => api.put(`/scheduler/${id}`, data),

  /**
   * 删除定时任务
   */
  delete: (id) => api.delete(`/scheduler/${id}`),

  // ==================== 任务状态 ====================

  /**
   * 启用/禁用定时任务
   */
  toggle: (id) => api.put(`/scheduler/${id}/toggle`),

  /**
   * 立即执行一次
   */
  runNow: (id) => api.post(`/scheduler/${id}/run`),

  // ==================== 执行历史 ====================

  /**
   * 获取执行历史
   * @param {string} id - 任务ID（可选，不传则获取全部）
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @param {string} params.status - 状态筛选 (success/failed/running)
   */
  getHistory: (params = {}) => api.get('/scheduler/history', { params }),

  /**
   * 获取任务执行历史
   */
  getTaskHistory: (id, params = {}) => api.get(`/scheduler/${id}/history`, { params }),

  /**
   * 获取执行详情
   */
  getExecution: (executionId) => api.get(`/scheduler/execution/${executionId}`),

  // ==================== Cron 工具 ====================

  /**
   * 验证 Cron 表达式
   */
  validateCron: (cron) => api.post('/scheduler/validate', { cron }),

  /**
   * 获取 Cron 下次执行时间
   */
  getNextRuns: (cron, count = 5) => api.post('/scheduler/next-runs', { cron, count })
};

export default schedulerApi;
