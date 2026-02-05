<template>
  <div class="dashboard">
    <h1>📊 控制面板</h1>
    
    <!-- 概览卡片 -->
    <div class="stats-cards">
      <div class="card">
        <div class="card-icon">💬</div>
        <div class="card-content">
          <div class="card-value">{{ overview.total || 0 }}</div>
          <div class="card-label">总消息数</div>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">📅</div>
        <div class="card-content">
          <div class="card-value">{{ overview.today || 0 }}</div>
          <div class="card-label">今日消息</div>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">👤</div>
        <div class="card-content">
          <div class="card-value">{{ overview.humanCount || 0 }}</div>
          <div class="card-label">人类消息</div>
        </div>
      </div>
      <div class="card">
        <div class="card-icon">🤖</div>
        <div class="card-content">
          <div class="card-value">{{ overview.botCount || 0 }}</div>
          <div class="card-label">机器人消息</div>
        </div>
      </div>
    </div>

    <!-- 在线用户 -->
    <div class="section">
      <h2>🟢 在线用户 ({{ onlineUsers.length }})</h2>
      <div class="online-users">
        <span v-for="user in onlineUsers" :key="user.name" class="user-tag online">
          {{ user.name }}
        </span>
        <span v-if="onlineUsers.length === 0" class="no-data">暂无在线用户</span>
      </div>
    </div>

    <!-- 最近消息 -->
    <div class="section">
      <h2>📝 最近消息</h2>
      <div class="message-list">
        <div v-for="msg in recentMessages" :key="msg.id" class="message-item">
          <span class="sender" :class="msg.type">{{ msg.sender }}</span>
          <span class="content">{{ msg.content.substring(0, 100) }}{{ msg.content.length > 100 ? '...' : '' }}</span>
          <span class="time">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <div v-if="recentMessages.length === 0" class="no-data">暂无消息</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const overview = ref({})
const onlineUsers = ref([])
const recentMessages = ref([])

const formatTime = (ts) => {
  return new Date(ts).toLocaleString('zh-CN')
}

const loadData = async () => {
  try {
    const [overviewRes, usersRes, messagesRes] = await Promise.all([
      api.getOverview(),
      api.getOnlineUsers(),
      api.getMessages({ page: 1, limit: 10 })
    ])
    overview.value = overviewRes.data.data
    onlineUsers.value = usersRes.data.data
    recentMessages.value = messagesRes.data.data
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

onMounted(() => {
  loadData()
  // 每 30 秒刷新一次
  setInterval(loadData, 30000)
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
  color: #333;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.card-icon {
  font-size: 40px;
  margin-right: 15px;
}

.card-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.card-label {
  color: #666;
  font-size: 14px;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.section h2 {
  margin-bottom: 15px;
  font-size: 18px;
  color: #333;
}

.online-users {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.user-tag {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 14px;
}

.user-tag.online {
  background: #e8f5e9;
  color: #2e7d32;
}

.message-list {
  max-height: 400px;
  overflow-y: auto;
}

.message-item {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.message-item:last-child {
  border-bottom: none;
}

.sender {
  min-width: 80px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 13px;
  margin-right: 10px;
}

.sender.human {
  background: #e3f2fd;
  color: #1565c0;
}

.sender.bot {
  background: #fce4ec;
  color: #c62828;
}

.content {
  flex: 1;
  color: #333;
  font-size: 14px;
}

.time {
  color: #999;
  font-size: 12px;
  margin-left: 10px;
}

.no-data {
  color: #999;
  font-style: italic;
}
</style>
