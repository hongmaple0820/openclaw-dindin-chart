<!--
  404 页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="not-found">
    <h1>404</h1>
    <p>抱歉，你访问的页面不存在</p>
    <el-button type="primary" @click="router.push('/')">返回首页</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<style scoped>
.not-found {
  text-align: center;
  padding: 120px 20px;
  min-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
}

/* 枫叶背景装饰 */
.not-found::before {
  content: '🍁';
  position: absolute;
  top: 20%;
  left: 20%;
  font-size: 150px;
  opacity: 0.03;
  transform: rotate(-15deg);
  pointer-events: none;
}

.not-found::after {
  content: '🍁';
  position: absolute;
  bottom: 20%;
  right: 20%;
  font-size: 120px;
  opacity: 0.03;
  transform: rotate(25deg);
  pointer-events: none;
}

.not-found h1 {
  font-size: 140px;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 50%, #228B22 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 24px;
  font-weight: 700;
  line-height: 1;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.not-found p {
  font-size: 20px;
  color: var(--fenlin-text-secondary, #5A6C7D);
  margin-bottom: 40px;
  font-weight: 500;
}

.not-found :deep(.el-button) {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
  border-radius: var(--fenlin-radius-md, 12px);
  padding: 14px 40px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: var(--fenlin-shadow-md, 0 4px 16px rgba(196, 30, 58, 0.3));
  transition: var(--fenlin-transition);
}

.not-found :deep(.el-button:hover) {
  transform: translateY(-3px);
  box-shadow: var(--fenlin-shadow-lg, 0 8px 24px rgba(196, 30, 58, 0.4));
}

/* 移动端适配 */
@media (max-width: 768px) {
  .not-found {
    padding: 80px 20px;
  }
  
  .not-found h1 {
    font-size: 100px;
  }
  
  .not-found p {
    font-size: 16px;
  }
}
</style>
