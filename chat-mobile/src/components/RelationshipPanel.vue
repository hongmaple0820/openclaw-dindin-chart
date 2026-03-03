<template>
  <view class="relationship-panel">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
    
    <!-- 错误状态 -->
    <view v-else-if="error" class="error-state">
      <text class="error-text">{{ error }}</text>
      <view class="retry-btn" @click="handleRetry">
        <text>重试</text>
      </view>
    </view>
    
    <!-- 正常状态 -->
    <view v-else class="panel-content">
      <!-- 关系类型标签 -->
      <view class="relationship-header">
        <view class="relationship-type" :style="{ backgroundColor: stageInfo?.color }">
          <text class="type-text">{{ relationshipType }}</text>
        </view>
        <!-- 亲密度变化动画 -->
        <IntimacyChange 
          v-if="intimacyChange" 
          :value="intimacyChange.value" 
          :show="intimacyChange.show"
          @hide="onIntimacyChangeHide"
        />
      </view>
      
      <!-- 亲密度进度条 -->
      <view class="intimacy-section">
        <view class="intimacy-label">
          <text class="label-text">亲密度</text>
          <text class="intimacy-value">{{ intimacyLevel }}</text>
        </view>
        <view class="intimacy-bar">
          <view 
            class="intimacy-fill" 
            :style="{ 
              width: intimacyPercent + '%',
              backgroundColor: stageInfo?.color 
            }"
          ></view>
        </view>
      </view>
      
      <!-- 关系阶段 -->
      <view class="relationship-stage">
        <view class="stage-header">
          <view class="stage-dot" :style="{ backgroundColor: stageInfo?.color }"></view>
          <text class="stage-label">{{ stageLabel }}</text>
        </view>
        <text class="stage-description">{{ stageDescription }}</text>
      </view>
      
      <!-- 解锁的特殊互动 -->
      <view v-if="unlockedInteractions.length > 0" class="unlocked-interactions">
        <text class="section-title">已解锁互动</text>
        <view class="interactions-list">
          <view 
            v-for="interaction in unlockedInteractions" 
            :key="interaction" 
            class="interaction-badge"
            :style="{ borderColor: stageInfo?.color }"
          >
            <text class="badge-text">{{ interaction }}</text>
          </view>
        </view>
      </view>
      
      <!-- 互动历史（可展开） -->
      <view class="interaction-history">
        <view class="history-header" @click="toggleHistory">
          <text class="section-title">互动记录</text>
          <text class="toggle-icon">{{ historyExpanded ? '▼' : '▶' }}</text>
        </view>
        
        <view v-if="historyExpanded" class="history-content">
          <view v-if="historyLoading" class="history-loading">
            <text>加载中...</text>
          </view>
          <view v-else-if="history.length === 0" class="history-empty">
            <text>暂无互动记录</text>
          </view>
          <view v-else class="history-timeline">
            <view 
              v-for="item in history" 
              :key="item.id" 
              class="history-item"
            >
              <view class="timeline-dot"></view>
              <view class="history-item-content">
                <text class="history-type">{{ item.type }}</text>
                <text class="history-desc">{{ item.description }}</text>
                <text 
                  class="history-change" 
                  :class="{ positive: item.intimacyChange > 0, negative: item.intimacyChange < 0 }"
                >
                  {{ item.intimacyChange > 0 ? '+' : '' }}{{ item.intimacyChange }}
                </text>
              </view>
              <text class="history-time">{{ formatTime(item.createdAt) }}</text>
            </view>
          </view>
          
          <!-- 加载更多 -->
          <view v-if="hasMoreHistory" class="load-more" @click="loadMoreHistory">
            <text>加载更多</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import IntimacyChange from './IntimacyChange.vue'
import { useRelationshipStore } from '@/stores/relationship'
import { STAGES, getStageByIntimacy } from '@/api/relationship'

const props = defineProps<{
  characterId: string
  characterName?: string
}>()

const relationshipStore = useRelationshipStore

// 状态
const loading = ref(false)
const error = ref<string | null>(null)
const historyExpanded = ref(false)
const historyLoading = ref(false)

// 计算属性
const relationship = computed(() => relationshipStore.state.currentRelationship)
const intimacyLevel = computed(() => relationship.value?.intimacyLevel || 0)
const intimacyPercent = computed(() => intimacyLevel.value)
const relationshipType = computed(() => relationship.value?.relationshipType || '新认识')

const stageInfo = computed(() => {
  const stageKey = getStageByIntimacy(intimacyLevel.value)
  return STAGES[stageKey]
})

const stageLabel = computed(() => stageInfo.value?.label || '陌生人')
const stageDescription = computed(() => stageInfo.value?.description || '')
const unlockedInteractions = computed(() => relationship.value?.unlockedInteractions || [])
const history = computed(() => relationshipStore.state.history)
const historyTotal = computed(() => relationshipStore.state.historyTotal)
const hasMoreHistory = computed(() => history.value.length < historyTotal.value)
const intimacyChange = computed(() => relationshipStore.state.intimacyChange)

// 方法
const fetchData = async () => {
  loading.value = true
  error.value = null
  
  try {
    await relationshipStore.fetchRelationship(props.characterId)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleRetry = () => {
  fetchData()
}

const toggleHistory = async () => {
  historyExpanded.value = !historyExpanded.value
  
  if (historyExpanded.value && history.value.length === 0) {
    await loadHistory()
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    await relationshipStore.fetchHistory(props.characterId)
  } finally {
    historyLoading.value = false
  }
}

const loadMoreHistory = async () => {
  historyLoading.value = true
  try {
    await relationshipStore.fetchHistory(props.characterId, 20, history.value.length)
  } finally {
    historyLoading.value = false
  }
}

const onIntimacyChangeHide = () => {
  // 动画结束后的处理
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return date.toLocaleDateString()
}

// 生命周期
onMounted(() => {
  fetchData()
})

// 监听 characterId 变化
watch(() => props.characterId, () => {
  relationshipStore.clearRelationship()
  fetchData()
})

// 暴露方法给父组件
defineExpose({
  refresh: fetchData,
  updateIntimacy: (delta: number) => relationshipStore.updateIntimacy(props.characterId, delta)
})
</script>

<style scoped>
.relationship-panel {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

/* 加载和错误状态 */
.loading-state,
.error-state {
  padding: 60rpx 0;
  text-align: center;
}

.loading-text {
  color: #999;
  font-size: 28rpx;
}

.error-text {
  color: #f44336;
  font-size: 28rpx;
}

.retry-btn {
  margin-top: 20rpx;
  padding: 16rpx 40rpx;
  background: #2196f3;
  border-radius: 40rpx;
  display: inline-block;
}

.retry-btn text {
  color: #fff;
  font-size: 28rpx;
}

/* 关系头部 */
.relationship-header {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.relationship-type {
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

.type-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 500;
}

/* 亲密度部分 */
.intimacy-section {
  margin-bottom: 24rpx;
}

.intimacy-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.label-text {
  color: #666;
  font-size: 26rpx;
}

.intimacy-value {
  color: #333;
  font-size: 28rpx;
  font-weight: bold;
}

.intimacy-bar {
  height: 16rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}

.intimacy-fill {
  height: 100%;
  border-radius: 8rpx;
  transition: width 0.5s ease, background-color 0.5s ease;
}

/* 关系阶段 */
.relationship-stage {
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}

.stage-header {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.stage-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}

.stage-label {
  color: #333;
  font-size: 30rpx;
  font-weight: 600;
}

.stage-description {
  color: #666;
  font-size: 24rpx;
  margin-left: 28rpx;
}

/* 解锁互动 */
.unlocked-interactions {
  margin-bottom: 24rpx;
}

.section-title {
  color: #333;
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  display: block;
}

.interactions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.interaction-badge {
  padding: 8rpx 20rpx;
  border: 2rpx solid;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.8);
}

.badge-text {
  font-size: 24rpx;
  color: #666;
}

/* 互动历史 */
.interaction-history {
  border-top: 1rpx solid #eee;
  padding-top: 24rpx;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.toggle-icon {
  color: #999;
  font-size: 24rpx;
}

.history-content {
  margin-top: 16rpx;
}

.history-loading,
.history-empty {
  padding: 40rpx 0;
  text-align: center;
}

.history-loading text,
.history-empty text {
  color: #999;
  font-size: 26rpx;
}

.history-timeline {
  position: relative;
  padding-left: 24rpx;
}

.history-timeline::before {
  content: '';
  position: absolute;
  left: 6rpx;
  top: 12rpx;
  bottom: 12rpx;
  width: 2rpx;
  background: #e0e0e0;
}

.history-item {
  position: relative;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.history-item:last-child {
  border-bottom: none;
}

.timeline-dot {
  position: absolute;
  left: -24rpx;
  top: 24rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #2196f3;
}

.history-item-content {
  display: flex;
  flex-direction: column;
}

.history-type {
  color: #333;
  font-size: 26rpx;
  font-weight: 500;
  margin-bottom: 4rpx;
}

.history-desc {
  color: #666;
  font-size: 24rpx;
}

.history-change {
  margin-left: auto;
  font-size: 26rpx;
  font-weight: bold;
}

.history-change.positive {
  color: #4caf50;
}

.history-change.negative {
  color: #f44336;
}

.history-time {
  color: #999;
  font-size: 22rpx;
  margin-top: 8rpx;
}

.load-more {
  padding: 20rpx;
  text-align: center;
}

.load-more text {
  color: #2196f3;
  font-size: 26rpx;
}
</style>
