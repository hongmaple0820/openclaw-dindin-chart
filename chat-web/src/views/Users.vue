<template>
  <div class="users-page">
    <h1>👥 用户管理</h1>

    <!-- 待审核用户 -->
    <div class="section pending-section" v-if="pendingUsers.length > 0">
      <h2>
        ⏳ 待审核 
        <span class="badge">{{ pendingUsers.length }}</span>
      </h2>
      <div class="card-list">
        <div v-for="user in pendingUsers" :key="user.id" class="user-card pending">
          <div class="user-info">
            <span class="avatar">{{ (user.nickname || user.username)?.[0] }}</span>
            <div class="details">
              <div class="name">{{ user.nickname || user.username }}</div>
              <div class="meta">
                @{{ user.username }} · 
                {{ user.type === 'bot' ? '🤖 机器人' : '👤 用户' }} · 
                {{ formatTime(user.created_at) }}
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-success" @click="approveUser(user)">
              ✅ 通过
            </button>
            <button class="btn btn-danger" @click="showRejectDialog(user)">
              ❌ 拒绝
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <select v-model="filterStatus" @change="loadUsers">
        <option value="">全部状态</option>
        <option value="approved">✅ 已通过</option>
        <option value="pending">⏳ 待审核</option>
        <option value="rejected">❌ 已拒绝</option>
        <option value="banned">🚫 已封禁</option>
      </select>
      <select v-model="filterType" @change="loadUsers">
        <option value="">全部类型</option>
        <option value="human">👤 人类</option>
        <option value="bot">🤖 机器人</option>
      </select>
      <button class="btn btn-secondary" @click="loadUsers">🔄 刷新</button>
    </div>

    <!-- 用户列表 -->
    <div class="section">
      <h2>用户列表 ({{ pagination.total }})</h2>
      <table class="user-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>类型</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" :class="user.status">
            <td>
              <div class="user-cell">
                <span class="avatar small">{{ (user.nickname || user.username)?.[0] }}</span>
                <div>
                  <div class="name">{{ user.nickname || user.username }}</div>
                  <div class="username">@{{ user.username }}</div>
                </div>
              </div>
            </td>
            <td>{{ user.type === 'bot' ? '🤖' : '👤' }}</td>
            <td>
              <span class="status-badge" :class="user.status">
                {{ getStatusText(user.status) }}
              </span>
            </td>
            <td>{{ formatTime(user.created_at) }}</td>
            <td class="actions">
              <button v-if="user.status === 'pending'" class="btn-sm btn-success" @click="approveUser(user)">通过</button>
              <button v-if="user.status === 'pending'" class="btn-sm btn-danger" @click="showRejectDialog(user)">拒绝</button>
              <button v-if="user.status === 'approved'" class="btn-sm btn-warning" @click="banUser(user)">封禁</button>
              <button v-if="user.status === 'banned'" class="btn-sm btn-success" @click="unbanUser(user)">解封</button>
              <button v-if="user.status === 'rejected'" class="btn-sm btn-success" @click="approveUser(user)">重新通过</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div class="pagination" v-if="pagination.totalPages > 1">
        <button :disabled="pagination.page <= 1" @click="pagination.page--; loadUsers()">上一页</button>
        <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
        <button :disabled="pagination.page >= pagination.totalPages" @click="pagination.page++; loadUsers()">下一页</button>
      </div>
    </div>

    <!-- 拒绝原因弹窗 -->
    <div class="modal" v-if="rejectDialogVisible" @click.self="rejectDialogVisible = false">
      <div class="modal-content">
        <h3>拒绝用户</h3>
        <p>确定拒绝用户 <strong>{{ rejectingUser?.username }}</strong> 吗？</p>
        <textarea v-model="rejectReason" placeholder="拒绝原因（可选）"></textarea>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="rejectDialogVisible = false">取消</button>
          <button class="btn btn-danger" @click="confirmReject">确定拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const ADMIN_TOKEN = localStorage.getItem('admin_token') || 'admin123';
const API_BASE = '';

export default {
  name: 'Users',
  data() {
    return {
      users: [],
      pendingUsers: [],
      filterStatus: '',
      filterType: '',
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      rejectDialogVisible: false,
      rejectingUser: null,
      rejectReason: ''
    };
  },
  mounted() {
    this.loadPendingUsers();
    this.loadUsers();
  },
  methods: {
    async loadPendingUsers() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/pending`, {
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
          this.pendingUsers = data.data || [];
        }
      } catch (e) {
        console.error('加载待审核用户失败:', e);
      }
    },
    async loadUsers() {
      try {
        const params = new URLSearchParams({
          page: this.pagination.page,
          limit: this.pagination.limit
        });
        if (this.filterStatus) params.append('status', this.filterStatus);
        if (this.filterType) params.append('type', this.filterType);

        const res = await fetch(`${API_BASE}/api/admin/users?${params}`, {
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
          this.users = data.users || [];
          this.pagination = data.pagination || this.pagination;
        }
      } catch (e) {
        console.error('加载用户列表失败:', e);
      }
    },
    async approveUser(user) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/approve`, {
          method: 'POST',
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ 已通过');
          this.loadPendingUsers();
          this.loadUsers();
        } else {
          alert('操作失败: ' + data.error);
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    },
    showRejectDialog(user) {
      this.rejectingUser = user;
      this.rejectReason = '';
      this.rejectDialogVisible = true;
    },
    async confirmReject() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${this.rejectingUser.id}/reject`, {
          method: 'POST',
          headers: { 
            'x-admin-token': ADMIN_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: this.rejectReason })
        });
        const data = await res.json();
        if (data.success) {
          alert('❌ 已拒绝');
          this.rejectDialogVisible = false;
          this.loadPendingUsers();
          this.loadUsers();
        } else {
          alert('操作失败: ' + data.error);
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    },
    async banUser(user) {
      if (!confirm(`确定封禁用户 ${user.username} 吗？`)) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/ban`, {
          method: 'POST',
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
          alert('🚫 已封禁');
          this.loadUsers();
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    },
    async unbanUser(user) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/unban`, {
          method: 'POST',
          headers: { 'x-admin-token': ADMIN_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ 已解封');
          this.loadUsers();
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    },
    getStatusText(status) {
      const map = {
        pending: '⏳ 待审核',
        approved: '✅ 已通过',
        rejected: '❌ 已拒绝',
        banned: '🚫 已封禁'
      };
      return map[status] || status;
    },
    formatTime(ts) {
      if (!ts) return '-';
      return new Date(ts).toLocaleString('zh-CN');
    }
  }
};
</script>

<style scoped>
.users-page {
  padding: 20px;
}

h1 { margin-bottom: 20px; }
h2 { margin: 20px 0 10px; }

.badge {
  background: #ff4d4f;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 14px;
  margin-left: 8px;
}

.section { margin-bottom: 30px; }

.pending-section {
  background: #fff7e6;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ffd591;
}

.card-list { display: flex; flex-direction: column; gap: 10px; }

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.user-info { display: flex; align-items: center; gap: 12px; }

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1890ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.avatar.small { width: 32px; height: 32px; font-size: 14px; }

.details .name { font-weight: 500; }
.details .meta { font-size: 12px; color: #666; }

.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.filter-bar select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.user-table th, .user-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.user-table th { background: #fafafa; font-weight: 500; }

.user-cell { display: flex; align-items: center; gap: 10px; }
.user-cell .name { font-weight: 500; }
.user-cell .username { font-size: 12px; color: #999; }

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status-badge.approved { background: #e6fffb; color: #13c2c2; }
.status-badge.pending { background: #fff7e6; color: #fa8c16; }
.status-badge.rejected { background: #fff1f0; color: #ff4d4f; }
.status-badge.banned { background: #f5f5f5; color: #999; }

.actions { display: flex; gap: 5px; }

.btn, .btn-sm {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-success { background: #52c41a; color: white; }
.btn-danger { background: #ff4d4f; color: white; }
.btn-warning { background: #faad14; color: white; }
.btn-secondary { background: #f0f0f0; color: #333; }
.btn-primary { background: #1890ff; color: white; }

.pagination {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  align-items: center;
}

.pagination button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
}

.modal-content textarea {
  width: 100%;
  height: 80px;
  margin: 10px 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

tr.pending { background: #fffbe6; }
tr.rejected { background: #fff1f0; }
tr.banned { background: #f5f5f5; opacity: 0.7; }
</style>
