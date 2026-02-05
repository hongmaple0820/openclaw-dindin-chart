<template>
  <div class="messages">
    <h1>💬 消息管理</h1>
    
    <!-- 筛选条件 -->
    <div class="filters">
      <input v-model="filters.keyword" placeholder="搜索关键词..." @input="debouncedSearch" />
      <select v-model="filters.sender" @change="loadMessages">
        <option value="">所有发送者</option>
        <option v-for="s in senders" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="filters.source" @change="loadMessages">
        <option value="">所有来源</option>
        <option value="dingtalk">钉钉</option>
        <option value="web">Web</option>
        <option value="bot">机器人</option>
        <option value="redis">Redis</option>
      </select>
      <button @click="loadMessages" class="btn">🔍 搜索</button>
      <button @click="deleteSelected" class="btn danger" :disabled="selected.length === 0">
        🗑️ 删除选中 ({{ selected.length }})
      </button>
    </div>

    <!-- 消息列表 -->
    <div class="message-table">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>发送者</th>
            <th>类型</th>
            <th>内容</th>
            <th>来源</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="msg in messages" :key="msg.id">
            <td><input type="checkbox" :value="msg.id" v-model="selected" /></td>
            <td>
              <span class="sender-tag" :class="msg.type">{{ msg.sender }}</span>
            </td>
            <td>{{ msg.type === 'human' ? '👤' : '🤖' }}</td>
            <td class="content-cell" :title="msg.content">
              {{ msg.content.substring(0, 80) }}{{ msg.content.length > 80 ? '...' : '' }}
            </td>
            <td><span class="source-tag">{{ msg.source || '-' }}</span></td>
            <td class="time-cell">{{ formatTime(msg.timestamp) }}</td>
            <td>
              <button @click="deleteMessage(msg.id)" class="btn-small danger">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="pagination">
      <button @click="prevPage" :disabled="pagination.page <= 1">上一页</button>
      <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页，共 {{ pagination.total }} 条</span>
      <button @click="nextPage" :disabled="pagination.page >= pagination.totalPages">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../api'

const messages = ref([])
const senders = ref([])
const selected = ref([])
const selectAll = ref(false)
const filters = ref({
  keyword: '',
  sender: '',
  source: ''
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadMessages, 300)
}

const formatTime = (ts) => {
  return new Date(ts).toLocaleString('zh-CN')
}

const loadMessages = async () => {
  try {
    const res = await api.getMessages({
      page: pagination.value.page,
      limit: pagination.value.limit,
      keyword: filters.value.keyword,
      sender: filters.value.sender,
      source: filters.value.source
    })
    messages.value = res.data.data
    pagination.value = { ...pagination.value, ...res.data.pagination }
    selected.value = []
    selectAll.value = false
  } catch (error) {
    console.error('加载消息失败:', error)
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
  if (selectAll.value) {
    selected.value = messages.value.map(m => m.id)
  } else {
    selected.value = []
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

onMounted(() => {
  loadMessages()
  loadSenders()
})
</script>

<style scoped>
.messages {
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters input, .filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.filters input {
  width: 200px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  background: #1976d2;
  color: white;
}

.btn:hover {
  background: #1565c0;
}

.btn.danger {
  background: #d32f2f;
}

.btn.danger:hover {
  background: #c62828;
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.message-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
}

.sender-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.sender-tag.human {
  background: #e3f2fd;
  color: #1565c0;
}

.sender-tag.bot {
  background: #fce4ec;
  color: #c62828;
}

.source-tag {
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}

.content-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-small.danger {
  background: #ffebee;
  color: #c62828;
}

.btn-small.danger:hover {
  background: #ffcdd2;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #f5f5f5;
}

.pagination button:disabled {
  color: #ccc;
  cursor: not-allowed;
}
</style>
