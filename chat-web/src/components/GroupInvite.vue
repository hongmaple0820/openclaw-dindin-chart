<!--
  邀请成员组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="邀请成员"
    width="500px"
    :close-on-click-modal="false"
  >
    <div class="invite-container">
      <!-- 搜索好友 -->
      <el-input
        v-model="searchQuery"
        placeholder="搜索用户名或ID"
        :prefix-icon="Search"
        clearable
        class="search-input"
      />

      <!-- 好友列表 -->
      <div class="friend-list">
        <el-checkbox-group v-model="selectedUsers">
          <div
            v-for="friend in filteredFriends"
            :key="friend.id"
            class="friend-item"
          >
            <el-checkbox :value="friend.id">
              <div class="friend-info">
                <el-avatar :size="32" :src="friend.avatar">
                  {{ friend.nickname?.charAt(0) || friend.username?.charAt(0) }}
                </el-avatar>
                <div class="friend-detail">
                  <span class="friend-name">{{ friend.nickname || friend.username }}</span>
                  <span class="friend-id">ID: {{ friend.id }}</span>
                </div>
              </div>
            </el-checkbox>
          </div>
        </el-checkbox-group>

        <el-empty v-if="filteredFriends.length === 0" description="暂无可邀请的好友" />
      </div>

      <!-- 已选择 -->
      <div v-if="selectedUsers.length > 0" class="selected-info">
        已选择 {{ selectedUsers.length }} 人
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" :disabled="selectedUsers.length === 0" @click="handleInvite">
        邀请
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  friends: {
    type: Array,
    default: () => []
  },
  existingMemberIds: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'invite']);

const searchQuery = ref('');
const selectedUsers = ref([]);

// 过滤好友（排除已在群里的）
const filteredFriends = computed(() => {
  let result = props.friends;
  
  // 排除已在群里的成员
  if (props.existingMemberIds.length > 0) {
    result = result.filter(f => !props.existingMemberIds.includes(f.id));
  }
  
  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(f => 
      (f.username && f.username.toLowerCase().includes(query)) ||
      (f.nickname && f.nickname.toLowerCase().includes(query)) ||
      (f.id && String(f.id).includes(query))
    );
  }
  
  return result;
});

// 邀请
async function handleInvite() {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning('请选择要邀请的成员');
    return;
  }
  
  emit('invite', selectedUsers.value);
  selectedUsers.value = [];
  searchQuery.value = '';
}

// 关闭
function handleClose() {
  emit('update:visible', false);
  selectedUsers.value = [];
  searchQuery.value = '';
}
</script>

<style scoped>
.invite-container {
  min-height: 300px;
}

.search-input {
  margin-bottom: 16px;
}

.friend-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 8px;
}

.friend-item {
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.friend-item:hover {
  background: #f5f7fa;
}

.friend-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.friend-detail {
  display: flex;
  flex-direction: column;
}

.friend-name {
  font-weight: 500;
  color: #303133;
}

.friend-id {
  font-size: 12px;
  color: #909399;
}

.selected-info {
  margin-top: 12px;
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 6px;
  font-size: 13px;
  color: #409eff;
}
</style>