<!--
  默认布局组件
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="layout">
    <!-- 移动端遮罩 -->
    <div class="mobile-overlay" :class="{ show: showMobileMenu }" @click="showMobileMenu = false"></div>
    
    <!-- 顶部导航 -->
    <el-header class="header">
      <div class="header-left">
        <!-- 移动端菜单按钮 -->
        <el-button class="mobile-menu-toggle" text @click="showMobileMenu = !showMobileMenu">
          <el-icon :size="24"><Menu /></el-icon>
        </el-button>
        
        <router-link to="/" class="logo">
          <el-icon><ChatDotRound /></el-icon>
          <span>枫琳</span>
        </router-link>
        
        <!-- 桌面端导航菜单 -->
        <el-menu
          class="desktop-menu"
          mode="horizontal"
          :router="true"
          :default-active="route.path"
          :ellipsis="false"
          @select="showMobileMenu = false"
        >
          <el-menu-item index="/">首页</el-menu-item>
          <el-menu-item index="/chat" v-if="userStore.isLoggedIn">协作空间</el-menu-item>
          <el-menu-item index="/dm" v-if="userStore.isLoggedIn">枫语私语</el-menu-item>
          <el-menu-item index="/groups" v-if="userStore.isLoggedIn">
            群聊
            <el-badge 
              v-if="groupUnreadCount > 0" 
              :value="groupUnreadCount" 
              :max="99"
              class="nav-badge"
            />
          </el-menu-item>
          <el-menu-item index="/friends" v-if="userStore.isLoggedIn">
            好友
            <el-badge 
              v-if="pendingFriendRequests > 0" 
              :value="pendingFriendRequests" 
              :max="99"
              class="nav-badge"
            />
          </el-menu-item>
          <el-menu-item index="/files" v-if="userStore.isLoggedIn">个人网盘</el-menu-item>
          <el-sub-menu index="tools" v-if="userStore.isLoggedIn">
            <template #title>
              <el-icon><Tools /></el-icon>
              工具
            </template>
            <el-menu-item index="/agents">
              <el-icon><User /></el-icon>
              智能体
            </el-menu-item>
            <el-menu-item index="/skills">
              <el-icon><MagicStick /></el-icon>
              技能库
            </el-menu-item>
            <el-menu-item index="/tasks">
              <el-icon><List /></el-icon>
              任务
            </el-menu-item>
            <el-menu-item index="/scheduler">
              <el-icon><Clock /></el-icon>
              调度器
            </el-menu-item>
            <el-menu-item index="/sandboxes">
              <el-icon><Monitor /></el-icon>
              沙箱
            </el-menu-item>
            <el-menu-item index="/workspaces">
              <el-icon><FolderOpened /></el-icon>
              工作空间
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="admin" v-if="userStore.isLoggedIn && userStore.isAdmin">
            <template #title>
              <el-icon><Setting /></el-icon>
              管理
            </template>
            <el-menu-item index="/observability">
              <el-icon><DataAnalysis /></el-icon>
              可观测性
            </el-menu-item>
            <el-menu-item index="/admin">
              <el-icon><DataBoard /></el-icon>
              数据仪表盘
            </el-menu-item>
            <el-menu-item index="/admin/users">
              <el-icon><UserFilled /></el-icon>
              用户管理
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </div>
      
      <!-- 移动端导航菜单 -->
      <div class="mobile-menu" :class="{ 'show-mobile': showMobileMenu }">
        <el-menu
          mode="vertical"
          :router="true"
          :default-active="route.path"
          @select="showMobileMenu = false"
        >
          <el-menu-item index="/">首页</el-menu-item>
          <el-menu-item index="/chat" v-if="userStore.isLoggedIn">协作空间</el-menu-item>
          <el-menu-item index="/dm" v-if="userStore.isLoggedIn">枫语私语</el-menu-item>
          <el-menu-item index="/groups" v-if="userStore.isLoggedIn">
            群聊
            <el-badge 
              v-if="groupUnreadCount > 0" 
              :value="groupUnreadCount" 
              :max="99"
              class="nav-badge"
            />
          </el-menu-item>
          <el-menu-item index="/friends" v-if="userStore.isLoggedIn">
            好友
            <el-badge 
              v-if="pendingFriendRequests > 0" 
              :value="pendingFriendRequests" 
              :max="99"
              class="nav-badge"
            />
          </el-menu-item>
          <el-menu-item index="/files" v-if="userStore.isLoggedIn">个人网盘</el-menu-item>
          <el-sub-menu index="tools-mobile" v-if="userStore.isLoggedIn">
            <template #title>
              <el-icon><Tools /></el-icon>
              工具
            </template>
            <el-menu-item index="/agents">智能体</el-menu-item>
            <el-menu-item index="/skills">技能库</el-menu-item>
            <el-menu-item index="/tasks">任务</el-menu-item>
            <el-menu-item index="/scheduler">调度器</el-menu-item>
            <el-menu-item index="/sandboxes">沙箱</el-menu-item>
            <el-menu-item index="/workspaces">工作空间</el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="admin-mobile" v-if="userStore.isLoggedIn && userStore.isAdmin">
            <template #title>
              <el-icon><Setting /></el-icon>
              管理
            </template>
            <el-menu-item index="/observability">可观测性</el-menu-item>
            <el-menu-item index="/admin">数据仪表盘</el-menu-item>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </div>

      <div class="header-right">
        <template v-if="userStore.isLoggedIn">
          <el-dropdown trigger="click">
            <span class="user-info">
              <el-avatar :size="32" :src="userStore.user?.avatar">
                {{ userStore.nickname.charAt(0) }}
              </el-avatar>
              <span class="username">{{ userStore.nickname }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/profile')">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item @click="router.push('/friends')">
                  <el-icon><UserFilled /></el-icon>
                  我的好友
                </el-dropdown-item>
                <el-dropdown-item @click="router.push('/groups')">
                  <el-icon><ChatLineRound /></el-icon>
                  我的群聊
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <el-button type="primary" @click="router.push('/login')">登录</el-button>
          <el-button class="register-btn" @click="router.push('/register')">注册</el-button>
        </template>
      </div>
    </el-header>

    <!-- 主内容区 -->
    <el-main class="main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>

    <!-- 底部 -->
    <el-footer class="footer">
      <span>© 2026 枫琳 Fenlin. 人机共生，自然之道</span>
    </el-footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useFriendStore } from '@/stores/friends';
import { useGroupStore } from '@/stores/groups';
import { ElMessage } from 'element-plus';
import { 
  Menu, ChatDotRound, ArrowDown, User, UserFilled, 
  ChatLineRound, SwitchButton, Tools, MagicStick, 
  List, Clock, Monitor, FolderOpened, Setting, 
  DataAnalysis, DataBoard 
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const friendStore = useFriendStore();
const groupStore = useGroupStore();
const showMobileMenu = ref(false);

// 好友申请数量
const pendingFriendRequests = computed(() => friendStore.pendingRequestCount);

// 群聊未读数
const groupUnreadCount = computed(() => groupStore.totalUnread);

// 初始化时获取好友申请数量和群聊列表
onMounted(async () => {
  if (userStore.isLoggedIn) {
    await friendStore.fetchRequests();
    await groupStore.fetchGroups();
  }
});

const handleLogout = async () => {
  await userStore.logout();
  ElMessage.success('已退出登录');
  router.push('/');
};
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fenlin-bg, #FAFAFA);
}

/* 移动端遮罩 */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.mobile-overlay.show {
  display: block;
  opacity: 1;
}

/* 移动端菜单按钮 */
.mobile-menu-toggle {
  display: none;
  margin-right: 12px;
  color: var(--fenlin-primary);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  box-shadow: 0 2px 12px rgba(196, 30, 58, 0.08);
  padding: 0 32px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
}

.header-left .logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-decoration: none;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.header-left .logo:hover {
  transform: scale(1.05);
}

.header-left .logo :deep(.el-icon) {
  color: #C41E3A;
  font-size: 24px;
}

/* 桌面端菜单 */
.desktop-menu {
  display: flex;
  border-bottom: none;
  background: transparent;
}

.desktop-menu :deep(.el-menu-item) {
  font-weight: 500;
  color: var(--fenlin-text-secondary, #5A6C7D);
  transition: all 0.3s ease;
  border-radius: 8px;
  margin: 0 4px;
  position: relative;
}

.desktop-menu :deep(.el-menu-item:hover) {
  background: rgba(196, 30, 58, 0.05);
  color: #C41E3A;
}

.desktop-menu :deep(.el-menu-item.is-active) {
  color: #C41E3A;
  background: rgba(196, 30, 58, 0.1);
  font-weight: 600;
  border-bottom: 3px solid #C41E3A;
}

.nav-badge {
  margin-left: 4px;
}

.nav-badge :deep(.el-badge__content) {
  font-size: 10px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
}

/* 移动端菜单 */
.mobile-menu {
  display: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right :deep(.el-button) {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.header-right :deep(.el-button--primary) {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(196, 30, 58, 0.3);
}

.header-right :deep(.el-button--primary:hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(196, 30, 58, 0.4);
}

.header-right :deep(.el-button--default) {
  border: 1px solid #C41E3A;
  color: #C41E3A;
}

.header-right :deep(.el-button--default:hover) {
  background: rgba(196, 30, 58, 0.05);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.user-info:hover {
  background: rgba(196, 30, 58, 0.05);
}

.user-info :deep(.el-avatar) {
  border: 2px solid #C41E3A;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
}

.username {
  color: var(--fenlin-text-primary, #2C3E50);
  font-weight: 500;
}

.main {
  flex: 1;
  margin-top: 60px;
  padding: 32px;
  position: relative;
}

.footer {
  text-align: center;
  color: var(--fenlin-text-tertiary, #95A5A6);
  font-size: 14px;
  background: white;
  border-top: 1px solid var(--fenlin-border, #E0E0E0);
  padding: 24px;
  position: relative;
}

.footer::before {
  content: '🍁';
  position: absolute;
  left: 50%;
  top: -15px;
  transform: translateX(-50%);
  font-size: 24px;
  opacity: 0.3;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
  
  .mobile-menu-toggle {
    display: inline-flex;
  }
  
  .header-left {
    gap: 12px;
  }
  
  .header-left .logo {
    font-size: 18px;
  }
  
  .header-left .logo :deep(.el-icon) {
    font-size: 20px;
  }
  
  /* 隐藏桌面端菜单 */
  .desktop-menu {
    display: none !important;
  }
  
  /* 显示移动端菜单 */
  .mobile-menu {
    display: block;
    position: fixed;
    top: 60px;
    left: -100%;
    width: 280px;
    height: calc(100vh - 60px);
    background: white;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    transition: left 0.3s ease;
    padding: 20px 0;
    overflow-y: auto;
  }
  
  .mobile-menu.show-mobile {
    left: 0;
  }
  
  .mobile-menu :deep(.el-menu) {
    border: none;
  }
  
  .mobile-menu :deep(.el-menu-item) {
    width: 100%;
    margin: 4px 0;
    padding: 16px 24px;
    border-radius: 0;
    border-left: 4px solid transparent;
  }
  
  .mobile-menu :deep(.el-menu-item.is-active) {
    border-left-color: #C41E3A;
    border-bottom: none;
    background: rgba(196, 30, 58, 0.05);
  }
  
  .header-right {
    gap: 8px;
  }
  
  .header-right .register-btn {
    display: none;
  }
  
  .username {
    display: none;
  }
  
  .user-info {
    padding: 4px;
  }
  
  .main {
    padding: 16px;
  }
  
  .footer {
    font-size: 12px;
    padding: 16px;
  }
}

/* 小屏手机 */
@media (max-width: 375px) {
  .header-left .logo span {
    display: none;
  }
  
  .header-right :deep(.el-button) {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>