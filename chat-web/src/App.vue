<template>
  <div class="chat-container">
    <!-- 头部 -->
    <header class="chat-header">
      <div class="header-content">
        <h1>🤖 AI 聊天室</h1>
        <div class="status" :class="{ online: isConnected }">
          {{ isConnected ? '在线' : '离线' }}
        </div>
      </div>
    </header>

    <!-- 消息列表 -->
    <main class="chat-messages" ref="messagesContainer">
      <div v-if="loading" class="loading">
        <span>加载中...</span>
      </div>
      <div v-else-if="messages.length === 0" class="empty">
        <span>暂无消息</span>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="getMessageClass(msg)"
      >
        <div class="message-avatar">
          {{ getAvatar(msg.sender) }}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="sender">{{ msg.sender }}</span>
            <span class="time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-text">{{ msg.content }}</div>
        </div>
      </div>
    </main>

    <!-- 输入区域 -->
    <footer class="chat-input">
      <div class="input-wrapper">
        <select v-model="sender" class="sender-select">
          <option value="测试用户">测试用户</option>
          <option value="小琳">小琳</option>
          <option value="小猪">小猪</option>
        </select>
        <input
          v-model="inputMessage"
          type="text"
          placeholder="输入消息..."
          @keyup.enter="sendMessage"
          :disabled="sending"
        />
        <button @click="sendMessage" :disabled="sending || !inputMessage.trim()">
          {{ sending ? '发送中...' : '发送' }}
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'

// 配置 API 地址
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

// 状态
const messages = ref([])
const inputMessage = ref('')
const sender = ref('测试用户')
const loading = ref(true)
const sending = ref(false)
const isConnected = ref(false)
const messagesContainer = ref(null)

// 轮询定时器
let pollTimer = null

// 获取消息
async function fetchMessages() {
  try {
    const res = await axios.get(`${API_BASE}/api/context`)
    messages.value = res.data.context || []
    isConnected.value = true
    await scrollToBottom()
  } catch (error) {
    console.error('获取消息失败:', error)
    isConnected.value = false
  } finally {
    loading.value = false
  }
}

// 发送消息
async function sendMessage() {
  if (!inputMessage.value.trim() || sending.value) return

  sending.value = true
  try {
    await axios.post(`${API_BASE}/api/send`, {
      content: inputMessage.value,
      sender: sender.value
    })
    inputMessage.value = ''
    await fetchMessages()
  } catch (error) {
    console.error('发送失败:', error)
    alert('发送失败，请检查服务是否运行')
  } finally {
    sending.value = false
  }
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 获取头像
function getAvatar(sender) {
  const avatars = {
    '小琳': '✨',
    '小猪': '🐷',
    'maple': '🍁',
    '鸿枫': '🍁',
    'lin': '👩',
    '琳琳': '👩'
  }
  return avatars[sender] || '👤'
}

// 获取消息样式类
function getMessageClass(msg) {
  if (msg.sender === '小琳') return 'bot-xiaolin'
  if (msg.sender === '小猪') return 'bot-xiaozhu'
  if (msg.type === 'bot') return 'bot'
  return 'human'
}

// 生命周期
onMounted(() => {
  fetchMessages()
  // 每 3 秒轮询一次
  pollTimer = setInterval(fetchMessages, 3000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f5f5;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

/* 头部 */
.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.status {
  font-size: 0.875rem;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.status.online {
  background: #4ade80;
  color: #166534;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f9fafb;
}

.loading, .empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #9ca3af;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sender {
  font-weight: 600;
  color: #374151;
}

.time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.message-text {
  background: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  border-radius: 12px 12px 12px 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  word-break: break-word;
  white-space: pre-wrap;
}

/* 不同角色的消息样式 */
.message.bot-xiaolin .message-avatar {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.message.bot-xiaolin .message-text {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.message.bot-xiaozhu .message-avatar {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
}

.message.bot-xiaozhu .message-text {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
}

.message.human .message-text {
  background: #fff;
}

/* 输入区域 */
.chat-input {
  padding: 16px 20px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  gap: 8px;
}

.sender-select {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}

.chat-input input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input input:focus {
  border-color: #667eea;
}

.chat-input button {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.chat-input button:hover:not(:disabled) {
  opacity: 0.9;
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 640px) {
  .chat-container {
    max-width: 100%;
    height: 100vh;
    height: 100dvh;
  }

  .chat-header h1 {
    font-size: 1rem;
  }

  .input-wrapper {
    flex-wrap: wrap;
  }

  .sender-select {
    width: 100%;
  }

  .chat-input input {
    flex: 1;
  }

  .chat-input button {
    padding: 10px 16px;
  }
}
</style>
