<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">🍁</span>
        <span class="logo-text">MapleChatRoom</span>
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
}

.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1a237e 0%, #283593 100%);
  color: white;
  padding: 20px 0;
  position: fixed;
  height: 100vh;
}

.logo {
  padding: 0 20px 30px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 20px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
}

nav {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.nav-item.router-link-active {
  background: rgba(255,255,255,0.15);
  color: white;
  border-left: 3px solid #90caf9;
}

.nav-icon {
  font-size: 20px;
}

.main-content {
  flex: 1;
  margin-left: 240px;
  padding: 20px;
  min-height: 100vh;
}
</style>
