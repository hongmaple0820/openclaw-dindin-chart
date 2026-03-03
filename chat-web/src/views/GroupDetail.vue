<!--
  群详情页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="group-detail">
    <!-- 群信息头部 -->
    <div class="detail-header">
      <div class="group-info">
        <el-avatar :size="48" :src="group?.avatar">
          {{ group?.name?.charAt(0) || '群' }}
        </el-avatar>
        <div class="info-text">
          <h3>{{ group?.name || '群聊' }}</h3>
          <span class="member-count">{{ members.length }} 人</span>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="$emit('settings')">
          <el-icon><Setting /></el-icon>
          群设置
        </el-button>
      </div>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="detail-tabs">
      <!-- 聊天 -->
      <el-tab-pane label="聊天" name="chat">
        <div class="chat-area">
          <div class="messages-container" ref="messagesRef">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="message-item"
              :class="{ 'is-self': msg.senderId === currentUserId }"
            >
              <el-avatar :size="36" :src="msg.senderAvatar">
                {{ msg.senderName?.charAt(0) || '?' }}
              </el-avatar>
              <div class="message-content">
                <div class="message-header">
                  <span class="sender-name">{{ msg.senderName }}</span>
                  <span class="time">{{ formatTime(msg.createdAt) }}</span>
                </div>
                <div class="message-text">{{ msg.content }}</div>
              </div>
            </div>

            <el-empty v-if="messages.length === 0" description="暂无消息，发送第一条消息吧" />
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
      </el-tab-pane>

      <!-- 成员 -->
      <el-tab-pane label="成员" name="members">
        <div class="members-area">
          <div class="members-header">
            <span>{{ members.length }} 位成员</span>
            <el-button
              v-if="isMember"
              type="primary"
              size="small"
              @click="showInvite = true"
            >
              邀请成员
            </el-button>
          </div>

          <div class="member-list">
            <!-- 群主 -->
            <div v-if="owner" class="member-section">
              <div class="section-title">群主</div>
              <GroupMember :member="owner" :owner-id="group?.ownerId" />
            </div>

            <!-- 管理员 -->
            <div v-if="admins.length > 0" class="member-section">
              <div class="section-title">管理员</div>
              <GroupMember
                v-for="member in admins"
                :key="member.userId"
                :member="member"
                :owner-id="group?.ownerId"
                :current-user-id="currentUserId"
                :current-user-is-admin="currentUserIsAdmin"
                :show-actions="isOwnerOrAdmin"
                @set-admin="handleSetAdmin"
                @remove-admin="handleRemoveAdmin"
                @remove="handleRemoveMember"
              />
            </div>

            <!-- 普通成员 -->
            <div v-if="regularMembers.length > 0" class="member-section">
              <div class="section-title">普通成员</div>
              <GroupMember
                v-for="member in regularMembers"
                :key="member.userId"
                :member="member"
                :owner-id="group?.ownerId"
                :current-user-id="currentUserId"
                :current-user-is-admin="currentUserIsAdmin"
                :show-actions="isOwnerOrAdmin"
                @set-admin="handleSetAdmin"
                @remove-admin="handleRemoveAdmin"
                @remove="handleRemoveMember"
              />
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 邀请成员对话框 -->
    <GroupInvite
      v-model:visible="showInvite"
      :friends="friends"
      :existing-member-ids="memberIds"
      :loading="inviting"
      @invite="handleInvite"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Setting } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useGroupStore } from '@/stores/groups';
import { groupApi } from '@/api/groups';
import GroupMember from '@/components/GroupMember.vue';
import GroupInvite from '@/components/GroupInvite.vue';

const props = defineProps({
  groupId: {
    type: [String, Number],
    required: true
  }
});

const emit = defineEmits(['settings']);

const router = useRouter();
const userStore = useUserStore();
const groupStore = useGroupStore();

const activeTab = ref('chat');
const messages = ref([]);
const members = ref([]);
const inputText = ref('');
const sending = ref(false);
const messagesRef = ref(null);
const showInvite = ref(false);
const inviting = ref(false);
const friends = ref([]);

const currentUserId = computed(() => userStore.user?.id);

const group = computed(() => groupStore.currentGroup);

const isMember = computed(() => 
  members.value.some(m => m.userId === currentUserId.value)
);

const isOwner = computed(() => 
  group.value?.ownerId === currentUserId.value
);

const currentUserIsAdmin = computed(() => {
  const member = members.value.find(m => m.userId === currentUserId.value);
  return member?.isAdmin || false;
});

const isOwnerOrAdmin = computed(() => isOwner.value || currentUserIsAdmin.value);

const owner = computed(() => 
  members.value.find(m => m.userId === group.value?.ownerId)
);

const admins = computed(() => 
  members.value.filter(m => m.isAdmin && m.userId !== group.value?.ownerId)
);

const regularMembers = computed(() => 
  members.value.filter(m => !m.isAdmin && m.userId !== group.value?.ownerId)
);

const memberIds = computed(() => members.value.map(m => m.userId));

// 加载群详情
async function loadGroupDetail() {
  await groupStore.fetchGroupDetail(props.groupId);
  await loadMembers();
  await loadMessages();
}

// 加载成员
async function loadMembers() {
  try {
    const res = await groupApi.getMembers(props.groupId);
    if (res.success) {
      members.value = res.members || [];
    }
  } catch (error) {
    console.error('加载成员失败:', error);
  }
}

// 加载消息
async function loadMessages() {
  try {
    const res = await groupApi.getMessages(props.groupId);
    if (res.success) {
      messages.value = res.messages || [];
      scrollToBottom();
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

// 发送消息
async function sendMessage() {
  if (!inputText.value.trim()) return;

  sending.value = true;
  try {
    const res = await groupApi.sendMessage(props.groupId, {
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

// 邀请成员
async function handleInvite(userIds) {
  inviting.value = true;
  try {
    const success = await groupStore.inviteMembers(props.groupId, userIds);
    if (success) {
      ElMessage.success('邀请成功');
      showInvite.value = false;
    } else {
      ElMessage.error('邀请失败');
    }
  } finally {
    inviting.value = false;
  }
}

// 设置管理员
async function handleSetAdmin(member) {
  try {
    await ElMessageBox.confirm(
      `确定要将「${member.nickname || member.username}」设为管理员吗？`,
      '设置管理员'
    );
    const success = await groupStore.setAdmin(props.groupId, member.userId, true);
    if (success) {
      ElMessage.success('设置成功');
    }
  } catch {
    // 取消
  }
}

// 取消管理员
async function handleRemoveAdmin(member) {
  try {
    await ElMessageBox.confirm(
      `确定要取消「${member.nickname || member.username}」的管理员身份吗？`,
      '取消管理员'
    );
    const success = await groupStore.setAdmin(props.groupId, member.userId, false);
    if (success) {
      ElMessage.success('取消成功');
    }
  } catch {
    // 取消
  }
}

// 移出成员
async function handleRemoveMember(member) {
  try {
    await ElMessageBox.confirm(
      `确定要将「${member.nickname || member.username}」移出群聊吗？`,
      '移出群聊',
      { type: 'warning' }
    );
    const success = await groupStore.removeMember(props.groupId, member.userId);
    if (success) {
      ElMessage.success('已移出');
    }
  } catch {
    // 取消
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
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5);
}

watch(() => props.groupId, () => {
  loadGroupDetail();
});

onMounted(() => {
  loadGroupDetail();
});
</script>

<style scoped>
.group-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-info :deep(.el-avatar) {
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
  color: white;
}

.info-text h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.member-count {
  font-size: 13px;
  color: #909399;
}

.detail-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.detail-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.chat-area {
  display: flex;
  flex-direction: column;
  height: 100%;
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

.time {
  font-size: 11px;
  color: #c0c4cc;
}

.message-text {
  background: #f4f4f5;
  padding: 10px 14px;
  border-radius: 8px;
  line-height: 1.5;
  word-break: break-word;
}

.is-self .message-text {
  background: #C41E3A;
  color: white;
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

.members-area {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  color: #606266;
}

.member-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 13px;
  color: #909399;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}
</style>