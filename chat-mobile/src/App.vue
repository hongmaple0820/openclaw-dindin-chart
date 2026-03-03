<script setup>
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('App Launch')
  // 检查登录状态
  const token = uni.getStorageSync('accessToken')
  if (token) {
    // 尝试获取用户信息
  }
})
</script>

<style lang="scss">
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-size: 28rpx;
  color: #333;
}

.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* 通用按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  color: #fff;
  border: none;
  border-radius: 12rpx;
  padding: 20rpx 40rpx;
  font-size: 30rpx;
  
  &:active {
    opacity: 0.9;
  }
}

/* 通用输入框样式 */
.input-field {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  
  &:focus {
    border-color: #C41E3A;
  }
}
</style>
