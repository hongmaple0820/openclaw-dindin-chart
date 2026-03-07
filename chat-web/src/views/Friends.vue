<!--
  好友页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="friends-page">
    <div class="friends-container">
      <!-- 左侧：好友列表 -->
      <div class="friends-sidebar">
        <!-- 顶部搜索栏 -->
        <div class="sidebar-header">
          <h3>好友</h3>
          <el-badge :value="pendingCount" :hidden="pendingCount === 0" :max="99">
            <el-button type="primary" :icon="Plus" circle @click="showSearch = true" />
          </el-badge>
        </div>
        
        <!-- 搜索组件 -->
        <div v-if="showSearch" class="search-wrapper">
          <UserSearch 
            @close="showSearch = false" 
            @request-sent="handleRequestSent"
          />
        </div>
        
        <!-- 好友申请提醒 -->
        <div 
          v-if="pendingCount > 0 && !showRequests" 
          class="request-notice"
          @click="showRequests = true"
        >
          <el-icon><Bell /></el-icon>
          <span>{{ pendingCount }} 条好友申请待处理</span>
          <el-icon><ArrowRight /></el-icon>
        </div>
        
        <!-- 好友申请列表 -->
        <transition name="slide">
          <div v-if="showRequests" class="requests-panel">
            <div class="panel-header">
              <el-button text :icon="ArrowLeft" @click="showRequests = false">返回</el-button>
              <span>好友申请</span>
            </div>
            <div class="requests-list">
              <div v-if="friendStore.requestLoading" class="loading-state">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
              <template v-else-if="pendingRequests.length > 0">
                <FriendRequest
                  v-for="request in pendingRequests"
                  :key="request.id"
                  :request="request"
                  @accept="handleAcceptRequest"
                  @reject="handleRejectRequest"
                />
              </template>
              <div v-else class="empty-state">
                暂无好友申请
              </div>
            </div>
          </div>
        </transition>
        
        <!-- 好友分组列表 -->
        <div class="friends-list">
          <el-collapse v-model="activeGroups" v-if="!showRequests">
            <el-collapse-item
              v-for="(groupFriends, groupName) in friendStore.friendsByGroup"
              :key="groupName"
              :name="groupName"
            >
              <template #title>
                <div class="group-header">
                  <el-icon><Folder /></el-icon>
                  <span>{{ groupName }}</span>
                  <el-badge :value="groupFriends.length" type="info" />
                </div>
              </template>
              
              <FriendItem
                v-for="friend in groupFriends"
                :key="friend.id"
                :friend="friend"
                :is-active="friendStore.currentFriend?.id === friend.id"
                @click="selectFriend(friend)"
              />
            </el-collapse-item>
          </el-collapse>
          
          <div v-if="friendStore.loading" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          
          <div v-else-if="friendStore.friends.length === 0 && !showRequests" class="empty-friends">
            <el-empty description="暂无好友" :image-size="100">
              <el-button type="primary" @click="showSearch = true">添加好友</el-button>
            </el-empty>
          </div>
        </div>
      </div>
      
      <!-- 右侧：好友详情 -->
      <div class="friend-detail">
        <template v-if="friendStore.currentFriend">
          <div class="detail-header">
            <el-avatar :size="64" :src="friendStore.currentFriend.avatar">
              {{ friendStore.currentFriend.nickname?.charAt(0) || '?' }}
            </el-avatar>
            <div class="detail-info">
              <div class="detail-name">
                {{ friendStore.currentFriend.remark || friendStore.currentFriend.nickname }}
                <el-tag v-if="friendStore.currentFriend.userType === 'bot'" type="warning">
                  🤖 机器人
                </el-tag>
              </div>
              <div class="detail-status">
                <span :class="friendStore.currentFriend.online ? 'online' : 'offline'">
                  {{ friendStore.currentFriend.online ? '在线' : '离线' }}
                </span>
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="detail-content">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="用户名">
                {{ friendStore.currentFriend.username }}
              </el-descriptions-item>
              <el-descriptions-item label="昵称">
                {{ friendStore.currentFriend.nickname }}
              </el-descriptions-item>
              <el-descriptions-item label="备注">
                {{ friendStore.currentFriend.remark || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="成为好友">
                {{ formatDate(friendStore.currentFriend.becameFriendAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          
          <div class="detail-actions">
            <el-button type="primary" :icon="ChatDotRound" @click="startChat">
              发消息
            </el-button>
            <el-button :icon="Edit" @click="showRemarkDialog = true">
              设置备注
            </el-button>
            <el-dropdown trigger="click" @command="handleCommand">
              <el-button :icon="More">
                更多
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" :icon="Delete">
                    删除好友
                  </el-dropdown-item>
                  <el-dropdown-item command="block" :icon="Lock">
                    拉黑
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
        
        <div v-else class="empty-detail">
          <el-empty description="选择一个好友查看详情" :image-size="120" />
        </div>
      </div>
    </div>
    
    <!-- 设置备注对话框 -->
    <el-dialog v-model="showRemarkDialog" title="设置备注" width="400px">
      <el-input
        v-model="newRemark"
        placeholder="请输入备注名"
        maxlength="20"
        show-word-limit
      />
      <template #footer>
        <el-button @click="showRemarkDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRemark" :loading="savingRemark">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Bell, ArrowRight, ArrowLeft, Folder,
  Loading, ChatDotRound, Edit, More, Delete, Lock
} from '@element-plus/icons-vue';
import { useFriendStore } from '@/stores/friends';
import FriendItem from '@/components/FriendItem.vue';
import FriendRequest from '@/components/FriendRequest.vue';
import UserSearch from '@/components/UserSearch.vue';

const router = useRouter();
const friendStore = useFriendStore();

// 状态
const showSearch = ref(false);
const showRequests = ref(false);
const activeGroups = ref(['默认分组']);
const showRemarkDialog = ref(false);
const newRemark = ref('');
const savingRemark = ref(false);

// 计算属性
const pendingCount = computed(() => friendStore.pendingRequestCount);
const pendingRequests = computed(() => 
  friendStore.requests.filter(r => r.status === 'pending')
);

// 初始化
onMounted(async () => {
  await Promise.all([
    friendStore.fetchFriends(),
    friendStore.fetchRequests()
  ]);
  // 默认展开所有分组
  activeGroups.value = Object.keys(friendStore.friendsByGroup);
});

// 选择好友
function selectFriend(friend) {
  friendStore.selectFriend(friend);
}

// 处理好友申请
async function handleAcceptRequest(requestId) {
  const res = await friendStore.handleRequest(requestId, 'accepted');
  if (res.success) {
    ElMessage.success('已同意好友申请');
  } else {
    ElMessage.error(res.error || '操作失败');
  }
}

async function handleRejectRequest(requestId) {
  const res = await friendStore.handleRequest(requestId, 'rejected');
  if (res.success) {
    ElMessage.success('已拒绝好友申请');
  } else {
    ElMessage.error(res.error || '操作失败');
  }
}

// 发送申请后刷新
function handleRequestSent() {
  showSearch.value = false;
  friendStore.fetchRequests();
}

// 发消息
function startChat() {
  const friend = friendStore.currentFriend;
  if (friend) {
    router.push({
      path: '/dm',
      query: { userId: friend.id, name: friend.remark || friend.nickname }
    });
  }
}

// 保存备注
async function saveRemark() {
  if (!friendStore.currentFriend) return;
  
  savingRemark.value = true;
  try {
    const res = await friendStore.setRemark(
      friendStore.currentFriend.id,
      newRemark.value.trim()
    );
    
    if (res.success) {
      ElMessage.success('备注已更新');
      showRemarkDialog.value = false;
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } finally {
    savingRemark.value = false;
  }
}

// 更多操作
async function handleCommand(command) {
  const friend = friendStore.currentFriend;
  if (!friend) return;
  
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确定要删除好友 "${friend.remark || friend.nickname}" 吗？`,
        '删除好友',
        { type: 'warning' }
      );
      
      const res = await friendStore.deleteFriend(friend.id);
      if (res.success) {
        ElMessage.success('好友已删除');
      } else {
        ElMessage.error(res.error || '删除失败');
      }
    } catch (e) {
      // 取消删除
    }
  } else if (command === 'block') {
    try {
      await ElMessageBox.confirm(
        `确定要拉黑 "${friend.remark || friend.nickname}" 吗？`,
        '拉黑用户',
        { type: 'warning' }
      );
      
      const res = await friendStore.blockUser(friend.id);
      if (res.success) {
        ElMessage.success('已拉黑该用户');
      } else {
        ElMessage.error(res.error || '操作失败');
      }
    } catch (e) {
      // 取消拉黑
    }
  }
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.friends-page {
  height: calc(100vh - 56px);
  padding: 0;
}

.friends-container {
  display: flex;
  height: 100%;
  background: white;
  overflow: hidden;
}

/* 左侧边栏 */
.friends-sidebar {
  width: 320px;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.sidebar-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
}

.search-wrapper {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.request-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}

.request-notice:hover {
  opacity: 0.9;
}

.request-notice span {
  flex: 1;
  font-size: 13px;
}

/* 好友申请面板 */
.requests-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
}

.requests-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 好友列表 */
.friends-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.group-header .el-badge {
  margin-left: auto;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__header) {
  background: transparent;
  border-bottom: none;
  padding: 0 16px;
  height: 44px;
  font-weight: 500;
}

:deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: none;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.empty-friends {
  padding: 40px 20px;
}

/* 右侧详情 */
.friend-detail {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-info {
  flex: 1;
}

.detail-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-status {
  margin-top: 4px;
  font-size: 14px;
}

.detail-status .online {
  color: #67c23a;
}

.detail-status .offline {
  color: #909399;
}

.detail-content {
  flex: 1;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.detail-actions .el-button--primary {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
}

.empty-detail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .friends-page {
    padding: 0;
  }
  
  .friends-container {
    flex-direction: column;
  }
  
  .friends-sidebar {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .friend-detail {
    width: 100%;
    height: 50%;
    padding: 16px;
  }
}
</style>
