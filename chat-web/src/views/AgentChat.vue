<!--
  Agent 对话页
  @author 小琳
  @date 2026-03-04
  功能：对话界面、消息列表、输入框、流式输出
-->
<template>
  <div class="agent-chat-page">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <div v-else-if="!agent" class="error-container">
      <el-empty description="Agent 不存在">
        <el-button type="primary" @click="$router.push({ name: 'Agents' })">
          返回列表
        </el-button>
      </el-empty>
    </div>

    <div v-else class="chat-container">
      <!-- 头部 -->
      <div class="chat-header">
        <div class="header-left">
          <el-button text @click="$router.back()">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <el-avatar :size="40" :src="agent.avatar">
            {{ agent.nickname?.[0] || agent.name?.[0] || 'A' }}
          </el-avatar>
          <div class="agent-info">
            <h3>{{ agent.nickname || agent.name }}</h3>
            <span class="status-text" :class="statusClass">{{ statusText }}</span>
          </div>
        </div>
        <div class="header-actions">
          <el-button text @click="clearMessages">
            <el-icon><Delete /></el-icon>
            清空对话
          </el-button>
          <el-button text @click="showSettings = true">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesRef">
        <div v-if="messages.length === 0" class="empty-messages">
          <el-empty description="开始对话吧~">
            <div class="quick-prompts">
              <el-button
                v-for="prompt in quickPrompts"
                :key="prompt"
                size="small"
                @click="sendQuickPrompt(prompt)"
              >{{ prompt }}</el-button>
            </div>
          </el-empty>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message-item"
          :class="{ 'is-user': msg.role === 'user', 'is-assistant': msg.role === 'assistant' }"
        >
          <el-avatar :size="36" :src="msg.role === 'user' ? userAvatar : agent.avatar">
            {{ msg.role === 'user' ? (currentUser[0] || 'U') : (agent.nickname?.[0] || 'A') }}
          </el-avatar>
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">
                {{ msg.role === 'user' ? currentUser : (agent.nickname || agent.name) }}
              </span>
              <span class="time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div class="message-text" v-html="renderMarkdown(msg.content)"></div>
            <div v-if="msg.streaming" class="streaming-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>

        <div v-if="isTyping" class="typing-indicator">
          <el-avatar :size="36" :src="agent.avatar">
            {{ agent.nickname?.[0] || 'A' }}
          </el-avatar>
          <div class="typing-dots">
            <spaspan>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入消息... Ctrl+Enter 发送"
          @keydown="handleKeydown"
          :disabled="sending"
          ref="inputRef"
        />
        <div class="input-actions">
          <div class="input-tools">
            <el-button text size="small">
             ictureFilled /></el-icon>
            </el-button>
            <el-button text size="small">
              <el-icon><Paperclip /></el-icon>
            </el-button>
          </div>
          <el-button
            type="primary"
            @click="sendMessage"
            :loading="sending"
            :disabled="!inputText.trim()"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>

    <!-- 设置抽屉 -->
    <el-drawer v-model="showSettings" title="对话设置" size="400px">
      <el-form label-position="top">
        <el-form-item label="Temperature">
          <el-slider v-model="chatSettings.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>
        <el-form-item label="Max Tokens">
          <el-input-number v-model="chatSettings.maxTokens" :min="100" :max="128000" :step="100" />
        </el-form-item>
        <el-form-item label="启用流式输出">
          <el-switch v-model="chatSettings.stream" />
        </el-form-item>
        <el-form-item label="启用记忆">
          <el-switch v-model="chatSettings.enableMemory" />
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Loading,
  ArrowLeft,
  Delete,
  Setting,
  PictureFilled,
  Paperclip
} from '@element-plus/icons-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '@/api';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const sending = ref(false);
const isTyping = ref(false);
const showSettings = ref(false);
const agent = ref(null);
const messages = ref([]);
const inputText = ref('');
const messagesRef = ref(null);
const inputRef = ref(null);

const currentUser = computed(() => userStore.user?.username || userStore.user?.nickname || '我');
const userAvatar = computed(() => userStore.user?.avatar || '');

const statusClass = computed(() => {
  switch (agent.value?.status) {
    case 'active': return 'status-active';
    case 'inactive': return 'status-inactive';
    case 'error': return 'status-error';
    default: return 'status-inactive';
  }
});

const statusText = computed(() => {
  switch (agent.value?.status) {
    case 'active': return '在线';
    case 'inactive': return '离线';
    case 'error': return '异常';
    default: return '未知';
  }
});

const chatSettings = ref({
  temperature: 0.7,
  maxTokens: 4096,
  stream: true,
  enableMemory: true
});

const quickPrompts = [
  '你好，介绍一下自己',
  '你能帮我做什么？',
  '给我讲个笑话',
  '推荐一本书'
];

async function loadAgent() {
  loading.value = true;
  try {
    const res = await api.get(`/agents/${route.params.id}`);
    if (res.success) {
      agent.value = res.agent;
      chatSettings.value.temperature = res.agent.temperature ?? 0.7;
      chatSettings.value.maxTokens = res.agent.maxTokens || 4096;
      chatSettings.value.enableMemory = res.agent.enableMemory ?? true;
      await loadMessages();
    } else {
      ElMessage.error('加载失败');
    }
  } catch (error) {
    console.error('加载 Agent 失败:', error);
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadMessages() {
  try {
    const res = await api.get(`/agents/${route.params.id}/messages`);
    if (res.success) {
      messages.value = res.messages || [];
      scrollToBottom();
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const content = inputText.value.trim();
  if (!content || sending.value) return;

  const userMessage = {
    role: 'user',
    content,
    timestamp: Date.now()
  };
  messages.value.push(userMessage);
  inputText.value = '';
  scrollToBottom();

  sending.value = true;
  isTyping.value = true;

  try {
    if (chatSettings.value.stream) {
      await sendStreamMessage(content);
    } else {
      await sendNormalMessage(content);
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    ElMessage.error('发送失败');
    messages.value.pop();
  } finally {
    sending.value = false;
    isTyping.value = false;
  }
}

async function sendNormalMessage(content) {
  const res = await api.post(`/agents/${route.params.id}/chat`, {
    message: content,
    settings: chatSettings.value
  });

  if (res.success && res.reply) {
    const assistantMessage = {
      role: 'assistant',
      content: res.reply,
      timestamp: Date.now()
    };
    messages.value.push(assistantMessage);
    scrollToBottom();
  } else {
    throw new Error(res.error || '发送失败');
  }
}

async function sendStreamMessage(content) {
  const assistantMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    streaming: true
  };
  messages.value.push(assistantMessage);
  isTyping.value = false;

  const response = await fetch(`/api/agents/${route.params.id}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: JSON.stringify({
      message: content,
      settings: chatSettings.value
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    consnk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          assistantMessage.streaming = false;
          break;
        }
        try {
          const json = JSON.parse(data);
          if (json.content) {
            assistantMessage.content += json.content;
            scrollToBottom();
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  assistantMessage.streaming = false;
}

function sendQuickPrompt(prompt) {
  inputText.value = prompt;
  nextTick(() => sendMessage());
}

async function clearMessages() {
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？', '清空确认', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const res = await api.delete(`/agents/${route.params.id}/messages`);
    if (res.success) {
      messages.value = [];
      ElMessage.success('已清空');
    } else {
      ElMessage.error(res.error || '清空失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空失败:', error);
      ElMessage.error('清空失败');
    }
  }
}

function renderMarkdown(content) {
  const html = marked.parse(content, { breaks: true });
  return DOMPurify.sanitize(html);
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
}

onMounted(() => {
  loadAgent();
  inputRef.value?.focus();
});
</script>

<style scoped>
.agent-chat-page { height: calc(100vh - 60px); display: flex; flex-direction: column; }
.loading-container, .error-container { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; color: #909399; }
.loading-container p { margin-top: 16px; }
.chat-container { display: flex; flex-direction: column; height: 100%; background: #fff; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e4e7ed; }
.header-left { display: flex; align-items: center; gap: 12px; }
.agent-info h3 { margin: 0; font-size: 16px; color: #303133; }
.status-text { font-size: 12px; }
.status-text.status-active { color: #67c23a; }
.status-text.status-inactive { color: #909399; }
.status-text.status-error { color: #f56c6c; }
.header-actions { display: flex; gap: 8px; }
.messages-container { flex: 1; overflow-y: auto; padding: 20px; }
.empty-messages { display: flex; justify-content: center; align-items: center; height: 100%; }
.quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
.message-item { display: flex; gap: 12px; margin-bottom: 20px; }
.message-item.is-user { flex-direction: row-reverse; }
.message-content { max-width: 70%; }
.message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.is-user .message-header { flex-direction: row-reverse; }
.sender-name { font-size: 13px; font-weight: 500; color: #606266; }
.time { font-size: 11px; color: #909399; }
.message-text { background: #f4f4f5; padding: 10px 14px; border-radius: 8px; line-height: 1.6; word-break: break-word; }
.is-user .message-text { background: #409eff; color: #fff; }
.message-text :deep(pre) { background: #282c34; color: #abb2bf; padding: 12px; border-radius: 6px; overflow-x: auto; }
.message-text :deep(code) { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
.streaming-indicator { display: flex; gap: 4px; margin-top: 8px; }
.streaming-indicator .dot { width: 6px; height: 6px; border-radius: 50%; background: #409eff; animation: pulse 1.4s infinite; }
.streaming-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
.streaming-indicator .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes pulse { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
.typing-indicator { display: flex; gap: 12px; align-items: center; }
.typing-dots { display: flex; gap: 4px; padding: 10px 14px; background: #f4f4f5; border-radius: 8px; }
.typing-dots span { width: 8px; height: 8px; border-radius: 50%; background: #909399; animation: bounce 1.4s infinite; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } }
.input-area { border-top: 1px solid #e4e7ed; padding: 16px 20px; background: #fafafa; }
.input-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.input-tools { display: flex; gap: 4px; }
@media (max-width: 768px) {
  .agent-chat-page { height: calc(100vh - 50px); }
  .chat-header { padding: 12px 16px; }
  .messages-container { padding: 16px; }
  .message-content { max-width: 85%; }
  .input-area { padding: 12px 16px; }
}
</style>
