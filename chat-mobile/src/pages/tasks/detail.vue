<template>
  <view class="task-detail-page">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹ 返回</text>
      </view>
      <text class="title">任务详情</text>
      <view class="more-btn" @click="showMoreOptions = true">
        <text>更多</text>
      </view>
    </view>
    
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>
    
    <scroll-view v-else-if="task" class="content" scroll-y>
      <!-- 任务信息 -->
      <view class="task-header">
        <view class="task-title-row">
          <text class="task-title">{{ task.title }}</text>
          <view class="pin-btn" @click="togglePin">
            <text>{{ task.pinned ? '📌' : '○' }}</text>
          </view>
        </view>
        <view class="task-meta">
          <text class="priority" :class="task.priority">{{ getPriorityLabel(task.priority) }}</text>
          <text class="status" :class="task.status">{{ getStatusLabel(task.status) }}</text>
        </view>
      </view>
      
      <!-- 描述 -->
      <view class="section" v-if="task.description">
        <text class="section-title">描述</text>
        <text class="description">{{ task.description }}</text>
      </view>
      
      <!-- 状态切换 -->
      <view class="section">
        <text class="section-title">状态</text>
        <view class="status-options">
          <view 
            v-for="s in statusOptions" 
            :key="s.value"
            :class="['status-option', s.value, { active: task.status === s.value }]"
            @click="updateStatus(s.value)"
          >
            {{ s.label }}
          </view>
        </view>
      </view>
      
      <!-- 执行者 -->
      <view class="section" v-if="task.assignees && task.assignees.length > 0">
        <text class="section-title">执行者</text>
        <view class="assignee-list">
          <view class="assignee-item" v-for="assignee in task.assignees" :key="assignee.id">
            <view class="assignee-avatar">
              <image v-if="assignee.avatar" :src="assignee.avatar" mode="aspectFill" />
              <text v-else>{{ assignee.name?.[0] || '?' }}</text>
            </view>
            <text class="assignee-name">{{ assignee.name }}</text>
          </view>
        </view>
      </view>
      
      <!-- 详情信息 -->
      <view class="section">
        <text class="section-title">详情信息</text>
        <view class="info-list">
          <view class="info-item" v-if="task.dueDate">
            <text class="label">截止日期</text>
            <text class="value">{{ formatDateTime(task.dueDate) }}</text>
          </view>
          <view class="info-item">
            <text class="label">创建时间</text>
            <text class="value">{{ formatDateTime(task.createdAt) }}</text>
          </view>
          <view class="info-item">
            <text class="label">更新时间</text>
            <text class="value">{{ formatDateTime(task.updatedAt) }}</text>
          </view>
        </view>
      </view>
      
      <!-- 日志 -->
      <view class="section" v-if="task.logs && task.logs.length > 0">
        <text class="section-title">活动日志</text>
        <view class="log-list">
          <view class="log-item" v-for="log in task.logs" :key="log.id">
            <text class="log-time">{{ formatDateTime(log.createdAt) }}</text>
            <text class="log-content">{{ log.content }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 更多选项弹窗 -->
    <uni-popup ref="morePopup" type="bottom">
      <view class="more-options">
        <view class="option-item" @click="editTask">
          <text>编辑任务</text>
        </view>
        <view class="option-item danger" @click="deleteTask">
          <text>删除任务</text>
        </view>
        <view class="option-item cancel" @click="showMoreOptions = false">
          <text>取消</text>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { Task } from '@/api/tasks'

const taskStore = useTaskStore

const task = ref<Task | null>(null)
const loading = ref(true)
const showMoreOptions = ref(false)
const morePopup = ref()

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
]

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const taskId = currentPage?.options?.id
  
  if (taskId) {
    try {
      task.value = await taskStore.fetchTaskDetail(taskId)
    } catch (error) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loading.value = false
    }
  } else {
    loading.value = false
  }
})

function goBack() {
  uni.navigateBack()
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高优先级'
    case 'medium': return '中优先级'
    case 'low': return '低优先级'
    default: return priority
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return '待处理'
    case 'in_progress': return '进行中'
    case 'completed': return '已完成'
    default: return status
  }
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function updateStatus(status: string) {
  if (!task.value) return
  
  try {
    await taskStore.updateStatus(task.value.id, status)
    task.value.status = status as any
    uni.showToast({ title: '状态已更新', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

async function togglePin() {
  if (!task.value) return
  
  try {
    await taskStore.togglePin(task.value.id)
    task.value.pinned = !task.value.pinned
    uni.showToast({ title: task.value.pinned ? '已置顶' : '已取消置顶', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function editTask() {
  if (task.value) {
    uni.navigateTo({
      url: `/pages/tasks/edit?id=${task.value.id}`
    })
  }
  showMoreOptions.value = false
}

async function deleteTask() {
  if (!task.value) return
  
  const [, result] = await uni.showModal({
    title: '确认删除',
    content: `确定要删除任务 "${task.value.title}" 吗？`
  })
  
  if (result) {
    uni.showLoading({ title: '删除中...' })
    try {
      await taskStore.deleteTask(task.value.id)
      uni.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    } catch (error) {
      uni.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  }
  showMoreOptions.value = false
}
</script>

<style lang="scss" scoped>
.task-detail-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.back-btn,
.more-btn {
  font-size: 28rpx;
  color: #fff;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 28rpx;
}

.content {
  flex: 1;
  padding: 20rpx 30rpx;
}

.task-header {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.task-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}

.task-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
}

.pin-btn {
  font-size: 32rpx;
  color: #ccc;
}

.task-meta {
  display: flex;
  gap: 12rpx;
}

.priority {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  
  &.high {
    background-color: #ffebee;
    color: #f44336;
  }
  
  &.medium {
    background-color: #fff3e0;
    color: #ff9800;
  }
  
  &.low {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.status {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background-color: #f5f5f5;
  color: #666;
  
  &.pending {
    background-color: #f5f5f5;
    color: #666;
  }
  
  &.in_progress {
    background-color: #e3f2fd;
    color: #2196f3;
  }
  
  &.completed {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 16rpx;
  display: block;
}

.description {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.status-options {
  display: flex;
  gap: 12rpx;
}

.status-option {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  font-size: 26rpx;
  background-color: #f5f5f5;
  color: #666;
  
  &.pending.active {
    background-color: #f5f5f5;
    color: #666;
    font-weight: 500;
  }
  
  &.in_progress.active {
    background-color: #e3f2fd;
    color: #2196f3;
    font-weight: 500;
  }
  
  &.completed.active {
    background-color: #e8f5e9;
    color: #4caf50;
    font-weight: 500;
  }
}

.assignee-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.assignee-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.assignee-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  
  image {
    width: 100%;
    height: 100%;
  }
  
  text {
    font-size: 24rpx;
    color: #fff;
  }
}

.assignee-name {
  font-size: 28rpx;
  color: #333;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  
  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 26rpx;
  color: #999;
}

.value {
  font-size: 26rpx;
  color: #333;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.log-item {
  padding: 16rpx;
  background-color: #f5f7fa;
  border-radius: 12rpx;
}

.log-time {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.log-content {
  font-size: 26rpx;
  color: #333;
}

.more-options {
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
}

.option-item {
  padding: 30rpx;
  text-align: center;
  font-size: 30rpx;
  color: #333;
  border-bottom: 1rpx solid #f5f5f5;
  
  &.danger {
    color: #f44336;
  }
  
  &.cancel {
    color: #999;
    border-bottom: none;
    margin-top: 10rpx;
    background-color: #f5f7fa;
  }
}
</style>