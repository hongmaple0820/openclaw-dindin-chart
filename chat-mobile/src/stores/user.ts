/**
 * 用户状态管理 Store
 */
import { API_BASE_URL } from '@/config/index'

export interface UserInfo {
  id: string
  username: string
  nickname?: string
  avatar?: string
}

interface UserState {
  user: UserInfo | null
  token: string | null
  isLoggedIn: boolean
}

const getInitialState = (): UserState => {
  const token = uni.getStorageSync('accessToken')
  const userStr = uni.getStorageSync('user')
  
  let user: UserInfo | null = null
  try {
    user = userStr ? JSON.parse(userStr) : null
  } catch (e) {
    uni.removeStorageSync('user')
  }
  
  return {
    user,
    token: token || null,
    isLoggedIn: !!token && !!user
  }
}

export const useUserStore = {
  state: getInitialState(),
  
  async login(username: string, password: string) {
    try {
      const res = await uni.request({
        url: API_BASE_URL + '/api/auth/login',
        method: 'POST',
        data: { username, password }
      })
      
      if (res.statusCode === 200 && res.data) {
        const { accessToken, user } = res.data as any
        
        uni.setStorageSync('accessToken', accessToken)
        uni.setStorageSync('username', username)
        uni.setStorageSync('user', JSON.stringify(user))
        
        this.state.user = user
        this.state.token = accessToken
        this.state.isLoggedIn = true
        
        return user
      }
      
      return Promise.reject(new Error((res.data as any)?.message || '登录失败'))
    } catch (error: any) {
      return Promise.reject(new Error(error.message || '登录失败'))
    }
  },
  
  logout() {
    uni.removeStorageSync('accessToken')
    uni.removeStorageSync('username')
    uni.removeStorageSync('user')
    
    this.state.user = null
    this.state.token = null
    this.state.isLoggedIn = false
    
    uni.reLaunch({ url: '/pages/login/index' })
  }
}

export default useUserStore
