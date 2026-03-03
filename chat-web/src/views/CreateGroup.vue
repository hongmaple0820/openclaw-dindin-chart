<!--
  创建群聊页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="create-group-page">
    <div class="create-container">
      <!-- 返回按钮 -->
      <div class="page-header">
        <el-button text @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2>创建群聊</h2>
      </div>

      <div class="create-content">
        <el-steps :active="currentStep" align-center class="steps">
          <el-step title="选择好友" />
          <el-step title="设置群信息" />
          <el-step title="完成创建" />
        </el-steps>

        <!-- 步骤1：选择好友 -->
        <div v-show="currentStep === 0" class="step-content">
          <div class="search-area">
            <el-input
              v-model="searchQuery"
              placeholder="搜索好友"
              :prefix-icon="Search"
              clearable
            />
          </div>

          <div class="friend-list-container">
            <div class="friend-list">
              <el-checkbox-group v-model="selectedFriends">
                <div
                  v-for="friend in filteredFriends"
                  :key="friend.id"
                  class="friend-item"
                >
                  <el-checkbox :value="friend.id">
                    <div class="friend-info">
                      <el-avatar :size="36" :src="friend.avatar">
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

              <el-empty v-if="filteredFriends.length === 0" description="暂无好友" />
            </div>

            <!-- 已选择的好友 -->
            <div v-if="selectedFriends.length > 0" class="selected-friends">
              <div class="selected-header">
                <span>已选择 {{ selectedFriends.length }} 人</span>
                <el-button text type="danger" @click="selectedFriends = []">
                  清空
                </el-button>
              </div>
              <div class="selected-avatars">
                <el-avatar
                  v-for="id in selectedFriends.slice(0, 10)"
                  :key="id"
                  :size="32"
                  :src="getFriendById(id)?.avatar"
                >
                  {{ getFriendById(id)?.nickname?.charAt(0) || getFriendById(id)?.username?.charAt(0) }}
                </el-avatar>
                <span v-if="selectedFriends.length > 10" class="more">
                  +{{ selectedFriends.length - 10 }}
                </span>
              </div>
            </div>
          </div>

          <div class="step-actions">
            <el-button @click="router.back()">取消</el-button>
            <el-button
              type="primary"
              :disabled="selectedFriends.length < 1"
              @click="currentStep = 1"
            >
              下一步
            </el-button>
          </div>
        </div>

        <!-- 步骤2：设置群信息 -->
        <div v-show="currentStep === 1" class="step-content">
          <el-form
            ref="formRef"
            :model="groupForm"
            :rules="formRules"
            label-width="80px"
            class="group-form"
          >
            <el-form-item label="群头像" prop="avatar">
              <el-upload
                class="avatar-uploader"
                action="#"
                :show-file-list="false"
                :auto-upload="false"
                @change="handleAvatarChange"
              >
                <el-avatar v-if="groupForm.avatar" :size="80" :src="groupForm.avatar" />
                <div v-else class="avatar-placeholder">
                  <el-icon><Plus /></el-icon>
                  <span>上传头像</span>
                </div>
              </el-upload>
            </el-form-item>

            <el-form-item label="群名称" prop="name">
              <el-input
                v-model="groupForm.name"
                placeholder="请输入群名称"
                maxlength="20"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="群公告">
              <el-input
                v-model="groupForm.announcement"
                type="textarea"
                :rows="3"
                placeholder="请输入群公告（选填）"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </el-form>

          <div class="step-actions">
            <el-button @click="currentStep = 0">上一步</el-button>
            <el-button
              type="primary"
              :loading="creating"
              @click="handleCreate"
            >
              创建群聊
            </el-button>
          </div>
        </div>

        <!-- 步骤3：创建成功 -->
        <div v-show="currentStep === 2" class="step-content success-step">
          <el-result
            icon="success"
            title="创建成功"
            sub-title="群聊已创建，快去邀请更多好友吧"
          >
            <template #extra>
              <el-button type="primary" @click="router.push(`/groups/${createdGroupId}`)">
                进入群聊
              </el-button>
              <el-button @click="router.push('/groups')">
                返回列表
              </el-button>
            </template>
          </el-result>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Plus, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useGroupStore } from '@/stores/groups';
import { groupApi } from '@/api/groups';

const router = useRouter();
const groupStore = useGroupStore();

const currentStep = ref(0);
const searchQuery = ref('');
const selectedFriends = ref([]);
const friends = ref([]);
const creating = ref(false);
const createdGroupId = ref(null);
const formRef = ref(null);

const groupForm = ref({
  name: '',
  announcement: '',
  avatar: ''
});

const formRules = {
  name: [
    { required: true, message: '请输入群名称', trigger: 'blur' },
    { min: 2, max: 20, message: '群名称长度为 2-20 个字符', trigger: 'blur' }
  ]
};

const filteredFriends = computed(() => {
  if (!searchQuery.value) return friends.value;
  const query = searchQuery.value.toLowerCase();
  return friends.value.filter(f => 
    (f.username && f.username.toLowerCase().includes(query)) ||
    (f.nickname && f.nickname.toLowerCase().includes(query))
  );
});

function getFriendById(id) {
  return friends.value.find(f => f.id === id);
}

function handleAvatarChange(file) {
  // TODO: 实现头像上传
  // 暂时使用默认头像
  ElMessage.info('头像上传功能开发中');
}

async function handleCreate() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  creating.value = true;
  try {
    const result = await groupStore.createGroup({
      name: groupForm.value.name,
      announcement: groupForm.value.announcement,
      memberIds: selectedFriends.value
    });

    if (result) {
      createdGroupId.value = result.id;
      currentStep.value = 2;
      ElMessage.success('创建成功');
    } else {
      ElMessage.error(groupStore.error || '创建失败');
    }
  } finally {
    creating.value = false;
  }
}

// 加载好友列表
async function loadFriends() {
  try {
    // TODO: 调用好友列表 API
    // 模拟数据
    friends.value = [
      { id: 1, username: 'user1', nickname: '小明', avatar: '' },
      { id: 2, username: 'user2', nickname: '小红', avatar: '' },
      { id: 3, username: 'user3', nickname: '小刚', avatar: '' }
    ];
  } catch (error) {
    console.error('加载好友列表失败:', error);
  }
}

onMounted(() => {
  loadFriends();
});
</script>

<style scoped>
.create-group-page {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.create-container {
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

.create-content {
  padding: 24px;
}

.steps {
  margin-bottom: 32px;
}

.step-content {
  min-height: 300px;
}

.search-area {
  margin-bottom: 16px;
}

.friend-list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.friend-list {
  max-height: 300px;
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

.selected-friends {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.selected-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.selected-avatars {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selected-avatars .more {
  font-size: 12px;
  color: #909399;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.group-form {
  max-width: 400px;
  margin: 0 auto;
}

.avatar-uploader {
  cursor: pointer;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border: 1px dashed #d9d9d9;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #909399;
  font-size: 12px;
}

.avatar-placeholder:hover {
  border-color: #C41E3A;
  color: #C41E3A;
}

.success-step {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>