<template>
  <div class="users">
    <h1>👥 用户管理</h1>
    
    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <input 
        v-model="searchQuery" 
        placeholder="🔍 搜索用户名..." 
        class="search-input"
        @input="handleSearch"
      />
      <select v-model="filterType" class="filter-select" @change="loadData">
        <option value="">全部类型</option>
        <option value="human">👤 人类</option>
        <option value="bot">🤖 机器人</option>
      </select>
      <select v-model="filterStatus" class="filter-select" @change="loadData">
        <option value="">全部状态</option>
        <option value="active">✅ 正常</option>
        <option value="disabled">🚫 已禁用</option>
      </select>
      <button class="btn btn-primary" @click="showAddUserDialog">
        ➕ 添加用户
      </button>
    </div>

    <!-- 在线状态概览 -->
    <div class="online-section">
      <h2>🟢 在线用户 ({{ onlineUsers.length }})</h2>
      <div class="online-list">
        <span v-for="user in onlineUsers" :key="user.name" class="user-badge online">
          {{ user.name }}
        </span>
        <span v-if="onlineUsers.length === 0" class="no-data">暂无在线用户</span>
      </div>
    </div>

    <!-- 用户列表 -->
    <div class="user-table">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>用户名</th>
            <th>类型</th>
            <th>角色</th>
            <th>状态</th>
            <th>消息数</th>
            <th>注册时间</th>
            <th>最后活跃</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id || user.name" :class="{ disabled: user.status === 'disabled' }">
            <td><input type="checkbox" v-model="selectedUsers" :value="user.id" /></td>
            <td>
              <span class="user-name">{{ user.name || user.username }}</span>
              <span v-if="user.email" class="user-email">{{ user.email }}</span>
            </td>
            <td>
              <span class="type-tag" :class="user.type">
                {{ user.type === 'human' ? '👤 人类' : '🤖 机器人' }}
              </span>
            </td>
            <td>
              <span class="role-tag" :class="user.role">
                {{ getRoleName(user.role) }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="user.status || 'active'">
                {{ user.status === 'disabled' ? '🚫 禁用' : '✅ 正常' }}
              </span>
            </td>
            <td>{{ user.messageCount || 0 }}</td>
            <td>{{ formatTime(user.createdAt || user.firstSeen) }}</td>
            <td>{{ formatTime(user.lastLoginAt || user.lastSeen) }}</td>
            <td class="actions">
              <button class="btn-icon" @click="viewUser(user)" title="查看详情">👁️</button>
              <button class="btn-icon" @click="editRole(user)" title="修改角色">🔑</button>
              <button 
                class="btn-icon" 
                @click="toggleStatus(user)" 
                :title="user.status === 'disabled' ? '启用' : '禁用'"
              >
                {{ user.status === 'disabled' ? '✅' : '🚫' }}
              </button>
              <button class="btn-icon" @click="resetPassword(user)" title="重置密码">🔒</button>
              <button class="btn-icon danger" @click="confirmDelete(user)" title="删除">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- 分页 -->
      <div class="pagination">
        <button :disabled="currentPage === 1" @click="currentPage--; loadData()">上一页</button>
        <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button :disabled="currentPage === totalPages" @click="currentPage++; loadData()">下一页</button>
      </div>
    </div>

    <!-- 批量操作 -->
    <div v-if="selectedUsers.length > 0" class="bulk-actions">
      <span>已选 {{ selectedUsers.length }} 项</span>
      <button class="btn btn-warning" @click="bulkDisable">批量禁用</button>
      <button class="btn btn-danger" @click="bulkDelete">批量删除</button>
    </div>

    <!-- 用户详情对话框 -->
    <div v-if="showUserDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <h3>{{ dialogMode === 'view' ? '用户详情' : dialogMode === 'edit' ? '修改角色' : '添加用户' }}</h3>
        
        <div v-if="dialogMode === 'view'" class="user-detail">
          <p><strong>用户名:</strong> {{ currentUser.username || currentUser.name }}</p>
          <p><strong>邮箱:</strong> {{ currentUser.email || '-' }}</p>
          <p><strong>角色:</strong> {{ getRoleName(currentUser.role) }}</p>
          <p><strong>状态:</strong> {{ currentUser.status === 'disabled' ? '已禁用' : '正常' }}</p>
          <p><strong>注册时间:</strong> {{ formatTime(currentUser.createdAt) }}</p>
          <p><strong>最后登录:</strong> {{ formatTime(currentUser.lastLoginAt) }}</p>
          <p><strong>登录IP:</strong> {{ currentUser.lastLoginIp || '-' }}</p>
        </div>
        
        <div v-if="dialogMode === 'edit'" class="form-group">
          <label>选择角色:</label>
          <select v-model="editForm.role">
            <option value="user">普通用户</option>
            <option value="moderator">版主</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        
        <div v-if="dialogMode === 'add'" class="add-form">
          <div class="form-group">
            <label>用户名:</label>
            <input v-model="addForm.username" placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label>邮箱:</label>
            <input v-model="addForm.email" type="email" placeholder="请输入邮箱" />
          </div>
          <div class="form-group">
            <label>密码:</label>
            <input v-model="addForm.password" type="password" placeholder="请输入密码" />
          </div>
          <div class="form-group">
            <label>角色:</label>
            <select v-model="addForm.role">
              <option value="user">普通用户</option>
              <option value="moderator">版主</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button class="btn" @click="closeDialog">取消</button>
          <button v-if="dialogMode === 'edit'" class="btn btn-primary" @click="saveRole">保存</button>
          <button v-if="dialogMode === 'add'" class="btn btn-primary" @click="addUser">添加</button>
        </div>
      </div>
    </div>

    <!-- 确认删除对话框 -->
    <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="showDeleteConfirm = false">
      <div class="dialog confirm-dialog">
        <h3>⚠️ 确认删除</h3>
        <p>确定要删除用户 <strong>{{ userToDelete?.username || userToDelete?.name }}</strong> 吗？</p>
        <p class="warning-text">此操作不可撤销！</p>
        <div class="dialog-actions">
          <button class="btn" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="deleteUser">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

// 数据
const users = ref([])
const onlineUsers = ref([])
const selectedUsers = ref([])
const selectAll = ref(false)

// 筛选
const searchQuery = ref('')
const filterType = ref('')
const filterStatus = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value) || 1)

// 对话框
const showUserDialog = ref(false)
const showDeleteConfirm = ref(false)
const dialogMode = ref('view') // view, edit, add
const currentUser = ref({})
const userToDelete = ref(null)
const editForm = ref({ role: 'user' })
const addForm = ref({ username: '', email: '', password: '', role: 'user' })

// 方法
const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const getRoleName = (role) => {
  const roles = {
    admin: '👑 管理员',
    moderator: '🛡️ 版主',
    user: '👤 用户'
  }
  return roles[role] || '👤 用户'
}

const loadData = async () => {
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value,
      type: filterType.value,
      status: filterStatus.value
    }
    
    const [usersRes, onlineRes] = await Promise.all([
      api.getUsers(params),
      api.getOnlineUsers()
    ])
    
    users.value = usersRes.data.data || usersRes.data
    totalCount.value = usersRes.data.total || users.value.length
    onlineUsers.value = onlineRes.data.data || []
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedUsers.value = users.value.map(u => u.id).filter(Boolean)
  } else {
    selectedUsers.value = []
  }
}

const viewUser = (user) => {
  currentUser.value = user
  dialogMode.value = 'view'
  showUserDialog.value = true
}

const editRole = (user) => {
  currentUser.value = user
  editForm.value.role = user.role || 'user'
  dialogMode.value = 'edit'
  showUserDialog.value = true
}

const saveRole = async () => {
  try {
    await api.updateUserRole(currentUser.value.id, editForm.value.role)
    alert('角色修改成功！')
    closeDialog()
    loadData()
  } catch (error) {
    alert('修改失败: ' + (error.response?.data?.error || error.message))
  }
}

const toggleStatus = async (user) => {
  const newStatus = user.status === 'disabled' ? 'active' : 'disabled'
  const action = newStatus === 'disabled' ? '禁用' : '启用'
  
  if (!confirm(`确定要${action}用户 ${user.username || user.name} 吗？`)) return
  
  try {
    await api.updateUserStatus(user.id, newStatus)
    alert(`${action}成功！`)
    loadData()
  } catch (error) {
    alert(`${action}失败: ` + (error.response?.data?.error || error.message))
  }
}

const resetPassword = async (user) => {
  const newPassword = prompt('请输入新密码（至少6位）:')
  if (!newPassword || newPassword.length < 6) {
    alert('密码至少6位！')
    return
  }
  
  try {
    await api.adminResetPassword(user.id, newPassword)
    alert('密码重置成功！')
  } catch (error) {
    alert('重置失败: ' + (error.response?.data?.error || error.message))
  }
}

const confirmDelete = (user) => {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

const deleteUser = async () => {
  try {
    await api.deleteUser(userToDelete.value.id)
    alert('删除成功！')
    showDeleteConfirm.value = false
    userToDelete.value = null
    loadData()
  } catch (error) {
    alert('删除失败: ' + (error.response?.data?.error || error.message))
  }
}

const showAddUserDialog = () => {
  addForm.value = { username: '', email: '', password: '', role: 'user' }
  dialogMode.value = 'add'
  showUserDialog.value = true
}

const addUser = async () => {
  if (!addForm.value.username || !addForm.value.password) {
    alert('用户名和密码必填！')
    return
  }
  
  try {
    await api.adminCreateUser(addForm.value)
    alert('添加成功！')
    closeDialog()
    loadData()
  } catch (error) {
    alert('添加失败: ' + (error.response?.data?.error || error.message))
  }
}

const bulkDisable = async () => {
  if (!confirm(`确定要禁用选中的 ${selectedUsers.value.length} 个用户吗？`)) return
  
  try {
    await Promise.all(selectedUsers.value.map(id => api.updateUserStatus(id, 'disabled')))
    alert('批量禁用成功！')
    selectedUsers.value = []
    loadData()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

const bulkDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedUsers.value.length} 个用户吗？此操作不可撤销！`)) return
  
  try {
    await Promise.all(selectedUsers.value.map(id => api.deleteUser(id)))
    alert('批量删除成功！')
    selectedUsers.value = []
    loadData()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

const closeDialog = () => {
  showUserDialog.value = false
  currentUser.value = {}
}

onMounted(() => {
  loadData()
  setInterval(loadData, 30000)
})
</script>

<style scoped>
.users {
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 15px;
  font-size: 18px;
}

/* 搜索筛选栏 */
.filter-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.filter-select {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

/* 按钮 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #1976d2;
  color: white;
}

.btn-primary:hover {
  background: #1565c0;
}

.btn-warning {
  background: #ff9800;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f0f0f0;
}

.btn-icon.danger:hover {
  background: #ffebee;
}

/* 在线区域 */
.online-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.online-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.user-badge {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
}

.user-badge.online {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

/* 表格 */
.user-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f5f5f5;
  font-weight: 600;
  font-size: 14px;
}

tr.disabled {
  background: #fafafa;
  opacity: 0.7;
}

.user-name {
  font-weight: 500;
  display: block;
}

.user-email {
  font-size: 12px;
  color: #666;
}

.type-tag, .role-tag, .status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
  display: inline-block;
}

.type-tag.human { background: #e3f2fd; color: #1565c0; }
.type-tag.bot { background: #fce4ec; color: #c62828; }

.role-tag.admin { background: #fff3e0; color: #e65100; }
.role-tag.moderator { background: #e8f5e9; color: #2e7d32; }
.role-tag.user { background: #f5f5f5; color: #666; }

.status-badge.active { background: #e8f5e9; color: #2e7d32; }
.status-badge.disabled { background: #ffebee; color: #c62828; }

.actions {
  white-space: nowrap;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-top: 1px solid #eee;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 批量操作 */
.bulk-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 15px 25px;
  border-radius: 12px;
  display: flex;
  gap: 15px;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 16px;
  padding: 25px;
  min-width: 400px;
  max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.dialog h3 {
  margin-bottom: 20px;
}

.user-detail p {
  margin: 10px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.confirm-dialog {
  text-align: center;
}

.warning-text {
  color: #f44336;
  font-size: 14px;
}

.no-data {
  color: #999;
  font-style: italic;
}
</style>
