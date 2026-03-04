/**
 * Agent 管理 API
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

// Agent 类型
export interface Agent {
  id: string
  name: string
  description?: string
  avatar?: string
  status: 'active' | 'inactive' | 'busy'
  model?: string
  systemPrompt?: string
  capabilities?: string[]
  memoryCount?: number
  chatCount?: number
  createdAt: number
  updatedAt: number
  isPublic?: boolean
}

// Agent API
export const agentsApi = {
  // 获取 Agent 列表
  getList: (params?: { status?: string; search?: string }) => {
    return request({
      url: '/agents',
      method: 'GET',
      data: params
    })
  },

  // 获取公开 Agent 列表
  getPublicList: (params?: { limit?: number; offset?: number }) => {
    return request({
      url: '/agents/public',
      method: 'GET',
      data: params
    })
  },

  // 获取我的 Agent 列表
  getMyList: (params?: { limit?: number; offset?: number }) => {
    return request({
      url: '/agents/my',
      method: 'GET',
      data: params
    })
  },

  // 获取单个 Agent 详情
  getDetail: (id: string) => {
    return request({
      url: `/agents/${id}`,
      method: 'GET'
    })
  },

  // 创建 Agent
  create: (data: Partial<Agent>) => {
    return request({
      url: '/agents',
      method: 'POST',
      data
    })
  },

  // 更新 Agent
  update: (id: string, data: Partial<Agent>) => {
    return request({
      url: `/agents/${id}`,
      method: 'PUT',
      data
    })
  },

  // 删除 Agent
  delete: (id: string) => {
    return request({
      url: `/agents/${id}`,
      method: 'DELETE'
    })
  },

  // 切换 Agent 状态
  toggleStatus: (id: string) => {
    return request({
      url: `/agents/${id}/status`,
      method: 'PATCH'
    })
  },

  // 获取 Agent 记忆
  getMemories: (id: string, params?: { limit?: number; offset?: number }) => {
    return request({
      url: `/agents/${id}/memories`,
      method: 'GET',
      data: params
    })
  },

  // 添加记忆
  addMemory: (id: string, data: { content: string; type?: string }) => {
    return request({
      url: `/agents/${id}/memories`,
      method: 'POST',
      data
    })
  },

  // 删除记忆
  deleteMemory: (id: string, memoryId: string) => {
    return request({
      url: `/agents/${id}/memories/${memoryId}`,
      method: 'DELETE'
    })
  },

  // 搜索记忆
  searchMemories: (id: string, query: string, params?: { limit?: number }) => {
    return request({
      url: `/agents/${id}/memories/search`,
      method: 'GET',
      data: { q: query, ...params }
    })
  },

  // 与 Agent 对话（非流式）
  chatSync: (id: string, messages: Array<{ role: string; content: string }>, options?: Record<string, any>) => {
    return request({
      url: `/agents/${id}/chat/sync`,
      method: 'POST',
      data: { messages, ...options }
    })
  },

  // 获取对话历史
  getChatHistory: (id: string, params?: { limit?: number; offset?: number }) => {
    return request({
      url: `/agents/${id}/chat/history`,
      method: 'GET',
      data: params
    })
  },

  // 清除对话历史
  clearChatHistory: (id: string) => {
    return request({
      url: `/agents/${id}/chat/history`,
      method: 'DELETE'
    })
  },

  // 复制 Agent
  duplicate: (id: string) => {
    return request({
      url: `/agents/${id}/duplicate`,
      method: 'POST'
    })
  },

  // 获取 Agent 能力模板
  getCapabilityTemplates: () => {
    return request({
      url: '/agents/capabilities/templates',
      method: 'GET'
    })
  },

  // 测试 Agent
  test: (id: string, input: string) => {
    return request({
      url: `/agents/${id}/test`,
      method: 'POST',
      data: { input }
    })
  },

  // 获取 Agent 统计
  getStats: (id: string) => {
    return request({
      url: `/agents/${id}/stats`,
      method: 'GET'
    })
  }
}

export default agentsApi