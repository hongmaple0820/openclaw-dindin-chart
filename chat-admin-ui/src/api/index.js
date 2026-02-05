import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3001',
  timeout: 10000
})

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

  // 用户相关
  getUsers() {
    return api.get('/api/users')
  },
  getOnlineUsers() {
    return api.get('/api/users/online')
  },
  userHeartbeat(name) {
    return api.post(`/api/users/${name}/heartbeat`)
  },

  // 同步状态
  getSyncStatus() {
    return api.get('/api/sync-status')
  },

  // 健康检查
  health() {
    return api.get('/health')
  }
}
