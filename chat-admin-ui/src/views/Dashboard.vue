<template>
  <div class="dashboard">
    <div class="header">
      <h1>📊 数据仪表盘</h1>
      <div class="header-actions">
        <select v-model="timeRange" @change="loadData">
          <option value="24h">最近24小时</option>
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
        </select>
        <button @click="loadData" class="btn-refresh">🔄 刷新</button>
      </div>
    </div>
    
    <!-- 概览卡片 -->
    <div class="stats-cards">
      <div class="card card-total">
        <div class="card-icon">💬</div>
        <div class="card-content">
          <div class="card-value">{{ animatedTotal }}</div>
          <div class="card-label">总消息数</div>
          <div class="card-trend" :class="{ up: trends.total > 0 }">
            {{ trends.total > 0 ? '↑' : trends.total < 0 ? '↓' : '→' }} {{ Math.abs(trends.total) }}%
          </div>
        </div>
      </div>
      <div class="card card-today">
        <div class="card-icon">📅</div>
        <div class="card-content">
          <div class="card-value">{{ overview.today || 0 }}</div>
          <div class="card-label">今日消息</div>
          <div class="card-sub">本周: {{ overview.week || 0 }}</div>
        </div>
      </div>
      <div class="card card-human">
        <div class="card-icon">👤</div>
        <div class="card-content">
          <div class="card-value">{{ overview.humanCount || 0 }}</div>
          <div class="card-label">人类消息</div>
          <div class="card-percent">{{ overview.humanRatio || 0 }}%</div>
        </div>
      </div>
      <div class="card card-bot">
        <div class="card-icon">🤖</div>
        <div class="card-content">
          <div class="card-value">{{ overview.botCount || 0 }}</div>
          <div class="card-label">机器人消息</div>
          <div class="card-percent">{{ overview.botRatio || 0 }}%</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- 消息趋势图 -->
      <div class="section chart-section">
        <h2>📈 消息趋势</h2>
        <div class="chart-container">
          <div class="chart-bars">
            <div 
              v-for="(item, index) in timeStats" 
              :key="index" 
              class="chart-bar-wrapper"
              :title="`${item.time}: ${item.count} 条`"
            >
              <div 
                class="chart-bar" 
                :style="{ height: getBarHeight(item.count) + '%' }"
              ></div>
              <span class="chart-label">{{ formatChartLabel(item.time) }}</span>
            </div>
          </div>
          <div class="chart-legend">
            <span>最高: {{ maxCount }} 条</span>
            <span>平均: {{ avgCount }} 条</span>
          </div>
        </div>
      </div>

      <!-- 发送者排行 -->
      <div class="section rank-section">
        <h2>🏆 活跃排行</h2>
        <div class="rank-list">
          <div v-for="(sender, index) in topSenders" :key="sender.sender" class="rank-item">
            <span class="rank-number" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
            <span class="rank-avatar">{{ sender.type === 'human' ? '👤' : '🤖' }}</span>
            <span class="rank-name">{{ sender.sender }}</span>
            <div class="rank-bar-wrapper">
              <div class="rank-bar" :style="{ width: getSenderBarWidth(sender.count) + '%' }"></div>
            </div>
            <span class="rank-count">{{ sender.count }}</span>
          </div>
          <div v-if="topSenders.length === 0" class="no-data">暂无数据</div>
        </div>
      </div>

      <!-- 来源分布 -->
      <div class="section source-section">
        <h2>📊 来源分布</h2>
        <div class="source-chart">
          <div class="pie-chart">
            <svg viewBox="0 0 100 100">
              <circle 
                v-for="(slice, index) in sourceSlices" 
                :key="index"
                cx="50" cy="50" r="40"
                fill="transparent"
                :stroke="slice.color"
                stroke-width="20"
                :stroke-dasharray="slice.dashArray"
                :stroke-dashoffset="slice.offset"
                :transform="`rotate(-90 50 50)`"
              />
            </svg>
          </div>
          <div class="source-legend">
            <div v-for="source in sourceStats" :key="source.source" class="legend-item">
              <span class="legend-color" :style="{ background: getSourceColor(source.source) }"></span>
              <span class="legend-label">{{ source.source || '未知' }}</span>
              <span class="legend-value">{{ source.count }} ({{ source.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 在线用户 -->
      <div class="section online-section">
        <h2>🟢 在线用户 ({{ onlineUsers.length }})</h2>
        <div class="online-users">
          <div v-for="user in onlineUsers" :key="user.name" class="online-user">
            <span class="online-dot"></span>
            <span class="online-name">{{ user.name }}</span>
            <span class="online-time">{{ relativeTime(user.lastSeen) }}</span>
          </div>
          <div v-if="onlineUsers.length === 0" class="no-data">
            <span class="offline-icon">😴</span>
            <p>暂无在线用户</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近消息 -->
    <div class="section recent-section">
      <div class="section-header">
        <h2>📝 最近消息</h2>
        <router-link to="/messages" class="view-all">查看全部 →</router-link>
      </div>
      <div class="message-list">
        <div v-for="msg in recentMessages" :key="msg.id" class="message-item">
          <div class="message-avatar" :class="msg.type">
            {{ msg.type === 'human' ? '👤' : '🤖' }}
          </div>
          <div class="message-body">
            <div class="message-header">
              <span class="message-sender">{{ msg.sender }}</span>
              <span class="message-time">{{ relativeTime(msg.timestamp) }}</span>
            </div>
            <p class="message-content">{{ msg.content.substring(0, 120) }}{{ msg.content.length > 120 ? '...' : '' }}</p>
          </div>
        </div>
        <div v-if="recentMessages.length === 0" class="no-data">暂无消息</div>
      </div>
    </div>

    <!-- 实时状态 -->
    <div class="status-bar">
      <span class="status-item">
        <span class="status-dot" :class="{ active: isConnected }"></span>
        {{ isConnected ? '实时更新中' : '已断开' }}
      </span>
      <span class="status-item">最后更新: {{ lastUpdate }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../api'

const overview = ref({})
const onlineUsers = ref([])
const recentMessages = ref([])
const timeStats = ref([])
const senderStats = ref([])
const sourceStats = ref([])
const timeRange = ref('7d')
const isConnected = ref(true)
const lastUpdate = ref('')
const animatedTotal = ref(0)

const trends = ref({ total: 5 }) // 模拟趋势

// 计算属性
const topSenders = computed(() => senderStats.value.slice(0, 8))
const maxCount = computed(() => Math.max(...timeStats.value.map(t => t.count), 1))
const avgCount = computed(() => {
  if (timeStats.value.length === 0) return 0
  return Math.round(timeStats.value.reduce((sum, t) => sum + t.count, 0) / timeStats.value.length)
})

const sourceSlices = computed(() => {
  const total = sourceStats.value.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return []
  
  let offset = 0
  return sourceStats.value.map((source, index) => {
    const percent = (source.count / total) * 100
    const circumference = 2 * Math.PI * 40
    const dashArray = `${(percent / 100) * circumference} ${circumference}`
    const slice = {
      color: getSourceColor(source.source),
      dashArray,
      offset: -offset * circumference / 100
    }
    offset += percent
    return slice
  })
})

// 方法
const formatTime = (ts) => new Date(ts).toLocaleString('zh-CN')

const relativeTime = (ts) => {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

const formatChartLabel = (time) => {
  if (!time) return ''
  if (time.includes(' ')) return time.split(' ')[1] // 小时格式
  return time.split('-').slice(1).join('/') // 日期格式
}

const getBarHeight = (count) => {
  if (maxCount.value === 0) return 0
  return Math.max(5, (count / maxCount.value) * 100)
}

const getSenderBarWidth = (count) => {
  const max = topSenders.value[0]?.count || 1
  return (count / max) * 100
}

const getSourceColor = (source) => {
  const colors = {
    dingtalk: '#1976d2',
    redis: '#e91e63',
    bot: '#ff9800',
    web: '#4caf50',
    test: '#9c27b0'
  }
  return colors[source] || '#9e9e9e'
}

const animateNumber = (target) => {
  const start = animatedTotal.value
  const diff = target - start
  const duration = 1000
  const startTime = Date.now()
  
  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    animatedTotal.value = Math.floor(start + diff * progress)
    if (progress < 1) requestAnimationFrame(animate)
  }
  animate()
}

const loadData = async () => {
  try {
    const days = timeRange.value === '24h' ? 1 : timeRange.value === '7d' ? 7 : 30
    const interval = timeRange.value === '24h' ? 'hour' : 'day'
    
    const [overviewRes, usersRes, messagesRes, timeRes, senderRes, sourceRes] = await Promise.all([
      api.getOverview(),
      api.getOnlineUsers(),
      api.getMessages({ page: 1, limit: 8 }),
      api.getStatsByTime({ interval, days }),
      api.getStatsBySender(),
      api.getStatsBySource()
    ])
    
    overview.value = overviewRes.data.data
    onlineUsers.value = usersRes.data.data
    recentMessages.value = messagesRes.data.data
    timeStats.value = timeRes.data.data
    senderStats.value = senderRes.data.data
    
    // 处理来源统计
    const total = sourceRes.data.data.reduce((sum, s) => sum + s.count, 0)
    sourceStats.value = sourceRes.data.data.map(s => ({
      ...s,
      percent: total > 0 ? Math.round((s.count / total) * 100) : 0
    }))
    
    lastUpdate.value = new Date().toLocaleTimeString('zh-CN')
    animateNumber(overview.value.total || 0)
  } catch (error) {
    console.error('加载数据失败:', error)
    isConnected.value = false
  }
}

let refreshInterval = null

onMounted(() => {
  loadData()
  refreshInterval = setInterval(loadData, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.dashboard { padding: 20px; max-width: 1400px; margin: 0 auto; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.header h1 { margin: 0; }

.header-actions {
  display: flex;
  gap: 10px;
}

.header-actions select {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.btn-refresh {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.btn-refresh:hover { background: #f5f5f5; }

/* 概览卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}

.card-total { border-left: 4px solid #1976d2; }
.card-today { border-left: 4px solid #4caf50; }
.card-human { border-left: 4px solid #ff9800; }
.card-bot { border-left: 4px solid #e91e63; }

.card-icon { font-size: 42px; margin-right: 18px; }

.card-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.card-label { color: #666; font-size: 14px; margin-top: 5px; }
.card-sub { color: #999; font-size: 12px; margin-top: 3px; }
.card-percent { color: #1976d2; font-size: 14px; font-weight: 500; margin-top: 3px; }

.card-trend {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
}

.card-trend.up { color: #4caf50; }

/* 网格布局 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 1000px) {
  .dashboard-grid { grid-template-columns: 1fr; }
}

.section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.section h2 {
  margin: 0 0 18px 0;
  font-size: 16px;
  color: #333;
}

/* 图表 */
.chart-section { grid-column: 1 / -1; }

.chart-container { padding: 10px 0; }

.chart-bars {
  display: flex;
  align-items: flex-end;
  height: 180px;
  gap: 8px;
  padding: 0 10px;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.chart-bar {
  width: 100%;
  max-width: 40px;
  background: linear-gradient(180deg, #1976d2 0%, #64b5f6 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
}

.chart-label {
  font-size: 11px;
  color: #999;
  margin-top: 8px;
  white-space: nowrap;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-top: 15px;
  font-size: 13px;
  color: #666;
}

/* 排行榜 */
.rank-list { display: flex; flex-direction: column; gap: 12px; }

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rank-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  background: #f0f0f0;
  color: #666;
}

.rank-1 { background: #ffd700; color: #333; }
.rank-2 { background: #c0c0c0; color: #333; }
.rank-3 { background: #cd7f32; color: white; }

.rank-avatar { font-size: 18px; }
.rank-name { width: 80px; font-size: 14px; color: #333; }

.rank-bar-wrapper {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  background: linear-gradient(90deg, #1976d2, #64b5f6);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.rank-count {
  width: 40px;
  text-align: right;
  font-size: 13px;
  color: #666;
}

/* 来源分布 */
.source-chart {
  display: flex;
  gap: 20px;
  align-items: center;
}

.pie-chart {
  width: 120px;
  height: 120px;
}

.source-legend { flex: 1; }

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-label { flex: 1; font-size: 13px; }
.legend-value { font-size: 12px; color: #666; }

/* 在线用户 */
.online-users {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.online-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.online-dot {
  width: 8px;
  height: 8px;
  background: #4caf50;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.online-name { flex: 1; font-size: 14px; }
.online-time { font-size: 12px; color: #999; }

.offline-icon { font-size: 32px; }

/* 最近消息 */
.recent-section { margin-bottom: 60px; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h2 { margin: 0; }

.view-all {
  font-size: 13px;
  color: #1976d2;
  text-decoration: none;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 10px;
  transition: background 0.2s;
}

.message-item:hover { background: #f0f0f0; }

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.message-avatar.human { background: #e3f2fd; }
.message-avatar.bot { background: #fce4ec; }

.message-body { flex: 1; min-width: 0; }

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.message-sender { font-weight: 500; font-size: 14px; }
.message-time { font-size: 12px; color: #999; }

.message-content {
  margin: 0;
  font-size: 14px;
  color: #555;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态栏 */
.status-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #333;
  color: white;
  padding: 10px 20px;
  display: flex;
  justify-content: center;
  gap: 30px;
  font-size: 13px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f44336;
}

.status-dot.active {
  background: #4caf50;
  animation: pulse 2s infinite;
}

.no-data {
  text-align: center;
  color: #999;
  padding: 20px;
}
</style>
