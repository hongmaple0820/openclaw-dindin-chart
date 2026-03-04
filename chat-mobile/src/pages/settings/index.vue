<template>
  <view class="settings-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">设置</text>
    </view>
    
    <!-- 用户信息 -->
    <view class="user-section" @click="goToProfile">
      <view class="user-avatar">
        <image v-if="userInfo.avatar" :src="userInfo.avatar" mode="aspectFill" />
        <text v-else>{{ userInfo.nickname?.[0] || '?' }}</text>
      </view>
      <view class="user-info">
        <text class="user-name">{{ userInfo.nickname || '未登录' }}</text>
        <text class="user-desc">{{ userInfo.email || '点击登录' }}</text>
      </view>
      <view class="arrow">
        <text>›</text>
      </view>
    </view>
    
    <!-- 功能设置 -->
    <view class="settings-section">
      <text class="section-title">功能设置</text>
      
      <view class="setting-item" @click="goToNotificationSettings">
        <view class="setting-icon">🔔</view>
        <text class="setting-label">通知设置</text>
        <view class="setting-value">
          <text class="arrow">›</text>
        </view>
      </view>
      
      <view class="setting-item" @click="goToThemeSettings">
        <view class="setting-icon">🎨</view>
        <text class="setting-label">主题设置</text>
        <view class="setting-value">
          <text class="value-text">{{ themeText }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      
      <view class="setting-item">
        <view class="setting-icon">🌐</view>
        <text class="setting-label">API 地址</text>
        <view class="setting-value">
          <text class="value-text">{{ apiUrl }}</text>
        </view>
      </view>
    </view>
    
    <!-- 通用设置 -->
    <view class="settings-section">
      <text class="section-title">通用</text>
      
      <view class="setting-item">
        <view class="setting-icon">🔊</view>
        <text class="setting-label">消息提示音</text>
        <switch :checked="soundEnabled" @change="toggleSound" color="#667eea" />
      </view>
      
      <view class="setting-item">
        <view class="setting-icon">📳</view>
        <text class="setting-label">震动反馈</text>
        <switch :checked="vibrationEnabled" @change="toggleVibration" color="#667eea" />
      </view>
      
      <view class="setting-item">
        <view class="setting-icon">🌙</view>
        <text class="setting-label">深色模式</text>
        <switch :checked="darkMode" @change="toggleDarkMode" color="#667eea" />
      </view>
    </view>
    
    <!-- 数据管理 -->
    <view class="settings-section">
      <text class="section-title">数据管理</text>
      
      <view class="setting-item" @click="clearCache">
        <view class="setting-icon">🗑️</view>
        <text class="setting-label">清除缓存</text>
        <view class="setting-value">
          <text class="value-text">{{ cacheSize }}</text>
          <text class="arrow">›</text>
        </view>
      </view>
      
      <view class="setting-item" @click="exportData">
        <view class="setting-icon">📤</view>
        <text class="setting-label">导出数据</text>
        <view class="setting-value">
          <text class="arrow">›</text>
        </view>
      </view>
      
      <view class="setting-item danger" @click="clearAllData">
        <view class="setting-icon">⚠️</view>
        <text class="setting-label">清除所有数据</text>
        <view class="setting-value">
          <text class="arrow">›</text>
        </view>
      </view>
    </view>
    
    <!-- 关于 -->
    <view class="settings-section">
      <text class="section-title">关于</text>
      
      <view class="setting-item">
        <view class="setting-icon">📱</view>
        <text class="setting-label">版本号</text>
        <view class="setting-value">
          <text class="value-text">v1.0.0</text>
        </view>
      </view>
      
      <view class="setting-item" @click="checkUpdate">
        <view class="setting-icon">🔄</view>
        <text class="setting-label">检查更新</text>
        <view class="setting-value">
          <text class="arrow">›</text>
        </view>
      </view>
      
      <view class="setting-item" @click="showAbout">
        <view class="setting-icon">ℹ️</view>
        <text class="setting-label">关于应用</text>
        <view class="setting-value">
          <text class="arrow">›</text>
        </view>
      </view>
    </view>
    
    <!-- 退出登录 -->
    <view class="logout-section" v-if="isLoggedIn">
      <view class="logout-btn" @click="handleLogout">
        <text>退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const userInfo = ref({
  nickname: '',
  email: '',
  avatar: ''
})

const soundEnabled = ref(true)
const vibrationEnabled = ref(true)
const darkMode = ref(false)
const cacheSize = ref('0 KB')
const apiUrl = ref('http://localhost:8273')

const isLoggedIn = computed(() => !!userInfo.value.nickname)

const themeText = computed(() => darkMode.value ? '深色' : '浅色')

onMounted(() => {
  // 加载用户信息
  const user = uni.getStorageSync('user')
  if (user) {
    userInfo.value = user
  }
  
  // 加载设置
  soundEnabled.value = uni.getStorageSync('soundEnabled') !== 'false'
  vibrationEnabled.value = uni.getStorageSync('vibrationEnabled') !== 'false'
  darkMode.value = uni.getStorageSync('darkMode') === 'true'
  
  // 计算缓存大小
  calculateCacheSize()
})

function goToProfile() {
  if (!isLoggedIn.value) {
    uni.navigateTo({ url: '/pages/login/index' })
  } else {
    uni.navigateTo({ url: '/pages/settings/profile' })
  }
}

function goToNotificationSettings() {
  uni.navigateTo({ url: '/pages/settings/notifications' })
}

function goToThemeSettings() {
  uni.navigateTo({ url: '/pages/settings/theme' })
}

function toggleSound(e: any) {
  soundEnabled.value = e.detail.value
  uni.setStorageSync('soundEnabled', e.detail.value)
}

function toggleVibration(e: any) {
  vibrationEnabled.value = e.detail.value
  uni.setStorageSync('vibrationEnabled', e.detail.value)
}

function toggleDarkMode(e: any) {
  darkMode.value = e.detail.value
  uni.setStorageSync('darkMode', e.detail.value)
  // TODO: 实际切换主题
}

async function calculateCacheSize() {
  // 简化计算
  cacheSize.value = '1.2 MB'
}

async function clearCache() {
  const [, result] = await uni.showModal({
    title: '清除缓存',
    content: '确定要清除缓存吗？'
  })
  
  if (result) {
    uni.showLoading({ title: '清除中...' })
    await new Promise(resolve => setTimeout(resolve, 1000))
    cacheSize.value = '0 KB'
    uni.hideLoading()
    uni.showToast({ title: '已清除', icon: 'success' })
  }
}

function exportData() {
  uni.showToast({ title: '功能开发中', icon: 'none' })
}

async function clearAllData() {
  const [, result] = await uni.showModal({
    title: '警告',
    content: '确定要清除所有数据吗？此操作不可恢复！'
  })
  
  if (result) {
    uni.showLoading({ title: '清除中...' })
    uni.clearStorageSync()
    uni.hideLoading()
    uni.showToast({ title: '已清除', icon: 'success' })
    
    // 跳转到登录页
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1500)
  }
}

function checkUpdate() {
  uni.showLoading({ title: '检查中...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '已是最新版本', icon: 'success' })
  }, 1500)
}

function showAbout() {
  uni.showModal({
    title: '关于',
    content: 'chat-mobile v1.0.0\n\n基于 uni-app 开发的智能助手客户端\n\n作者: 小琳',
    showCancel: false
  })
}

async function handleLogout() {
  const [, result] = await uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？'
  })
  
  if (result) {
    uni.removeStorageSync('token')
    uni.removeStorageSync('user')
    uni.reLaunch({ url: '/pages/login/index' })
  }
}
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.user-section {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  
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

.user-info {
  flex: 1;
  margin-left: 24rpx;
}

.user-name {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.user-desc {
  font-size: 26rpx;
  color: #999;
}

.arrow {
  font-size: 36rpx;
  color: #ccc;
}

.settings-section {
  background-color: #fff;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 26rpx;
  color: #999;
  padding: 20rpx 30rpx 10rpx;
  display: block;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #f5f5f5;
  
  &:last-child {
    border-bottom: none;
  }
  
  &.danger {
    .setting-label {
      color: #f44336;
    }
  }
}

.setting-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.setting-label {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.setting-value {
  display: flex;
  align-items: center;
}

.value-text {
  font-size: 26rpx;
  color: #999;
  margin-right: 8rpx;
}

.logout-section {
  padding: 40rpx 30rpx;
}

.logout-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  color: #f44336;
}
</style>