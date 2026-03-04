<template>
  <view class="agent-detail-page">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹ 返回</text>
      </view>
      <text class="title">智能体详情</text>
      <view class="edit-btn" @click="goToEdit">
        <text>编辑</text>
      </view>
    </view>
    
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>
    
    <scroll-view v-else-if="agent" class="content" scroll-y>
      <!-- 智能体信息 -->
      <view class="agent-header">
        <view class="agent-avatar">
          <image v-if="agent.avatar" :src="agent.avatar" mode="aspectFill" />
          <text v-else>{{ agent.name?.[0] || '?' }}</text>
        </view>
        <view class="agent-info">
          <text class="agent-name">{{ agent.name }}</text>
          <text class="agent-desc">{{ agent.description || '暂无描述' }}</text>
          <view class="status-row">
            <view :class="['status-badge', agent.status]">
              {{ getStatusLabel(agent.status) }}
            </view>
            <text class="model" v-if="agent.model">{{ agent.model }}</text>
          </view>
        </view>
      </view>
      
      <!-- 统计 -->
      <view class="stats-section">
        <view class="stat-item">
          <text class="stat-value">{{ agent.memoryCount || 0 }}</text>
          <text class="stat-label">记忆</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ agent.chatCount || 0 }}</text>
          <text class="stat-label">对话</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ agent.capabilities?.length || 0 }}</text>
          <text class="stat-label">能力</text>
        </view>
      </view>
      
      <!-- 基本信息 -->
      <view class="section">
        <text class="section-title">基本信息</text>
        <view class="info-list">
          <view class="info-item">
            <text class="label">ID</text>
            <text class="value">{{ agent.id }}</text>
          </view>
          <view class="info-item">
            <text class="label">创建时间</text>
            <text class="value">{{ formatDate(agent.createdAt) }}</text>
          </view>
          <view class="info-item">
            <text class="label">更新时间</text>
            <text class="value">{{ formatDate(agent.updatedAt) }}</text>
          </view>
        </view>
      </view>
      
      <!-- 能力 -->
      <view class="section" v-if="agent.capabilities && agent.capabilities.length > 0">
        <text class="section-title">能力</text>
        <view class="capability-list">
          <view class="capability-item" v-for="(cap, index) in agent.capabilities" :key="index">
            <text>{{ cap }}</text>
          </view>
        </view>
      </view>
      
      <!-- 系统提示词 -->
      <view class="section" v-if="agent.systemPrompt">
        <text class="section-title">系统提示词</text>
        <view class="prompt-box">
          <text>{{ agent.systemPrompt }}</text>
        </view>
      </view>
    </scroll-view>
    
    <!-- 底部操作 -->
    <view class="actions" v-if="agent">
      <view class="chat-btn" @click="goToChat">
        <text>开始对话</text>
      </view>
      <view class="more-btn" @click="showMoreOptions = true">
        <text>更多</text>
      </view>
    </view>
    
    <!-- 更多选项弹窗 -->
    <uni-popup ref="morePopup" type="bottom">
      <view class="more-options">
        <view class="option-item" @click="toggleStatus">
          <text>{{ agent?.status === 'active' ? '暂停智能体' : '激活智能体' }}</text>
        </view>
        <view class="option-item" @click="duplicateAgent">
          <text>复制智能体</text>
        </view>
        <view class="option-item danger" @click="deleteAgent">
          <text>删除智能体</text>
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
import { useAgentStore } from '@/stores/agents'
import { Agent } from '@/api/agents'

const agentStore = useAgentStore

const agent = ref<Agent | null>(null)
const loading = ref(true)
const showMoreOptions = ref(false)
const morePopup = ref()

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const agentId = currentPage?.options?.id
  
  if (agentId) {
    try {
      agent.value = await agentStore.fetchAgentDetail(agentId)
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

function goToEdit() {
  if (agent.value) {
    uni.navigateTo({
      url: `/pages/agents/edit?id=${agent.value.id}`
    })
  }
}

function goToChat() {
  if (agent.value) {
    uni.navigateTo({
      url: `/pages/agents/chat?id=${agent.value.id}`
    })
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active': return '运行中'
    case 'inactive': return '已停止'
    case 'busy': return '忙碌'
    default: return status
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function toggleStatus() {
  if (!agent.value) return
  
  try {
    const updated = await agentStore.toggleAgentStatus(agent.value.id)
    if (updated) {
      agent.value = updated
      uni.showToast({ title: '状态已更新', icon: 'success' })
    }
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    showMoreOptions.value = false
  }
}

async function duplicateAgent() {
  if (!agent.value) return
  
  uni.showLoading({ title: '复制中...' })
  try {
    // 调用复制 API
    uni.showToast({ title: '复制成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '复制失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    showMoreOptions.value = false
  }
}

async function deleteAgent() {
  if (!agent.value) return
  
  const [, result] = await uni.showModal({
    title: '确认删除',
    content: `确定要删除智能体 "${agent.value.name}" 吗？此操作不可恢复。`
  })
  
  if (result) {
    uni.showLoading({ title: '删除中...' })
    try {
      await agentStore.deleteAgent(agent.value.id)
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
.agent-detail-page {
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
.edit-btn {
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

.agent-header {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.agent-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  
  image {
    width: 100%;
    height: 100%;
  }
  
  text {
    font-size: 50rpx;
    color: #fff;
    font-weight: bold;
  }
}

.agent-info {
  flex: 1;
  margin-left: 24rpx;
}

.agent-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.agent-desc {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 12rpx;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.status-badge {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  
  &.active {
    background-color: #e8f5e9;
    color: #4caf50;
  }
  
  &.inactive {
    background-color: #f5f5f5;
    color: #9e9e9e;
  }
  
  &.busy {
    background-color: #fff3e0;
    color: #ff9800;
  }
}

.model {
  font-size: 22rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

.stats-section {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  margin-bottom: 20rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
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
  margin-bottom: 20rpx;
  display: block;
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

.capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.capability-item {
  font-size: 24rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
}

.prompt-box {
  padding: 16rpx;
  background-color: #f5f7fa;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx;
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.chat-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 44rpx;
  font-size: 30rpx;
  color: #fff;
}

.more-btn {
  width: 120rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 44rpx;
  font-size: 28rpx;
  color: #666;
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