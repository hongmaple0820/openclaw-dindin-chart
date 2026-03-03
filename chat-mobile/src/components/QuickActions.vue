<template>
  <view class="quick-actions">
    <view class="action-btn" @click="emit('selfie')">
      <text class="action-icon">📷</text>
      <text class="action-text">自拍</text>
    </view>
    <view class="action-btn" @click="emit('voice')">
      <text class="action-icon">🎤</text>
      <text class="action-text">语音</text>
    </view>
    <view class="action-btn" @click="emit('memories')">
      <text class="action-icon">💭</text>
      <text class="action-text">回忆</text>
    </view>
  </view>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  selfie: []
  voice: []
  memories: []
}>()
</script>

<style lang="scss" scoped>
.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 16rpx 20rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #e5e5e5;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 16rpx;
  background-color: #f5f5f5;
  transition: all 0.2s;
  
  &:active {
    transform: scale(0.95);
    background-color: #e8e8e8;
  }
}

.action-icon {
  font-size: 40rpx;
  margin-bottom: 6rpx;
}

.action-text {
  font-size: 22rpx;
  color: #666;
}
</style>
