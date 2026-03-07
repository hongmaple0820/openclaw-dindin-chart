<!--
  协作空间页面
  @author 小琳
  @date 2026-03-05
  功能：空间列表、创建空间、邀请成员、发送消息
-->
<template>
  <div class="workspaces-page">
    <div class="workspaces-container">
      <!-- 左侧空间列表 -->
      <div class="space-list-panel">
        <div class="panel-header">
          <span class="header-title">协作空间</span>
          <el-button type="primary" size="small" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建
          </el-button>
        </div>

        <!-- 搜索 -->
        <div class="search-area">
          <el-input
            v-model="searchQuery"
            placeholder="搜索空间..."
            :prefix-icon="Search"
            clearable
            size="small"
          />
        </div>

        <!-- 空间列表 -->
        <div class="space-list" v-loading="loading">
          <div
            v-for="space in filteredSpaces"
            :key="space.id"
            class="space-item"
            :class="{ active: currentSpaceId === space.id }"
            @click="selectSpace(space)"
          >
            <el-avatar :size="48" :src="space.avatar" class="space-avatar">
              {{ space.name?.[0] || 'W' }}
            </el-avatar>
            <div class="space-info">
              <div class="space-name">{{ space.name }}</div>
              <div class="space-meta">
                <span>{{ space.member_count || 0 }} 成员</span>
                <span>{{ space.message_count || 0 }} 消息</span>
              </div>
            </div>
            <el-tag size="small" :type="getTypeTag(space.type)">{{ getTypeLabel(space.type) }}</el-tag>
          </div>

          <el-empty v-if="filteredSpaces.length === 0 && !loading" description="暂无协作空间" />
        </div>
      </div>

      <!-- 右侧空间详情 -->
      <div class="space-detail-panel">
        <template v-if="currentSpace">
          <!-- 头部 -->
          <div class="detail-header">
            <div class="header-info">
              <h3>{{ currentSpace.name }}</h3>
              <span class="space-type">{{ getTypeLabel(currentSpace.type) }}</span>
            </div>
            <div class="header-actions">
              <el-button text @click="showInviteDialog = true">
                <el-icon><UserFilled /></el-icon>
                邀请
              </el-button>
              <el-button text @click="showSettingsDialog = true">
                <el-icon><Setting /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 成员列表 -->
          <div class="members-bar">
            <el-avatar
              v-for="member in members"
              :key="member.member_id"
              :size="28"
              :class="member.member_type"
            >
              {{ member.member_type === 'agent' ? '🤖' : member.member_id?.[0]?.toUpperCase() || 'U' }}
            </el-avatar>
            <span class="member-count">{{ members.length }} 人</span>
          </div>

          <!-- 消息列表 -->
          <div class="messages-container" ref="messagesRef">
            <div v-if="messages.length === 0" class="empty-messages">
              <el-empty description="开始对话吧~" />
            </div>

            <div
              v-for="msg in messages"
              :key="msg.id"
              class="message-item"
              :class="{ 'is-me': msg.sender_id === currentUserId }"
            >
              <el-avatar :size="36" :class="msg.sender_type">
                {{ msg.sender_type === 'agent' ? '🤖' : msg.sender_id?.[0]?.toUpperCase() || 'U' }}
              </el-avatar>
              <div class="message-content">
                <div class="message-header">
                  <span class="sender-name">{{ getSenderName(msg) }}</span>
                  <span class="time">{{ formatTime(msg.created_at) }}</span>
                </div>
                <div class="message-text">{{ msg.content }}</div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="input-area">
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="2"
              placeholder="输入消息... (Ctrl+Enter 发送)"
              @keydown="handleKeydown"
              :disabled="sending"
            />
            <div class="input-actions">
              <el-button type="primary" @click="sendMessage" :loading="sending" :disabled="!inputText.trim()">
                发送
              </el-button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="empty-state">
            <el-empty description="选择或创建一个协作空间" />
          </div>
        </template>
      </div>
    </div>

    <!-- 创建空间弹窗 -->
    <el-dialog v-model="showCreateDialog" title="创建协作空间" width="500px">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="空间名称" required>
          <el-input v-model="createForm.name" placeholder="给空间起个名字" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" placeholder="空间用途..." />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="createForm.type">
            <el-radio value="human-ai">人机协作</el-radio>
            <el-radio value="human-only">纯人群聊</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="添加 Agent">
          <el-select v-model="createForm.agentIds" multiple placeholder="选择要添加的 Agent" style="width: 100%">
            <el-option
              v-for="agent in availableAgents"
              :key="agent.id"
              :label="agent.nickname || agent.name"
              :value="agent.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createSpace" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 邀请成员弹窗 -->
    <el-dialog v-model="showInviteDialog" title="邀请成员" width="450px">
      <el-tabs v-model="inviteTab">
        <el-tab-pane label="好友列表" name="friends">
          <div class="invite-user-list" v-if="friendStore.friends.length > 0">
            <div 
              v-for="friend in friendStore.friends" 
              :key="friend.id"
              class="invite-user-item"
              :class="{ selected: inviteUserId === friend.id }"
              @click="inviteUserId = friend.id"
            >
              <el-avatar :size="36" :src="friend.avatar">
                {{ (friend.remark || friend.nickname || friend.username)?.charAt(0) }}
              </el-avatar>
              <div class="user-info">
                <div class="user-name">{{ friend.remark || friend.nickname || friend.username }}</div>
                <div class="user-username">@{{ friend.username }}</div>
              </div>
              <el-icon v-if="inviteUserId === friend.id" class="check-icon"><Check /></el-icon>
            </div>
          </div>
          <el-empty v-else description="暂无好友" :image-size="80">
            <el-button type="primary" size="small" @click="router.push('/friends')">添加好友</el-button>
          </el-empty>
        </el-tab-pane>
        <el-tab-pane label="搜索用户" name="search">
          <el-input
            v-model="userSearchQuery"
            placeholder="搜索用户名或昵称..."
            clearable
            @keyup.enter="searchUsers"
          >
            <template #append>
              <el-button @click="searchUsers" :loading="userSearchLoading">搜索</el-button>
            </template>
          </el-input>
          <div class="invite-user-list" v-if="userSearchResults.length > 0" style="margin-top: 12px; max-height: 200px;">
            <div 
              v-for="user in userSearchResults" 
              :key="user.id"
              class="invite-user-item"
              :class="{ selected: inviteUserId === user.id }"
              @click="inviteUserId = user.id"
            >
              <el-avatar :size="36" :src="user.avatar">
                {{ (user.nickname || user.username)?.charAt(0) }}
              </el-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.nickname || user.username }}</div>
                <div class="user-username">@{{ user.username }}</div>
              </div>
              <el-icon v-if="inviteUserId === user.id" class="check-icon"><Check /></el-icon>
            </div>
          </div>
          <el-empty v-else-if="userSearchQuery && !userSearchLoading" description="未找到用户" :image-size="60" />
        </el-tab-pane>
        <el-tab-pane label="选择 Agent" name="agents">
          <div class="invite-user-list" v-if="availableAgents.length > 0">
            <div 
              v-for="agent in availableAgents" 
              :key="agent.id"
              class="invite-user-item"
              :class="{ selected: inviteAgentId === agent.id }"
              @click="inviteAgentId = agent.id"
            >
              <el-avatar :size="36" :src="agent.avatar">
                🤖
              </el-avatar>
              <div class="user-info">
                <div class="user-name">{{ agent.nickname || agent.name }}</div>
                <div class="user-username">{{ agent.description?.slice(0, 30) || 'AI 助手' }}</div>
              </div>
              <el-icon v-if="inviteAgentId === agent.id" class="check-icon"><Check /></el-icon>
            </div>
          </div>
          <el-empty v-else description="暂无可用 Agent" :image-size="80" />
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showInviteDialog = false">取消</el-button>
        <el-button type="primary" @click="inviteMember" :loading="inviting" :disabled="!inviteUserId && !inviteAgentId">
          邀请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Search, UserFilled, Setting, Check } from '@element-plus/icons-vue';
import api from '@/api';
import { useUserStore } from '@/stores/user';
import { useFriendStore } from '@/stores/friends';

const userStore = useUserStore();
const friendStore = useFriendStore();
const router = useRouter();

const loading = ref(false);
const spaces = ref([]);
const currentSpaceId = ref(null);
const members = ref([]);
const messages = ref([]);
const inputText = ref('');
const sending = ref(false);

const showCreateDialog = ref(false);
const showInviteDialog = ref(false);
const showSettingsDialog = ref(false);
const creating = ref(false);
const inviting = ref(false);
const inviteTab = ref('friends');

const searchQuery = ref('');
const availableAgents = ref([]);
const userSearchQuery = ref('');
const userSearchResults = ref([]);
const userSearchLoading = ref(false);

const createForm = ref({
  name: '',
  description: '',
  type: 'human-ai',
  agentIds: []
});

const inviteUserId = ref('');
const inviteAgentId = ref('');

const messagesRef = ref(null);
let eventSource = null;  // SSE 连接

const currentUserId = computed(() => userStore.user?.id || 'anonymous');

const currentSpace = computed(() => spaces.value.find(s => s.id === currentSpaceId.value));

const filteredSpaces = computed(() => {
  if (!searchQuery.value) return spaces.value;
  const query = searchQuery.value.toLowerCase();
  return spaces.value.filter(s => s.name?.toLowerCase().includes(query));
});

function getTypeLabel(type) {
  const labels = {
    'human-ai': '人机协作',
    'human-only': '纯人群聊',
    'ai-team': 'AI 团队'
  };
  return labels[type] || type;
}

function getTypeTag(type) {
  const tags = {
    'human-ai': 'success',
    'human-only': 'info',
    'ai-team': 'warning'
  };
  return tags[type] || '';
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getSenderName(msg) {
  if (msg.sender_type === 'agent') {
    const agent = availableAgents.value.find(a => a.id === msg.sender_id);
    return agent?.nickname || agent?.name || 'AI 助手';
  }
  return msg.sender_id === currentUserId.value ? '我' : msg.sender_id;
}

async function loadSpaces() {
  loading.value = true;
  try {
    const res = await api.get('/workspaces', {
      headers: { 'x-user-id': currentUserId.value }
    });
    if (res.success) {
      spaces.value = res.workspaces || [];
    }
  } catch (error) {
    console.error('加载空间失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadAgents() {
  try {
    const res = await api.get('/agents');
    if (res.success) {
      availableAgents.value = res.agents || [];
    }
  } catch (error) {
    console.error('加载 Agent 失败:', error);
  }
}

// 搜索用户
async function searchUsers() {
  if (!userSearchQuery.value.trim()) {
    ElMessage.warning('请输入搜索内容');
    return;
  }
  
  userSearchLoading.value = true;
  try {
    const res = await friendStore.searchUsers(userSearchQuery.value.trim());
    if (res.success) {
      userSearchResults.value = res.users || [];
    } else {
      userSearchResults.value = [];
    }
  } catch (error) {
    console.error('搜索用户失败:', error);
    userSearchResults.value = [];
  } finally {
    userSearchLoading.value = false;
  }
}

async function selectSpace(space) {
  currentSpaceId.value = space.id;
  await loadSpaceDetail();
}

async function loadSpaceDetail() {
  if (!currentSpaceId.value) return;
  
  try {
    const res = await api.get(`/workspaces/${currentSpaceId.value}`, {
      headers: { 'x-user-id': currentUserId.value }
    });
    if (res.success) {
      members.value = res.workspace.members || [];
      messages.value = res.workspace.recentMessages || [];
      scrollToBottom();
    }
  } catch (error) {
    console.error('加载空间详情失败:', error);
  }
}

async function createSpace() {
  if (!createForm.value.name) {
    ElMessage.warning('请输入空间名称');
    return;
  }
  
  creating.value = true;
  try {
    const members = createForm.value.agentIds.map(id => ({
      id,
      type: 'agent',
      role: 'assistant'
    }));
    
    const res = await api.post('/workspaces', {
      name: createForm.value.name,
      description: createForm.value.description,
      type: createForm.value.type,
      members
    }, {
      headers: { 'x-user-id': currentUserId.value }
    });
    
    if (res.success) {
      ElMessage.success('创建成功');
      showCreateDialog.value = false;
      createForm.value = { name: '', description: '', type: 'human-ai', agentIds: [] };
      await loadSpaces();
      if (res.workspace) {
        selectSpace(res.workspace);
      }
    } else {
      ElMessage.error(res.error || '创建失败');
    }
  } catch (error) {
    console.error('创建空间失败:', error);
    ElMessage.error('创建失败');
  } finally {
    creating.value = false;
  }
}

async function inviteMember() {
  if (!inviteUserId.value && !inviteAgentId.value) {
    ElMessage.warning('请选择要邀请的成员');
    return;
  }
  
  inviting.value = true;
  try {
    if (inviteAgentId.value) {
      const res = await api.post(`/workspaces/${currentSpaceId.value}/members`, {
        memberId: inviteAgentId.value,
        memberType: 'agent',
        role: 'assistant'
      }, {
        headers: { 'x-user-id': currentUserId.value }
      });
      
      if (res.success) {
        ElMessage.success('Agent 已添加');
        inviteAgentId.value = '';
        await loadSpaceDetail();
      }
    }
    
    if (inviteUserId.value) {
      const res = await api.post(`/workspaces/${currentSpaceId.value}/members`, {
        memberId: inviteUserId.value,
        memberType: 'human',
        role: 'member'
      }, {
        headers: { 'x-user-id': currentUserId.value }
      });
      
      if (res.success) {
        ElMessage.success('用户已邀请');
        inviteUserId.value = '';
        await loadSpaceDetail();
      }
    }
    
    showInviteDialog.value = false;
  } catch (error) {
    console.error('邀请失败:', error);
    ElMessage.error('邀请失败');
  } finally {
    inviting.value = false;
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
  
  sending.value = true;
  try {
    const res = await api.post(`/workspaces/${currentSpaceId.value}/messages`, {
      content
    }, {
      headers: { 'x-user-id': currentUserId.value }
    });
    
    if (res.success) {
      messages.value.push(res.message);
      inputText.value = '';
      scrollToBottom();
    } else {
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    ElMessage.error('发送失败');
  } finally {
    sending.value = false;
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
}

// SSE 连接
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }
  
  const sseUrl = `${window.location.protocol}//${window.location.hostname}:8273/api/sse/connect?userId=${currentUserId.value}`;
  
  eventSource = new EventSource(sseUrl);
  
  eventSource.onopen = () => {
    console.log('[Workspaces] SSE 连接成功');
  };
  
  eventSource.addEventListener('workspace_message', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[Workspaces] 收到新消息:', data);
      
      // 只处理当前空间的消息
      if (data.space_id === currentSpaceId.value && data.message) {
        messages.value.push(data.message);
        scrollToBottom();
      }
    } catch (e) {
      console.error('[Workspaces] 解析消息失败:', e);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('[Workspaces] SSE 错误:', error);
    // 5秒后重连
    setTimeout(connectSSE, 5000);
  };
}

onMounted(async () => {
  await Promise.all([
    loadSpaces(), 
    loadAgents(),
    friendStore.fetchFriends()
  ]);
  connectSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
});
</script>

<style scoped>
.workspaces-page { height: calc(100vh - 56px); padding: 0; margin: -24px; }
.workspaces-container { display: flex; height: 100%; background: #fff; overflow: hidden; }
.space-list-panel { width: 280px; border-right: 1px solid #e4e7ed; display: flex; flex-direction: column; }
.panel-header { padding: 12px 16px; border-bottom: 1px solid #e4e7ed; display: flex; justify-content: space-between; align-items: center; }
.header-title { font-size: 15px; font-weight: 600; color: #303133; }
.search-area { padding: 8px 12px; border-bottom: 1px solid #e4e7ed; }
.space-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.space-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: all 0.2s; }
.space-item:hover { background: #f5f7fa; }
.space-item.active { background: #ecf5ff; border-left: 3px solid #409eff; }
.space-avatar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; flex-shrink: 0; }
.space-info { flex: 1; min-width: 0; }
.space-name { font-size: 14px; font-weight: 500; color: #303133; }
.space-meta { font-size: 12px; color: #909399; margin-top: 2px; display: flex; gap: 12px; }
.space-detail-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.detail-header { padding: 12px 16px; border-bottom: 1px solid #e4e7ed; display: flex; justify-content: space-between; align-items: center; }
.header-info { display: flex; align-items: center; gap: 12px; }
.header-info h3 { margin: 0; font-size: 15px; }
.space-type { font-size: 12px; color: #67c23a; background: #f0f9ff; padding: 2px 8px; border-radius: 4px; }
.members-bar { padding: 8px 16px; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; gap: 8px; }
.members-bar .el-avatar.agent { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.members-bar .el-avatar.human { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.member-count { font-size: 12px; color: #909399; margin-left: 8px; }
.messages-container { flex: 1; overflow-y: auto; padding: 16px; }
.empty-messages { display: flex; justify-content: center; align-items: center; height: 100%; }
.message-item { display: flex; gap: 12px; margin-bottom: 16px; }
.message-item.is-me { flex-direction: row-reverse; }
.message-item .el-avatar.agent { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.message-item .el-avatar.human { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.message-content { max-width: 70%; }
.message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.is-me .message-header { flex-direction: row-reverse; }
.sender-name { font-size: 12px; font-weight: 500; color: #606266; }
.time { font-size: 11px; color: #909399; }
.message-text { background: #f4f4f5; padding: 10px 14px; border-radius: 8px; line-height: 1.6; word-break: break-word; }
.is-me .message-text { background: #409eff; color: #fff; }
.input-area { border-top: 1px solid #e4e7ed; padding: 12px 16px; background: #fafafa; }
.input-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.empty-state { flex: 1; display: flex; justify-content: center; align-items: center; }

/* 邀请用户列表样式 */
.invite-user-list { max-height: 280px; overflow-y: auto; }
.invite-user-item { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 10px 12px; 
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s;
  margin-bottom: 4px;
}
.invite-user-item:hover { background: #f5f7fa; }
.invite-user-item.selected { background: #ecf5ff; border: 1px solid #409eff; }
.invite-user-item .user-info { flex: 1; min-width: 0; }
.invite-user-item .user-name { font-size: 14px; font-weight: 500; color: #303133; }
.invite-user-item .user-username { font-size: 12px; color: #909399; margin-top: 2px; }
.invite-user-item .check-icon { color: #409eff; font-size: 18px; }

@media (max-width: 768px) {
  .workspaces-page { margin: -16px; padding: 0; }
  .workspaces-container { flex-direction: column; }
  .space-list-panel { width: 100%; height: 50%; border-right: none; border-bottom: 1px solid #e4e7ed; }
  .space-detail-panel { height: 50%; }
}
</style>