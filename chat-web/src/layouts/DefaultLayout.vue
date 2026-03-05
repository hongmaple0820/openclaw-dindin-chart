<!--
  默认布局组件 - 重构版
  左边栏 + 顶部栏 + 内容区域 + 底部聊天框
  @author 小琳
  @date 2026-03-05
-->
<template>
  <div class="layout" :class="{ 'sidebar-collapsed': settingsStore.sidebarCollapsed }">
    <!-- 左边栏 -->
    <aside class="sidebar" :class="{ 'mobile-show': showMobileSidebar }">
      <div class="sidebar-header">
        <router-link to="/" class="logo">
          <el-icon><ChatDotRound /></el-icon>
          <span v-show="!settingsStore.sidebarCollapsed">枫琳</span>
        </router-link>
        <el-button
          v-if="!isMobile"
          class="collapse-btn"
          text
          @click="settingsStore.toggleSidebar()"
        >
          <el-icon :size="18">
            <DArrowLeft v-if="!settingsStore.sidebarCollapsed" />
            <DArrowRight v-else />
          </el-icon>
        </el-button>
      </div>

      <el-scrollbar class="sidebar-menu">
        <el-menu
          :default-active="route.path"
          :router="true"
          :collapse="settingsStore.sidebarCollapsed && !isMobile"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/about">
            <el-icon><HomeFilled /></el-icon>
            <template #title>首页</template>
          </el-menu-item>
          
          <el-menu-item index="/chat" v-if="userStore.isLoggedIn">
            <el-icon><Monitor /></el-icon>
            <template #title>协作空间</template>
          </el-menu-item>
          
          <el-menu-item index="/dm" v-if="userStore.isLoggedIn">
            <el-icon><ChatLineSquare /></el-icon>
            <template #title>私聊</template>
          </el-menu-item>
          
          <el-menu-item index="/groups" v-if="userStore.isLoggedIn">
            <el-icon><ChatDotRound /></el-icon>
            <template #title>
              群聊
              <el-badge v-if="groupUnreadCount > 0" :value="groupUnreadCount" :max="99" class="menu-badge" />
            </template>
          </el-menu-item>
          
          <el-menu-item index="/friends" v-if="userStore.isLoggedIn">
            <el-icon><User /></el-icon>
            <template #title>
              好友
              <el-badge v-if="pendingFriendRequests > 0" :value="pendingFriendRequests" :max="99" class="menu-badge" />
            </template>
          </el-menu-item>
          
          <el-menu-item index="/files" v-if="userStore.isLoggedIn">
            <el-icon><FolderOpened /></el-icon>
            <template #title>个人网盘</template>
          </el-menu-item>
          
          <el-menu-item index="/agents" v-if="userStore.isLoggedIn">
            <el-icon><UserFilled /></el-icon>
            <template #title>智能体</template>
          </el-menu-item>
          
          <el-menu-item index="/skills" v-if="userStore.isLoggedIn">
            <el-icon><MagicStick /></el-icon>
            <template #title>技能库</template>
          </el-menu-item>
          
          <el-menu-item index="/tasks" v-if="userStore.isLoggedIn">
            <el-icon><List /></el-icon>
            <template #title>任务</template>
          </el-menu-item>
          
          <el-menu-item index="/settings" v-if="userStore.isLoggedIn">
            <el-icon><Setting /></el-icon>
            <template #title>设置</template>
          </el-menu-item>
          
          <!-- 管理员菜单 -->
          <el-sub-menu index="admin" v-if="userStore.isLoggedIn && userStore.isAdmin">
            <template #title>
              <el-icon><DataBoard /></el-icon>
              <span>管理</span>
            </template>
            <el-menu-item index="/observability">
              <el-icon><DataAnalysis /></el-icon>
              <template #title>可观测性</template>
            </el-menu-item>
            <el-menu-item index="/admin">
              <el-icon><DataBoard /></el-icon>
              <template #title>数据仪表盘</template>
            </el-menu-item>
            <el-menu-item index="/admin/users">
              <el-icon><UserFilled /></el-icon>
              <template #title>用户管理</template>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>

      <!-- 底部用户信息 -->
      <div class="sidebar-footer" v-if="userStore.isLoggedIn">
        <el-dropdown trigger="click" placement="right-start">
          <div class="user-card" :class="{ collapsed: settingsStore.sidebarCollapsed }">
            <el-avatar :size="36" :src="userStore.user?.avatar">
              {{ userStore.nickname.charAt(0) }}
            </el-avatar>
            <div class="user-info" v-show="!settingsStore.sidebarCollapsed || isMobile">
              <span class="username">{{ userStore.nickname }}</span>
              <span class="user-status">在线</span>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/profile')">
                <el-icon><User /></el-icon>
                个人中心
              </el-dropdown-item>
              <el-dropdown-item @click="router.push('/settings')">
                <el-icon><Setting /></el-icon>
                设置
              </el-dropdown-item>
              <el-dropdown-item divided @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div class="mobile-overlay" :class="{ show: showMobileSidebar }" @click="showMobileSidebar = false"></div>

    <!-- 右侧主区域 -->
    <div class="main-container">
      <!-- 顶部栏 -->
      <header class="header">
        <div class="header-left">
          <!-- 移动端菜单按钮 -->
          <el-button class="mobile-menu-btn" text @click="showMobileSidebar = !showMobileSidebar">
            <el-icon :size="24"><Menu /></el-icon>
          </el-button>
          
          <!-- Logo（移动端显示） -->
          <router-link to="/" class="mobile-logo">
            <el-icon><ChatDotRound /></el-icon>
            <span>枫琳</span>
          </router-link>
          
          <!-- 当前页面标题 -->
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>

        <div class="header-right">
          <!-- 未登录 -->
          <template v-if="!userStore.isLoggedIn">
            <el-button type="primary" @click="router.push('/login')">登录</el-button>
            <el-button @click="router.push('/register')">注册</el-button>
          </template>
          
          <!-- 已登录 -->
          <template v-else>
            <!-- 设置按钮 -->
            <el-tooltip content="设置" placement="bottom">
              <el-button text @click="showSettingsPanel = true">
                <el-icon :size="20"><Setting /></el-icon>
              </el-button>
            </el-tooltip>
            
            <!-- 用户头像（桌面端） -->
            <el-dropdown trigger="click" class="user-dropdown">
              <div class="header-user">
                <el-avatar :size="32" :src="userStore.user?.avatar">
                  {{ userStore.nickname.charAt(0) }}
                </el-avatar>
                <span class="username">{{ userStore.nickname }}</span>
                <el-icon><ArrowDown /></el-icon>
              </div>
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
                  <el-dropdown-item @click="router.push('/settings')">
                    <el-icon><Setting /></el-icon>
                    设置
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleLogout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      </div>

    <!-- 设置面板 -->
    <el-drawer
      v-model="showSettingsPanel"
      title="设置"
      direction="rtl"
      size="360px"
    >
      <el-form label-position="top">
        <el-form-item label="主题">
          <el-radio-group v-model="themeSetting" @change="handleThemeChange">
            <el-radio-button value="light">亮色</el-radio-button>
            <el-radio-button value="dark">暗色</el-radio-button>
            <el-radio-button value="system">跟随系统</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="字体">
          <el-select v-model="fontSetting" @change="handleFontChange" style="width: 100%">
            <el-option
              v-for="font in AVAILABLE_FONTS"
              :key="font.value"
              :label="font.label"
              :value="font.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="字体大小">
          <el-radio-group v-model="fontSizeSetting" @change="handleFontSizeChange">
            <el-radio-button v-for="size in FONT_SIZES" :key="size.value" :value="size.value">
              {{ size.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showSettingsPanel = false">关闭</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useFriendStore } from '@/stores/friends';
import { useGroupStore } from '@/stores/groups';
import { useSettingsStore, AVAILABLE_FONTS, FONT_SIZES } from '@/stores/settings';
import { ElMessage } from 'element-plus';
import { 
  Menu, ChatDotRound, ArrowDown, User, UserFilled, 
  ChatLineSquare, SwitchButton, MagicStick, List, 
  Setting, DataAnalysis, DataBoard, HomeFilled,
  Monitor, FolderOpened, DArrowLeft, DArrowRight
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const friendStore = useFriendStore();
const groupStore = useGroupStore();
const settingsStore = useSettingsStore();

// 响应式状态
const isMobile = ref(window.innerWidth < 768);
const showMobileSidebar = ref(false);
const showSettingsPanel = ref(false);

// 设置本地状态
const themeSetting = ref(settingsStore.theme);
const fontSetting = ref(settingsStore.fontFamily);
const fontSizeSetting = ref(settingsStore.fontSize);

// 好友申请数量
const pendingFriendRequests = computed(() => friendStore.pendingRequestCount);

// 群聊未读数
const groupUnreadCount = computed(() => groupStore.totalUnread);

// 页面标题
const pageTitle = computed(() => {
  return route.meta.title || '枫琳';
});

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  if (isMobile.value && settingsStore.sidebarCollapsed) {
    settingsStore.sidebarCollapsed = false;
  }
};

// 菜单选择
const handleMenuSelect = () => {
  if (isMobile.value) {
    showMobileSidebar.value = false;
  }
};

// 设置变更
const handleThemeChange = (value) => {
  settingsStore.setTheme(value);
};

const handleFontChange = (value) => {
  settingsStore.setFontFamily(value);
};

const handleFontSizeChange = (value) => {
  settingsStore.setFontSize(value);
};



// 退出登录
const handleLogout = async () => {
  await userStore.logout();
  ElMessage.success('已退出登录');
  router.push('/');
};

// 初始化
onMounted(async () => {
  window.addEventListener('resize', handleResize);
  settingsStore.init();
  
  if (userStore.isLoggedIn) {
    await friendStore.fetchRequests();
    await groupStore.fetchGroups();
  }
});

// 监听路由变化
watch(() => route.path, () => {
  showMobileSidebar.value = false;
});
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  background: var(--fenlin-bg, #FAFAFA);
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 64px;
  --header-height: 56px;
  transition: var(--fenlin-transition, all 0.3s ease);
}

/* 侧边栏 */
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: white;
  border-right: 1px solid var(--fenlin-border, #E0E0E0);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 100;
  flex-shrink: 0;
}

.layout.sidebar-collapsed .sidebar {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--fenlin-border, #E0E0E0);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: var(--fenlin-primary, #C41E3A);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
}

.logo .el-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.collapse-btn {
  color: var(--fenlin-text-secondary, #5A6C7D);
}

.sidebar-menu {
  flex: 1;
  overflow: hidden;
}

.sidebar-menu :deep(.el-menu) {
  border-right: none;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 48px;
  line-height: 48px;
  margin: 4px 8px;
  border-radius: var(--fenlin-radius-sm, 8px);
  color: var(--fenlin-text-secondary, #5A6C7D);
  transition: var(--fenlin-transition, all 0.3s ease);
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background: rgba(196, 30, 58, 0.05);
  color: var(--fenlin-primary, #C41E3A);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: rgba(196, 30, 58, 0.1);
  color: var(--fenlin-primary, #C41E3A);
  font-weight: 600;
}

.menu-badge {
  margin-left: 8px;
}

.menu-badge :deep(.el-badge__content) {
  font-size: 10px;
  height: 16px;
  line-height: 16px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--fenlin-border, #E0E0E0);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--fenlin-radius-md, 12px);
  cursor: pointer;
  transition: var(--fenlin-transition, all 0.3s ease);
}

.user-card:hover {
  background: var(--fenlin-bg, #FAFAFA);
}

.user-card.collapsed {
  padding: 8px;
  justify-content: center;
}

.user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  font-size: 12px;
  color: var(--fenlin-accent, #228B22);
}

/* 主容器 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* 顶部栏 */
.header {
  height: var(--header-height);
  background: white;
  border-bottom: 1px solid var(--fenlin-border, #E0E0E0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mobile-menu-btn {
  display: none;
  color: var(--fenlin-primary, #C41E3A);
}

.mobile-logo {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--fenlin-primary, #C41E3A);
  text-decoration: none;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 24px;
  transition: var(--fenlin-transition, all 0.3s ease);
}

.header-user:hover {
  background: var(--fenlin-bg, #FAFAFA);
}

.header-user .username {
  font-weight: 500;
}

/* 内容区域 */
.content {
  flex: 1;
  overflow: auto;
  padding: 24px;
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

/* 移动端适配 */
@media (max-width: 768px) {
  .layout {
    --sidebar-width: 260px;
  }
  
  .sidebar {
    position: fixed;
    left: -100%;
    top: 0;
    height: 100vh;
    box-shadow: none;
    z-index: 200;
  }
  
  .sidebar.mobile-show {
    left: 0;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  }
  
  .mobile-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
  }
  
  .mobile-overlay.show {
    display: block;
  }
  
  .header {
    padding: 0 16px;
  }
  
  .mobile-menu-btn {
    display: inline-flex;
  }
  
  .mobile-logo {
    display: flex;
  }
  
  .page-title {
    display: none;
  }
  
  .header-user .username {
    display: none;
  }
  
  .content {
    padding: 16px;
  }
}

/* 暗色主题 */
:root[data-theme="dark"] {
  --fenlin-bg: #1a1a1a;
  --fenlin-bg-secondary: #2a2a2a;
  --fenlin-surface: #242424;
  --fenlin-border: #333;
  --fenlin-text-primary: #e0e0e0;
  --fenlin-text-secondary: #a0a0a0;
  --fenlin-text-tertiary: #666;
}

:root[data-theme="dark"] .sidebar,
:root[data-theme="dark"] .header {
  background: var(--fenlin-surface);
  border-color: var(--fenlin-border);
}

:root[data-theme="dark"] .sidebar-menu :deep(.el-menu-item) {
  color: var(--fenlin-text-secondary);
}

:root[data-theme="dark"] .sidebar-menu :deep(.el-menu-item:hover),
:root[data-theme="dark"] .sidebar-menu :deep(.el-menu-item.is-active) {
  background: rgba(196, 30, 58, 0.2);
}
</style>