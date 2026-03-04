/**
 * Skills 系统 API
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

// 技能类型
export interface Skill {
  id: string
  name: string
  description?: string
  icon?: string
  version?: string
  category?: string
  type: 'built-in' | 'market' | 'custom'
  author?: string
  enabled?: boolean
  installed?: boolean
  installedAt?: number
  config?: Record<string, any>
  examples?: Array<{ title: string; description: string; command: string }>
}

// 技能 API
export const skillApi = {
  // 获取技能列表
  getList: (params?: { type?: string; q?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return request({
      url: `/skills?${query}`,
      method: 'GET'
    })
  },

  // 获取技能详情
  getDetail: (skillId: string) => {
    return request({
      url: `/skills/${skillId}`,
      method: 'GET'
    })
  },

  // 安装技能
  install: (skillId: string, options?: Record<string, any>) => {
    return request({
      url: `/skills/${skillId}/install`,
      method: 'POST',
      data: options
    })
  },

  // 卸载技能
  uninstall: (skillId: string) => {
    return request({
      url: `/skills/${skillId}`,
      method: 'DELETE'
    })
  },

  // 更新技能配置
  updateConfig: (skillId: string, config: Record<string, any>) => {
    return request({
      url: `/skills/${skillId}/config`,
      method: 'PUT',
      data: config
    })
  },

  // 获取技能配置
  getConfig: (skillId: string) => {
    return request({
      url: `/skills/${skillId}/config`,
      method: 'GET'
    })
  },

  // 启用/禁用技能
  toggleEnabled: (skillId: string, enabled: boolean) => {
    return request({
      url: `/skills/${skillId}/enabled`,
      method: 'PUT',
      data: { enabled }
    })
  },

  // 测试技能调用
  testCall: (skillId: string, params?: Record<string, any>) => {
    return request({
      url: `/skills/${skillId}/test`,
      method: 'POST',
      data: params
    })
  },

  // 获取技能使用历史
  getHistory: (skillId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString()
    return request({
      url: `/skills/${skillId}/history?${query}`,
      method: 'GET'
    })
  },

  // 获取技能分类
  getCategories: () => {
    return request({
      url: '/skills/categories',
      method: 'GET'
    })
  },

  // 获取推荐技能
  getRecommended: () => {
    return request({
      url: '/skills/recommended',
      method: 'GET'
    })
  },

  // 搜索市场技能
  searchMarket: (query: string) => {
    return request({
      url: `/skills/market/search?q=${encodeURIComponent(query)}`,
      method: 'GET'
    })
  }
}

export default skillApi