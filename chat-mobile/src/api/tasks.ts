/**
 * 任务系统 API
 * @author 小琳
 * @date 2026-03-04
 */
import { API_BASE_URL } from '@/config/index'

// 封装请求
const request = (options: any) => {
  const token = uni.getStorageSync('accessToken')
  
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(res.data || res)
        }
      },
      fail: reject
    })
  })
}

// 任务类型
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  assignees?: Array<{ id: string; name: string; avatar?: string }>
  context?: Record<string, any>
  pinned?: boolean
  dueDate?: number
  createdAt: number
  updatedAt: number
  createdBy: string
  logs?: Array<{ id: string; content: string; createdAt: number }>
  comments?: Array<{ id: string; content: string; userId: string; createdAt: number }>
}

// 任务 API
export const taskApi = {
  // ==================== 任务列表 ====================

  // 获取任务列表
  getList: (params?: { status?: string; priority?: string; assignee?: string; search?: string; pinned?: boolean }) => {
    return request({
      url: '/tasks',
      method: 'GET',
      data: params
    })
  },

  // 获取置顶任务
  getPinned: () => {
    return request({
      url: '/tasks/pinned',
      method: 'GET'
    })
  },

  // 获取任务详情
  getDetail: (id: string) => {
    return request({
      url: `/tasks/${id}`,
      method: 'GET'
    })
  },

  // 创建任务
  create: (data: Partial<Task>) => {
    return request({
      url: '/tasks',
      method: 'POST',
      data
    })
  },

  // 更新任务
  update: (id: string, data: Partial<Task>) => {
    return request({
      url: `/tasks/${id}`,
      method: 'PUT',
      data
    })
  },

  // 删除任务
  delete: (id: string) => {
    return request({
      url: `/tasks/${id}`,
      method: 'DELETE'
    })
  },

  // ==================== 任务状态 ====================

  // 更新任务状态
  updateStatus: (id: string, status: string) => {
    return request({
      url: `/tasks/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  },

  // 置顶/取消置顶任务
  togglePin: (id: string) => {
    return request({
      url: `/tasks/${id}/pin`,
      method: 'PUT'
    })
  },

  // ==================== 执行者 ====================

  // 添加执行者
  addAssignee: (taskId: string, userId: string) => {
    return request({
      url: `/tasks/${taskId}/assignees`,
      method: 'POST',
      data: { userId }
    })
  },

  // 移除执行者
  removeAssignee: (taskId: string, userId: string) => {
    return request({
      url: `/tasks/${taskId}/assignees/${userId}`,
      method: 'DELETE'
    })
  },

  // 替换执行者列表
  setAssignees: (taskId: string, userIds: string[]) => {
    return request({
      url: `/tasks/${taskId}/assignees`,
      method: 'PUT',
      data: { userIds }
    })
  },

  // ==================== 上下文 ====================

  // 更新任务上下文
  updateContext: (taskId: string, context: Record<string, any>) => {
    return request({
      url: `/tasks/${taskId}/context`,
      method: 'PUT',
      data: { context }
    })
  },

  // ==================== 日志 ====================

  // 获取任务日志
  getLogs: (taskId: string, params?: { limit?: number; offset?: number }) => {
    return request({
      url: `/tasks/${taskId}/logs`,
      method: 'GET',
      data: params
    })
  },

  // 添加任务日志
  addLog: (taskId: string, content: string) => {
    return request({
      url: `/tasks/${taskId}/logs`,
      method: 'POST',
      data: { content }
    })
  },

  // ==================== 评论 ====================

  // 获取任务评论
  getComments: (taskId: string, params?: { limit?: number; offset?: number }) => {
    return request({
      url: `/tasks/${taskId}/comments`,
      method: 'GET',
      data: params
    })
  },

  // 添加任务评论
  addComment: (taskId: string, content: string) => {
    return request({
      url: `/tasks/${taskId}/comments`,
      method: 'POST',
      data: { content }
    })
  },

  // 删除任务评论
  deleteComment: (taskId: string, commentId: string) => {
    return request({
      url: `/tasks/${taskId}/comments/${commentId}`,
      method: 'DELETE'
    })
  },

  // ==================== 批量操作 ====================

  // 批量更新任务状态
  batchUpdateStatus: (taskIds: string[], status: string) => {
    return request({
      url: '/tasks/batch/status',
      method: 'PUT',
      data: { taskIds, status }
    })
  },

  // 批量删除任务
  batchDelete: (taskIds: string[]) => {
    return request({
      url: '/tasks/batch',
      method: 'DELETE',
      data: { taskIds }
    })
  }
}

export default taskApi