<template>
  <view class="message-input-area">
    <button class="emoji-btn" @click="emit('emoji')">😊</button>
    <input 
      class="input"
      v-model="inputText" 
      :placeholder="placeholder"
      confirm-type="send"
      @confirm="handleSend"
      @input="emit('update:inputText', inputText)"
    />
    <button class="image-btn" @click="emit('chooseImage')">🖼️</button>
    <button 
      class="send-btn" 
      @click="handleSend" 
      :disabled="!inputText.trim()"
    >
      发送
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [text: string]
  emoji: []
  chooseImage: []
}>()

const inputText = ref(props.modelValue || '')

watch(() => props.modelValue, (val) => {
  inputText.value = val || ''
})

watch(inputText, (val) => {
  emit('update:modelValue', val)
})

const handleSend = () => {
  const text = inputText.value.trim()
  if (text) {
    emit('send', text)
    inputText.value = ''
    emit('update:modelValue', '')
  }
}
</script>

<style lang="scss" scoped>
.message-input-area {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  background-color: #fff;
  border-top: 1rpx solid #e5e5e5;
  gap: 12rpx;
}

.emoji-btn,
.image-btn {
  width: 70rpx;
  height: 70rpx;
  font-size: 36rpx;
  background-color: #f5f5f5;
  border: none;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &::after {
    border: none;
  }
}

.input {
  flex: 1;
  height: 70rpx;
  background-color: #f5f5f5;
  border-radius: 35rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 70rpx;
  background-color: #409eff;
  color: #fff;
  font-size: 28rpx;
  border-radius: 35rpx;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &::after {
    border: none;
  }
  
  &[disabled] {
    background-color: #ccc;
  }
}
</style>
