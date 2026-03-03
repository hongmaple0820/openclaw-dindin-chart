/**
 * 角色状态管理 Store
 * @author 小琳
 * @date 2026-03-03
 */
import { characterApi, Character } from '@/api/character'

interface CharacterState {
  characters: Character[]
  currentCharacter: Character | null
  loading: boolean
}

export const useCharacterStore = {
  state: {
    characters: [],
    currentCharacter: null,
    loading: false
  } as CharacterState,
  
  // 获取角色列表
  async fetchCharacters() {
    try {
      this.state.loading = true
      const res = await characterApi.getList() as any
      
      if (res.success || res.data) {
        this.state.characters = res.data || res.characters || []
      }
      return this.state.characters
    } catch (error) {
      console.error('获取角色列表失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },
  
  // 获取当前角色
  async fetchCurrentCharacter() {
    try {
      const res = await characterApi.getCurrent() as any
      
      if (res.success || res.data) {
        this.state.currentCharacter = res.data || res.character || null
      }
      return this.state.currentCharacter
    } catch (error) {
      console.error('获取当前角色失败:', error)
      throw error
    }
  },
  
  // 切换角色
  async switchCharacter(id: string) {
    try {
      const res = await characterApi.switch(id) as any
      
      if (res.success || res.data) {
        // 更新当前角色
        const character = this.state.characters.find(c => c.id === id)
        if (character) {
          this.state.currentCharacter = character
        }
        return this.state.currentCharacter
      }
      throw new Error(res.message || '切换失败')
    } catch (error) {
      console.error('切换角色失败:', error)
      throw error
    }
  },
  
  // 创建角色
  async createCharacter(data: Partial<Character>) {
    try {
      this.state.loading = true
      const res = await characterApi.create(data) as any
      
      if (res.success || res.data) {
        const newCharacter = res.data || res.character
        this.state.characters.push(newCharacter)
        return newCharacter
      }
      throw new Error(res.message || '创建失败')
    } catch (error) {
      console.error('创建角色失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },
  
  // 更新角色
  async updateCharacter(id: string, data: Partial<Character>) {
    try {
      const res = await characterApi.update(id, data) as any
      
      if (res.success || res.data) {
        const index = this.state.characters.findIndex(c => c.id === id)
        if (index > -1) {
          this.state.characters[index] = { ...this.state.characters[index], ...data }
        }
        // 如果更新的是当前角色，同步更新
        if (this.state.currentCharacter?.id === id) {
          this.state.currentCharacter = { ...this.state.currentCharacter, ...data }
        }
        return this.state.characters[index]
      }
      throw new Error(res.message || '更新失败')
    } catch (error) {
      console.error('更新角色失败:', error)
      throw error
    }
  },
  
  // 删除角色
  async deleteCharacter(id: string) {
    try {
      const res = await characterApi.delete(id) as any
      
      if (res.success) {
        const index = this.state.characters.findIndex(c => c.id === id)
        if (index > -1) {
          this.state.characters.splice(index, 1)
        }
        // 如果删除的是当前角色，清空当前角色
        if (this.state.currentCharacter?.id === id) {
          this.state.currentCharacter = this.state.characters[0] || null
        }
        return true
      }
      throw new Error(res.message || '删除失败')
    } catch (error) {
      console.error('删除角色失败:', error)
      throw error
    }
  },
  
  // 获取角色详情
  async getCharacterById(id: string) {
    try {
      const res = await characterApi.getById(id) as any
      return res.data || res.character || null
    } catch (error) {
      console.error('获取角色详情失败:', error)
      throw error
    }
  }
}

export default useCharacterStore
