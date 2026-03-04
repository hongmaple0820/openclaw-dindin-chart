/**
 * Agent 管理 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const agentsApi = {
  // 获取 Agent 列表
  getList: (params = {}) => api.get('/agents', { params }),
  
  // 获取公开 Agent 列表
  getPublicList: (params = {}) => api.get('/agents/public', { params }),
  
  // 获取我的 Agent 列表
  getMyList: (params = {}) => api.get('/agents/my', { params }),
  
  // 获取单个 Agent 详情
  getDetail: (id) => api.get(`/agents/${id}`),
  
  // 创建 Agent
  create: (data) => api.post('/agents', data),
  
  // 更新 Agent
  update: (id, data) => api.put(`/agents/${id}`, data),
  
  // 删除 Agent
  delete: (id) => api.delete(`/agents/${id}`),
  
  // 切换 Agent 状态
  toggleStatus: (id) => api.patch(`/agents/${id}/status`),
  
  // 获取 Agent 记忆
  getMemories: (id, params = {}) => api.get(`/agents/${id}/memories`, { params }),
  
  // 添加记忆
  addMemory: (id, data) => api.post(`/agents/${id}/memories`, data),
  
  // 删除记忆
  deleteMemory: (id, memoryId) => api.delete(`/agents/${id}/memories/${memoryId}`),
  
  // 搜索记忆
  searchMemories: (id, query, params = {}) => 
    api.get(`/agents/${id}/memories/search`, { params: { q: query, ...params } }),
  
  // 与 Agent 对话（流式）
  chat: (id, messages, options = {}) => {
    const token = localStorage.getItem('accessToken');
    return fetch(`/api/agents/${id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ messages, ...options })
    });
  },
  
  // 与 Agent 对话（非流式）
  chatSync: (id, messages, options = {}) => 
    api.post(`/agents/${id}/chat/sync`, { messages, ...options }),
  
  // 获取对话历史
  getChatHistory: (id, params = {}) => api.get(`/agents/${id}/chat/history`, { params }),
  
  // 清除对话历史
  clearChatHistory: (id) => api.delete(`/agents/${id}/chat/history`),
  
  // 复制 Agent
  duplicate: (id) => api.post(`/agents/${id}/duplicate`),
  
  // 获取 Agent 能力模板
  getCapabilityTemplates: () => api.get('/agents/capabilities/templates'),
  
  // 测试 Agent
  test: (id, input) => api.post(`/agents/${id}/test`, { input }),
  
  // 获取 Agent 统计
  getStats: (id) => api.get(`/agents/${id}/stats`)
};

export default agentsApi;
