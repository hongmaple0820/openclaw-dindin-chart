<template>
  <view class="test-page">
    <view class="header">
      <text class="title">关系面板测试</text>
      <text class="subtitle">RelationshipPanel Component Test</text>
    </view>
    
    <!-- 模拟数据切换 -->
    <view class="controls">
      <view class="control-item" @click="changeCharacter">
        <text class="control-label">切换角色</text>
        <text class="control-value">{{ currentCharacter }}</text>
      </view>
      
      <view class="control-item" @click="addIntimacy(10)">
        <text class="control-label">亲密度 +10</text>
      </view>
      
      <view class="control-item" @click="addIntimacy(-5)">
        <text class="control-label">亲密度 -5</text>
      </view>
      
      <view class="control-item" @click="resetRelationship">
        <text class="control-label">重置关系</text>
      </view>
    </view>
    
    <!-- 关系面板 -->
    <RelationshipPanel
      ref="panelRef"
      :character-id="characterId"
      :character-name="characterName"
    />
    
    <!-- 调试信息 -->
    <view class="debug-info">
      <text class="debug-title">调试信息</text>
      <text class="debug-text">当前角色: {{ characterId }}</text>
      <text class="debug-text">亲密度: {{ currentIntimacy }}</text>
      <text class="debug-text">阶段: {{ currentStage }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import RelationshipPanel from '@/components/RelationshipPanel.vue'
import { useRelationshipStore, STAGES, getStageByIntimacy } from '@/stores/relationship'

const panelRef = ref<InstanceType<typeof RelationshipPanel> | null>(null)
const relationshipStore = useRelationshipStore

// 模拟角色列表
const characters = [
  { id: 'char_001', name: '小琳' },
  { id: 'char_002', name: '若溪' },
  { id: 'char_003', name: '测试角色' }
]

const currentIndex = ref(0)

const characterId = computed(() => characters[currentIndex.value].id)
const characterName = computed(() => characters[currentIndex.value].name)
const currentCharacter = computed(() => `${characterName.value} (${characterId.value})`)

const currentIntimacy = computed(() => 
  relationshipStore.state.currentRelationship?.intimacyLevel || 0
)

const currentStage = computed(() => {
  const stageKey = getStageByIntimacy(currentIntimacy.value)
  return STAGES[stageKey].label
})

const changeCharacter = () => {
  currentIndex.value = (currentIndex.value + 1) % characters.length
}

const addIntimacy = (delta: number) => {
  panelRef.value?.updateIntimacy(delta)
}

const resetRelationship = () => {
  relationshipStore.clearRelationship()
  panelRef.value?.refresh()
}
</script>

<style scoped>
.test-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 32rpx;
}

.header {
  text-align: center;
  margin-bottom: 32rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.subtitle {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.control-item {
  flex: 1;
  min-width: 200rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.control-label {
  font-size: 26rpx;
  color: #666;
  display: block;
}

.control-value {
  font-size: 24rpx;
  color: #2196f3;
  margin-top: 8rpx;
  display: block;
}

.debug-info {
  margin-top: 32rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.debug-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

.debug-text {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}
</style>
