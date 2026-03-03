<template>
  <view class="character-header" v-if="character">
    <image class="character-avatar" :src="character.avatar" mode="aspectFill" />
    <view class="character-info">
      <text class="character-name">{{ character.name }}</text>
      <text class="character-status">{{ character.mood || '在线' }}</text>
    </view>
    <view class="intimacy-badge" @click="emit('showRelationship')">
      <text class="intimacy-icon">❤️</text>
      <text class="intimacy-level">{{ intimacyText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Character {
  id: string
  name: string
  avatar: string
  mood?: string
}

interface Relationship {
  intimacyLevel: number
  trustLevel: number
  memories: string[]
}

const props = defineProps<{
  character: Character | null
  relationship?: Relationship
}>()

const emit = defineEmits<{
  showRelationship: []
}>()

const intimacyText = computed(() => {
  const level = props.relationship?.intimacyLevel || 0
  if (level >= 80) return '挚爱'
  if (level >= 60) return '热恋'
  if (level >= 40) return '喜欢'
  if (level >= 20) return '好感'
  return '初识'
})
</script>

<style lang="scss" scoped>
.character-header {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.character-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.character-info {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
}

.character-name {
  font-size: 32rpx;
  font-weight: bold;
}

.character-status {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 6rpx;
}

.intimacy-badge {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.2);
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.intimacy-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.intimacy-level {
  font-size: 24rpx;
}
</style>
