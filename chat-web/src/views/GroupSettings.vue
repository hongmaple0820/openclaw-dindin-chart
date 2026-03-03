<!--
  群设置页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="group-settings-page">
    <div class="settings-container">
      <!-- 返回按钮 -->
      <div class="page-header">
        <el-button text @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2>群设置</h2>
      </div>

      <div class="settings-content" v-loading="loading">
        <!-- 群基本信息 -->
        <div class="settings-section">
          <h3>群信息</h3>
          <div class="info-card">
            <div class="info-item">
              <label>群头像</label>
              <el-upload
                class="avatar-uploader"
                action="#"
                :show-file-list="false"
                :auto-upload="false"
                @change="handleAvatarChange"
              >
                <el-avatar :size="64" :src="group?.avatar">
                  {{ group?.name?.charAt(0) || '群' }}
                </el-avatar>
                <div class="upload-hint">点击更换</div>
              </el-upload>
            </div>

            <div class="info-item">
              <label>群名称</label>
              <div class="info-value">
                <span v-if="!editingName">{{ group?.name }}</span>
                <el-input
                  v-else
                  v-model="editForm.name"
                  placeholder="输入群名称"
                  style="width: 200px"
                />
                <el-button
                  v-if="isOwnerOrAdmin"
                  :type="editingName ? 'primary' : 'default'"
                  size="small"
                  @click="handleEditName"
                >
                  {{ editingName ? '保存' : '修改' }}
                </el-button>
              </div>
            </div>

            <div class="info-item">
              <label>群公告</label>
              <div class="info-value">
                <span v-if="!editingAnnouncement">{{ group?.announcement || '暂无公告' }}</span>
                <el-input
                  v-else
                  v-model="editForm.announcement"
                  type="textarea"
                  :rows="3"
                  placeholder="输入群公告"
                />
                <el-button
                  v-if="isOwnerOrAdmin"
                  :type="editingAnnouncement ? 'primary' : 'default'"
                  size="small"
                  @click="handleEditAnnouncement"
                >
                  {{ editingAnnouncement ? '保存' : '修改' }}
                </el-button>
              </div>
            </div>

            <div class="info-item">
              <label>创建时间</label>
              <span>{{ formatDate(group?.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- 成员管理（仅群主/管理员可见） -->
        <div class="settings-section" v-if="isOwnerOrAdmin">
          <h3>成员管理</h3>
          <div class="member-management">
            <el-button type="primary" @click="showInvite = true">
              <el-icon><Plus /></el-icon>
              邀请成员
            </el-button>
          </div>
        </div>

        <!-- 机器人管理（仅群主可见） -->
        <div class="settings-section" v-if="isOwner">
          <GroupManageBot
            :bots="bots"
            :available-bots="availableBots"
            @add-bot="handleAddBot"
            @remove-bot="handleRemoveBot"
            @toggle-bot="handleToggleBot"
          />
        </div>

        <!-- 转让群主（仅群主可见） -->
        <div class="settings-section" v-if="isOwner">
          <h3>转让群主</h3>
          <div class="transfer-section">
            <p class="warning-text">转让后您将变为普通成员，新群主将获得群管理权限。</p>
            <el-select v-model="newOwnerId" placeholder="选择新群主" style="width: 200px">
              <el-option
                v-for="member in transferableMembers"
                :key="member.userId"
                :label="member.nickname || member.username"
                :value="member.userId"
              />
            </el-select>
            <el-button
              type="warning"
              :disabled="!newOwnerId"
              @click="handleTransfer"
            >
              转让群主
            </el-button>
          </div>
        </div>

        <!-- 危险操作 -->
        <div class="settings-section danger-section">
          <h3>危险操作</h3>
          <div class="danger-actions">
            <template v-if="isOwner">
              <p class="warning-text">解散群聊后，所有成员将被移除，聊天记录将被清空。</p>
              <el-button type="danger" @click="handleDismiss">
                解散群聊
              </el-button>
            </template>
            <template v-else>
              <p class="warning-text">退出群聊后，您将无法查看群消息。</p>
              <el-button type="danger" @click="handleLeave">
                退出群聊
              </el-button>
            </template>
          </div>
        </div>
      </div>
    </div>

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
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useGroupStore } from '@/stores/groups';
import { groupApi } from '@/api/groups';
import GroupManageBot from '@/components/GroupManageBot.vue';
import GroupInvite from '@/components/GroupInvite.vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const groupStore = useGroupStore();

const loading = ref(false);
const editingName = ref(false);
const editingAnnouncement = ref(false);
const editForm = ref({
  name: '',
  announcement: ''
});
const showInvite = ref(false);
const inviting = ref(false);
const friends = ref([]);
const members = ref([]);
const bots = ref([]);
const newOwnerId = ref(null);

const groupId = computed(() => route.params.id);

const group = computed(() => groupStore.currentGroup);

const currentUserId = computed(() => userStore.user?.id);

const isOwner = computed(() => group.value?.ownerId === currentUserId.value);

const currentUserMember = computed(() => 
  members.value.find(m => m.userId === currentUserId.value)
);

const currentUserIsAdmin = computed(() => currentUserMember.value?.isAdmin || false);

const isOwnerOrAdmin = computed(() => isOwner.value || currentUserIsAdmin.value);

const memberIds = computed(() => members.value.map(m => m.userId));

const transferableMembers = computed(() => 
  members.value.filter(m => m.userId !== currentUserId.value)
);

const availableBots = ref([
  { id: 'assistant', name: '小琳助手', description: '智能助手，帮助回答问题' },
  { id: 'reminder', name: '提醒机器人', description: '定时提醒，不错过重要事项' },
  { id: 'weather', name: '天气机器人', description: '每日天气预报播报' }
]);

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    await groupStore.fetchGroupDetail(groupId.value);
    await loadMembers();
    // TODO: 加载好友列表、机器人列表
  } finally {
    loading.value = false;
  }
}

// 加载成员
async function loadMembers() {
  try {
    const res = await groupApi.getMembers(groupId.value);
    if (res.success) {
      members.value = res.members || [];
    }
  } catch (error) {
    console.error('加载成员失败:', error);
  }
}

// 编辑群名
async function handleEditName() {
  if (!editingName.value) {
    editingName.value = true;
    editForm.value.name = group.value?.name || '';
    return;
  }

  if (!editForm.value.name.trim()) {
    ElMessage.warning('群名称不能为空');
    return;
  }

  try {
    const success = await groupStore.updateGroup(groupId.value, {
      name: editForm.value.name.trim()
    });
    if (success) {
      ElMessage.success('修改成功');
      editingName.value = false;
    } else {
      ElMessage.error('修改失败');
    }
  } catch (error) {
    ElMessage.error('修改失败');
  }
}

// 编辑公告
async function handleEditAnnouncement() {
  if (!editingAnnouncement.value) {
    editingAnnouncement.value = true;
    editForm.value.announcement = group.value?.announcement || '';
    return;
  }

  try {
    const success = await groupStore.updateGroup(groupId.value, {
      announcement: editForm.value.announcement.trim()
    });
    if (success) {
      ElMessage.success('修改成功');
      editingAnnouncement.value = false;
    } else {
      ElMessage.error('修改失败');
    }
  } catch (error) {
    ElMessage.error('修改失败');
  }
}

// 更换头像
function handleAvatarChange(file) {
  // TODO: 实现头像上传
  ElMessage.info('头像上传功能开发中');
}

// 邀请成员
async function handleInvite(userIds) {
  inviting.value = true;
  try {
    const success = await groupStore.inviteMembers(groupId.value, userIds);
    if (success) {
      ElMessage.success('邀请成功');
      showInvite.value = false;
      await loadMembers();
    } else {
      ElMessage.error('邀请失败');
    }
  } finally {
    inviting.value = false;
  }
}

// 添加机器人
async function handleAddBot(bot) {
  try {
    const res = await groupApi.addBot(groupId.value, bot.id);
    if (res.success) {
      ElMessage.success('添加成功');
      bots.value.push({ ...bot, enabled: true });
    } else {
      ElMessage.error(res.error || '添加失败');
    }
  } catch (error) {
    ElMessage.error('添加失败');
  }
}

// 移除机器人
async function handleRemoveBot(bot) {
  try {
    const res = await groupApi.removeBot(groupId.value, bot.id);
    if (res.success) {
      ElMessage.success('移除成功');
      bots.value = bots.value.filter(b => b.id !== bot.id);
    } else {
      ElMessage.error(res.error || '移除失败');
    }
  } catch (error) {
    ElMessage.error('移除失败');
  }
}

// 切换机器人状态
async function handleToggleBot(bot) {
  // TODO: 实现机器人状态切换
  ElMessage.info('机器人状态切换功能开发中');
}

// 转让群主
async function handleTransfer() {
  if (!newOwnerId.value) {
    ElMessage.warning('请选择新群主');
    return;
  }

  try {
    await ElMessageBox.confirm(
      '确定要转让群主身份吗？转让后您将变为普通成员。',
      '转让群主',
      { type: 'warning' }
    );

    const success = await groupStore.transferOwner(groupId.value, newOwnerId.value);
    if (success) {
      ElMessage.success('转让成功');
      router.push('/groups');
    } else {
      ElMessage.error('转让失败');
    }
  } catch {
    // 取消
  }
}

// 解散群聊
async function handleDismiss() {
  try {
    await ElMessageBox.confirm(
      '确定要解散群聊吗？此操作不可撤销！',
      '解散群聊',
      { type: 'error', confirmButtonText: '解散', cancelButtonText: '取消' }
    );

    const success = await groupStore.dismissGroup(groupId.value);
    if (success) {
      ElMessage.success('群聊已解散');
      router.push('/groups');
    } else {
      ElMessage.error('解散失败');
    }
  } catch {
    // 取消
  }
}

// 退出群聊
async function handleLeave() {
  try {
    await ElMessageBox.confirm(
      '确定要退出群聊吗？',
      '退出群聊',
      { type: 'warning' }
    );

    const success = await groupStore.leaveGroup(groupId.value);
    if (success) {
      ElMessage.success('已退出群聊');
      router.push('/groups');
    } else {
      ElMessage.error('退出失败');
    }
  } catch {
    // 取消
  }
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.group-settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.settings-content {
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  font-size: 15px;
  color: #303133;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.info-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  width: 80px;
  font-weight: 500;
  color: #606266;
}

.info-value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-uploader {
  position: relative;
  cursor: pointer;
}

.upload-hint {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 0 0 50% 50%;
  padding: 2px 0;
}

.member-management {
  display: flex;
  gap: 12px;
}

.transfer-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warning-text {
  font-size: 13px;
  color: #e6a23c;
  margin: 0;
}

.danger-section {
  background: #fff5f5;
  border-radius: 8px;
  padding: 16px;
  margin-top: 24px;
}

.danger-section h3 {
  color: #f56c6c;
}

.danger-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>