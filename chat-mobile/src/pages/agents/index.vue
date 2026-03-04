<template>
  <view class="agents-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">智能体</text>
      <view class="create-btn" @click="goToCreate">
        <text>+</text>
      </view>
    </view>
    
    <!-- Tab 切换 -->
    <view class="tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.value"
        :class="['tab-item', { active: currentTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <view class="badge" v-if="getCountByTab(tab.value)">{{ getCountByTab(tab.value) }}</view>
      </view>
    </view>
    
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input 
        v-model="searchQuery" 
        placeholder="搜索智能体..." 
        class="search-input"
        @confirm="handleSearch"
      />
    </view>
    
    <!-- Agent 列表 -->
    <scroll-view class="agents-list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="currentAgents.length === 0" class="empty-state">
        <text class="empty-text">暂无智能体</text>
        <view class="create-empty-btn" @click="goToCreate">
          <text>创建智能体</text>
        </view>
      </view>
      
      <view 
        v-else
        v-for="agent in currentAgents" 
        :key="agent.id" 
        class="agent-card"
        @click="goToDetail(agent.id)"
      >
        <view class="agent-avatar">
          <image v-if="agent.avatar" :src="agent.avatar" mode="aspectFill" />
          <text v-else>{{ agent.name?.[0] || '?' }}</text>
        </view>
        <view class="agent-info">
          <view class="agent-name">
            <text>{{ agent.name }}</text>
            <view :class="['status-dot', agent.status]"></view>
          </view>
          <text class="agent-desc">{{ agent.description || '暂无描述' }}</text>
          <view class="agent-meta">
            <text class="model" v-if="agent.model">{{ agent.model }}</text>
            <text class="memories" v-if="agent.memoryCount">{{ agent.memoryCount }} 条记忆</text>
          </view>
        </view>
        <view class="agent-actions">
          <view class="chat-btn" @click.stop="goToChat(agent.id)">
            <text>对话</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAgentStore } from '@/stores/agents'
import { Agent } from '@/api/agents'

const agentStore = useAgentStore

const currentTab = ref('my')
const searchQuery = ref('')
const loading = ref(false)

const tabs = [
  { label: '我的智能体', value: 'my' },
  { label: '公开智能体', value: 'public' }
]

const currentAgents = computed(() => {
  switch (currentTab.value) {
    case 'my':
      return agentStore.state.myAgents
    case 'public':
      return agentStore.state.publicAgents
    default:
      return []
  }
})

function getCountByTab(tab: string): number {
  switch (tab) {
    case 'my':
      return agentStore.state.myAgents.length
    case 'public':
      return agentStore.state.publicAgents.length
    default:
      return 0
  }
}

async function switchTab(tab: string) {
  currentTab.value = tab
  loading.value = true
  try {
    if (tab === 'my') {
      await agentStore.fetchMyAgents()
    } else {
      await agentStore.fetchPublicAgents()
    }
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  loading.value = true
  try {
    await agentStore.fetchAgents({ search: searchQuery.value })
  } finally {
    loading.value = false
  }
}

function goToDetail(agentId: string) {
  uni.navigateTo({
    url: `/pages/agents/detail?id=${agentId}`
  })
}

function goToChat(agentId: string) {
  uni.navigateTo({
    url: `/pages/agents/chat?id=${agentId}`
  })
}

function goToCreate() {
  uni.navigateTo({
    url: '/pages/agents/create'
  })
}

async function loadMore() {
  // 分页加载逻辑
}

onMounted(async () => {
  loading.value = true
  try {
    await agentStore.fetchMyAgents()
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.agents-page {
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

.tabs {
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

.search-bar {
  padding: 20rpx 30rpx;
  background-color: #fff;
}

.search-input {
  width: 100%;
  height: 70rpx;
  padding: 0 24rpx;
  background-color: #f5f7fa;
  border-radius: 35rpx;
  font-size: 28rpx;
}

.agents-list {
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

.agent-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.agent-avatar {
  width: 80rpx;
  height: 80rpx;
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
    font-size: 36rpx;
    color: #fff;
    font-weight: bold;
  }
}

.agent-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}

.agent-name {
  display: flex;
  align-items: center;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 8rpx;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-left: 10rpx;
  
  &.active {
    background-color: #4caf50;
  }
  
  &.inactive {
    background-color: #9e9e9e;
  }
  
  &.busy {
    background-color: #ff9800;
  }
}

.agent-desc {
  font-size: 24rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.agent-meta {
  display: flex;
  gap: 16rpx;
}

.model,
.memories {
  font-size: 22rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

.agent-actions {
  margin-left: 20rpx;
}

.chat-btn {
  padding: 12rpx 24rpx;
  background-color: #667eea;
  color: #fff;
  font-size: 24rpx;
  border-radius: 30rpx;
}
</style>