/**
 * 关系状态管理 Store
 * @author 小琳
 */
import { getStageByIntimacy, STAGES, type Relationship, type InteractionHistory, type StageKey } from '@/api/relationship'
import { API_BASE_URL } from '@/config/index'

interface RelationshipState {
  currentRelationship: Relationship | null
  history: InteractionHistory[]
  historyTotal: number
  loading: boolean
  error: string | null
  // 亲密度变化动画
  intimacyChange: { value: number; show: boolean } | null
}

const getInitialState = (): RelationshipState => ({
  currentRelationship: null,
  history: [],
  historyTotal: 0,
  loading: false,
  error: null,
  intimacyChange: null
})

export const useRelationshipStore = {
  state: getInitialState(),
  
  // 获取关系信息
  async fetchRelationship(characterId: string) {
    this.state.loading = true
    this.state.error = null
    
    try {
      const res = await uni.request({
        url: API_BASE_URL + `/api/character/relationships/${characterId}`,
        method: 'GET',
        header: {
          Authorization: `Bearer ${uni.getStorageSync('accessToken')}`
        }
      })
      
      if (res.statusCode === 200 && res.data) {
        this.state.currentRelationship = res.data as Relationship
        return this.state.currentRelationship
      }
      
      // 如果不存在，创建新关系
      return await this.createRelationship(characterId, '新角色')
    } catch (error: any) {
      this.state.error = error.message || '获取关系失败'
      return null
    } finally {
      this.state.loading = false
    }
  },
  
  // 创建关系
  async createRelationship(characterId: string, characterName: string, characterAvatar?: string) {
    try {
      const res = await uni.request({
        url: API_BASE_URL + '/api/character/relationships',
        method: 'POST',
        data: { characterId, characterName, characterAvatar },
        header: {
          Authorization: `Bearer ${uni.getStorageSync('accessToken')}`
        }
      })
      
      if (res.statusCode === 200 && res.data) {
        this.state.currentRelationship = res.data as Relationship
        return this.state.currentRelationship
      }
      
      return null
    } catch (error: any) {
      this.state.error = error.message || '创建关系失败'
      return null
    }
  },
  
  // 更新亲密度
  async updateIntimacy(characterId: string, delta: number) {
    this.state.loading = true
    
    try {
      const res = await uni.request({
        url: API_BASE_URL + `/api/character/relationships/${characterId}/intimacy`,
        method: 'PUT',
        data: { delta },
        header: {
          Authorization: `Bearer ${uni.getStorageSync('accessToken')}`
        }
      })
      
      if (res.statusCode === 200 && res.data) {
        this.state.currentRelationship = res.data as Relationship
        
        // 触发亲密度变化动画
        this.showIntimacyChange(delta)
        
        return this.state.currentRelationship
      }
      
      return null
    } catch (error: any) {
      this.state.error = error.message || '更新亲密度失败'
      return null
    } finally {
      this.state.loading = false
    }
  },
  
  // 获取互动历史
  async fetchHistory(characterId: string, limit = 20, offset = 0) {
    try {
      const res = await uni.request({
        url: API_BASE_URL + `/api/character/relationships/${characterId}/history`,
        method: 'GET',
        data: { limit, offset },
        header: {
          Authorization: `Bearer ${uni.getStorageSync('accessToken')}`
        }
      })
      
      if (res.statusCode === 200 && res.data) {
        const data = res.data as { list: InteractionHistory[]; total: number }
        if (offset === 0) {
          this.state.history = data.list
        } else {
          this.state.history = [...this.state.history, ...data.list]
        }
        this.state.historyTotal = data.total
        return data
      }
      
      return null
    } catch (error: any) {
      this.state.error = error.message || '获取历史失败'
      return null
    }
  },
  
  // 显示亲密度变化动画
  showIntimacyChange(delta: number) {
    this.state.intimacyChange = { value: delta, show: true }
    
    // 2秒后隐藏
    setTimeout(() => {
      this.state.intimacyChange = null
    }, 2000)
  },
  
  // 清除当前关系
  clearRelationship() {
    this.state.currentRelationship = null
    this.state.history = []
    this.state.historyTotal = 0
    this.state.error = null
  },
  
  // Getters
  get stageInfo(): { key: StageKey; label: string; color: string; description: string } | null {
    if (!this.state.currentRelationship) return null
    
    const stageKey = getStageByIntimacy(this.state.currentRelationship.intimacyLevel)
    const stage = STAGES[stageKey]
    
    return {
      key: stageKey,
      label: stage.label,
      color: stage.color,
      description: stage.description
    }
  },
  
  get intimacyPercent(): number {
    return this.state.currentRelationship?.intimacyLevel || 0
  },
  
  get unlockedInteractions(): string[] {
    return this.state.currentRelationship?.unlockedInteractions || []
  }
}

export default useRelationshipStore
