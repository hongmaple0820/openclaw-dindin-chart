/**
 * Agent 状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { agentsApi } from '@/api/agents';
import type { Agent, ApiResponse } from '@/types';

interface AgentWithStatus extends Agent {
  status?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  error?: string;
}

interface Memory {
  id: string;
  content: string;
  type?: string;
  createdAt?: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<AgentWithStatus[]>([]);
  const publicAgents = ref<AgentWithStatus[]>([]);
  const myAgents = ref<AgentWithStatus[]>([]);
  const currentAgent = ref<AgentWithStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const chatMessages = ref<ChatMessage[]>([]);
  const chatLoading = ref(false);
  const chatStreaming = ref(false);
  
  const memories = ref<Memory[]>([]);
  const memoriesLoading = ref(false);
  
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0
  });

  const activeAgents = computed(() => 
    agents.value.filter(a => a.status === 'active' || a.enabled)
  );
  
  const agentById = computed(() => (id: string): AgentWithStatus | undefined => 
    agents.value.find(a => a.id === id)
  );

  async function fetchAgents(params: Record<string, unknown> = {}): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getList(params);
      if (res.success) {
        agents.value = (res.agents as AgentWithStatus[]) || [];
        pagination.value.total = (res.total as number) || agents.value.length;
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '获取 Agent 列表失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPublicAgents(params: Record<string, unknown> = {}): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getPublicList(params);
      if (res.success) {
        publicAgents.value = (res.agents as AgentWithStatus[]) || [];
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '获取公开 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMyAgents(params: Record<string, unknown> = {}): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getMyList(params);
      if (res.success) {
        myAgents.value = (res.agents as AgentWithStatus[]) || [];
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '获取我的 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAgent(id: string): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.getDetail(id);
      if (res.success && res.agent) {
        currentAgent.value = res.agent as AgentWithStatus;
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '获取 Agent 详情失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createAgent(data: { name: string; description?: string; model?: string; systemPrompt?: string }): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.create(data);
      if (res.success && res.agent) {
        const agent = res.agent as AgentWithStatus;
        myAgents.value.unshift(agent);
        agents.value.unshift(agent);
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '创建 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateAgent(id: string, data: Partial<Agent>): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.update(id, data);
      if (res.success && res.agent) {
        const agent = res.agent as AgentWithStatus;
        const index = agents.value.findIndex(a => a.id === id);
        if (index > -1) {
          agents.value[index] = agent;
        }
        const myIndex = myAgents.value.findIndex(a => a.id === id);
        if (myIndex > -1) {
          myAgents.value[myIndex] = agent;
        }
        if (currentAgent.value?.id === id) {
          currentAgent.value = agent;
        }
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '更新 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteAgent(id: string): Promise<ApiResponse> {
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
      error.value = (e as Error).message || '删除 Agent 失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function toggleAgentStatus(id: string): Promise<ApiResponse> {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentsApi.toggleStatus(id);
      if (res.success) {
        const newStatus = (res as ApiResponse & { enabled?: boolean }).enabled;
        const index = agents.value.findIndex(a => a.id === id);
        if (index > -1 && newStatus !== undefined) {
          agents.value[index].enabled = newStatus;
          agents.value[index].status = newStatus ? 'active' : 'inactive';
        }
        const myIndex = myAgents.value.findIndex(a => a.id === id);
        if (myIndex > -1 && newStatus !== undefined) {
          myAgents.value[myIndex].enabled = newStatus;
          myAgents.value[myIndex].status = newStatus ? 'active' : 'inactive';
        }
        if (currentAgent.value?.id === id && newStatus !== undefined) {
          currentAgent.value.enabled = newStatus;
          currentAgent.value.status = newStatus ? 'active' : 'inactive';
        }
      }
      return res;
    } catch (e) {
      error.value = (e as Error).message || '切换状态失败';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMemories(agentId: string, params: Record<string, unknown> = {}): Promise<ApiResponse> {
    memoriesLoading.value = true;
    try {
      const res = await agentsApi.getMemories(agentId, params);
      if (res.success) {
        memories.value = (res.memories as Memory[]) || [];
      }
      return res;
    } catch (e) {
      console.error('获取记忆失败:', e);
      throw e;
    } finally {
      memoriesLoading.value = false;
    }
  }

  async function addMemory(agentId: string, data: { content: string; type?: string }): Promise<ApiResponse> {
    try {
      const res = await agentsApi.addMemory(agentId, data);
      if (res.success && res.memory) {
        memories.value.unshift(res.memory as Memory);
      }
      return res;
    } catch (e) {
      console.error('添加记忆失败:', e);
      throw e;
    }
  }

  async function deleteMemory(agentId: string, memoryId: string): Promise<ApiResponse> {
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

  async function searchMemories(agentId: string, query: string, params: Record<string, unknown> = {}): Promise<ApiResponse> {
    memoriesLoading.value = true;
    try {
      const res = await agentsApi.searchMemories(agentId, query, params);
      if (res.success) {
        memories.value = (res.memories as Memory[]) || [];
      }
      return res;
    } catch (e) {
      console.error('搜索记忆失败:', e);
      throw e;
    } finally {
      memoriesLoading.value = false;
    }
  }

  async function sendMessage(
    agentId: string, 
    content: string, 
    onChunk?: (chunk: string, msg: ChatMessage) => void, 
    onComplete?: (msg: ChatMessage) => void, 
    onError?: (err: Error) => void
  ): Promise<ChatMessage> {
    chatLoading.value = true;
    chatStreaming.value = true;
    
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    chatMessages.value.push(userMsg);
    
    const aiMsg: ChatMessage = {
      id: 'ai-' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true
    };
    chatMessages.value.push(aiMsg);
    
    try {
      const messages = chatMessages.value
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content });
      
      const response = await agentsApi.chat(agentId, messages);
      
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
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
              if ((e as Error).message !== 'Unexpected end of JSON input') {
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
      aiMsg.error = (e as Error).message;
      if (onError) onError(e as Error);
      throw e;
    } finally {
      chatLoading.value = false;
      chatStreaming.value = false;
    }
  }

  async function fetchChatHistory(agentId: string, params: Record<string, unknown> = {}): Promise<ApiResponse> {
    try {
      const res = await agentsApi.getChatHistory(agentId, params);
      if (res.success) {
        chatMessages.value = (res.messages as ChatMessage[]) || [];
      }
      return res;
    } catch (e) {
      console.error('获取对话历史失败:', e);
      throw e;
    }
  }

  async function clearChatHistory(agentId: string): Promise<ApiResponse> {
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

  function setCurrentAgent(agent: AgentWithStatus | null): void {
    currentAgent.value = agent;
    chatMessages.value = [];
    memories.value = [];
  }

  function clearState(): void {
    agents.value = [];
    publicAgents.value = [];
    myAgents.value = [];
    currentAgent.value = null;
    chatMessages.value = [];
    memories.value = [];
    error.value = null;
  }

  return {
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
    activeAgents,
    agentById,
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