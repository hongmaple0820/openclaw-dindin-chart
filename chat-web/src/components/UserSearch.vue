<!--
  用户搜索组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="user-search">
    <el-input
      v-model="searchQuery"
      placeholder="搜索用户名或昵称..."
      :prefix-icon="Search"
      clearable
      @keyup.enter="handleSearch"
      @clear="clearResults"
    >
      <template #append>
        <el-button :icon="Search" @click="handleSearch" :loading="loading" />
      </template>
    </el-input>
    
    <!-- 搜索结果 -->
    <transition name="fade">
      <div v-if="showResults" class="search-results">
        <div v-if="loading" class="loading-state">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>搜索中...</span>
        </div>
        
        <template v-else-if="results.length > 0">
          <div 
            v-for="user in results" 
            :key="user.id"
            class="search-result-item"
            @click="selectUser(user)"
          >
            <el-avatar :size="36" :src="user.avatar">
              {{ user.nickname?.charAt(0) || user.username?.charAt(0) || '?' }}
            </el-avatar>
            <div class="user-info">
              <div class="user-name">
                {{ user.nickname || user.username }}
                <el-tag v-if="user.userType === 'bot'" type="warning" size="small" class="user-type-tag">
                  🤖 机器人
                </el-tag>
              </div>
              <div class="user-id">ID: {{ user.id }}</div>
            </div>
            <el-button 
              v-if="!user.isFriend" 
              type="primary" 
              size="small"
              @click.stop="sendFriendRequest(user)"
            >
              添加好友
            </el-button>
            <el-tag v-else type="success" size="small">已是好友</el-tag>
          </div>
        </template>
        
        <div v-else-if="searchQuery && !loading" class="empty-state">
          未找到相关用户
        </div>
      </div>
    </transition>
    
    <!-- 发送好友申请对话框 -->
    <el-dialog 
      v-model="showRequestDialog" 
      title="发送好友申请" 
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="selected-user">
        <el-avatar :size="48" :src="selectedUser?.avatar">
          {{ selectedUser?.nickname?.charAt(0) || selectedUser?.username?.charAt(0) || '?' }}
        </el-avatar>
        <span class="user-name">{{ selectedUser?.nickname || selectedUser?.username }}</span>
      </div>
      
      <el-form class="request-form">
        <el-form-item label="验证消息">
          <el-input
            v-model="requestMessage"
            type="textarea"
            :rows="3"
            placeholder="请输入验证消息（选填）"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRequestDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSendRequest" :loading="sending">
          发送申请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Search, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useFriendStore } from '@/stores/friends';

const emit = defineEmits(['close', 'request-sent']);

const friendStore = useFriendStore();

const searchQuery = ref('');
const results = ref([]);
const loading = ref(false);
const showResults = ref(false);

const selectedUser = ref(null);
const showRequestDialog = ref(false);
const requestMessage = ref('');
const sending = ref(false);

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('请输入搜索内容');
    return;
  }
  
  loading.value = true;
  showResults.value = true;
  
  try {
    const res = await friendStore.searchUsers(searchQuery.value.trim());
    if (res.success) {
      results.value = res.users;
    } else {
      ElMessage.error(res.error || '搜索失败');
      results.value = [];
    }
  } catch (error) {
    ElMessage.error('搜索失败');
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function clearResults() {
  results.value = [];
  showResults.value = false;
}

function selectUser(user) {
  selectedUser.value = user;
  showRequestDialog.value = true;
  requestMessage.value = '';
}

async function sendFriendRequest(user) {
  selectedUser.value = user;
  showRequestDialog.value = true;
  requestMessage.value = '';
}

async function confirmSendRequest() {
  if (!selectedUser.value) return;
  
  sending.value = true;
  try {
    const res = await friendStore.sendRequest({
      userId: selectedUser.value.id,
      message: requestMessage.value.trim()
    });
    
    if (res.success) {
      ElMessage.success('好友申请已发送');
      showRequestDialog.value = false;
      emit('request-sent');
    } else {
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    ElMessage.error('发送失败');
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.user-search {
  position: relative;
}

.search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid #e4e7ed;
  max-height: 400px;
  overflow-y: auto;
  z-index: 100;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: rgba(196, 30, 58, 0.05);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-type-tag {
  padding: 0 4px;
  height: 16px;
  line-height: 14px;
  font-size: 10px;
}

.user-id {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  margin-top: 2px;
}

.selected-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.selected-user .user-name {
  font-weight: 500;
  font-size: 16px;
}

.request-form {
  margin-top: 8px;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
