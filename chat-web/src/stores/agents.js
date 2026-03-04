/**
 * Agent 状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { agentsApi } from '@/api/agents';

export const useAgentsStore = defineStore('agents', () => {
  // 状态
  const agents = ref([]);
  const publicAgents = ref([]);
  const myAgents = ref([]);
  const currentAgent = ref(null);
  const loading = ref(false);
  const error = ref(null);
  
  // 对话状态
  const chatMessages = ref([]);
  const chatLoading = ref(false);
  const chatStreaming = ref(false);
  
  // 记忆状态
  const memories = ref([]);
  const memoriesLoading = ref(false);
  
  // 分页
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0
  });

  // 计算属性
  const activeAgents = computed(() => 
    agents.value.filter(a => a.status === 'active')
  );
  
  const agentById = computed(() => (id) => 
    agents.value.find(a => a.id === id)
  );

  // 获取 Agent 列表
  async function fetchAgents(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getList(params);
      if (res.success) {
        agents.value = res.agents || [];
        pagination.value.total = res.total || agents.value.length;
      }
      return res;
    } catch (e) {
      error.value = e.message || '获取 Agent 列表失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 获取公开 Agent
  async function fetchPublicAgents(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getPublicList(params);
      if (res.success) {
        publicAgents.value = res.agents || [];
      }
      return res;
    } catch (e) {
      error.value = e.message || '获取公开 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 获取我的 Agent
  async function fetchMyAgents(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getMyList(params);
      if (res.success) {
        myAgents.value = res.agents || [];
      }
      return res;
    } catch (e) {
      error.value = e.message || '获取我的 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 获取单个 Agent 详情
  async function fetchAgent(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getDetail(id);
      if (res.success) {
        currentAgent.value = res.agent;
      }
      return res;
    } catch (e) {
      error.value = e.message || '获取 Agent 详情失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 创建 Agent
  async function createAgent(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.create(data);
      if (res.success) {
        myAgents.value.unshift(res.agent);
        agents.value.unshift(res.agent);
      }
      return res;
    } catch (e) {
      error.value = e.message || '创建 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 更新 Agent
  async function updateAgent(id, data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.update(id, data);
      if (res.success) {
        // 更新列表中的 Agent
        const index = agents.value.findIndex(a => a.id === id);
        if (index > -1) {
          agents.value[index] = res.agent;
        }
        const myIndex = myAgents.value.findIndex(a => a.id === id);
        if (myIndex > -1) {
          myAgents.value[myIndex] = res.agent;
        }
        if (currentAgent.value?.id === id) {
          currentAgent.value = res.agent;
        }
      }
      return res;
    } catch (e) {
      error.value = e.message || '更新 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 删除 Agent
  async function deleteAgent(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.delete(id);
      if (res.success) {
        agents.value = agents.value.filter(a => a.id !== id);
        myAgents.value = myAgents.value.filter(a => a.id !== id);
        if (currentAgent.value?.id === id) {
          currentAgent.value = null;
        }
      }
      return res;
    } catch (e) {
      error.value = e.message || '删除 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 切换状态
  async function toggleAgentStatus(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.toggleStatus(id);
      if (res.success) {
        const index = agents.value.findIndex(a => a.id === id);
        if (index > -1) {
          agents.value[index].status = res.agent.status;
        }
        const myIndex = myAgents.value.findIndex(a => a.id === id);
        if (myIndex > -1) {
          myAgents.value[myIndex].status = res.agent.status;
        }
        if (currentAgent.value?.id === id) {
          currentAgent.value.status = res.agent.status;
        }
      }
      return res;
    } catch (e) {
      error.value = e.message || '切换状态失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 获取记忆
  async function fetchMemories(agentId, params = {}) {
    memoriesLoading.value = true;
    try {
      const res = await agentsApi.getMemories(agentId, params);
      if (res.success) {
        memories.value = res.memories || [];
      }
      return res;
    } catch (e) {
      console.error('获取记忆失败:', e);
      throw e;
    } finally {
      memoriesLoading.value = false;
    }
  }

  // 添加记忆
  async function addMemory(agentId, data) {
    try {
      const res = await agentsApi.addMemory(agentId, data);
      if (res.success) {
        memories.value.unshift(res.memory);
      }
      return res;
    } catch (e) {
      console.error('添加记忆失败:', e);
      throw e;
    }
  }

  // 删除记忆
  async function deleteMemory(agentId, memoryId) {
    try {
      const res = await agentsApi.deleteMemory(agentId, memoryId);
      if (res.success) {
        memories.value = memories.value.filter(m => m.id !== memoryId);
      }
      return res;
    } catch (e) {
      console.error('删除记忆失败:', e);
      throw e;
    }
  }

  // 搜索记忆
  async function searchMemories(agentId, query, params = {}) {
    memoriesLoading.value = true;
    try {
      const res = await agentsApi.searchMemories(agentId, query, params);
      if (res.success) {
        memories.value = res.memories || [];
      }
      return res;
    } catch (e) {
      console.error('搜索记忆失败:', e);
      throw e;
    } finally {
      memoriesLoading.value = false;
    }
  }

  // 发送消息（流式）
  async function sendMessage(agentId, content, onChunk, onComplete, onError) {
    chatLoading.value = true;
    chatStreaming.value = true;
    
    // 添加用户消息
    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    chatMessages.value.push(userMsg);
    
    // 添加空的 AI 消息占位
    const aiMsg = {
      id: 'ai-' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true
    };
    chatMessages.value.push(aiMsg);
    
    try {
      // 构建消息历史
      const messages = chatMessages.value
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content });
      
      const response = await agentsApi.chat(agentId, messages);
      
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              aiMsg.streaming = false;
              if (onComplete) onComplete(aiMsg);
              break;
            }
            
            try {
              const json = JSON.parse(data);
              if (json.content) {
                aiMsg.content += json.content;
                if (onChunk) onChunk(json.content, aiMsg);
              }
              if (json.error) {
                throw new Error(json.error);
              }
            } catch (e) {
              if (e.message !== 'Unexpected end of JSON input') {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }
      
      aiMsg.streaming = false;
      return aiMsg;
    } catch (e) {
      aiMsg.streaming = false;
      aiMsg.error = e.message;
      if (onError) onError(e);
      throw e;
    } finally {
      chatLoading.value = false;
      chatStreaming.value = false;
    }
  }

  // 获取对话历史
  async function fetchChatHistory(agentId, params = {}) {
    try {
      const res = await agentsApi.getChatHistory(agentId, params);
      if (res.success) {
        chatMessages.value = res.messages || [];
      }
      return res;
    } catch (e) {
      console.error('获取对话历史失败:', e);
      throw e;
    }
  }

  // 清除对话历史
  async function clearChatHistory(agentId) {
    try {
      const res = await agentsApi.clearChatHistory(agentId);
      if (res.success) {
        chatMessages.value = [];
      }
      return res;
    } catch (e) {
      console.error('清除对话历史失败:', e);
      throw e;
    }
  }

  // 设置当前 Agent
  function setCurrentAgent(agent) {
    currentAgent.value = agent;
    chatMessages.value = [];
    memories.value = [];
  }

  // 清空状态
  function clearState() {
    agents.value = [];
    publicAgents.value = [];
    myAgents.value = [];
    currentAgent.value = null;
    chatMessages.value = [];
    memories.value = [];
    error.value = null;
  }

  return {
    // 状态
    agents,
    publicAgents,
    myAgents,
    currentAgent,
    loading,
    error,
    chatMessages,
    chatLoading,
    chatStreaming,
    memories,
    memoriesLoading,
    pagination,
    
    // 计算属性
    activeAgents,
    agentById,
    
    // 方法
    fetchAgents,
    fetchPublicAgents,
    fetchMyAgents,
    fetchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    fetchMemories,
    addMemory,
    deleteMemory,
    searchMemories,
    sendMessage,
    fetchChatHistory,
    clearChatHistory,
    setCurrentAgent,
    clearState
  };
});

export default useAgentsStore;
