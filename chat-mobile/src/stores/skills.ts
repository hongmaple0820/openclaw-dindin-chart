/**
 * Skills 状态管理 Store
 * @author 小琳
 * @date 2026-03-04
 */
import { skillApi, Skill } from '@/api/skills'

interface SkillState {
  skills: Skill[]
  builtInSkills: Skill[]
  mySkills: Skill[]
  marketSkills: Skill[]
  currentSkill: Skill | null
  categories: string[]
  currentTab: string
  searchQuery: string
  categoryFilter: string
  loading: boolean
}

export const useSkillStore = {
  state: {
    skills: [],
    builtInSkills: [],
    mySkills: [],
    marketSkills: [],
    currentSkill: null,
    categories: [],
    currentTab: 'built-in',
    searchQuery: '',
    categoryFilter: '',
    loading: false
  } as SkillState,

  // 获取技能列表
  async fetchSkills(type?: string) {
    try {
      this.state.loading = true
      const params: any = {}
      
      if (type || this.state.currentTab) {
        params.type = type || this.state.currentTab
      }
      if (this.state.searchQuery) {
        params.q = this.state.searchQuery
      }
      if (this.state.categoryFilter) {
        params.category = this.state.categoryFilter
      }

      const res = await skillApi.getList(params) as any
      
      if (res.success || res.data) {
        const skills = res.data || res.skills || []
        
        if (params.type === 'built-in') {
          this.state.builtInSkills = skills
        } else if (params.type === 'my') {
          this.state.mySkills = skills
        } else if (params.type === 'market') {
          this.state.marketSkills = skills
        }
        this.state.skills = skills
      }
      return this.state.skills
    } catch (error) {
      console.error('获取技能列表失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 获取技能分类
  async fetchCategories() {
    try {
      const res = await skillApi.getCategories() as any
      
      if (res.success || res.data) {
        this.state.categories = res.data || res.categories || []
      }
      return this.state.categories
    } catch (error) {
      console.error('获取技能分类失败:', error)
      throw error
    }
  },

  // 获取技能详情
  async fetchSkillDetail(skillId: string) {
    try {
      const res = await skillApi.getDetail(skillId) as any
      const skill = res.data || res.skill || null
      this.state.currentSkill = skill
      return skill
    } catch (error) {
      console.error('获取技能详情失败:', error)
      throw error
    }
  },

  // 选择技能
  selectSkill(skill: Skill | null) {
    this.state.currentSkill = skill
  },

  // 设置当前 Tab
  setCurrentTab(tab: string) {
    this.state.currentTab = tab
  },

  // 安装技能
  async installSkill(skillId: string, options?: Record<string, any>) {
    try {
      const res = await skillApi.install(skillId, options) as any
      return { success: res.success || !!res.data, data: res.data || res.skill }
    } catch (error: any) {
      return { success: false, error: error.message || '安装失败' }
    }
  },

  // 卸载技能
  async uninstallSkill(skillId: string) {
    try {
      const res = await skillApi.uninstall(skillId) as any
      return { success: res.success || true }
    } catch (error: any) {
      return { success: false, error: error.message || '卸载失败' }
    }
  },

  // 切换技能启用状态
  async toggleSkillEnabled(skillId: string, enabled: boolean) {
    try {
      const res = await skillApi.toggleEnabled(skillId, enabled) as any
      return { success: res.success || true }
    } catch (error: any) {
      return { success: false, error: error.message || '操作失败' }
    }
  },

  // 更新技能配置
  async updateSkillConfig(skillId: string, config: Record<string, any>) {
    try {
      const res = await skillApi.updateConfig(skillId, config) as any
      return { success: res.success || true, data: res.data || res.config }
    } catch (error: any) {
      return { success: false, error: error.message || '保存失败' }
    }
  }
}

export default useSkillStore