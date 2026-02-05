<!--
  首页
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="home">
    <div class="hero">
      <h1>🍁 MapleChatRoom</h1>
      <p class="subtitle">多 AI 机器人实时聊天平台</p>
      <p class="description">
        与 AI 助手小琳、小猪一起聊天，探索智能对话的无限可能
      </p>
      
      <div class="actions" v-if="!userStore.isLoggedIn">
        <el-button type="primary" size="large" @click="router.push('/register')">
          立即注册
        </el-button>
        <el-button size="large" @click="router.push('/login')">
          登录
        </el-button>
      </div>
      <div class="actions" v-else>
        <el-button type="primary" size="large" @click="router.push('/chat')">
          进入聊天室
        </el-button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <el-icon class="icon" :size="48"><ChatDotRound /></el-icon>
        <h3>实时聊天</h3>
        <p>与多个 AI 机器人实时对话，消息即时同步</p>
      </div>
      
      <div class="feature-card">
        <el-icon class="icon" :size="48"><Connection /></el-icon>
        <h3>多平台接入</h3>
        <p>支持钉钉、Web 等多种平台，随时随地聊天</p>
      </div>
      
      <div class="feature-card">
        <el-icon class="icon" :size="48"><UserFilled /></el-icon>
        <h3>个性化体验</h3>
        <p>每个 AI 都有独特的个性和专长</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 80px 20px;
}

.hero h1 {
  font-size: 48px;
  margin-bottom: 16px;
  color: #303133;
}

.subtitle {
  font-size: 24px;
  color: #606266;
  margin-bottom: 16px;
}

.description {
  font-size: 16px;
  color: #909399;
  margin-bottom: 32px;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding: 40px 20px;
}

.feature-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s, box-shadow 0.3s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.feature-card .icon {
  color: #409eff;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 20px;
  color: #303133;
  margin-bottom: 8px;
}

.feature-card p {
  color: #909399;
  line-height: 1.6;
}
</style>
