<template>
  <view class="login-container">
    <!-- Logo 和标题区域 -->
    <view class="header">
      <view class="logo-area">
        <text class="logo-text">Chat App</text>
      </view>
      <text class="subtitle">欢迎回来，请登录</text>
    </view>

    <!-- 表单区域 -->
    <view class="form-area">
      <!-- 用户名输入框 -->
      <view class="input-group">
        <text class="label">用户名</text>
        <input 
          class="input" 
          type="text" 
          v-model="form.username" 
          placeholder="请输入用户名"
          maxlength="20"
        />
      </view>

      <!-- 密码输入框 -->
      <view class="input-group">
        <text class="label">密码</text>
        <input 
          class="input" 
          type="password" 
          v-model="form.password" 
          placeholder="请输入密码"
          maxlength="20"
        />
      </view>

      <!-- 登录按钮 -->
      <button 
        class="login-btn" 
        :loading="loading" 
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </view>

    <!-- 错误提示 -->
    <view class="error-tip" v-if="errorMsg">
      <text>{{ errorMsg }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/user'

// 用户 Store
const userStore = useUserStore()

// 表单数据
const form = reactive({
  username: '',
  password: ''
})

// 加载状态
const loading = ref(false)

// 错误信息
const errorMsg = ref('')

// 登录处理
const handleLogin = async () => {
  // 表单验证
  if (!form.username.trim()) {
    errorMsg.value = '请输入用户名'
    return
  }
  
  if (!form.password.trim()) {
    errorMsg.value = '请输入密码'
    return
  }
  
  // 清空错误信息
  errorMsg.value = ''
  
  // 开始登录
  loading.value = true
  
  try {
    // 调用登录接口
    await userStore.login(form.username, form.password)
    
    uni.showToast({
      title: '登录成功',
      icon: 'success'
    })
    
    // 跳转到首页
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/index/index'
      })
    }, 1500)
    
  } catch (error: any) {
    errorMsg.value = error.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 120rpx 60rpx;
  display: flex;
  flex-direction: column;
}

.header {
  margin-bottom: 80rpx;
}

.logo-area {
  margin-bottom: 20rpx;
}

.logo-text {
  font-size: 56rpx;
  font-weight: bold;
  color: #333;
}

.subtitle {
  font-size: 28rpx;
  color: #999;
}

.form-area {
  flex: 1;
}

.input-group {
  margin-bottom: 40rpx;
}

.label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
}

.input {
  width: 100%;
  height: 96rpx;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 0 30rpx;
  font-size: 30rpx;
  box-sizing: border-box;
  
  &::placeholder {
    color: #bbb;
  }
}

.login-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  border: none;
  margin-top: 60rpx;
  
  &:active {
    opacity: 0.9;
  }
}

.error-tip {
  margin-top: 30rpx;
  padding: 20rpx 30rpx;
  background-color: #fee2e2;
  border-radius: 12rpx;
  
  text {
    font-size: 26rpx;
    color: #dc2626;
  }
}
</style>
