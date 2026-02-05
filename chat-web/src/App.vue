<template>
  <div class="chat-container">
    <!-- 头部 -->
    <el-header class="chat-header">
      <div class="header-left">
        <el-icon :size="24"><ChatDotRound /></el-icon>
        <span class="title">{{ appTitle }}</span>
      </div>
      <div class="header-right">
        <el-tag :type="isConnected ? 'success' : 'danger'" size="small">
          {{ isConnected ? '在线' : '离线' }}
        </el-tag>
        <el-button :icon="Setting" circle @click="showSettings = true" />
      </div>
    </el-header>

    <!-- 消息列表 -->
    <el-main class="chat-messages" ref="messagesContainer">
      <el-empty v-if="loading" description="加载中..." />
      <el-empty v-else-if="messages.length === 0" description="暂无消息，发送一条试试吧" />
      <div v-else class="message-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-item"
          :class="getMessageClass(msg)"
        >
          <el-avatar :size="40" class="message-avatar">
            {{ getAvatar(msg.sender) }}
          </el-avatar>
          <div class="message-body">
            <div class="message-meta">
              <span class="sender">{{ msg.sender }}</span>
              <span class="time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <el-card shadow="hover" class="message-card">
              <div v-html="formatContent(msg.content)"></div>
            </el-card>
          </div>
        </div>
      </div>
    </el-main>

    <!-- @ 提示 -->
    <el-popover
      :visible="showAtHint"
      placement="top"
      :width="300"
      trigger="manual"
    >
      <template #reference>
        <span></span>
      </template>
      <div class="at-popover">
        <div class="at-title">快速 @ 成员</div>
        <el-space wrap>
          <el-button
            v-for="member in atMembers"
            :key="member.name"
            size="small"
            @click="insertAt(member.name)"
          >
            {{ member.avatar }} {{ member.name }}
          </el-button>
        </el-space>
      </div>
    </el-popover>

    <!-- 输入区域 -->
    <el-footer class="chat-footer">
      <div class="input-area">
        <el-avatar :size="36" class="input-avatar">
          {{ getAvatar(userName) }}
        </el-avatar>
        <el-input
          v-model="inputMessage"
          :placeholder="`以 ${userName} 身份发送消息... (输入 @ 可快速提及)`"
          @keyup.enter="sendMessage"
          @input="handleInput"
          :disabled="sending"
          ref="inputRef"
          size="large"
          clearable
        >
          <template #append>
            <el-button
              type="primary"
              :icon="Promotion"
              @click="sendMessage"
              :loading="sending"
              :disabled="!inputMessage.trim()"
            >
              发送
            </el-button>
          </template>
        </el-input>
      </div>
      
      <!-- @ 提示（移动端友好） -->
      <el-collapse-transition>
        <div v-if="showAtHint" class="at-hint-bar">
          <el-button
            v-for="member in atMembers"
            :key="member.name"
            size="small"
            @click="insertAt(member.name)"
          >
            {{ member.avatar }} {{ member.name }}
          </el-button>
        </div>
      </el-collapse-transition>
    </el-footer>

    <!-- 设置弹窗 -->
    <el-dialog
      v-model="showSettings"
      title="设置"
      width="400px"
      :close-on-click-modal="true"
    >
      <el-form :model="settingsForm" label-width="80px">
        <el-form-item label="你的名字">
          <el-input v-model="settingsForm.name" placeholder="输入你的名字" />
        </el-form-item>
        <el-form-item label="API 地址">
          <el-input v-model="settingsForm.apiBase" placeholder="http://localhost:3000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Setting, Promotion, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

// 环境配置
const appTitle = import.meta.env.VITE_APP_TITLE || 'MapleChatRoom'
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

// 设置表单
const settingsForm = reactive({
  name: '',
  apiBase: ''
})

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
    ElMessage.success('发送成功')
  } catch (error) {
    console.error('发送失败:', error)
    ElMessage.error('发送失败，请检查服务是否运行')
  } finally {
    sending.value = false
  }
}

// 处理输入
function handleInput(value) {
  showAtHint.value = value.endsWith('@')
}

// 插入 @
function insertAt(name) {
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
  if (messagesContainer.value?.$el) {
    messagesContainer.value.$el.scrollTop = messagesContainer.value.$el.scrollHeight
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
  let escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  escaped = escaped.replace(/@(小琳|小猪|鸿枫|琳琳|maple|lin)/g, '<span class="at-mention">@$1</span>')
  // 保持换行
  escaped = escaped.replace(/\n/g, '<br>')
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

// 保存设置
function saveSettings() {
  if (settingsForm.name.trim()) {
    userName.value = settingsForm.name.trim()
    localStorage.setItem('chat-userName', userName.value)
  }
  if (settingsForm.apiBase.trim()) {
    apiBase.value = settingsForm.apiBase.trim()
    localStorage.setItem('chat-apiBase', apiBase.value)
  }
  showSettings.value = false
  fetchMessages()
  ElMessage.success('设置已保存')
}

// 生命周期
onMounted(() => {
  settingsForm.name = userName.value
  settingsForm.apiBase = apiBase.value
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

html, body, #app {
  height: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  max-width: 900px;
  margin: 0 auto;
  background: #f5f7fa;
}

/* 头部 */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  color: white;
  height: 60px !important;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left .title {
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right .el-button {
  color: white;
  border-color: rgba(255,255,255,0.3);
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sender {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.time {
  font-size: 12px;
  color: #909399;
}

.message-card {
  display: inline-block;
  max-width: 100%;
}

.message-card .el-card__body {
  padding: 12px 16px;
  line-height: 1.6;
  word-break: break-word;
}

.at-mention {
  color: #409eff;
  font-weight: 500;
}

/* 不同角色样式 */
.message-item.bot-xiaolin .message-avatar {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.message-item.bot-xiaolin .message-card {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.message-item.bot-xiaozhu .message-avatar {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
}

.message-item.bot-xiaozhu .message-card {
  background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
}

.message-item.self .message-card {
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
}

/* 底部输入区 */
.chat-footer {
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  height: auto !important;
}

.input-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
}

.input-area .el-input {
  flex: 1;
}

.at-hint-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}

/* 响应式 */
@media (max-width: 640px) {
  .chat-container {
    max-width: 100%;
  }

  .chat-header {
    padding: 0 12px;
  }

  .header-left .title {
    font-size: 16px;
  }

  .chat-messages {
    padding: 12px;
  }

  .message-item {
    gap: 8px;
  }

  .message-avatar {
    --el-avatar-size: 32px !important;
  }

  .chat-footer {
    padding: 12px;
  }

  .input-avatar {
    display: none;
  }
}
</style>
