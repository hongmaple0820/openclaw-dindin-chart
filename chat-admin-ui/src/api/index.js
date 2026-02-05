import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3001',
  timeout: 10000
})

// 请求拦截器 - 添加认证 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      // 可以跳转到登录页
    }
    return Promise.reject(error)
  }
)

export default {
  // 消息相关
  getMessages(params) {
    return api.get('/api/messages', { params })
  },
  deleteMessage(id) {
    return api.delete(`/api/messages/${id}`)
  },
  batchDeleteMessages(ids) {
    return api.post('/api/messages/batch-delete', { ids })
  },

  // 统计相关
  getOverview() {
    return api.get('/api/stats/overview')
  },
  getStatsBySender() {
    return api.get('/api/stats/by-sender')
  },
  getStatsBySource() {
    return api.get('/api/stats/by-source')
  },
  getStatsByTime(params) {
    return api.get('/api/stats/by-time', { params })
  },

  // 用户相关 - 基础查询（聊天用户统计）
  getUsers(params) {
    return api.get('/api/users', { params })
  },
  getOnlineUsers() {
    return api.get('/api/users/online')
  },
  userHeartbeat(name) {
    return api.post(`/api/users/${name}/heartbeat`)
  },

  // 用户相关 - 管理操作（认证用户管理）
  getUserList(params) {
    return api.get('/api/user/list', { params })
  },
  getUserById(id) {
    return api.get(`/api/user/${id}`)
  },
  updateUserRole(id, role) {
    return api.put(`/api/user/${id}/role`, { role })
  },
  updateUserStatus(id, status) {
    return api.put(`/api/user/${id}/status`, { status })
  },
  deleteUser(id) {
    return api.delete(`/api/user/${id}`)
  },
  adminResetPassword(id, newPassword) {
    return api.post(`/api/user/${id}/reset-password`, { newPassword })
  },
  adminCreateUser(data) {
    return api.post('/api/auth/register', data)
  },

  // 同步状态
  getSyncStatus() {
    return api.get('/api/sync-status')
  },

  // 健康检查
  health() {
    return api.get('/health')
  },

  // 认证相关
  login(username, password) {
    return api.post('/api/auth/login', { username, password })
  },
  logout() {
    return api.post('/api/auth/logout')
  },
  getCurrentUser() {
    return api.get('/api/auth/me')
  }
}
