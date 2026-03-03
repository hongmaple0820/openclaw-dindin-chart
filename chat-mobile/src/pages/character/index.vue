<template>
  <view class="character-list-page">
    <!-- 顶部标题栏 -->
    <view class="header">
      <text class="title">角色管理</text>
      <text class="subtitle">选择一个角色开始对话</text>
    </view>
    
    <!-- 当前角色展示 -->
    <view class="current-character" v-if="characterStore.state.currentCharacter">
      <view class="current-label">当前角色</view>
      <view class="current-card" @click="goToDetail(characterStore.state.currentCharacter.id)">
        <view class="avatar">
          <image 
            v-if="characterStore.state.currentCharacter.avatar" 
            :src="characterStore.state.currentCharacter.avatar" 
            mode="aspectFill"
          />
          <text v-else>{{ characterStore.state.currentCharacter.name?.[0] || '?' }}</text>
        </view>
        <view class="info">
          <text class="name">{{ characterStore.state.currentCharacter.name }}</text>
          <text class="type">{{ characterStore.state.currentCharacter.type }}</text>
        </view>
        <view class="arrow">
          <text class="arrow-icon">›</text>
        </view>
      </view>
    </view>
    
    <!-- 角色列表 -->
    <view class="character-list">
      <view class="list-header">
        <text class="list-title">所有角色</text>
        <text class="count">{{ characterStore.state.characters.length }} 个</text>
      </view>
      
      <!-- 加载中 -->
      <view class="loading" v-if="characterStore.state.loading">
        <text>加载中...</text>
      </view>
      
      <!-- 角色卡片 -->
      <view 
        class="character-card" 
        v-for="char in characterStore.state.characters" 
        :key="char.id"
        :class="{ 'is-current': char.id === characterStore.state.currentCharacter?.id }"
        @click="handleCardClick(char)"
      >
        <view class="avatar">
          <image v-if="char.avatar" :src="char.avatar" mode="aspectFill" />
          <text v-else>{{ char.name?.[0] || '?' }}</text>
        </view>
        <view class="info">
          <text class="name">{{ char.name }}</text>
          <view class="tags">
            <text class="tag" v-for="(p, idx) in char.personality?.slice(0, 3)" :key="idx">{{ p }}</text>
          </view>
        </view>
        <view class="actions">
          <view 
            class="switch-btn" 
            :class="{ 'is-active': char.id === characterStore.state.currentCharacter?.id }"
            @click.stop="handleSwitch(char)"
          >
            {{ char.id === characterStore.state.currentCharacter?.id ? '使用中' : '切换' }}
          </view>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view class="empty" v-if="!characterStore.state.loading && characterStore.state.characters.length === 0">
        <text class="empty-text">暂无角色</text>
        <text class="empty-hint">点击下方按钮创建你的第一个角色</text>
      </view>
    </view>
    
    <!-- 创建按钮 -->
    <view class="create-btn" @click="goToCreate">
      <text class="create-icon">+</text>
      <text class="create-text">创建新角色</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { Character } from '@/api/character'

const characterStore = useCharacterStore

// 加载数据
onMounted(async () => {
  try {
    await characterStore.fetchCharacters()
    await characterStore.fetchCurrentCharacter()
  } catch (error) {
    console.error('加载数据失败:', error)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
})

// 点击卡片
const handleCardClick = (char: Character) => {
  goToDetail(char.id)
}

// 切换角色
const handleSwitch = async (char: Character) => {
  if (char.id === characterStore.state.currentCharacter?.id) return
  
  try {
    await characterStore.switchCharacter(char.id)
    uni.showToast({ title: '切换成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '切换失败', icon: 'none' })
  }
}

// 跳转详情
const goToDetail = (id: string) => {
  uni.navigateTo({
    url: `/pages/character/detail?id=${id}`
  })
}

// 跳转创建
const goToCreate = () => {
  uni.navigateTo({
    url: '/pages/character/create'
  })
}
</script>

<style lang="scss" scoped>
.character-list-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 140rpx;
}

.header {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.current-character {
  padding: 30rpx;
}

.current-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.current-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.character-list {
  padding: 0 30rpx;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.count {
  font-size: 24rpx;
  color: #999;
}

.loading {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.character-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  
  &.is-current {
    border: 2rpx solid #667eea;
    background-color: rgba(102, 126, 234, 0.05);
  }
}

.avatar {
  width: 100rpx;
  height: 100rpx;
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
    font-size: 40rpx;
    color: #fff;
    font-weight: bold;
  }
}

.info {
  flex: 1;
  margin-left: 24rpx;
  overflow: hidden;
}

.name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.type {
  font-size: 24rpx;
  color: #999;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}

.tag {
  font-size: 22rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  margin-right: 10rpx;
  margin-top: 6rpx;
}

.actions {
  flex-shrink: 0;
}

.switch-btn {
  padding: 12rpx 24rpx;
  background-color: #667eea;
  color: #fff;
  font-size: 24rpx;
  border-radius: 30rpx;
  
  &.is-active {
    background-color: #e8e8e8;
    color: #999;
  }
}

.arrow {
  margin-left: 16rpx;
}

.arrow-icon {
  font-size: 36rpx;
  color: #ccc;
}

.empty {
  text-align: center;
  padding: 100rpx 0;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
  display: block;
  margin-bottom: 16rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
}

.create-btn {
  position: fixed;
  bottom: 40rpx;
  left: 30rpx;
  right: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
}

.create-icon {
  font-size: 40rpx;
  color: #fff;
  margin-right: 10rpx;
}

.create-text {
  font-size: 30rpx;
  color: #fff;
  font-weight: 500;
}
</style>
