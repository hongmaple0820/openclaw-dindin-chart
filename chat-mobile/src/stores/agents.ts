/**
 * Agents 状态管理 Store
 * @author 小琳
 * @date 2026-03-04
 */
import { agentsApi, Agent } from '@/api/agents'

interface AgentState {
  agents: Agent[]
  publicAgents: Agent[]
  myAgents: Agent[]
  currentAgent: Agent | null
  loading: boolean
}

export const useAgentStore = {
  state: {
    agents: [],
    publicAgents: [],
    myAgents: [],
    currentAgent: null,
    loading: false
  } as AgentState,

  // 获取 Agent 列表
  async fetchAgents(params?: { status?: string; search?: string }) {
    try {
      this.state.loading = true
      const res = await agentsApi.getList(params) as any
      
      if (res.success || res.data) {
        this.state.agents = res.data || res.agents || []
      }
      return this.state.agents
    } catch (error) {
      console.error('获取 Agent 列表失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 获取公开 Agent 列表
  async fetchPublicAgents(params?: { limit?: number; offset?: number }) {
    try {
      const res = await agentsApi.getPublicList(params) as any
      
      if (res.success || res.data) {
        this.state.publicAgents = res.data || res.agents || []
      }
      return this.state.publicAgents
    } catch (error) {
      console.error('获取公开 Agent 列表失败:', error)
      throw error
    }
  },

  // 获取我的 Agent 列表
  async fetchMyAgents(params?: { limit?: number; offset?: number }) {
    try {
      this.state.loading = true
      const res = await agentsApi.getMyList(params) as any
      
      if (res.success || res.data) {
        this.state.myAgents = res.data || res.agents || []
      }
      return this.state.myAgents
    } catch (error) {
      console.error('获取我的 Agent 列表失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 获取 Agent 详情
  async fetchAgentDetail(id: string) {
    try {
      const res = await agentsApi.getDetail(id) as any
      const agent = res.data || res.agent || null
      this.state.currentAgent = agent
      return agent
    } catch (error) {
      console.error('获取 Agent 详情失败:', error)
      throw error
    }
  },

  // 选择 Agent
  selectAgent(agent: Agent | null) {
    this.state.currentAgent = agent
  },

  // 创建 Agent
  async createAgent(data: Partial<Agent>) {
    try {
      this.state.loading = true
      const res = await agentsApi.create(data) as any
      
      if (res.success || res.data) {
        const newAgent = res.data || res.agent
        this.state.myAgents.push(newAgent)
        this.state.agents.push(newAgent)
        return newAgent
      }
      throw new Error(res.message || '创建失败')
    } catch (error) {
      console.error('创建 Agent 失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 更新 Agent
  async updateAgent(id: string, data: Partial<Agent>) {
    try {
      const res = await agentsApi.update(id, data) as any
      
      if (res.success || res.data) {
        const updatedAgent = res.data || res.agent
        
        // 更新列表中的 Agent
        const index = this.state.agents.findIndex(a => a.id === id)
        if (index > -1) {
          this.state.agents[index] = { ...this.state.agents[index], ...updatedAgent }
        }
        
        const myIndex = this.state.myAgents.findIndex(a => a.id === id)
        if (myIndex > -1) {
          this.state.myAgents[myIndex] = { ...this.state.myAgents[myIndex], ...updatedAgent }
        }
        
        // 如果更新的是当前 Agent，同步更新
        if (this.state.currentAgent?.id === id) {
          this.state.currentAgent = { ...this.state.currentAgent, ...updatedAgent }
        }
        
        return updatedAgent
      }
      throw new Error(res.message || '更新失败')
    } catch (error) {
      console.error('更新 Agent 失败:', error)
      throw error
    }
  },

  // 删除 Agent
  async deleteAgent(id: string) {
    try {
      const res = await agentsApi.delete(id) as any
      
      if (res.success) {
        // 从列表中移除
        const index = this.state.agents.findIndex(a => a.id === id)
        if (index > -1) {
          this.state.agents.splice(index, 1)
        }
        
        const myIndex = this.state.myAgents.findIndex(a => a.id === id)
        if (myIndex > -1) {
          this.state.myAgents.splice(myIndex, 1)
        }
        
        // 如果删除的是当前 Agent，清空
        if (this.state.currentAgent?.id === id) {
          this.state.currentAgent = null
        }
        
        return true
      }
      throw new Error(res.message || '删除失败')
    } catch (error) {
      console.error('删除 Agent 失败:', error)
      throw error
    }
  },

  // 切换 Agent 状态
  async toggleAgentStatus(id: string) {
    try {
      const res = await agentsApi.toggleStatus(id) as any
      
      if (res.success || res.data) {
        const agent = this.state.agents.find(a => a.id === id)
        if (agent) {
          agent.status = res.data?.status || (agent.status === 'active' ? 'inactive' : 'active')
        }
        return agent
      }
      throw new Error(res.message || '切换失败')
    } catch (error) {
      console.error('切换 Agent 状态失败:', error)
      throw error
    }
  },

  // 发送消息给 Agent
  async sendMessage(agentId: string, messages: Array<{ role: string; content: string }>) {
    try {
      const res = await agentsApi.chatSync(agentId, messages) as any
      return res.data || res
    } catch (error) {
      console.error('发送消息失败:', error)
      throw error
    }
  }
}

export default useAgentStore