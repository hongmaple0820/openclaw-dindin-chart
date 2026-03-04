<!--
  管理后台布局组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo" v-if="!sidebarCollapsed">
          <el-icon><Setting /></el-icon>
          <span>管理后台</span>
        </div>
        <el-button 
          class="collapse-btn" 
          text 
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <el-icon>
            <Fold v-if="!sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
        </el-button>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        :collapse="sidebarCollapsed"
        :collapse-transition="false"
        router
        class="admin-menu"
      >
        <el-menu-item index="/admin/dashboard">
          <el-icon><DataBoard /></el-icon>
          <template #title>数据仪表盘</template>
        </el-menu-item>
        
        <el-menu-item index="/admin/users">
          <el-icon><UserFilled /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        
        <el-menu-item index="/admin/skills">
          <el-icon><MagicStick /></el-icon>
          <template #title>技能管理</template>
        </el-menu-item>
        
        <el-menu-item index="/admin/mcp">
          <el-icon><Connection /></el-icon>
          <template #title>MCP 管理</template>
        </el-menu-item>
        
        <el-menu-item index="/admin/monitor">
          <el-icon><Monitor /></el-icon>
          <template #title>系统监控</template>
        </el-menu-item>
        
        <el-divider />
        
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <template #title>返回首页</template>
        </el-menu-item>
      </el-menu>
      
      <!-- 用户信息 -->
      <div class="sidebar-footer" v-if="!sidebarCollapsed">
        <div class="admin-info">
          <el-avatar :size="36" :src="userStore.user?.avatar">
            {{ userStore.nickname?.charAt(0) }}
          </el-avatar>
          <div class="admin-details">
            <div class="admin-name">{{ userStore.nickname }}</div>
            <el-tag size="small" type="danger">超级管理员</el-tag>
          </div>
        </div>
      </div>
    </aside>
    
    <!-- 主内容区 -->
    <main class="admin-main">
      <!-- 顶部栏 -->
      <header class="admin-header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">管理后台</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-badge :value="notificationCount" :hidden="notificationCount === 0" class="notification-badge">
            <el-button text @click="showNotifications">
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
          <el-button text @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            退出
          </el-button>
        </div>
      </header>
      
      <!-- 内容区 -->
      <div class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Setting, Fold, Expand, DataBoard, UserFilled, MagicStick,
  Connection, Monitor, HomeFilled, Bell, SwitchButton
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const sidebarCollapsed = ref(false);
const notificationCount = ref(0);

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta?.title || '');

function showNotifications() {
  // TODO: 显示通知面板
  ElMessage.info('暂无新通知');
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning'
    });
    await userStore.logout();
    ElMessage.success('已退出登录');
    router.push('/login');
  } catch (e) {
    // 取消
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

/* 侧边栏 */
.admin-sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
}

.admin-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
  font-size: 18px;
  font-weight: 600;
}

.logo .el-icon {
  font-size: 24px;
  color: #C41E3A;
}

.collapse-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}

.collapse-btn:hover {
  color: white !important;
}

/* 菜单 */
.admin-menu {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
}

.admin-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.3s;
}

.admin-menu :deep(.el-menu-item:hover) {
  background: rgba(196, 30, 58, 0.2);
  color: white;
}

.admin-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  color: white;
}

.admin-menu :deep(.el-divider) {
  margin: 12px 0;
  border-color: rgba(255, 255, 255, 0.1);
}

/* 底部用户信息 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-info .el-avatar {
  border: 2px solid #C41E3A;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
  color: white;
}

.admin-details {
  flex: 1;
  min-width: 0;
}

.admin-name {
  color: white;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 主内容区 */
.admin-main {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
}

.admin-sidebar.collapsed + .admin-main {
  margin-left: 64px;
}

/* 顶部栏 */
.admin-header {
  height: 60px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-badge :deep(.el-badge__content) {
  background: #C41E3A;
}

/* 内容区 */
.admin-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .admin-sidebar {
    width: 64px;
  }
  
  .admin-main {
    margin-left: 64px;
  }
  
  .admin-content {
    padding: 16px;
  }
}
</style>