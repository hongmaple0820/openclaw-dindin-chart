<!--
  私信页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="dm-page">
    <div class="dm-container">
      <!-- 会话列表 -->
      <div class="conversation-list">
        <div class="list-header">
          <h3>私信</h3>
          <el-button type="primary" size="small" @click="showNewDM = true">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
        
        <div class="conversations">
          <div
            v-for="conv in conversations"
            :key="conv.conversationId"
            class="conversation-item"
            :class="{ active: currentConversation?.conversationId === conv.conversationId }"
            @click="selectConversation(conv)"
          >
            <el-avatar :size="40">{{ conv.partnerName?.[0] || '?' }}</el-avatar>
            <div class="conv-info">
              <div class="conv-header">
                <span class="partner-name">{{ conv.partnerName }}</span>
                <span class="time">{{ formatTime(conv.updatedAt) }}</span>
              </div>
              <div class="last-message">{{ conv.lastMessage?.content || '' }}</div>
            </div>
            <el-badge v-if="conv.unreadCount > 0" :value="conv.unreadCount" class="unread-badge" />
          </div>
          
          <div v-if="conversations.length === 0" class="empty-list">
            暂无私信
          </div>
        </div>
      </div>

      <!-- 聊天区域 -->
      <div class="chat-area" v-if="currentConversation">
        <div class="chat-header">
          <span class="partner-name">{{ currentConversation.partnerName }}</span>
        </div>

        <div class="messages-container" ref="messagesRef">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message-item"
            :class="{ 'is-self': msg.senderId === userId }"
          >
            <el-avatar :size="32">{{ msg.senderName?.[0] || '?' }}</el-avatar>
            <div class="message-content">
              <div class="message-header">
                <span class="sender-name">{{ msg.senderName }}</span>
                <span class="time">{{ formatTime(msg.createdAt) }}</span>
              </div>
              <div class="message-text">{{ msg.content }}</div>
            </div>
          </div>
        </div>

        <div class="input-area">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="2"
            placeholder="输入消息..."
            @keydown.enter.ctrl="sendMessage"
          />
          <el-button type="primary" @click="sendMessage" :loading="sending">
            发送
          </el-button>
        </div>
      </div>

      <!-- 未选择会话 -->
      <div class="empty-chat" v-else>
        <el-empty description="选择一个会话开始聊天" />
      </div>
    </div>

    <!-- 新建私信对话框 -->
    <el-dialog v-model="showNewDM" title="发起私信" width="400px">
      <el-form>
        <el-form-item label="用户名">
          <el-input v-model="newDMReceiver" placeholder="输入用户名或ID" />
        </el-form-item>
        <el-form-item label="消息">
          <el-input v-model="newDMContent" type="textarea" :rows="3" placeholder="输入消息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDM = false">取消</el-button>
        <el-button type="primary" @click="startNewDM" :loading="sending">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import dmApi from '@/api/dm';

const userStore = useUserStore();
const userId = computed(() => userStore.user?.id);

const conversations = ref([]);
const currentConversation = ref(null);
const messages = ref([]);
const inputText = ref('');
const sending = ref(false);
const messagesRef = ref(null);

const showNewDM = ref(false);
const newDMReceiver = ref('');
const newDMContent = ref('');

// 加载会话列表
async function loadConversations() {
  try {
    const res = await dmApi.getConversations();
    if (res.success) {
      conversations.value = res.conversations;
    }
  } catch (error) {
    console.error('加载会话失败:', error);
  }
}

// 选择会话
async function selectConversation(conv) {
  currentConversation.value = conv;
  await loadMessages(conv.conversationId);
}

// 加载消息
async function loadMessages(conversationId) {
  try {
    const res = await dmApi.getMessages(conversationId);
    if (res.success) {
      messages.value = res.messages;
      scrollToBottom();
      
      // 更新未读数
      const conv = conversations.value.find(c => c.conversationId === conversationId);
      if (conv) conv.unreadCount = 0;
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

// 发送消息
async function sendMessage() {
  if (!inputText.value.trim() || !currentConversation.value) return;

  sending.value = true;
  try {
    const res = await dmApi.send({
      receiverId: currentConversation.value.partnerId,
      receiverName: currentConversation.value.partnerName,
      content: inputText.value.trim()
    });

    if (res.success) {
      messages.value.push(res.message);
      inputText.value = '';
      scrollToBottom();
    } else {
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    ElMessage.error('发送失败');
  } finally {
    sending.value = false;
  }
}

// 发起新私信
async function startNewDM() {
  if (!newDMReceiver.value.trim() || !newDMContent.value.trim()) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  sending.value = true;
  try {
    const res = await dmApi.send({
      receiverId: newDMReceiver.value.trim(),
      receiverName: newDMReceiver.value.trim(),
      content: newDMContent.value.trim()
    });

    if (res.success) {
      ElMessage.success('发送成功');
      showNewDM.value = false;
      newDMReceiver.value = '';
      newDMContent.value = '';
      await loadConversations();
    } else {
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    ElMessage.error('发送失败');
  } finally {
    sending.value = false;
  }
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
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
  
  return date.toLocaleDateString();
}

onMounted(() => {
  loadConversations();
});
</script>

<style scoped>
.dm-page {
  height: calc(100vh - 120px);
  padding: 20px;
}

.dm-container {
  display: flex;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.conversation-list {
  width: 300px;
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
}

.conversations {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.conversation-item:hover {
  background: #f5f7fa;
}

.conversation-item.active {
  background: #ecf5ff;
}

.conv-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.conv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.partner-name {
  font-weight: 500;
}

.time {
  font-size: 12px;
  color: #909399;
}

.last-message {
  font-size: 13px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.empty-list {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 500;
  font-size: 16px;
}

.messages-container {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.message-item {
  display: flex;
  margin-bottom: 16px;
}

.message-item.is-self {
  flex-direction: row-reverse;
}

.message-content {
  max-width: 60%;
  margin: 0 12px;
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
  color: #606266;
}

.message-text {
  background: #f4f4f5;
  padding: 10px 14px;
  border-radius: 8px;
  line-height: 1.5;
}

.is-self .message-text {
  background: #409eff;
  color: #fff;
}

.input-area {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  gap: 12px;
}

.input-area .el-input {
  flex: 1;
}

.empty-chat {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
