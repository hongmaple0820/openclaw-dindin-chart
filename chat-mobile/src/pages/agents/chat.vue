<template>
  <view class="agent-chat-page">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹ 返回</text>
      </view>
      <view class="agent-info" v-if="agent">
        <text class="agent-name">{{ agent.name }}</text>
        <view :class="['status-dot', agent.status]"></view>
      </view>
      <view class="clear-btn" @click="clearHistory">
        <text>清空</text>
      </view>
    </view>
    
    <!-- 消息列表 -->
    <scroll-view 
      class="messages-container" 
      scroll-y 
      :scroll-into-view="scrollToView"
      :scroll-with-animation="true"
    >
      <view v-if="messages.length === 0" class="empty-messages">
        <text>开始与 {{ agent?.name || '智能体' }} 对话吧</text>
      </view>
      
      <view 
        v-for="(msg, index) in messages" 
        :key="index" 
        :id="'msg-' + index"
        class="message-item"
        :class="{ 'is-agent': msg.role === 'assistant' }"
      >
        <view class="avatar" v-if="msg.role === 'assistant'">
          <image v-if="agent?.avatar" :src="agent.avatar" mode="aspectFill" />
          <text v-else>{{ agent?.name?.[0] || '?' }}</text>
        </view>
        <view class="message-content">
          <view class="message-text">{{ msg.content }}</view>
          <text class="time">{{ formatTime(msg.timestamp) }}</text>
        </view>
      </view>
      
      <view v-if="isTyping" class="message-item is-agent">
        <view class="avatar">
          <image v-if="agent?.avatar" :src="agent.avatar" mode="aspectFill" />
          <text v-else>{{ agent?.name?.[0] || '?' }}</text>
        </view>
        <view class="message-content">
          <view class="typing-indicator">
            <text>.</text><text>.</text><text>.</text>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 输入区域 -->
    <view class="input-area">
      <input 
        v-model="inputText" 
        placeholder="输入消息..." 
        class="message-input"
        :adjust-position="true"
        @confirm="sendMessage"
      />
      <view class="send-btn" :class="{ active: inputText.trim() }" @click="sendMessage">
        <text>发送</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useAgentStore } from '@/stores/agents'
import { Agent } from '@/api/agents'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const agentStore = useAgentStore

const agent = ref<Agent | null>(null)
const messages = ref<Message[]>([])
const inputText = ref('')
const scrollToView = ref('')
const isTyping = ref(false)

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const agentId = currentPage?.options?.id
  
  if (agentId) {
    agent.value = await agentStore.fetchAgentDetail(agentId)
  }
})

function goBack() {
  uni.navigateBack()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !agent.value) return
  
  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: text,
    timestamp: Date.now()
  })
  inputText.value = ''
  scrollToBottom()
  
  // 显示输入中状态
  isTyping.value = true
  
  try {
    // 构建消息历史
    const chatMessages = messages.value.map(m => ({
      role: m.role,
      content: m.content
    }))
    
    // 发送请求
    const response = await agentStore.sendMessage(agent.value!.id, chatMessages)
    
    // 添加助手回复
    messages.value.push({
      role: 'assistant',
      content: response.message || response.content || '抱歉，我无法理解您的问题。',
      timestamp: Date.now()
    })
    scrollToBottom()
  } catch (error) {
    uni.showToast({ title: '发送失败', icon: 'none' })
  } finally {
    isTyping.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    const lastIdx = messages.value.length - 1
    if (lastIdx >= 0) {
      scrollToView.value = 'msg-' + lastIdx
    }
  })
}

async function clearHistory() {
  const [, result] = await uni.showModal({
    title: '确认清空',
    content: '确定要清空对话历史吗？'
  })
  
  if (result) {
    messages.value = []
    if (agent.value) {
      await agentStore.state.currentAgent && uni.showToast({ title: '已清空', icon: 'success' })
    }
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
.agent-chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.back-btn,
.clear-btn {
  font-size: 28rpx;
  color: #fff;
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.agent-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  
  &.active {
    background-color: #4caf50;
  }
  
  &.inactive {
    background-color: #9e9e9e;
  }
  
  &.busy {
    background-color: #ff9800;
  }
}

.messages-container {
  flex: 1;
  padding: 20rpx;
}

.empty-messages {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.message-item {
  display: flex;
  margin-bottom: 30rpx;
  
  &.is-agent {
    .message-content {
      align-items: flex-start;
    }
    
    .message-text {
      background-color: #fff;
    }
  }
}

.avatar {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 16rpx;
  
  image {
    width: 100%;
    height: 100%;
  }
  
  text {
    font-size: 30rpx;
    color: #fff;
    font-weight: bold;
  }
}

.message-content {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}

.message-text {
  background-color: #667eea;
  color: #fff;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 1.5;
  word-break: break-word;
}

.time {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.typing-indicator {
  display: flex;
  gap: 4rpx;
  padding: 20rpx 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  
  text {
    animation: typing 1s infinite;
    
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes typing {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.input-area {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background-color: #fff;
  border-top: 1rpx solid #eee;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.message-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  background-color: #f5f7fa;
  border-radius: 36rpx;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e0e0e0;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: #999;
  
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}
</style>