/**
 * API 配置 (uni-app 版本)
 * @author 小琳
 * @date 2026-02-28
 */
import { API_BASE_URL } from '@/config/index'

// 封装 uni.request
export const request = (options: any) => {
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

// 消息相关 API
export const messageApi = {
  // 获取消息列表
  getMessages: (params?: { limit?: number; offset?: number }) => {
    return request({
      url: '/api/context',
      method: 'GET',
      data: params
    })
  },
  
  // 发送消息
  sendMessage: (data: { content: string; source?: string }) => {
    return request({
      url: '/api/store',
      method: 'POST',
      data: {
        sender: uni.getStorageSync('username') || '游客',
        ...data
      }
    })
  }
}

// 文件上传
export const uploadApi = {
  uploadImage: (filePath: string) => {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: API_BASE_URL + '/api/files/upload',
        filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${uni.getStorageSync('accessToken')}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data))
          } else {
            reject(new Error('上传失败'))
          }
        },
        fail: reject
      })
    })
  }
}

export default request
