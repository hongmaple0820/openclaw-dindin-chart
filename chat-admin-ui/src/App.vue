<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">🍁</span>
        <span class="logo-text">枫琳管理后台</span>
      </div>
      <nav>
        <router-link to="/dashboard" class="nav-item">
          <span class="nav-icon">📊</span>
          <span>控制面板</span>
        </router-link>
        <router-link to="/messages" class="nav-item">
          <span class="nav-icon">💬</span>
          <span>消息管理</span>
        </router-link>
        <router-link to="/users" class="nav-item">
          <span class="nav-icon">👥</span>
          <span>用户管理</span>
        </router-link>
        <router-link to="/stats" class="nav-item">
          <span class="nav-icon">📈</span>
          <span>数据统计</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  background: #F5F7FA;
  color: #2C3E50;
}

.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #C41E3A 0%, #A01830 100%);
  color: white;
  padding: 0;
  position: fixed;
  height: 100vh;
  box-shadow: 4px 0 20px rgba(196, 30, 58, 0.15);
  z-index: 100;
}

.logo {
  padding: 32px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.1);
}

.logo-icon {
  font-size: 32px;
  animation: maple-float 3s ease-in-out infinite;
}

@keyframes maple-float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-5px) rotate(5deg);
  }
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #FFFFFF 0%, #FFE082 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

nav {
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #D4A017;
  transform: scaleY(0);
  transition: transform 0.3s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  transform: translateX(4px);
}

.nav-item:hover::before {
  transform: scaleY(1);
}

.nav-item.router-link-active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.nav-item.router-link-active::before {
  transform: scaleY(1);
  background: #D4A017;
}

.nav-icon {
  font-size: 22px;
  transition: transform 0.3s ease;
}

.nav-item:hover .nav-icon {
  transform: scale(1.1);
}

.main-content {
  flex: 1;
  margin-left: 260px;
  padding: 32px;
  min-height: 100vh;
  background: #F5F7FA;
  position: relative;
}

/* 枫叶背景装饰 */
.main-content::before {
  content: '🍁';
  position: fixed;
  top: 100px;
  right: 50px;
  font-size: 150px;
  opacity: 0.02;
  transform: rotate(-20deg);
  pointer-events: none;
  z-index: 0;
}

.main-content::after {
  content: '🍁';
  position: fixed;
  bottom: 100px;
  left: 300px;
  font-size: 120px;
  opacity: 0.02;
  transform: rotate(30deg);
  pointer-events: none;
  z-index: 0;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #F5F7FA;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #C41E3A;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #A01830;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 200px;
  }
  
  .main-content {
    margin-left: 200px;
    padding: 16px;
  }
  
  .logo {
    padding: 24px 16px;
  }
  
  .logo-text {
    font-size: 16px;
  }
  
  .nav-item {
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>
