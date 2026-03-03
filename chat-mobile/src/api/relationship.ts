/**
 * 关系 API 接口
 * @author 小琳
 */
import { request } from './index'

// 关系类型
export interface Relationship {
  id: string
  characterId: string
  characterName: string
  characterAvatar?: string
  relationshipType: string  // 关系类型标签
  intimacyLevel: number      // 亲密度等级 0-100
  stage: keyof typeof STAGES
  unlockedInteractions: string[]  // 解锁的特殊互动
  createdAt: string
  updatedAt: string
}

// 互动历史记录
export interface InteractionHistory {
  id: string
  relationshipId: string
  type: string           // 互动类型
  description: string    // 描述
  intimacyChange: number // 亲密度变化
  createdAt: string
}

// 关系阶段定义
export const STAGES = {
  stranger: { min: 0, max: 20, label: '陌生人', color: '#999999', description: '初次相识，还需更多了解' },
  acquaintance: { min: 21, max: 40, label: '泛泛之交', color: '#8bc34a', description: '有些印象，可以聊几句' },
  friend: { min: 41, max: 60, label: '朋友', color: '#2196f3', description: '已经熟悉，可以分享日常' },
  closeFriend: { min: 61, max: 80, label: '密友', color: '#9c27b0', description: '无话不谈，彼此信任' },
  intimate: { min: 81, max: 100, label: '亲密关系', color: '#e91e63', description: '心有灵犀，彼此依赖' }
} as const

export type StageKey = keyof typeof STAGES

// 根据亲密度获取阶段
export function getStageByIntimacy(intimacy: number): StageKey {
  for (const [key, stage] of Object.entries(STAGES)) {
    if (intimacy >= stage.min && intimacy <= stage.max) {
      return key as StageKey
    }
  }
  return 'stranger'
}

export const relationshipApi = {
  // 获取角色关系
  get: (characterId: string) => 
    request({
      url: `/api/character/relationships/${characterId}`,
      method: 'GET'
    }) as Promise<Relationship>,
  
  // 创建关系
  create: (data: { characterId: string; characterName: string; characterAvatar?: string }) => 
    request({
      url: '/api/character/relationships',
      method: 'POST',
      data
    }) as Promise<Relationship>,
  
  // 更新亲密度
  updateIntimacy: (characterId: string, delta: number) => 
    request({
      url: `/api/character/relationships/${characterId}/intimacy`,
      method: 'PUT',
      data: { delta }
    }) as Promise<Relationship>,
  
  // 获取互动历史
  getHistory: (characterId: string, params?: { limit?: number; offset?: number }) => 
    request({
      url: `/api/character/relationships/${characterId}/history`,
      method: 'GET',
      data: params
    }) as Promise<{ list: InteractionHistory[]; total: number }>
}

export default relationshipApi
