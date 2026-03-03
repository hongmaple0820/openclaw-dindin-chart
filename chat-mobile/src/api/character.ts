/**
 * 角色相关 API
 * @author 小琳
 * @date 2026-03-03
 */
import { API_BASE_URL } from '@/config/index'

// 角色类型
export interface Character {
  id: string
  name: string
  type: string
  avatar?: string
  personality: string[]
  speakingStyle: string
  referenceImages?: string[]
  createdAt: number
  updatedAt: number
}

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

// 角色 API
export const characterApi = {
  // 获取角色列表
  getList: () => {
    return request({
      url: '/api/character/characters',
      method: 'GET'
    })
  },
  
  // 获取当前角色
  getCurrent: () => {
    return request({
      url: '/api/character/characters/current',
      method: 'GET'
    })
  },
  
  // 获取角色详情
  getById: (id: string) => {
    return request({
      url: `/api/character/characters/${id}`,
      method: 'GET'
    })
  },
  
  // 创建角色
  create: (data: Partial<Character>) => {
    return request({
      url: '/api/character/characters',
      method: 'POST',
      data
    })
  },
  
  // 更新角色
  update: (id: string, data: Partial<Character>) => {
    return request({
      url: `/api/character/characters/${id}`,
      method: 'PUT',
      data
    })
  },
  
  // 删除角色
  delete: (id: string) => {
    return request({
      url: `/api/character/characters/${id}`,
      method: 'DELETE'
    })
  },
  
  // 切换角色
  switch: (id: string) => {
    return request({
      url: `/api/character/characters/${id}/switch`,
      method: 'POST'
    })
  }
}

export default characterApi
