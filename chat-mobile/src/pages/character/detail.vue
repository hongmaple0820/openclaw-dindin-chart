<template>
  <view class="character-detail-page">
    <!-- 加载中 -->
    <view class="loading" v-if="loading">
      <text>加载中...</text>
    </view>
    
    <template v-else-if="character">
      <!-- 顶部信息区 -->
      <view class="header">
        <view class="avatar-large">
          <image v-if="character.avatar" :src="character.avatar" mode="aspectFill" />
          <text v-else>{{ character.name?.[0] || '?' }}</text>
        </view>
        <text class="name">{{ character.name }}</text>
        <text class="type">{{ character.type }}</text>
      </view>
      
      <!-- 基本信息 -->
      <view class="section">
        <text class="section-title">性格特征</text>
        <view class="tags">
          <text 
            class="tag" 
            v-for="(p, idx) in character.personality" 
            :key="idx"
          >{{ p }}</text>
          <text class="empty-tag" v-if="!character.personality?.length">暂无性格标签</text>
        </view>
      </view>
      
      <!-- 说话风格 -->
      <view class="section">
        <text class="section-title">说话风格</text>
        <view class="content-box">
          <text class="content">{{ character.speakingStyle || '暂无设置' }}</text>
        </view>
      </view>
      
      <!-- 参考图片 -->
      <view class="section" v-if="character.referenceImages?.length">
        <text class="section-title">参考图片</text>
        <view class="images">
          <image 
            class="ref-image" 
            v-for="(img, idx) in character.referenceImages" 
            :key="idx"
            :src="img" 
            mode="aspectFill"
            @click="previewImage(img, character.referenceImages)"
          />
        </view>
      </view>
      
      <!-- 创建时间 -->
      <view class="section">
        <text class="section-title">创建时间</text>
        <text class="time">{{ formatTime(character.createdAt) }}</text>
      </view>
      
      <!-- 操作按钮 -->
      <view class="actions">
        <button class="edit-btn" @click="goToEdit">
          <text class="btn-icon">✎</text>
          <text>编辑</text>
        </button>
        <button class="delete-btn" @click="handleDelete">
          <text class="btn-icon">✕</text>
          <text>删除</text>
        </button>
      </view>
      
      <!-- 设为当前角色 -->
      <view class="switch-area" v-if="!isCurrent">
        <button class="switch-btn" @click="handleSwitch">设为当前角色</button>
      </view>
    </template>
    
    <!-- 错误状态 -->
    <view class="error" v-else-if="!loading">
      <text class="error-text">角色不存在或已被删除</text>
      <button class="back-btn" @click="goBack">返回列表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { Character } from '@/api/character'

const characterStore = useCharacterStore

const characterId = ref('')
const character = ref<Character | null>(null)
const loading = ref(true)

// 是否是当前角色
const isCurrent = computed(() => {
  return character.value?.id === characterStore.state.currentCharacter?.id
})

// 加载角色详情
onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  characterId.value = currentPage?.options?.id || ''
  
  if (!characterId.value) {
    loading.value = false
    return
  }
  
  try {
    character.value = await characterStore.getCharacterById(characterId.value)
  } catch (error) {
    console.error('加载角色详情失败:', error)
  } finally {
    loading.value = false
  }
})

// 获取页面栈
const getCurrentPages = () => {
  return getCurrentPages()
}

// 格式化时间
const formatTime = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 预览图片
const previewImage = (current: string, urls: string[]) => {
  uni.previewImage({
    current,
    urls
  })
}

// 跳转编辑
const goToEdit = () => {
  uni.navigateTo({
    url: `/pages/character/create?id=${characterId.value}&mode=edit`
  })
}

// 删除角色
const handleDelete = () => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除角色「${character.value?.name}」吗？删除后无法恢复。`,
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        try {
          await characterStore.deleteCharacter(characterId.value)
          uni.showToast({ title: '删除成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } catch (error) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

// 切换角色
const handleSwitch = async () => {
  try {
    await characterStore.switchCharacter(characterId.value)
    uni.showToast({ title: '已切换', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '切换失败', icon: 'none' })
  }
}

// 返回列表
const goBack = () => {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.character-detail-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 200rpx;
}

.loading {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-large {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 20rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  
  image {
    width: 100%;
    height: 100%;
  }
  
  text {
    font-size: 60rpx;
    color: #fff;
    font-weight: bold;
  }
}

.name {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8rpx;
}

.type {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section {
  margin: 30rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.tags {
  display: flex;
  flex-wrap: wrap;
}

.tag {
  font-size: 24rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 10rpx 20rpx;
  border-radius: 24rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.empty-tag {
  font-size: 24rpx;
  color: #999;
}

.content-box {
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
}

.content {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.images {
  display: flex;
  flex-wrap: wrap;
}

.ref-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.time {
  font-size: 26rpx;
  color: #999;
}

.actions {
  display: flex;
  padding: 0 30rpx;
  margin-top: 30rpx;
}

.edit-btn, .delete-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  margin: 0 8rpx;
  border: none;
}

.edit-btn {
  background-color: #667eea;
  color: #fff;
}

.delete-btn {
  background-color: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
}

.btn-icon {
  margin-right: 8rpx;
}

.switch-area {
  position: fixed;
  bottom: 40rpx;
  left: 30rpx;
  right: 30rpx;
}

.switch-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 48rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
}

.error {
  text-align: center;
  padding: 100rpx 30rpx;
}

.error-text {
  font-size: 30rpx;
  color: #999;
  display: block;
  margin-bottom: 30rpx;
}

.back-btn {
  width: 240rpx;
  height: 80rpx;
  line-height: 80rpx;
  background-color: #667eea;
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
  border: none;
}
</style>
