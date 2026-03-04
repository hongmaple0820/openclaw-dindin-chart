<template>
  <view class="tasks-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">任务</text>
      <view class="create-btn" @click="showCreateTask = true">
        <text>+</text>
      </view>
    </view>
    
    <!-- 状态 Tab -->
    <view class="status-tabs">
      <view 
        v-for="tab in statusTabs" 
        :key="tab.value"
        :class="['tab-item', { active: activeTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <view class="badge" v-if="getCountByStatus(tab.value)">{{ getCountByStatus(tab.value) }}</view>
      </view>
    </view>
    
    <!-- 置顶任务 -->
    <view class="pinned-section" v-if="taskStore.state.pinnedTasks.length > 0 && showPinned">
      <view class="section-header" @click="showPinned = !showPinned">
        <text class="section-title">📌 置顶任务</text>
        <text class="toggle">{{ showPinned ? '收起' : '展开' }}</text>
      </view>
      <view class="task-list" v-show="showPinned">
        <view 
          v-for="task in taskStore.state.pinnedTasks" 
          :key="task.id"
          class="task-card pinned"
          @click="goToDetail(task.id)"
        >
          <view class="task-main">
            <view class="task-title">{{ task.title }}</view>
            <view class="task-meta">
              <text class="priority" :class="task.priority">{{ getPriorityLabel(task.priority) }}</text>
              <text class="due-date" v-if="task.dueDate">{{ formatDate(task.dueDate) }}</text>
            </view>
          </view>
          <view class="task-actions">
            <view class="unpin-btn" @click.stop="togglePin(task.id)">
              <text>取消置顶</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 任务列表 -->
    <scroll-view class="tasks-list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="filteredTasks.length === 0" class="empty-state">
        <text class="empty-text">暂无任务</text>
        <view class="create-empty-btn" @click="showCreateTask = true">
          <text>创建任务</text>
        </view>
      </view>
      
      <view 
        v-else
        v-for="task in filteredTasks" 
        :key="task.id" 
        class="task-card"
        @click="goToDetail(task.id)"
      >
        <view class="task-main">
          <view class="task-header">
            <text class="task-title">{{ task.title }}</text>
            <view class="pin-btn" @click.stop="togglePin(task.id)">
              <text>{{ task.pinned ? '📌' : '○' }}</text>
            </view>
          </view>
          <text class="task-desc" v-if="task.description">{{ task.description }}</text>
          <view class="task-meta">
            <text class="priority" :class="task.priority">{{ getPriorityLabel(task.priority) }}</text>
            <text class="status">{{ getStatusLabel(task.status) }}</text>
            <text class="due-date" v-if="task.dueDate">{{ formatDate(task.dueDate) }}</text>
          </view>
          <view class="assignees" v-if="task.assignees && task.assignees.length > 0">
            <view class="assignee" v-for="(assignee, idx) in task.assignees.slice(0, 3)" :key="idx">
              <image v-if="assignee.avatar" :src="assignee.avatar" mode="aspectFill" />
              <text v-else>{{ assignee.name?.[0] || '?' }}</text>
            </view>
            <text class="more" v-if="task.assignees.length > 3">+{{ task.assignees.length - 3 }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 创建任务弹窗 -->
    <uni-popup ref="createPopup" type="bottom">
      <view class="create-form">
        <view class="form-header">
          <text @click="showCreateTask = false">取消</text>
          <text class="form-title">创建任务</text>
          <text @click="handleCreateTask">创建</text>
        </view>
        
        <view class="form-body">
          <view class="form-item">
            <text class="form-label">标题</text>
            <input v-model="createForm.title" placeholder="请输入任务标题" class="form-input" />
          </view>
          
          <view class="form-item">
            <text class="form-label">描述</text>
            <textarea v-model="createForm.description" placeholder="任务描述（可选）" class="form-textarea" />
          </view>
          
          <view class="form-item">
            <text class="form-label">优先级</text>
            <view class="priority-options">
              <view 
                v-for="p in priorityOptions" 
                :key="p.value"
                :class="['priority-option', p.value, { active: createForm.priority === p.value }]"
                @click="createForm.priority = p.value"
              >
                {{ p.label }}
              </view>
            </view>
          </view>
          
          <view class="form-item">
            <text class="form-label">截止日期</text>
            <picker mode="date" @change="onDateChange">
              <view class="date-picker">
                <text>{{ createForm.dueDate || '选择日期' }}</text>
              </view>
            </picker>
          </view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { Task } from '@/api/tasks'

const taskStore = useTaskStore

const activeTab = ref('pending')
const loading = ref(false)
const showPinned = ref(true)
const showCreateTask = ref(false)
const createPopup = ref()

const createForm = ref({
  title: '',
  description: '',
  priority: 'medium' as 'high' | 'medium' | 'low',
  dueDate: ''
})

const statusTabs = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
]

const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
]

const filteredTasks = computed(() => {
  let tasks: Task[] = []
  
  switch (activeTab.value) {
    case 'pending':
      tasks = taskStore.state.pendingTasks
      break
    case 'in_progress':
      tasks = taskStore.state.inProgressTasks
      break
    case 'completed':
      tasks = taskStore.state.completedTasks
      break
  }
  
  // 过滤掉置顶任务（它们单独显示）
  return tasks.filter(t => !t.pinned)
})

function getCountByStatus(status: string): number {
  switch (status) {
    case 'pending':
      return taskStore.state.pendingTasks.length
    case 'in_progress':
      return taskStore.state.inProgressTasks.length
    case 'completed':
      return taskStore.state.completedTasks.length
    default:
      return 0
  }
}

async function switchTab(tab: string) {
  activeTab.value = tab
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高'
    case 'medium': return '中'
    case 'low': return '低'
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

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function goToDetail(taskId: string) {
  uni.navigateTo({
    url: `/pages/tasks/detail?id=${taskId}`
  })
}

async function togglePin(taskId: string) {
  try {
    await taskStore.togglePin(taskId)
    uni.showToast({ title: '操作成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function onDateChange(e: any) {
  createForm.value.dueDate = e.detail.value
}

async function handleCreateTask() {
  if (!createForm.value.title.trim()) {
    uni.showToast({ title: '请输入任务标题', icon: 'none' })
    return
  }
  
  uni.showLoading({ title: '创建中...' })
  try {
    const taskData: Partial<Task> = {
      title: createForm.value.title,
      description: createForm.value.description,
      priority: createForm.value.priority,
      status: 'pending'
    }
    
    if (createForm.value.dueDate) {
      taskData.dueDate = new Date(createForm.value.dueDate).getTime()
    }
    
    await taskStore.createTask(taskData)
    
    uni.showToast({ title: '创建成功', icon: 'success' })
    showCreateTask.value = false
    createForm.value = {
      title: '',
      description: '',
      priority: 'medium',
      dueDate: ''
    }
  } catch (error) {
    uni.showToast({ title: '创建失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

async function loadMore() {
  // 分页加载
}

onMounted(async () => {
  loading.value = true
  try {
    await taskStore.fetchTasks()
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.tasks-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.create-btn {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #fff;
}

.status-tabs {
  display: flex;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
  
  &.active {
    color: #667eea;
    font-weight: 500;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 40rpx;
      height: 4rpx;
      background-color: #667eea;
      border-radius: 2rpx;
    }
  }
}

.badge {
  margin-left: 8rpx;
  padding: 2rpx 10rpx;
  font-size: 22rpx;
  background-color: #667eea;
  color: #fff;
  border-radius: 20rpx;
}

.pinned-section {
  background-color: #fff;
  margin: 20rpx 30rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background-color: #fef9e7;
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #f39c12;
}

.toggle {
  font-size: 24rpx;
  color: #999;
}

.tasks-list {
  flex: 1;
  padding: 20rpx 30rpx;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.create-empty-btn {
  margin-top: 30rpx;
  padding: 16rpx 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 30rpx;
  display: inline-block;
  font-size: 28rpx;
}

.task-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  
  &.pinned {
    border-left: 4rpx solid #f39c12;
    background-color: #fffbf0;
  }
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.task-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.pin-btn {
  font-size: 28rpx;
  color: #ccc;
}

.task-desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.priority {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
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
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  background-color: #f5f5f5;
  color: #666;
}

.due-date {
  font-size: 22rpx;
  color: #999;
}

.assignees {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.assignee {
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
    font-size: 20rpx;
    color: #fff;
  }
}

.more {
  font-size: 22rpx;
  color: #999;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

.unpin-btn {
  font-size: 24rpx;
  color: #f39c12;
  padding: 8rpx 16rpx;
  background-color: rgba(243, 156, 18, 0.1);
  border-radius: 20rpx;
}

.create-form {
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 80vh;
}

.form-header {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #eee;
  font-size: 28rpx;
  color: #667eea;
}

.form-title {
  font-weight: 500;
  color: #333;
}

.form-body {
  padding: 20rpx 30rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 16rpx 20rpx;
  background-color: #f5f7fa;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.form-textarea {
  height: 160rpx;
}

.priority-options {
  display: flex;
  gap: 16rpx;
}

.priority-option {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  font-size: 26rpx;
  background-color: #f5f5f5;
  color: #666;
  
  &.high.active {
    background-color: #ffebee;
    color: #f44336;
  }
  
  &.medium.active {
    background-color: #fff3e0;
    color: #ff9800;
  }
  
  &.low.active {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.date-picker {
  padding: 16rpx 20rpx;
  background-color: #f5f7fa;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
}
</style>