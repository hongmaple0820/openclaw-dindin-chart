<!--
  管理后台 - 用户管理
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="admin-users">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>👥 用户管理</h2>
      <div class="header-actions">
        <el-button @click="loadData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 待审核用户卡片 -->
    <el-card v-if="pendingUsers.length > 0" class="pending-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>⏳ 待审核用户</span>
          <el-badge :value="pendingUsers.length" type="warning" />
        </div>
      </template>
      <div class="pending-list">
        <div v-for="user in pendingUsers" :key="user.id" class="pending-item">
          <div class="user-info">
            <el-avatar :size="48" :src="user.avatar">
              {{ (user.nickname || user.username)?.charAt(0) }}
            </el-avatar>
            <div class="user-details">
              <div class="user-name">{{ user.nickname || user.username }}</div>
              <div class="user-meta">
                <span>@{{ user.username }}</span>
                <el-tag size="small" :type="user.type === 'bot' ? 'warning' : 'primary'">
                  {{ user.type === 'bot' ? '🤖 机器人' : '👤 人类' }}
                </el-tag>
                <span class="register-time">{{ formatDate(user.created_at) }}</span>
              </div>
            </div>
          </div>
          <div class="pending-actions">
            <el-button type="success" @click="handleApprove(user)">
              <el-icon><Check /></el-icon>
              通过
            </el-button>
            <el-button type="danger" @click="showRejectDialog(user)">
              <el-icon><Close /></el-icon>
              拒绝
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 筛选和搜索 -->
    <el-card class="filter-card" shadow="hover">
      <div class="filter-row">
        <el-input
          v-model="searchQuery"
          placeholder="搜索用户名、昵称..."
          :prefix-icon="Search"
          clearable
          style="width: 240px"
          @keyup.enter="loadUsers"
        />
        <el-select v-model="filterStatus" placeholder="用户状态" clearable style="width: 140px" @change="loadUsers">
          <el-option label="已通过" value="approved" />
          <el-option label="待审核" value="pending" />
          <el-option label="已拒绝" value="rejected" />
          <el-option label="已封禁" value="banned" />
        </el-select>
        <el-select v-model="filterType" placeholder="用户类型" clearable style="width: 120px" @change="loadUsers">
          <el-option label="人类" value="human" />
          <el-option label="机器人" value="bot" />
        </el-select>
        <el-button type="primary" @click="loadUsers">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
      </div>
    </el-card>

    <!-- 用户列表 -->
    <el-card class="users-card" shadow="hover">
      <el-table
        :data="users"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="36" :src="row.avatar">
                {{ (row.nickname || row.username)?.charAt(0) }}
              </el-avatar>
              <div class="user-info-cell">
                <div class="user-name">{{ row.nickname || row.username }}</div>
                <div class="user-username">@{{ row.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'bot' ? 'warning' : 'primary'">
              {{ row.type === 'bot' ? '🤖' : '👤' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.role === 'admin'" type="danger" size="small">管理员</el-tag>
            <span v-else class="text-muted">普通用户</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="row.status === 'pending'"
                type="success"
                size="small"
                @click="handleApprove(row)"
              >
                通过
              </el-button>
              <el-button
                v-if="row.status === 'pending'"
                type="danger"
                size="small"
                @click="showRejectDialog(row)"
              >
                拒绝
              </el-button>
              <el-button
                v-if="row.status === 'approved'"
                type="warning"
                size="small"
                @click="handleBan(row)"
              >
                封禁
              </el-button>
              <el-button
                v-if="row.status === 'banned'"
                type="success"
                size="small"
                @click="handleUnban(row)"
              >
                解封
              </el-button>
              <el-button
                v-if="row.status === 'rejected'"
                type="primary"
                size="small"
                @click="handleApprove(row)"
              >
                重新通过
              </el-button>
              <el-button
                size="small"
                @click="showUserDetail(row)"
              >
                详情
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadUsers"
          @current-change="loadUsers"
        />
      </div>
    </el-card>

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝用户" width="400px">
      <p>确定拒绝用户 <strong>{{ rejectingUser?.username }}</strong> 吗？</p>
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="拒绝原因（可选）"
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject" :loading="rejecting">确定拒绝</el-button>
      </template>
    </el-dialog>

    <!-- 用户详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="用户详情" width="500px">
      <template v-if="currentUser">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="用户ID">{{ currentUser.id }}</el-descriptions-item>
          <el-descriptions-item label="用户名">@{{ currentUser.username }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ currentUser.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ currentUser.email || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="currentUser.type === 'bot' ? 'warning' : 'primary'">
              {{ currentUser.type === 'bot' ? '机器人' : '人类' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentUser.status)">
              {{ getStatusText(currentUser.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="角色">{{ currentUser.role === 'admin' ? '管理员' : '普通用户' }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatDate(currentUser.created_at) }}</el-descriptions-item>
          <el-descriptions-item v-if="currentUser.bio" label="简介">{{ currentUser.bio }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Check, Close } from '@element-plus/icons-vue';
import adminApi from '@/api/admin';

const loading = ref(false);
const rejecting = ref(false);

// 用户数据
const users = ref([]);
const pendingUsers = ref([]);
const searchQuery = ref('');
const filterStatus = ref('');
const filterType = ref('');

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

// 拒绝对话框
const rejectDialogVisible = ref(false);
const rejectingUser = ref(null);
const rejectReason = ref('');

// 详情对话框
const detailDialogVisible = ref(false);
const currentUser = ref(null);

// 加载所有数据
async function loadData() {
  loading.value = true;
  try {
    await Promise.all([loadUsers(), loadPendingUsers()]);
  } finally {
    loading.value = false;
  }
}

// 加载用户列表
async function loadUsers() {
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery.value,
      status: filterStatus.value,
      type: filterType.value
    };
    
    const res = await adminApi.getUsers(params);
    if (res.success) {
      users.value = res.users || res.data?.users || [];
      pagination.total = res.pagination?.total || res.total || 0;
    }
  } catch (error) {
    console.error('加载用户失败:', error);
    ElMessage.error('加载用户列表失败');
  }
}

// 加载待审核用户
async function loadPendingUsers() {
  try {
    const res = await adminApi.getPendingUsers();
    if (res.success) {
      pendingUsers.value = res.data || res.users || [];
    }
  } catch (error) {
    console.error('加载待审核用户失败:', error);
  }
}

// 审批用户
async function handleApprove(user) {
  try {
    await ElMessageBox.confirm(`确定通过用户 "${user.username}" 的注册申请吗？`, '确认', { type: 'success' });
    
    const res = await adminApi.approveUser(user.id);
    if (res.success) {
      ElMessage.success('已通过');
      loadData();
    } else {
      ElMessage.error(res.error || '操作失败');
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

// 显示拒绝对话框
function showRejectDialog(user) {
  rejectingUser.value = user;
  rejectReason.value = '';
  rejectDialogVisible.value = true;
}

// 确认拒绝
async function confirmReject() {
  if (!rejectingUser.value) return;
  
  rejecting.value = true;
  try {
    const res = await adminApi.rejectUser(rejectingUser.value.id, rejectReason.value);
    if (res.success) {
      ElMessage.success('已拒绝');
      rejectDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.error || '操作失败');
    }
  } finally {
    rejecting.value = false;
  }
}

// 封禁用户
async function handleBan(user) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入封禁原因', '封禁用户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '封禁原因（可选）'
    });
    
    const res = await adminApi.banUser(user.id, reason || '');
    if (res.success) {
      ElMessage.success('已封禁');
      loadUsers();
    } else {
      ElMessage.error(res.error || '操作失败');
    }
  } catch (e) {
    // 取消
  }
}

// 解封用户
async function handleUnban(user) {
  try {
    await ElMessageBox.confirm(`确定解封用户 "${user.username}" 吗？`, '确认', { type: 'warning' });
    
    const res = await adminApi.unbanUser(user.id);
    if (res.success) {
      ElMessage.success('已解封');
      loadUsers();
    } else {
      ElMessage.error(res.error || '操作失败');
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

// 显示用户详情
function showUserDetail(user) {
  currentUser.value = user;
  detailDialogVisible.value = true;
}

// 获取状态类型
function getStatusType(status) {
  const types = {
    approved: 'success',
    pending: 'warning',
    rejected: 'danger',
    banned: 'info'
  };
  return types[status] || 'info';
}

// 获取状态文本
function getStatusText(status) {
  const texts = {
    approved: '✅ 已通过',
    pending: '⏳ 待审核',
    rejected: '❌ 已拒绝',
    banned: '🚫 已封禁'
  };
  return texts[status] || status;
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}

onMounted(loadData);
</script>

<style scoped>
.admin-users { padding: 0; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

/* 待审核卡片 */
.pending-card {
  margin-bottom: 20px;
  border-left: 4px solid #E6A23C;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-details .user-name {
  font-weight: 600;
  font-size: 15px;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}

.register-time {
  color: #C0C4CC;
}

.pending-actions {
  display: flex;
  gap: 8px;
}

/* 筛选卡片 */
.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 用户列表 */
.users-card {
  margin-bottom: 20px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info-cell .user-name {
  font-weight: 500;
}

.user-info-cell .user-username {
  font-size: 12px;
  color: #909399;
}

.text-muted {
  color: #909399;
  font-size: 13px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 响应式 */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .filter-row .el-input,
  .filter-row .el-select {
    width: 100% !important;
  }
  
  .pending-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>