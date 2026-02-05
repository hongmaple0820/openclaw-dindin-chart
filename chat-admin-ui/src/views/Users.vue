<template>
  <div class="users">
    <h1>👥 用户管理</h1>
    
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
            <th>用户名</th>
            <th>类型</th>
            <th>状态</th>
            <th>消息数</th>
            <th>首次出现</th>
            <th>最后活跃</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.name">
            <td>
              <span class="user-name">{{ user.name }}</span>
            </td>
            <td>
              <span class="type-tag" :class="user.type">
                {{ user.type === 'human' ? '👤 人类' : '🤖 机器人' }}
              </span>
            </td>
            <td>
              <span class="status-dot" :class="{ online: user.online }"></span>
              {{ user.online ? '在线' : '离线' }}
            </td>
            <td>{{ user.messageCount }}</td>
            <td>{{ formatTime(user.firstSeen) }}</td>
            <td>{{ formatTime(user.lastSeen) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 同步状态 -->
    <div class="sync-section">
      <h2>🔄 同步状态</h2>
      <div class="sync-list">
        <div v-for="sync in syncStatus" :key="sync.participantId" class="sync-item">
          <span class="sync-name">{{ sync.participantId }}</span>
          <span class="sync-info">
            最后同步: {{ sync.lastSyncTime }}
            <span v-if="sync.unsyncedCount > 0" class="unsynced-badge">
              {{ sync.unsyncedCount }} 条未同步
            </span>
          </span>
        </div>
        <div v-if="syncStatus.length === 0" class="no-data">暂无同步记录</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const users = ref([])
const onlineUsers = ref([])
const syncStatus = ref([])

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const loadData = async () => {
  try {
    const [usersRes, onlineRes, syncRes] = await Promise.all([
      api.getUsers(),
      api.getOnlineUsers(),
      api.getSyncStatus()
    ])
    users.value = usersRes.data.data
    onlineUsers.value = onlineRes.data.data
    syncStatus.value = syncRes.data.data
  } catch (error) {
    console.error('加载数据失败:', error)
  }
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

.online-section, .sync-section {
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
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

.user-name {
  font-weight: 500;
}

.type-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.type-tag.human {
  background: #e3f2fd;
  color: #1565c0;
}

.type-tag.bot {
  background: #fce4ec;
  color: #c62828;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  margin-right: 6px;
}

.status-dot.online {
  background: #4caf50;
}

.sync-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sync-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f9f9f9;
  border-radius: 8px;
}

.sync-name {
  font-weight: 500;
}

.sync-info {
  color: #666;
  font-size: 14px;
}

.unsynced-badge {
  background: #fff3e0;
  color: #e65100;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  margin-left: 10px;
}

.no-data {
  color: #999;
  font-style: italic;
}
</style>
