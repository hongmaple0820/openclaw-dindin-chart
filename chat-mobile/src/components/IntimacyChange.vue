<template>
  <!-- 显示 +5/-10 等变化动画 -->
  <view v-if="show" class="intimacy-change" :class="changeClass">
    {{ changeText }}
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  value: number
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'hide'): void
}>()

const changeClass = computed(() => ({
  'positive': props.value > 0,
  'negative': props.value < 0,
  'fade-out': !props.show
}))

const changeText = computed(() => {
  if (props.value > 0) {
    return `+${props.value}`
  }
  return props.value.toString()
})

// 动画结束后隐藏
watch(() => props.show, (newVal) => {
  if (!newVal) {
    emit('hide')
  }
})
</script>

<style scoped>
.intimacy-change {
  position: absolute;
  top: -20rpx;
  right: 20rpx;
  padding: 8rpx 16rpx;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: bold;
  animation: floatUp 2s ease-out forwards;
  z-index: 100;
  pointer-events: none;
}

.intimacy-change.positive {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
}

.intimacy-change.negative {
  color: #f44336;
  background: rgba(244, 67, 54, 0.15);
}

.intimacy-change.fade-out {
  animation: fadeOut 0.3s ease-out forwards;
}

@keyframes floatUp {
  0% {
    opacity: 0;
    transform: translateY(20rpx);
  }
  20% {
    opacity: 1;
    transform: translateY(0);
  }
  80% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-30rpx);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
