/**
 * API 请求封装
 * 封装 uni.request，包含请求和响应拦截器
 */

// 基础配置
const BASE_URL = 'http://localhost:3000/api'

// 请求拦截器
const requestInterceptor = (config: UniApp.RequestOptions) => {
  // 添加 token 到请求头
  const token = uni.getStorageSync('token')
  if (token) {
    config.header = {
      ...config.header,
      'Authorization': `Bearer ${token}`
    }
  }
  return config
}

// 响应拦截器
const responseInterceptor = (response: UniApp.RequestSuccess) => {
  const { statusCode, data } = response
  
  if (statusCode === 200) {
    return data
  }
  
  if (statusCode === 401) {
    // token 过期或无效，清除存储并跳转到登录页
    uni.removeStorageSync('token')
    uni.removeStorageSync('user')
    uni.navigateTo({
      url: '/pages/login/index'
    })
    return Promise.reject(new Error('登录已过期，请重新登录'))
  }
  
  return Promise.reject(new Error((data as any)?.message || '请求失败'))
}

/**
 * 封装的请求函数
 */
export const request = <T = any>(options: UniApp.RequestOptions): Promise<T> => {
  // 执行请求拦截器
  const processedConfig = requestInterceptor(options)
  
  return new Promise((resolve, reject) => {
    uni.request({
      ...processedConfig,
      url: BASE_URL + processedConfig.url,
      success: (res) => {
        responseInterceptor(res)
          .then(resolve)
          .catch(reject)
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

/**
 * GET 请求
 */
export const get = <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
  return request<T>({
    url,
    method: 'GET',
    data: params
  })
}

/**
 * POST 请求
 */
export const post = <T = any>(url: string, data?: Record<string, any>): Promise<T> => {
  return request<T>({
    url,
    method: 'POST',
    data
  })
}

export default request
