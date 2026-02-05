<template>
  <div class="chat-container">
    <!-- 头部 -->
    <header class="chat-header">
      <div class="header-content">
        <h1>🤖 AI 聊天室</h1>
        <div class="header-right">
          <div class="status" :class="{ online: isConnected }">
            {{ isConnected ? '在线' : '离线' }}
          </div>
          <button class="settings-btn" @click="showSettings = true">⚙️</button>
        </div>
      </div>
    </header>

    <!-- 消息列表 -->
    <main class="chat-messages" ref="messagesContainer">
      <div v-if="loading" class="loading">
        <span>加载中...</span>
      </div>
      <div v-else-if="messages.length === 0" class="empty">
        <span>暂无消息，发送一条试试吧</span>
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
          <div class="message-text" v-html="formatContent(msg.content)"></div>
        </div>
      </div>
    </main>

    <!-- @ 提示 -->
    <div class="at-hint" v-if="showAtHint">
      <div class="at-hint-title">快速 @ 成员</div>
      <div class="at-options">
        <button 
          v-for="member in atMembers" 
          :key="member.name"
          @click="insertAt(member.name)"
          class="at-option"
        >
          {{ member.avatar }} {{ member.name }}
        </button>
      </div>
    </div>

    <!-- 输入区域 -->
    <footer class="chat-input">
      <div class="input-wrapper">
        <div class="input-user">{{ getAvatar(userName) }}</div>
        <input
          v-model="inputMessage"
          type="text"
          :placeholder="`以 ${userName} 身份发送消息... (输入 @ 可快速提及)`"
          @keyup.enter="sendMessage"
          @input="handleInput"
          :disabled="sending"
          ref="inputRef"
        />
        <button @click="sendMessage" :disabled="sending || !inputMessage.trim()">
          {{ sending ? '...' : '发送' }}
        </button>
      </div>
    </footer>

    <!-- 设置弹窗 -->
    <div class="modal-overlay" v-if="showSettings" @click.self="showSettings = false">
      <div class="modal">
        <div class="modal-header">
          <h2>设置</h2>
          <button class="close-btn" @click="showSettings = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>你的名字</label>
            <input v-model="settingsName" type="text" placeholder="输入你的名字" />
          </div>
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="settingsApiBase" type="text" placeholder="http://localhost:3000" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showSettings = false">取消</button>
          <button class="btn-primary" @click="saveSettings">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import axios from 'axios'

// 配置
const defaultApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

// 状态
const messages = ref([])
const inputMessage = ref('')
const loading = ref(true)
const sending = ref(false)
const isConnected = ref(false)
const messagesContainer = ref(null)
const inputRef = ref(null)
const showSettings = ref(false)
const showAtHint = ref(false)

// 用户设置
const userName = ref(localStorage.getItem('chat-userName') || '鸿枫')
const apiBase = ref(localStorage.getItem('chat-apiBase') || defaultApiBase)
const settingsName = ref('')
const settingsApiBase = ref('')

// @ 成员列表（排除自己）
const allMembers = [
  { name: '小琳', avatar: '✨' },
  { name: '小猪', avatar: '🐷' },
  { name: '鸿枫', avatar: '🍁' },
  { name: '琳琳', avatar: '👩' }
]

const atMembers = computed(() => {
  return allMembers.filter(m => m.name !== userName.value)
})

// 轮询定时器
let pollTimer = null

// 获取消息
async function fetchMessages() {
  try {
    const res = await axios.get(`${apiBase.value}/api/context`)
    const newMessages = res.data.context || []
    
    // 检查是否有新消息
    if (newMessages.length !== messages.value.length) {
      messages.value = newMessages
      await scrollToBottom()
    }
    isConnected.value = true
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
  showAtHint.value = false
  
  try {
    await axios.post(`${apiBase.value}/api/send`, {
      content: inputMessage.value,
      sender: userName.value
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

// 处理输入
function handleInput(e) {
  const value = e.target.value
  // 检测是否输入了 @
  if (value.endsWith('@')) {
    showAtHint.value = true
  } else {
    showAtHint.value = false
  }
}

// 插入 @
function insertAt(name) {
  // 替换最后的 @ 为 @名字
  if (inputMessage.value.endsWith('@')) {
    inputMessage.value = inputMessage.value.slice(0, -1) + `@${name} `
  } else {
    inputMessage.value += `@${name} `
  }
  showAtHint.value = false
  inputRef.value?.focus()
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
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 格式化内容（高亮 @）
function formatContent(content) {
  if (!content) return ''
  // 转义 HTML
  let escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // 高亮 @某人
  escaped = escaped.replace(/@(小琳|小猪|鸿枫|琳琳|maple|lin)/g, '<span class="at-mention">@$1</span>')
  return escaped
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
  if (msg.sender === userName.value) return 'self'
  if (msg.type === 'bot') return 'bot'
  return 'human'
}

// 打开设置
function openSettings() {
  settingsName.value = userName.value
  settingsApiBase.value = apiBase.value
  showSettings.value = true
}

// 保存设置
function saveSettings() {
  if (settingsName.value.trim()) {
    userName.value = settingsName.value.trim()
    localStorage.setItem('chat-userName', userName.value)
  }
  if (settingsApiBase.value.trim()) {
    apiBase.value = settingsApiBase.value.trim()
    localStorage.setItem('chat-apiBase', apiBase.value)
  }
  showSettings.value = false
  fetchMessages()
}

// 生命周期
onMounted(() => {
  settingsName.value = userName.value
  settingsApiBase.value = apiBase.value
  fetchMessages()
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
  background: #f0f2f5;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  position: relative;
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

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.status {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.status.online {
  background: #4ade80;
  color: #166534;
}

.settings-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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
  font-size: 0.9rem;
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
  font-size: 0.9rem;
}

.time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.message-text {
  background: #fff;
  padding: 12px 16px;
  border-radius: 4px 16px 16px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
  display: inline-block;
  max-width: 100%;
}

.at-mention {
  color: #667eea;
  font-weight: 500;
}

/* 不同角色的消息样式 */
.message.bot-xiaolin .message-avatar {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.message.bot-xiaolin .message-text {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.message.bot-xiaozhu .message-avatar {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
}

.message.bot-xiaozhu .message-text {
  background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
}

.message.self .message-text {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 16px 4px 16px 16px;
}

/* @ 提示 */
.at-hint {
  position: absolute;
  bottom: 80px;
  left: 20px;
  right: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  z-index: 10;
}

.at-hint-title {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.at-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.at-option {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.at-option:hover {
  background: #f3f4f6;
  border-color: #667eea;
  color: #667eea;
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
  align-items: center;
}

.input-user {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.chat-input input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-input input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input button {
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.chat-input button:hover:not(:disabled) {
  opacity: 0.9;
  transform: scale(1.02);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 设置弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #9ca3af;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  outline: none;
}

.form-group input:focus {
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary {
  padding: 10px 20px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

/* 响应式 */
@media (max-width: 640px) {
  .chat-container {
    max-width: 100%;
  }

  .chat-header h1 {
    font-size: 1rem;
  }

  .chat-messages {
    padding: 16px;
  }

  .message {
    gap: 10px;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    font-size: 1.1rem;
  }

  .message-text {
    padding: 10px 14px;
    font-size: 0.9rem;
  }

  .chat-input {
    padding: 12px 16px;
  }

  .input-user {
    width: 36px;
    height: 36px;
    font-size: 1.1rem;
  }

  .chat-input input {
    padding: 10px 14px;
    font-size: 0.9rem;
  }

  .chat-input button {
    padding: 10px 16px;
    font-size: 0.9rem;
  }
}
</style>
