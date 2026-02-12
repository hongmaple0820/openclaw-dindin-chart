<!--
  首页
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="home">
    <div class="hero">
      <h1>🍁 枫琳 Fenlin</h1>
      <p class="subtitle">人机共生智能协作平台</p>
      <p class="description">
        让 AI 如枫叶般自然融入生活与工作，与智能伙伴共同成长
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
          开始协作
        </el-button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <el-icon class="icon" :size="48"><ChatDotRound /></el-icon>
        <h3>自然交流</h3>
        <p>人机和谐相处，AI 如枫叶般自然融入对话</p>
      </div>
      
      <div class="feature-card">
        <el-icon class="icon" :size="48"><Connection /></el-icon>
        <h3>协同办公</h3>
        <p>枫林成片，协作共生，支持钉钉、企微等多平台</p>
      </div>
      
      <div class="feature-card">
        <el-icon class="icon" :size="48"><UserFilled /></el-icon>
        <h3>共同成长</h3>
        <p>枫叶四季蜕变，人机持续进步，陪伴你的每一步</p>
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
  position: relative;
}

/* 枫叶背景装饰 */
.home::before {
  content: '🍁';
  position: absolute;
  top: 50px;
  right: -50px;
  font-size: 200px;
  opacity: 0.03;
  transform: rotate(-15deg);
  pointer-events: none;
  z-index: 0;
}

.home::after {
  content: '🍁';
  position: absolute;
  bottom: 100px;
  left: -80px;
  font-size: 150px;
  opacity: 0.03;
  transform: rotate(25deg);
  pointer-events: none;
  z-index: 0;
}

.hero {
  text-align: center;
  padding: 100px 20px 80px;
  position: relative;
  z-index: 1;
}

.hero h1 {
  font-size: 56px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 50%, #228B22 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: -1px;
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.subtitle {
  font-size: 28px;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 16px;
  font-weight: 600;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.description {
  font-size: 18px;
  color: var(--fenlin-text-secondary, #5A6C7D);
  margin-bottom: 40px;
  line-height: 1.8;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  animation: fadeInUp 0.8s ease-out 0.4s both;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  animation: fadeInUp 0.8s ease-out 0.6s both;
}

.actions :deep(.el-button) {
  padding: 16px 40px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.actions :deep(.el-button--primary) {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.3);
}

.actions :deep(.el-button--primary:hover) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(196, 30, 58, 0.4);
}

.actions :deep(.el-button--default) {
  border: 2px solid #C41E3A;
  color: #C41E3A;
  background: white;
}

.actions :deep(.el-button--default:hover) {
  background: #C41E3A;
  color: white;
  transform: translateY(-3px);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
  padding: 60px 20px;
  position: relative;
  z-index: 1;
}

.feature-card {
  background: white;
  border-radius: 20px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #C41E3A 0%, #D4A017 50%, #228B22 100%);
  transform: scaleX(0);
  transition: transform 0.4s ease;
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(196, 30, 58, 0.15);
  border-color: rgba(196, 30, 58, 0.2);
}

.feature-card:nth-child(1) .icon {
  color: #C41E3A;
}

.feature-card:nth-child(2) .icon {
  color: #D4A017;
}

.feature-card:nth-child(3) .icon {
  color: #228B22;
}

.feature-card .icon {
  margin-bottom: 20px;
  transition: transform 0.4s ease;
}

.feature-card:hover .icon {
  transform: scale(1.1) rotate(5deg);
}

.feature-card h3 {
  font-size: 22px;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 12px;
  font-weight: 600;
}

.feature-card p {
  color: var(--fenlin-text-secondary, #5A6C7D);
  line-height: 1.8;
  font-size: 15px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 40px;
  }
  
  .subtitle {
    font-size: 22px;
  }
  
  .description {
    font-size: 16px;
  }
  
  .actions {
    flex-direction: column;
    align-items: center;
  }
  
  .actions :deep(.el-button) {
    width: 100%;
    max-width: 300px;
  }
  
  .features {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
