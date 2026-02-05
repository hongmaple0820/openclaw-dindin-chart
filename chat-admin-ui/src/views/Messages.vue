<template>
  <div class="messages">
    <h1>💬 消息管理</h1>
    
    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input 
          v-model="filters.keyword" 
          placeholder="搜索消息内容..." 
          @input="debouncedSearch"
          @keyup.enter="loadMessages"
          class="search-input"
        />
        <button v-if="filters.keyword" @click="clearSearch" class="clear-btn">✕</button>
      </div>
      <button @click="showAdvanced = !showAdvanced" class="btn-outline">
        {{ showAdvanced ? '收起' : '高级搜索' }} ⚙️
      </button>
    </div>

    <!-- 高级搜索 -->
    <div v-if="showAdvanced" class="advanced-filters">
      <div class="filter-group">
        <label>发送者</label>
        <select v-model="filters.sender" @change="loadMessages">
          <option value="">全部</option>
          <option v-for="s in senders" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>类型</label>
        <select v-model="filters.type" @change="loadMessages">
          <option value="">全部</option>
          <option value="human">👤 人类</option>
          <option value="bot">🤖 机器人</option>
        </select>
      </div>
      <div class="filter-group">
        <label>来源</label>
        <select v-model="filters.source" @change="loadMessages">
          <option value="">全部</option>
          <option value="dingtalk">钉钉</option>
          <option value="web">Web</option>
          <option value="bot">机器人</option>
          <option value="redis">Redis</option>
        </select>
      </div>
      <div class="filter-group">
        <label>时间范围</label>
        <select v-model="filters.timeRange" @change="applyTimeRange">
          <option value="">全部时间</option>
          <option value="1h">最近1小时</option>
          <option value="24h">最近24小时</option>
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div v-if="filters.timeRange === 'custom'" class="filter-group date-range">
        <input type="datetime-local" v-model="filters.startDate" @change="loadMessages" />
        <span>至</span>
        <input type="datetime-local" v-model="filters.endDate" @change="loadMessages" />
      </div>
      <button @click="resetFilters" class="btn-text">重置筛选</button>
    </div>

    <!-- 搜索结果统计 -->
    <div class="search-stats" v-if="filters.keyword || filters.sender || filters.source">
      <span class="result-count">找到 <strong>{{ pagination.total }}</strong> 条结果</span>
      <div class="active-filters">
        <span v-if="filters.keyword" class="filter-tag">
          关键词: {{ filters.keyword }} <button @click="filters.keyword = ''; loadMessages()">✕</button>
        </span>
        <span v-if="filters.sender" class="filter-tag">
          发送者: {{ filters.sender }} <button @click="filters.sender = ''; loadMessages()">✕</button>
        </span>
        <span v-if="filters.source" class="filter-tag">
          来源: {{ filters.source }} <button @click="filters.source = ''; loadMessages()">✕</button>
        </span>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="action-bar" v-if="selected.length > 0">
      <span>已选 {{ selected.length }} 条</span>
      <button @click="exportSelected" class="btn-small">📥 导出</button>
      <button @click="deleteSelected" class="btn-small danger">🗑️ 删除</button>
    </div>

    <!-- 消息列表 -->
    <div class="message-list">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="messages.length === 0" class="empty">
        <span class="empty-icon">📭</span>
        <p>没有找到消息</p>
      </div>
      <div v-else>
        <div class="message-header">
          <label class="checkbox-wrapper">
            <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
            全选
          </label>
          <span class="header-item">发送者</span>
          <span class="header-item content-header">内容</span>
          <span class="header-item">来源</span>
          <span class="header-item">时间</span>
          <span class="header-item">操作</span>
        </div>
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          class="message-row"
          :class="{ selected: selected.includes(msg.id) }"
        >
          <label class="checkbox-wrapper">
            <input type="checkbox" :value="msg.id" v-model="selected" />
          </label>
          <div class="sender-cell">
            <span class="sender-tag" :class="msg.type">
              {{ msg.type === 'human' ? '👤' : '🤖' }} {{ msg.sender }}
            </span>
          </div>
          <div class="content-cell" @click="showDetail(msg)">
            <p class="content-text" v-html="highlightKeyword(msg.content)"></p>
            <span v-if="msg.atTargets && msg.atTargets.length" class="at-tags">
              <span v-for="at in msg.atTargets" :key="at" class="at-tag">@{{ at }}</span>
            </span>
          </div>
          <div class="source-cell">
            <span class="source-tag" :class="msg.source">{{ msg.source || '-' }}</span>
          </div>
          <div class="time-cell">
            <span class="time-text">{{ formatTime(msg.timestamp) }}</span>
            <span class="time-relative">{{ relativeTime(msg.timestamp) }}</span>
          </div>
          <div class="action-cell">
            <button @click="copyMessage(msg)" class="btn-icon" title="复制">📋</button>
            <button @click="deleteMessage(msg.id)" class="btn-icon danger" title="删除">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.totalPages > 1">
      <button @click="goToPage(1)" :disabled="pagination.page <= 1">首页</button>
      <button @click="prevPage" :disabled="pagination.page <= 1">上一页</button>
      <div class="page-numbers">
        <button 
          v-for="p in visiblePages" 
          :key="p" 
          @click="goToPage(p)"
          :class="{ active: p === pagination.page }"
        >
          {{ p }}
        </button>
      </div>
      <button @click="nextPage" :disabled="pagination.page >= pagination.totalPages">下一页</button>
      <button @click="goToPage(pagination.totalPages)" :disabled="pagination.page >= pagination.totalPages">末页</button>
      <span class="page-info">共 {{ pagination.total }} 条</span>
    </div>

    <!-- 消息详情弹窗 -->
    <div v-if="detailMessage" class="modal-overlay" @click.self="detailMessage = null">
      <div class="modal">
        <div class="modal-header">
          <h3>消息详情</h3>
          <button @click="detailMessage = null" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <label>发送者:</label>
            <span class="sender-tag" :class="detailMessage.type">
              {{ detailMessage.type === 'human' ? '👤' : '🤖' }} {{ detailMessage.sender }}
            </span>
          </div>
          <div class="detail-row">
            <label>时间:</label>
            <span>{{ formatTime(detailMessage.timestamp) }}</span>
          </div>
          <div class="detail-row">
            <label>来源:</label>
            <span class="source-tag">{{ detailMessage.source }}</span>
          </div>
          <div v-if="detailMessage.atTargets?.length" class="detail-row">
            <label>@提及:</label>
            <span v-for="at in detailMessage.atTargets" :key="at" class="at-tag">@{{ at }}</span>
          </div>
          <div class="detail-row content-row">
            <label>内容:</label>
            <div class="detail-content">{{ detailMessage.content }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="copyMessage(detailMessage)" class="btn">📋 复制</button>
          <button @click="detailMessage = null" class="btn-outline">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const messages = ref([])
const senders = ref([])
const selected = ref([])
const selectAll = ref(false)
const showAdvanced = ref(false)
const loading = ref(false)
const detailMessage = ref(null)

const filters = ref({
  keyword: '',
  sender: '',
  source: '',
  type: '',
  timeRange: '',
  startDate: '',
  endDate: ''
})

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

// 可见页码
const visiblePages = computed(() => {
  const total = pagination.value.totalPages
  const current = pagination.value.page
  const pages = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1
    loadMessages()
  }, 300)
}

const formatTime = (ts) => {
  return new Date(ts).toLocaleString('zh-CN')
}

const relativeTime = (ts) => {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return ''
}

const highlightKeyword = (content) => {
  if (!filters.value.keyword) return content.substring(0, 100) + (content.length > 100 ? '...' : '')
  const regex = new RegExp(`(${filters.value.keyword})`, 'gi')
  const highlighted = content.replace(regex, '<mark>$1</mark>')
  if (highlighted.length > 150) {
    const index = highlighted.toLowerCase().indexOf(filters.value.keyword.toLowerCase())
    const start = Math.max(0, index - 50)
    const end = Math.min(highlighted.length, index + 100)
    return (start > 0 ? '...' : '') + highlighted.substring(start, end) + (end < highlighted.length ? '...' : '')
  }
  return highlighted
}

const applyTimeRange = () => {
  const now = Date.now()
  switch (filters.value.timeRange) {
    case '1h':
      filters.value.startDate = new Date(now - 3600000).toISOString().slice(0, 16)
      break
    case '24h':
      filters.value.startDate = new Date(now - 86400000).toISOString().slice(0, 16)
      break
    case '7d':
      filters.value.startDate = new Date(now - 7 * 86400000).toISOString().slice(0, 16)
      break
    case '30d':
      filters.value.startDate = new Date(now - 30 * 86400000).toISOString().slice(0, 16)
      break
    case 'custom':
      return
    default:
      filters.value.startDate = ''
      filters.value.endDate = ''
  }
  filters.value.endDate = ''
  loadMessages()
}

const resetFilters = () => {
  filters.value = { keyword: '', sender: '', source: '', type: '', timeRange: '', startDate: '', endDate: '' }
  loadMessages()
}

const clearSearch = () => {
  filters.value.keyword = ''
  loadMessages()
}

const loadMessages = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      keyword: filters.value.keyword,
      sender: filters.value.sender,
      source: filters.value.source
    }
    if (filters.value.startDate) {
      params.startTime = new Date(filters.value.startDate).getTime()
    }
    if (filters.value.endDate) {
      params.endTime = new Date(filters.value.endDate).getTime()
    }
    const res = await api.getMessages(params)
    messages.value = res.data.data
    pagination.value = { ...pagination.value, ...res.data.pagination }
    selected.value = []
    selectAll.value = false
  } catch (error) {
    console.error('加载消息失败:', error)
  } finally {
    loading.value = false
  }
}

const loadSenders = async () => {
  try {
    const res = await api.getStatsBySender()
    senders.value = res.data.data.map(s => s.sender)
  } catch (error) {
    console.error('加载发送者列表失败:', error)
  }
}

const toggleSelectAll = () => {
  selected.value = selectAll.value ? messages.value.map(m => m.id) : []
}

const showDetail = (msg) => {
  detailMessage.value = msg
}

const copyMessage = async (msg) => {
  try {
    await navigator.clipboard.writeText(msg.content)
    alert('已复制到剪贴板')
  } catch {
    alert('复制失败')
  }
}

const deleteMessage = async (id) => {
  if (!confirm('确定删除这条消息吗？')) return
  try {
    await api.deleteMessage(id)
    loadMessages()
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

const deleteSelected = async () => {
  if (!confirm(`确定删除选中的 ${selected.value.length} 条消息吗？`)) return
  try {
    await api.batchDeleteMessages(selected.value)
    loadMessages()
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

const exportSelected = () => {
  const data = messages.value
    .filter(m => selected.value.includes(m.id))
    .map(m => `[${formatTime(m.timestamp)}] ${m.sender}: ${m.content}`)
    .join('\n')
  const blob = new Blob([data], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `messages-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const prevPage = () => {
  if (pagination.value.page > 1) {
    pagination.value.page--
    loadMessages()
  }
}

const nextPage = () => {
  if (pagination.value.page < pagination.value.totalPages) {
    pagination.value.page++
    loadMessages()
  }
}

const goToPage = (p) => {
  pagination.value.page = p
  loadMessages()
}

onMounted(() => {
  loadMessages()
  loadSenders()
})
</script>

<style scoped>
.messages { padding: 20px; }
h1 { margin-bottom: 20px; }

/* 搜索栏 */
.search-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 40px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #1976d2;
  outline: none;
}

.clear-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
}

/* 按钮 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  background: #1976d2;
  color: white;
}

.btn-outline {
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.btn-text {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 14px;
}

.btn-small {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  background: #f5f5f5;
}

.btn-small.danger { background: #ffebee; color: #c62828; }

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
}

.btn-icon:hover { background: #f0f0f0; }
.btn-icon.danger:hover { background: #ffebee; }

/* 高级搜索 */
.advanced-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 10px;
  margin-bottom: 15px;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-size: 12px;
  color: #666;
}

.filter-group select, .filter-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.date-range {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

/* 搜索结果统计 */
.search-stats {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding: 10px 15px;
  background: #e3f2fd;
  border-radius: 8px;
}

.result-count { font-size: 14px; }
.active-filters { display: flex; gap: 8px; flex-wrap: wrap; }

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: white;
  border-radius: 20px;
  font-size: 13px;
}

.filter-tag button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #999;
}

/* 批量操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 15px;
  background: #fff3e0;
  border-radius: 8px;
  margin-bottom: 15px;
}

/* 消息列表 */
.message-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.loading, .empty {
  padding: 60px;
  text-align: center;
  color: #999;
}

.empty-icon { font-size: 48px; }

.message-header {
  display: grid;
  grid-template-columns: 40px 120px 1fr 80px 120px 80px;
  gap: 10px;
  padding: 12px 15px;
  background: #f5f5f5;
  font-weight: 600;
  font-size: 13px;
}

.message-row {
  display: grid;
  grid-template-columns: 40px 120px 1fr 80px 120px 80px;
  gap: 10px;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
}

.message-row:hover { background: #fafafa; }
.message-row.selected { background: #e3f2fd; }

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
}

.sender-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
}

.sender-tag.human { background: #e3f2fd; color: #1565c0; }
.sender-tag.bot { background: #fce4ec; color: #c62828; }

.content-cell {
  cursor: pointer;
  overflow: hidden;
}

.content-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.content-text :deep(mark) {
  background: #fff59d;
  padding: 0 2px;
  border-radius: 2px;
}

.at-tags { margin-top: 5px; }
.at-tag {
  display: inline-block;
  padding: 2px 6px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 4px;
  font-size: 11px;
  margin-right: 5px;
}

.source-tag {
  display: inline-block;
  padding: 3px 8px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}

.source-tag.dingtalk { background: #e3f2fd; color: #1976d2; }
.source-tag.redis { background: #fce4ec; color: #c62828; }
.source-tag.bot { background: #fff3e0; color: #e65100; }

.time-cell {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.time-text { color: #333; }
.time-relative { color: #999; }

.action-cell {
  display: flex;
  gap: 5px;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.pagination button {
  padding: 8px 14px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.pagination button:hover:not(:disabled) { background: #f5f5f5; }
.pagination button:disabled { color: #ccc; cursor: not-allowed; }
.pagination button.active { background: #1976d2; color: white; border-color: #1976d2; }

.page-numbers { display: flex; gap: 5px; }
.page-info { color: #666; font-size: 13px; }

/* 弹窗 */
.modal-overlay {
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

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 { margin: 0; }

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  align-items: flex-start;
}

.detail-row label {
  width: 80px;
  color: #666;
  flex-shrink: 0;
}

.content-row { flex-direction: column; }

.detail-content {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
</style>
