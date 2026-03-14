<!--
  群聊室页面
  @author 小琳
  @date 2026-02-06
  功能：消息列表、@智能提及、Markdown渲染、表情、图片、私聊入口
-->
<template>
  <div class="chat-page" role="main">
    <!-- 移动端遮罩层 -->
    <div class="mobile-overlay" :class="{ show: showMobileMenu }" @click="showMobileMenu = false" aria-hidden="true"></div>
    
    <div class="chat-container">
      <!-- 在线用户列表 -->
      <aside class="user-list" :class="{ 'show-mobile': showMobileMenu }" aria-label="在线成员列表">
        <div class="list-header">
          <h3>在线成员</h3>
          <el-badge :value="onlineUsers.length" type="success" aria-label="在线人数" />
        </div>
        <div class="users" role="list">
          <div
            v-for="user in onlineUsers"
            :key="user.id"
            class="user-item"
            role="listitem"
            tabindex="0"
            @click="showUserActions(user)"
            @keypress.enter="showUserActions(user)"
          >
            <el-avatar :size="32" :aria-label="user.name || user.nickname">{{ user.name?.[0] || user.nickname?.[0] || '?' }}</el-avatar>
            <span class="user-name">{{ user.name || user.nickname }}</span>
            <span class="user-role" v-if="user.role">{{ user.role }}</span>
            <span class="user-type" v-if="user.type === 'bot'" aria-label="机器人">🤖</span>
          </div>
        </div>
      </aside>

      <!-- 聊天区域 -->
      <section class="chat-area" aria-label="聊天区域">
        <header class="chat-header">
          <el-button class="mobile-menu-btn" text @click="showMobileMenu = !showMobileMenu" aria-label="打开成员列表">
            <el-icon><Menu /></el-icon>
          </el-button>
          <h3>{{ chatTitle }}</h3>
          <div class="header-actions">
            <el-button v-if="isPrivateChat" text @click="exitPrivateChat" aria-label="返回群聊">
              返回群聊
            </el-button>
            <el-button text @click="loadMessages" aria-label="刷新消息">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
        </header>

        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesRef" @scroll="handleScroll" role="log" aria-label="消息列表" aria-live="polite">
          <div v-if="loading" class="loading-more" aria-busy="true">
            <el-icon class="is-loading"><Loading /></el-icon>
            加载中...
          </div>
          
          <article
            v-for="msg in messages"
            :key="msg.id"
            class="message-item"
            :class="{ 
              'is-self': msg.sender === currentUser,
              'is-mentioned': isMentioned(msg)
            }"
            role="article"
            :aria-label="msg.sender + '的消息'"
          >
            <el-avatar :size="36" @click="showUserActions({ name: msg.sender })" :aria-label="msg.sender">
              {{ msg.sender?.[0] || '?' }}
            </el-avatar>
            <div class="message-content">
              <div class="message-header">
                <span class="sender-name" :class="getSenderClass(msg.sender)">
                  {{ msg.sender }}
                </span>
                <span class="time">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <!-- Markdown 渲染 -->
              <div class="message-text" v-html="renderMessage(msg.content)"></div>
              <!-- 图片预览 -->
              <div v-if="msg.images?.length" class="message-images" role="img" :aria-label="'图片 ' + msg.images.length + ' 张'">
                <el-image
                  v-for="(img, idx) in msg.images"
                  :key="idx"
                  :src="img"
                  :preview-src-list="msg.images"
                  fit="cover"
                  class="message-image"
                  :aria-label="'图片 ' + (idx + 1)"
                />
              </div>
              <!-- 文件消息 -->
              <div v-if="msg.file" class="message-file" role="link">
                <div class="file-icon">
                  <el-icon :size="28"><Document /></el-icon>
                </div>
                <div class="file-info">
                  <div class="file-name">{{ msg.file.name }}</div>
                  <div class="file-size">{{ formatFileSize(msg.file.size) }}</div>
                </div>
                <el-button text size="small" class="file-download" @click="downloadFile(msg.file)" :aria-label="'下载 ' + msg.file.name">
                  <el-icon><Download /></el-icon>
                </el-button>
              </div>
            </div>
            <!-- 消息操作 -->
            <div class="message-actions">
              <el-button text size="small" @click="replyTo(msg)">回复</el-button>
              <el-button text size="small" @click="insertMention(msg.sender)">@</el-button>
            </div>
          </article>

          <div v-if="messages.length === 0 && !loading" class="empty-messages">
            <el-empty description="暂无消息，说点什么吧~" />
          </div>
          
          <!-- 滚动按钮 -->
          <transition name="fade">
            <div v-if="showScrollButtons" class="scroll-buttons">
              <el-tooltip content="滚动到顶部" placement="left">
                <el-button circle @click="scrollToTop">
                  <el-icon><ArrowUp /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="滚动到底部" placement="left">
                <el-button circle type="primary" @click="scrollToBottom">
                  <el-icon><ArrowDown /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </transition>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
          <!-- 回复提示 -->
          <div v-if="replyingTo" class="replying-hint">
            <span>回复 {{ replyingTo.sender }}：{{ replyingTo.content.slice(0, 30) }}...</span>
            <el-button text size="small" @click="replyingTo = null">取消</el-button>
          </div>
          
          <!-- 工具栏 -->
          <div class="input-toolbar">
            <el-popover placement="top" :width="320" trigger="click">
              <template #reference>
                <el-button text title="表情">
                  <el-icon><PictureFilled /></el-icon>
                </el-button>
              </template>
              <div class="emoji-picker">
                <span
                  v-for="emoji in emojis"
                  :key="emoji"
                  class="emoji-item"
                  @click="insertEmoji(emoji)"
                >
                  {{ emoji }}
                </span>
              </div>
            </el-popover>
            
            <el-upload
              :show-file-list="false"
              :before-upload="handleImageUpload"
              accept="image/*"
            >
              <el-button text title="发送图片">
                <el-icon><Picture /></el-icon>
              </el-button>
            </el-upload>
            
            <el-upload
              :show-file-list="false"
              :before-upload="handleFileUpload"
            >
              <el-button text title="发送文件">
                <el-icon><FolderOpened /></el-icon>
              </el-button>
            </el-upload>
            
            <!-- @ 按钮 -->
            <el-button text @click="showMentionPicker = true" title="@用户">
              <el-icon><User /></el-icon>
            </el-button>
          </div>

          <!-- 输入框包装器（用于显示 @ 下拉） -->
          <div class="input-wrapper">
            <!-- @ 提及下拉框 -->
            <div 
              v-if="showMentionDropdown" 
              class="mention-dropdown"
              :style="mentionDropdownStyle"
            >
              <div class="mention-search">
                <el-input 
                  v-model="mentionSearch" 
                  placeholder="搜索用户..."
                  size="small"
                  :prefix-icon="Search"
                  ref="mentionSearchRef"
                />
              </div>
              <div class="mention-list">
                <div
                  v-for="(user, index) in filteredMentionUsers"
                  :key="user.id || user.name"
                  class="mention-option"
                  :class="{ active: mentionActiveIndex === index }"
                  @click="selectMention(user)"
                  @mouseenter="mentionActiveIndex = index"
                >
                  <el-avatar :size="24">{{ (user.name || user.nickname)?.[0] }}</el-avatar>
                  <span class="mention-name">{{ user.name || user.nickname }}</span>
                  <span class="mention-role" v-if="user.role">{{ user.role }}</span>
                  <span class="mention-type" v-if="user.type === 'bot'">🤖</span>
                </div>
                <div v-if="filteredMentionUsers.length === 0" class="mention-empty">
                  无匹配用户
                </div>
              </div>
            </div>

            <div class="input-main">
              <el-input
                v-model="inputText"
                type="textarea"
                :rows="2"
                placeholder="输入消息... 输入 @ 可提及用户，Ctrl+Enter 发送"
                @keydown="handleInputKeydown"
                @input="handleInputChange"
                ref="inputRef"
              />
              <el-button type="primary" @click="sendMessage" :loading="sending">
                发送
              </el-button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 用户操作弹窗 -->
    <el-dialog v-model="userActionDialog" :title="selectedUser?.name || '用户'" width="300px">
      <div class="user-action-content">
        <el-avatar :size="64">{{ (selectedUser?.name || selectedUser?.nickname)?.[0] }}</el-avatar>
        <h3>{{ selectedUser?.name || selectedUser?.nickname }}</h3>
        <p v-if="selectedUser?.role" class="user-role-tag">{{ selectedUser?.role }}</p>
      </div>
      <template #footer>
        <el-button @click="insertMention(selectedUser?.name); userActionDialog = false">
          @ TA
        </el-button>
        <el-button type="primary" @click="startPrivateChat(selectedUser)">
          枫语私语
        </el-button>
      </template>
    </el-dialog>

    <!-- @ 用户快捷选择（按钮触发） -->
    <el-dialog v-model="showMentionPicker" title="选择要 @ 的用户" width="320px">
      <el-input 
        v-model="mentionPickerSearch" 
        placeholder="搜索用户..." 
        :prefix-icon="Search"
        class="mention-picker-search"
      />
      <div class="mention-picker-list">
        <div
          v-for="user in filteredPickerUsers"
          :key="user.id || user.name"
          class="mention-picker-item"
          @click="insertMention(user.name || user.nickname); showMentionPicker = false"
        >
          <el-avatar :size="32">{{ (user.name || user.nickname)?.[0] }}</el-avatar>
          <span>{{ user.name || user.nickname }}</span>
          <span class="user-type" v-if="user.type === 'bot'">🤖</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, onUnmounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Loading, PictureFilled, Picture, User, Menu, Search, ArrowUp, ArrowDown, Document, Download, FolderOpened } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '@/api';

const userStore = useUserStore();
const currentUser = computed(() => userStore.user?.username || userStore.user?.nickname || '我');

// 状态
const messages = ref([]);
const onlineUsers = ref([
  { id: 1, name: '小琳', role: 'AI', type: 'bot' },
  { id: 2, name: '小猪', role: 'AI', type: 'bot' },
  { id: 3, name: '鸿枫', role: '管理员', type: 'human' }
]);
const inputText = ref('');
const sending = ref(false);
const loading = ref(false);
const messagesRef = ref(null);
const inputRef = ref(null);
const replyingTo = ref(null);
const pollTimer = ref(null);
const showMobileMenu = ref(false);

// 私聊相关
const isPrivateChat = ref(false);
const privateChatTarget = ref(null);
const chatTitle = computed(() => 
  isPrivateChat.value ? `枫语私语 - ${privateChatTarget.value?.name}` : '协作空间'
);

// 用户操作弹窗
const userActionDialog = ref(false);
const selectedUser = ref(null);

// @ 提及相关
const showMentionDropdown = ref(false);
const mentionSearch = ref('');
const mentionActiveIndex = ref(0);
const mentionStartPos = ref(0);
const mentionSearchRef = ref(null);
const mentionDropdownStyle = ref({});

// @ 选择器（按钮触发）
const showMentionPicker = ref(false);
const mentionPickerSearch = ref('');

// 滚动相关
const showScrollButtons = ref(false);
const isNearBottom = ref(true);

// 过滤后的用户列表（输入框 @）
const filteredMentionUsers = computed(() => {
  const search = mentionSearch.value.toLowerCase();
  return onlineUsers.value.filter(u => {
    const name = (u.name || u.nickname || '').toLowerCase();
    return name.includes(search);
  });
});

// 过滤后的用户列表（按钮选择器）
const filteredPickerUsers = computed(() => {
  const search = mentionPickerSearch.value.toLowerCase();
  return onlineUsers.value.filter(u => {
    const name = (u.name || u.nickname || '').toLowerCase();
    return name.includes(search);
  });
});

// 表情列表
const emojis = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤔', '😅', 
                '👍', '👎', '👏', '🙌', '🎉', '🔥', '❤️', '💯', '✨', '🚀'];

// 监听 @ 下拉框打开时聚焦搜索框
watch(showMentionDropdown, (val) => {
  if (val) {
    nextTick(() => {
      mentionSearchRef.value?.focus();
    });
  }
});

// 处理输入变化，检测 @
function handleInputChange() {
  const textarea = inputRef.value?.$el?.querySelector('textarea');
  if (!textarea) return;
  
  const cursorPos = textarea.selectionStart;
  const text = inputText.value;
  
  // 找到光标前最近的 @
  let atPos = -1;
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === '@') {
      atPos = i;
      break;
    }
    // 遇到空格或换行则停止
    if (text[i] === ' ' || text[i] === '\n') {
      break;
    }
  }
  
  if (atPos >= 0) {
    // 提取 @ 后的文字作为搜索词
    const searchText = text.slice(atPos + 1, cursorPos);
    // 只有当 @ 后没有空格时才显示下拉
    if (!searchText.includes(' ')) {
      mentionSearch.value = searchText;
      mentionStartPos.value = atPos;
      mentionActiveIndex.value = 0;
      showMentionDropdown.value = true;
      
      // 计算下拉框位置（简单定位在输入框上方）
      mentionDropdownStyle.value = {
        bottom: '100%',
        left: '16px'
      };
      return;
    }
  }
  
  showMentionDropdown.value = false;
}

// 处理键盘事件
function handleInputKeydown(e) {
  // @ 下拉框打开时的键盘导航
  if (showMentionDropdown.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionActiveIndex.value = Math.min(
        mentionActiveIndex.value + 1, 
        filteredMentionUsers.value.length - 1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionActiveIndex.value = Math.max(mentionActiveIndex.value - 1, 0);
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      if (filteredMentionUsers.value.length > 0) {
        selectMention(filteredMentionUsers.value[mentionActiveIndex.value]);
      }
    } else if (e.key === 'Escape') {
      showMentionDropdown.value = false;
    }
    return;
  }
  
  // Ctrl+Enter 发送
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
}

// 选择 @ 用户
function selectMention(user) {
  const name = user.name || user.nickname;
  const before = inputText.value.slice(0, mentionStartPos.value);
  const textarea = inputRef.value?.$el?.querySelector('textarea');
  const cursorPos = textarea?.selectionStart || inputText.value.length;
  const after = inputText.value.slice(cursorPos);
  
  inputText.value = before + '@' + name + ' ' + after;
  showMentionDropdown.value = false;
  mentionSearch.value = '';
  
  // 聚焦并移动光标
  nextTick(() => {
    inputRef.value?.focus();
    const newPos = before.length + name.length + 2;
    textarea?.setSelectionRange(newPos, newPos);
  });
}

// 直接插入 @ 用户
function insertMention(name) {
  if (!name) return;
  inputText.value += `@${name} `;
  inputRef.value?.focus();
}

// 显示用户操作
function showUserActions(user) {
  selectedUser.value = user;
  userActionDialog.value = true;
  showMobileMenu.value = false;
}

// 发起私聊
function startPrivateChat(user) {
  isPrivateChat.value = true;
  privateChatTarget.value = user;
  userActionDialog.value = false;
  messages.value = []; // 清空消息，加载私聊消息
  loadPrivateMessages(user);
  ElMessage.success(`开始与 ${user.name || user.nickname} 的枫语私语`);
}

// 退出私聊
function exitPrivateChat() {
  isPrivateChat.value = false;
  privateChatTarget.value = null;
  loadMessages();
}

// 加载私聊消息
async function loadPrivateMessages(user) {
  loading.value = true;
  try {
    const res = await api.get('/dm/messages', { 
      params: { 
        partnerId: user.id || user.username,
        limit: 50 
      } 
    });
    if (res.success) {
      // 消息按时间正序排列（旧消息在上，新消息在下）
      messages.value = res.messages || [];
      scrollToBottom();
    }
  } catch (error) {
    console.error('加载私聊消息失败:', error);
    // 私聊功能可能未实现，显示空消息
    messages.value = [];
  } finally {
    loading.value = false;
  }
}

// 加载群聊消息
async function loadMessages() {
  if (isPrivateChat.value) {
    loadPrivateMessages(privateChatTarget.value);
    return;
  }
  
  loading.value = true;
  try {
    const res = await api.get('/context', { params: { limit: 50 } });
    if (res.success) {
      // 去重
      const seen = new Map();
      const deduped = [];
      for (const msg of (res.context || [])) {
        const key = `${msg.sender}:${msg.content}`;
        const existing = seen.get(key);
        if (!existing || Math.abs(msg.timestamp - existing.timestamp) > 5000) {
          seen.set(key, msg);
          deduped.push(msg);
        }
      }
      // 按时间戳排序（正序：旧消息在上，新消息在下）
      deduped.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      messages.value = deduped;
      scrollToBottom();
    }
  } catch (error) {
    console.error('加载消息失败:', error);
    ElMessage.error('加载消息失败');
  } finally {
    loading.value = false;
  }
}

// 发送消息
async function sendMessage() {
  const content = inputText.value.trim();
  if (!content) return;

  sending.value = true;
  
  // 乐观更新
  const tempId = 'temp-' + Date.now();
  const tempMessage = {
    id: tempId,
    type: 'human',
    sender: currentUser.value,
    content: replyingTo.value 
      ? `> ${replyingTo.value.sender}: ${replyingTo.value.content.slice(0, 50)}...\n\n${content}`
      : content,
    timestamp: Date.now(),
    source: 'web',
    sending: true
  };
  messages.value.push(tempMessage);
  scrollToBottom();
  
  const savedContent = inputText.value;
  inputText.value = '';
  replyingTo.value = null;

  try {
    let res;
    if (isPrivateChat.value) {
      // 发送私聊消息
      res = await api.post('/dm/send', {
        receiverId: privateChatTarget.value.id || privateChatTarget.value.username,
        content: tempMessage.content
      });
    } else {
      // 发送群聊消息
      res = await api.post('/store', {
        sender: currentUser.value,
        content: tempMessage.content,
        source: 'web'
      });
    }
    
    if (res.success) {
      sentMessageIds.add(res.message?.id);
      const index = messages.value.findIndex(m => m.id === tempId);
      if (index > -1) {
        messages.value[index] = { ...res.message, sending: false };
      }
    } else {
      inputText.value = savedContent;
      messages.value = messages.value.filter(m => m.id !== tempId);
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    inputText.value = savedContent;
    messages.value = messages.value.filter(m => m.id !== tempId);
    ElMessage.error('发送失败');
  } finally {
    sending.value = false;
  }
}

// 已发送消息 ID 集合
const sentMessageIds = new Set();

// 渲染 Markdown + @ 高亮
function renderMessage(content) {
  if (!content) return '';
  
  // 高亮 @ 提及
  let processed = content.replace(/@(\S+)/g, '<span class="mention">@$1</span>');
  
  // 渲染 Markdown
  const html = marked.parse(processed, { breaks: true });
  
  return DOMPurify.sanitize(html);
}

// 检查是否被 @ 
function isMentioned(msg) {
  const username = currentUser.value;
  return msg.content?.includes(`@${username}`) || msg.content?.includes('@all');
}

// 获取发送者样式
function getSenderClass(sender) {
  if (sender === '小琳') return 'sender-xiaoling';
  if (sender === '小猪') return 'sender-xiaozhu';
  if (sender === '鸿枫' || sender === 'maple') return 'sender-maple';
  return '';
}

// 回复消息
function replyTo(msg) {
  replyingTo.value = msg;
  inputRef.value?.focus();
}

// 插入表情
function insertEmoji(emoji) {
  inputText.value += emoji;
  inputRef.value?.focus();
}

// 处理图片上传
async function handleImageUpload(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data?.success || res.success) {
      inputText.value += `\n![图片](${res.data?.url || res.url})\n`;
    }
  } catch (error) {
    ElMessage.error('图片上传失败');
  }
  
  return false;
}

// 处理文件上传
async function handleFileUpload(file) {
  // 检查文件大小（限制 50MB）
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 50MB');
    return false;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    ElMessage.info('文件上传中...');
    const res = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000 // 文件上传超时时间延长
    });
    
    if (res.data?.success || res.success) {
      const fileUrl = res.data?.url || res.url;
      const fileName = file.name;
      const fileSize = file.size;
      
      // 发送文件消息
      const fileMessage = {
        id: 'file-' + Date.now(),
        type: 'human',
        sender: currentUser.value,
        content: `[文件] ${fileName}`,
        timestamp: Date.now(),
        source: 'web',
        file: {
          name: fileName,
          size: fileSize,
          url: fileUrl
        }
      };
      
      // 乐观更新
      messages.value.push(fileMessage);
      scrollToBottom();
      
      // 同步到服务器
      await api.post('/store', {
        sender: currentUser.value,
        content: fileMessage.content,
        source: 'web',
        file: fileMessage.file
      });
      
      ElMessage.success('文件上传成功');
    }
  } catch (error) {
    console.error('文件上传失败:', error);
    ElMessage.error('文件上传失败');
  }
  
  return false;
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTo({
        top: messagesRef.value.scrollHeight,
        behavior: 'smooth'
      });
    }
  });
}

// 滚动到顶部
function scrollToTop() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  });
}

// 处理滚动
function handleScroll() {
  if (!messagesRef.value) return;
  
  const { scrollTop, scrollHeight, clientHeight } = messagesRef.value;
  const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
  
  isNearBottom.value = nearBottom;
  // 滚动超过一屏时显示滚动按钮
  showScrollButtons.value = scrollTop > clientHeight;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// 下载文件
function downloadFile(file) {
  if (!file?.url) {
    ElMessage.warning('文件链接不存在');
    return;
  }
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.name || 'download';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// WebSocket 实时消息
import chatWS from '@/utils/websocket';
import notifyManager from '@/utils/notification';

function setupWebSocket() {
  chatWS.connect().then(() => {
    console.log('[Chat] WebSocket 已连接');
  }).catch(err => {
    console.warn('[Chat] WebSocket 连接失败，使用轮询:', err);
    startPolling();
  });

  chatWS.on('message', (msg) => {
    if (sentMessageIds.has(msg.id)) {
      sentMessageIds.delete(msg.id);
      return;
    }
    if (!messages.value.find(m => m.id === msg.id)) {
      messages.value.push(msg);
      
      // 新消息自动滚动到底部（如果用户在底部附近）
      if (isNearBottom.value) {
        scrollToBottom();
      }
      
      if (msg.sender !== currentUser.value) {
        const isMentionedMe = msg.atTargets?.includes(currentUser.value) || 
                              msg.content?.includes(`@${currentUser.value}`);
        if (isMentionedMe) {
          notifyManager.notifyMention(msg.sender, msg.content);
        } else {
          notifyManager.notifyMessage(msg.sender, msg.content);
        }
      }
    }
  });

  chatWS.on('user_online', (user) => {
    if (!onlineUsers.value.find(u => u.username === user.username || u.name === user.name)) {
      onlineUsers.value.push(user);
    }
  });

  chatWS.on('user_offline', (user) => {
    const index = onlineUsers.value.findIndex(u => u.username === user.username || u.name === user.name);
    if (index > -1) {
      onlineUsers.value.splice(index, 1);
    }
  });
}

function startPolling() {
  pollTimer.value = setInterval(loadMessages, 5000);
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

// 加载在线用户
async function loadOnlineUsers() {
  try {
    // 首先尝试获取在线用户列表
    const res = await api.get('/online-users');
    if (res.success && res.users && res.users.length > 0) {
      onlineUsers.value = res.users.map(u => ({
        id: u.id || u.username,
        name: u.name || u.nickname || u.username,
        nickname: u.nickname || u.name || u.username,
        role: u.role || (u.type === 'bot' ? 'AI' : ''),
        type: u.type || 'human',
        avatar: u.avatar
      }));
      return;
    }
  } catch (e) {
    console.log('[Chat] /online-users API 不可用，尝试其他方式加载用户');
  }
  
  // 尝试从好友列表获取用户
  try {
    const friendsRes = await api.get('/friends');
    if (friendsRes.success && friendsRes.friends) {
      const users = friendsRes.friends.map(f => ({
        id: f.id,
        name: f.remark || f.nickname || f.username,
        nickname: f.nickname || f.username,
        role: f.userType === 'bot' ? 'AI' : '',
        type: f.userType || 'human',
        online: f.online,
        avatar: f.avatar
      }));
      // 添加默认 AI 用户
      const defaultUsers = [
        { id: 'bot-xiaoling', name: '小琳', nickname: '小琳', role: 'AI', type: 'bot' },
        { id: 'bot-xiaozhu', name: '小猪', nickname: '小猪', role: 'AI', type: 'bot' }
      ];
      // 合并用户，确保 AI 用户始终存在
      const userMap = new Map();
      defaultUsers.forEach(u => userMap.set(u.id, u));
      users.forEach(u => {
        if (u.type !== 'bot') {
          userMap.set(u.id, u);
        }
      });
      onlineUsers.value = Array.from(userMap.values());
      return;
    }
  } catch (e) {
    console.log('[Chat] 无法从好友列表加载用户');
  }
  
  // 最后使用默认用户
  onlineUsers.value = [
    { id: 'bot-xiaoling', name: '小琳', nickname: '小琳', role: 'AI', type: 'bot' },
    { id: 'bot-xiaozhu', name: '小猪', nickname: '小猪', role: 'AI', type: 'bot' },
    { id: 'admin', name: '鸿枫', nickname: '鸿枫', role: '管理员', type: 'human' }
  ];
}

onMounted(() => {
  loadMessages();
  loadOnlineUsers();
  setupWebSocket();
  notifyManager.restore();
  notifyManager.requestPermission();
});

onUnmounted(() => {
  stopPolling();
  chatWS.off('message');
  chatWS.off('user_online');
  chatWS.off('user_offline');
});
</script>

<style scoped>
.chat-page {
  height: calc(100vh - 56px);
  padding: 0;
}

.chat-container {
  display: flex;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

/* 用户列表 */
.user-list {
  width: 200px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h3 {
  margin: 0;
  font-size: 14px;
}

.users {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-item:hover {
  background: #f5f7fa;
}

.user-name {
  margin-left: 8px;
  flex: 1;
  font-size: 13px;
}

.user-role {
  font-size: 11px;
  color: #909399;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.user-type {
  margin-left: 4px;
}

/* 聊天区域 */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* 消息列表 */
.messages-container {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  position: relative;
}

.loading-more {
  text-align: center;
  padding: 12px;
  color: #909399;
}

.message-item {
  display: flex;
  margin-bottom: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  transition: background 0.2s;
}

.message-item:hover {
  background: #fafafa;
}

.message-item.is-self {
  flex-direction: row-reverse;
}

.message-item.is-mentioned {
  background: #fff7e6;
  border-left: 3px solid #ff9800;
}

.message-content {
  max-width: 65%;
  margin: 0 8px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.is-self .message-header {
  flex-direction: row-reverse;
}

.sender-name {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
}

.sender-name:hover {
  text-decoration: underline;
}

.sender-xiaoling { color: #e91e63; }
.sender-xiaozhu { color: #9c27b0; }
.sender-maple { color: #2196f3; }

.time {
  font-size: 11px;
  color: #909399;
}

.message-text {
  background: #f4f4f5;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.6;
  word-break: break-word;
  position: relative;
}

/* 微信风格气泡尖角 */
.message-item:not(.is-self) .message-text::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 12px;
  border: 6px solid transparent;
  border-right-color: #f4f4f5;
}

.message-item.is-self .message-text::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 12px;
  border: 6px solid transparent;
  border-left-color: #409eff;
}

.message-text :deep(.mention) {
  color: #409eff;
  background: #ecf5ff;
  padding: 0 4px;
  border-radius: 4px;
  cursor: pointer;
}

.message-text :deep(.mention:hover) {
  background: #d9ecff;
}

.message-text :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 4px 0;
}

.message-text :deep(code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.message-text :deep(blockquote) {
  border-left: 3px solid #dcdfe6;
  margin: 8px 0;
  padding-left: 12px;
  color: #606266;
}

.is-self .message-text {
  background: #409eff;
  color: #fff;
}

.is-self .message-text :deep(.mention) {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.is-self .message-text :deep(code) {
  background: rgba(255,255,255,0.15);
  color: #fff;
}

.is-self .message-text :deep(pre) {
  background: rgba(0,0,0,0.2);
}

.message-images {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.message-image {
  width: 150px;
  height: 150px;
  border-radius: 8px;
  cursor: pointer;
  object-fit: cover;
}

/* 文件消息样式 */
.message-file {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  gap: 12px;
  max-width: 280px;
}

.is-self .message-file {
  background: rgba(255,255,255,0.95);
  border-color: rgba(255,255,255,0.3);
}

.file-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.file-download {
  color: #409eff;
  flex-shrink: 0;
}

.message-actions {
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

/* 滚动按钮 */
.scroll-buttons {
  position: fixed;
  right: 24px;
  bottom: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 50;
}

.scroll-buttons :deep(.el-button) {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.scroll-buttons :deep(.el-button:hover) {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.scroll-buttons :deep(.el-button .el-icon) {
  font-size: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 输入区域 */
.input-area {
  border-top: 1px solid #e4e7ed;
  background: #fafafa;
}

.replying-hint {
  padding: 8px 16px;
  background: #f0f9eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #67c23a;
}

.input-toolbar {
  padding: 8px 16px 0;
  display: flex;
  gap: 4px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.input-toolbar .el-button {
  padding: 8px;
}

.input-toolbar .el-button:hover {
  background: #f5f7fa;
  border-radius: 8px;
}

.emoji-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-item {
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.emoji-item:hover {
  background: #f0f0f0;
}

/* @ 提及下拉框 */
.input-wrapper {
  position: relative;
}

.mention-dropdown {
  position: absolute;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 240px;
  max-height: 280px;
  overflow: hidden;
  z-index: 100;
}

.mention-search {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.mention-list {
  max-height: 220px;
  overflow-y: auto;
}

.mention-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 8px;
}

.mention-option:hover,
.mention-option.active {
  background: #f5f7fa;
}

.mention-name {
  flex: 1;
  font-size: 14px;
}

.mention-role {
  font-size: 11px;
  color: #909399;
}

.mention-type {
  font-size: 12px;
}

.mention-empty {
  padding: 20px;
  text-align: center;
  color: #909399;
}

.input-main {
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  background: #fff;
  align-items: flex-end;
}

.input-main .el-textarea {
  flex: 1;
}

.input-main .el-textarea :deep(.el-textarea__inner) {
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  padding: 12px;
  resize: none;
  min-height: 44px;
  line-height: 1.5;
}

.input-main .el-textarea :deep(.el-textarea__inner:focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.input-main .el-button {
  height: 44px;
  min-width: 70px;
  border-radius: 12px;
  font-weight: 500;
}

/* 用户操作弹窗 */
.user-action-content {
  text-align: center;
  padding: 20px 0;
}

.user-action-content h3 {
  margin: 12px 0 4px;
}

.user-role-tag {
  color: #909399;
  font-size: 13px;
}

/* @ 选择器 */
.mention-picker-search {
  margin-bottom: 12px;
}

.mention-picker-list {
  max-height: 300px;
  overflow-y: auto;
}

.mention-picker-item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  border-radius: 6px;
  gap: 10px;
  transition: background 0.15s;
}

.mention-picker-item:hover {
  background: #f5f7fa;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: none;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-page {
    padding: 0;
    height: calc(100vh - 60px);
  }

  .chat-container {
    border-radius: 0;
    box-shadow: none;
  }

  .user-list {
    position: fixed;
    left: 0;
    top: 60px;
    bottom: 0;
    width: 200px;
    z-index: 100;
    background: #fff;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  }
  
  .user-list.show-mobile {
    transform: translateX(0);
  }
  
  .mobile-overlay {
    display: none;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.3);
    z-index: 99;
  }
  
  .mobile-overlay.show {
    display: block;
  }
  
  .mobile-menu-btn {
    display: inline-flex;
  }

  .message-content {
    max-width: 85%;
    margin: 0 8px;
  }
  
  .message-actions {
    opacity: 1;
  }
  
  .mention-dropdown {
    left: 8px !important;
    right: 8px !important;
    width: auto;
  }
}

@media (max-width: 375px) {
  .message-content {
    max-width: 90%;
  }
}
</style>
