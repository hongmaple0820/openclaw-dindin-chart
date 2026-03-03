<template>
  <view class="chat-page">
    <!-- 角色信息栏 -->
    <CharacterHeader 
      v-if="chatStore.hasCharacter"
      :character="chatStore.currentCharacter"
      :relationship="chatStore.relationship"
      @show-relationship="showRelationshipPanel"
    />

    <!-- 触发器状态指示 -->
    <view class="trigger-status" :class="{ active: chatStore.triggerActive }">
      <text>{{ chatStore.triggerStatusText }}</text>
    </view>

    <!-- 快捷操作栏 -->
    <QuickActions 
      v-if="chatStore.hasCharacter"
      @selfie="handleSelfie"
      @voice="handleVoice"
      @memories="handleMemories"
    />

    <!-- 消息列表 -->
    <scroll-view 
      class="messages-container" 
      scroll-y 
      :scroll-into-view="scrollToView"
      :scroll-with-animation="true"
    >
      <view 
        v-for="msg in chatStore.sortedMessages" 
        :key="msg.id" 
        :id="'msg-' + msg.id"
        class="message-item"
        :class="{ 'is-self': msg.sender === currentUser }"
      >
        <view class="avatar">{{ msg.sender?.[0] || '?' }}</view>
        <view class="message-content">
          <view class="message-header">
            <text class="sender-name">{{ msg.sender }}</text>
            <text class="time">{{ formatTime(msg.timestamp) }}</text>
          </view>
          
          <!-- 文本消息 -->
          <view class="message-text" v-if="msg.type === 'text' || !msg.type">
            {{ msg.content }}
          </view>
          
          <!-- 图片消息 -->
          <view class="message-image" v-if="msg.type === 'image' && msg.imageUrl" @click="previewImage(msg.imageUrl)">
            <image :src="msg.imageUrl" mode="widthFix" class="chat-image" />
            <text class="image-caption" v-if="msg.content">{{ msg.content }}</text>
          </view>
          
          <!-- 语音消息 -->
          <view class="message-voice" v-if="msg.type === 'voice'" @click="playVoice(msg.voiceUrl!)">
            <text class="voice-icon">🔊</text>
            <text class="voice-text">{{ msg.content }}</text>
          </view>
        </view>
      </view>
      
      <view v-if="chatStore.messages.length === 0 && !chatStore.isLoading" class="empty-messages">
        <text>暂无消息</text>
      </view>
      
      <view v-if="chatStore.isLoading" class="loading">
        <text>加载中...</text>
      </view>
    </scroll-view>

    <!-- 增强的消息输入区域 -->
    <MessageInput 
      v-model="inputText"
      placeholder="说点什么..."
      @send="handleSend"
      @emoji="showEmojiPicker"
      @choose-image="chooseImage"
    />

    <!-- 关系面板弹窗 -->
    <uni-popup ref="relationshipPopup" type="bottom">
      <RelationshipPanel 
        :character-id="chatStore.currentCharacterId"
        :relationship="chatStore.relationship"
        @close="closeRelationshipPanel"
      />
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import CharacterHeader from '@/components/CharacterHeader.vue'
import QuickActions from '@/components/QuickActions.vue'
import MessageInput from '@/components/MessageInput.vue'
import RelationshipPanel from '@/components/RelationshipPanel.vue'

const chatStore = useChatStore()
const inputText = ref('')
const scrollToView = ref('')
const relationshipPopup = ref()
const currentUser = ref(uni.getStorageSync('username') || '我')

// 当前角色ID（可以从路由参数获取）
const currentCharacterId = computed(() => {
  // 尝试从页面参数获取
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return (currentPage as any).options?.characterId || ''
})

// 加载消息
const loadMessages = async () => {
  await chatStore.loadMessages(50)
  scrollToBottom()
}

// 发送消息
const handleSend = async (text: string) => {
  if (!text.trim()) return
  
  inputText.value = ''
  await chatStore.sendMessage(text)
  scrollToBottom()
}

// 选择图片
const chooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传中...' })
      
      try {
        // 上传图片
        const uploadRes: any = await new Promise((resolve, reject) => {
          uni.uploadFile({
            url: (uni as any).API_BASE_URL + '/api/files/upload',
            filePath: tempFilePath,
            name: 'file',
            header: {
              Authorization: \`Bearer \${uni.getStorageSync('accessToken')}\`
            },
            success: (res) => resolve(JSON.parse(res.data)),
            fail: reject
          })
        })
        
        if (uploadRes.success && uploadRes.url) {
          // 发送图片消息
          await chatStore.sendMessage('[图片]', 'image', uploadRes.url)
          scrollToBottom()
        }
      } catch (error) {
        console.error('上传图片失败:', error)
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

// 预览图片
const previewImage = (url: string) => {
  uni.previewImage({
    urls: [url],
    current: url
  })
}

// 播放语音
const playVoice = (url: string) => {
  const innerAudioContext = uni.createInnerAudioContext()
  innerAudioContext.src = url
  innerAudioContext.play()
}

// 显示表情选择器
const showEmojiPicker = () => {
  uni.showToast({ title: '表情功能开发中', icon: 'none' })
}

// 请求自拍
const handleSelfie = async () => {
  uni.showLoading({ title: '生成中...' })
  const result = await chatStore.requestSelfie()
  uni.hideLoading()
  
  if (result) {
    scrollToBottom()
    uni.showToast({ title: '自拍已生成', icon: 'success' })
  } else {
    uni.showToast({ title: '生成失败', icon: 'none' })
  }
}

// 请求语音
const handleVoice = async () => {
  if (!inputText.value.trim()) {
    uni.showToast({ title: '请输入文字', icon: 'none' })
    return
  }
  
  uni.showLoading({ title: '生成中...' })
  const result = await chatStore.requestVoice(inputText.value.trim())
  uni.hideLoading()
  
  if (result) {
    inputText.value = ''
    scrollToBottom()
  } else {
    uni.showToast({ title: '生成失败', icon: 'none' })
  }
}

// 显示回忆
const handleMemories = () => {
  showRelationshipPanel()
}

// 显示关系面板
const showRelationshipPanel = () => {
  relationshipPopup.value?.open()
}

// 关闭关系面板
const closeRelationshipPanel = () => {
  relationshipPopup.value?.close()
}

// 滚动到底部
const scrollToBottom = () => {
  setTimeout(() => {
    const messages = chatStore.sortedMessages
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      scrollToView.value = 'msg-' + lastMsg.id
    }
  }, 100)
}

// 格式化时间
const formatTime = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  
  return \`\${date.getMonth() + 1}-\${date.getDate()} \${date.getHours()}:\${date.getMinutes()}\`
}

// 页面加载
onMounted(async () => {
  // 加载消息
  await loadMessages()
  
  // 如果有角色ID，加载角色信息
  if (currentCharacterId.value) {
    await chatStore.loadCharacter(currentCharacterId.value)
    await chatStore.loadRelationship(currentCharacterId.value)
  }
})

// 下拉刷新
const onPullDownRefresh = () => {
  loadMessages().then(() => {
    uni.stopPullDownRefresh()
  })
}

// 定义页面配置
definePageConfig({
  navigationBarTitleText: '聊天',
  enablePullDownRefresh: true
})
</script>

<style lang="scss" scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.trigger-status {
  padding: 12rpx 30rpx;
  background-color: #fff3e0;
  text-align: center;
  font-size: 24rpx;
  color: #ff9800;
  
  &.active {
    animation: pulse 1.5s infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.messages-container {
  flex: 1;
  padding: 20rpx;
}

.message-item {
  display: flex;
  margin-bottom: 30rpx;
  
  &.is-self {
    flex-direction: row-reverse;
    
    .message-content {
      align-items: flex-end;
    }
    
    .message-text {
      background-color: #409eff;
      color: #fff;
    }
    
    .message-image,
    .message-voice {
      background-color: #409eff;
    }
  }
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin: 0 20rpx;
  flex-shrink: 0;
}

.message-content {
  max-width: 500rpx;
  display: flex;
  flex-direction: column;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.sender-name {
  font-size: 24rpx;
  color: #666;
  margin-right: 10rpx;
}

.time {
  font-size: 20rpx;
  color: #999;
}

.message-text {
  background-color: #fff;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  line-height: 1.5;
  word-break: break-word;
}

.message-image {
  background-color: #fff;
  padding: 10rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.chat-image {
  max-width: 400rpx;
  border-radius: 8rpx;
}

.image-caption {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 8rpx;
  padding: 0 10rpx;
}

.message-voice {
  background-color: #fff;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.voice-icon {
  font-size: 32rpx;
}

.voice-text {
  font-size: 28rpx;
  color: #333;
}

.empty-messages,
.loading {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
