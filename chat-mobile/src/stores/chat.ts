/**
 * 聊天状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { request } from '@/api/index'

export interface Message {
  id: string
  sender: string
  content: string
  timestamp: number
  type?: 'text' | 'image' | 'voice'
  imageUrl?: string
  voiceUrl?: string
}

export interface Character {
  id: string
  name: string
  avatar: string
  mood?: string
  description?: string
}

export interface Relationship {
  intimacyLevel: number
  trustLevel: number
  memories: string[]
}

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<Message[]>([])
  const currentCharacter = ref<Character | null>(null)
  const currentCharacterId = ref<string>('')
  const relationship = ref<Relationship>({
    intimacyLevel: 0,
    trustLevel: 0,
    memories: []
  })
  const triggerActive = ref(false)
  const triggerStatusText = ref('')
  const inputText = ref('')
  const isLoading = ref(false)

  // 计算属性
  const hasCharacter = computed(() => !!currentCharacter.value)
  
  const sortedMessages = computed(() => {
    return [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  })

  // 加载消息
  const loadMessages = async (limit = 50) => {
    try {
      isLoading.value = true
      const res: any = await request({
        url: '/api/context',
        method: 'GET',
        data: { limit }
      })
      if (res.success) {
        messages.value = (res.context || []).map((msg: any) => ({
          id: msg.id || String(Date.now()),
          sender: msg.sender || '未知',
          content: msg.content || msg.message || '',
          timestamp: msg.timestamp || Date.now(),
          type: msg.type || 'text',
          imageUrl: msg.imageUrl,
          voiceUrl: msg.voiceUrl
        }))
      }
      return true
    } catch (error) {
      console.error('加载消息失败:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 发送消息
  const sendMessage = async (content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    if (!content.trim() && type === 'text') return null

    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      sender: uni.getStorageSync('username') || '我',
      content,
      timestamp: Date.now(),
      type,
      imageUrl
    }

    messages.value.push(tempMessage)

    try {
      const res: any = await request({
        url: '/api/store',
        method: 'POST',
        data: {
          sender: tempMessage.sender,
          content,
          type,
          imageUrl,
          source: 'mobile'
        }
      })
      
      if (res.success) {
        const index = messages.value.findIndex(m => m.id === tempMessage.id)
        if (index > -1 && res.message) {
          messages.value[index] = {
            ...tempMessage,
            id: res.message.id || tempMessage.id
          }
        }
        return res.message
      }
    } catch (error) {
      console.error('发送失败:', error)
      // 移除临时消息
      const index = messages.value.findIndex(m => m.id === tempMessage.id)
      if (index > -1) {
        messages.value.splice(index, 1)
      }
    }
    return null
  }

  // 加载角色信息
  const loadCharacter = async (characterId: string) => {
    try {
      const res: any = await request({
        url: \`/api/character/characters/\${characterId}\`,
        method: 'GET'
      })
      if (res.success && res.character) {
        currentCharacter.value = res.character
        currentCharacterId.value = characterId
      }
      return res
    } catch (error) {
      console.error('加载角色失败:', error)
      return null
    }
  }

  // 加载关系信息
  const loadRelationship = async (characterId: string) => {
    try {
      const res: any = await request({
        url: \`/api/character/relationship/\${characterId}\`,
        method: 'GET'
      })
      if (res.success && res.relationship) {
        relationship.value = res.relationship
      }
      return res
    } catch (error) {
      console.error('加载关系失败:', error)
      return null
    }
  }

  // 请求自拍
  const requestSelfie = async (mode = 'mirror') => {
    if (!currentCharacterId.value) return null
    
    triggerActive.value = true
    triggerStatusText.value = '正在生成自拍...'
    
    try {
      const res: any = await request({
        url: \`/api/character/characters/\${currentCharacterId.value}/selfie\`,
        method: 'POST',
        data: { mode }
      })
      
      if (res.success && res.imageUrl) {
        // 添加图片消息
        messages.value.push({
          id: 'selfie-' + Date.now(),
          sender: currentCharacter.value?.name || '角色',
          content: '📸 刚拍的自拍~',
          timestamp: Date.now(),
          type: 'image',
          imageUrl: res.imageUrl
        })
        return res.imageUrl
      }
    } catch (error) {
      console.error('请求自拍失败:', error)
    } finally {
      triggerActive.value = false
      triggerStatusText.value = ''
    }
    return null
  }

  // 请求语音
  const requestVoice = async (text: string) => {
    if (!currentCharacterId.value) return null
    
    triggerActive.value = true
    triggerStatusText.value = '正在生成语音...'
    
    try {
      const res: any = await request({
        url: \`/api/character/characters/\${currentCharacterId.value}/voice\`,
        method: 'POST',
        data: { text }
      })
      
      if (res.success && res.voiceUrl) {
        // 添加语音消息
        messages.value.push({
          id: 'voice-' + Date.now(),
          sender: currentCharacter.value?.name || '角色',
          content: text,
          timestamp: Date.now(),
          type: 'voice',
          voiceUrl: res.voiceUrl
        })
        return res.voiceUrl
      }
    } catch (error) {
      console.error('请求语音失败:', error)
    } finally {
      triggerActive.value = false
      triggerStatusText.value = ''
    }
    return null
  }

  // 添加消息（用于接收推送消息）
  const addMessage = (message: Message) => {
    messages.value.push(message)
  }

  // 清空消息
  const clearMessages = () => {
    messages.value = []
  }

  return {
    // 状态
    messages,
    currentCharacter,
    currentCharacterId,
    relationship,
    triggerActive,
    triggerStatusText,
    inputText,
    isLoading,
    
    // 计算属性
    hasCharacter,
    sortedMessages,
    
    // 方法
    loadMessages,
    sendMessage,
    loadCharacter,
    loadRelationship,
    requestSelfie,
    requestVoice,
    addMessage,
    clearMessages
  }
})
