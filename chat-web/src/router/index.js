/**
 * 路由配置
 * @author 小琳
 * @date 2026-02-06
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

// 路由配置
const routes = [
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/Chat.vue'),
        meta: { title: '协作空间', requiresAuth: true }
      },
      {
        path: 'dm',
        name: 'DM',
        component: () => import('@/views/DM.vue'),
        meta: { title: '枫语私语', requiresAuth: true }
      },
      {
        path: 'friends',
        name: 'Friends',
        component: () => import('@/views/Friends.vue'),
        meta: { title: '好友', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      },
      {
        path: 'files',
        name: 'Files',
        component: () => import('@/views/FileManagement.vue'),
        meta: { title: '个人网盘', requiresAuth: true }
      },
      {
        path: 'admin',
        name: 'AdminDashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据仪表盘', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/messages',
        name: 'AdminMessages',
        component: () => import('@/views/Messages.vue'),
        meta: { title: '消息管理', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('@/views/Users.vue'),
        meta: { title: '用户管理', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/images',
        name: 'AdminImages',
        component: () => import('@/views/Images.vue'),
        meta: { title: '图片管理', requiresAuth: true, requiresAdmin: true }
      },
      {
        path: 'admin/stats',
        name: 'AdminStats',
        component: () => import('@/views/Stats.vue'),
        meta: { title: '数据统计', requiresAuth: true, requiresAdmin: true }
      },
      // 可观测性仪表板
      {
        path: 'observability',
        name: 'ObservabilityDashboard',
        component: () => import('@/views/ObservabilityDashboard.vue'),
        meta: { title: '可观测性仪表板', requiresAuth: true }
      },
      // 群聊相关路由
      {
        path: 'groups',
        name: 'Groups',
        component: () => import('@/views/Groups.vue'),
        meta: { title: '群聊', requiresAuth: true }
      },
      {
        path: 'groups/create',
        name: 'CreateGroup',
        component: () => import('@/views/CreateGroup.vue'),
        meta: { title: '创建群聊', requiresAuth: true }
      },
      {
        path: 'groups/:id/settings',
        name: 'GroupSettings',
        component: () => import('@/views/GroupSettings.vue'),
        meta: { title: '群设置', requiresAuth: true }
      },
      // 项目群相关路由
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/Projects.vue'),
        meta: { title: '项目群', requiresAuth: true }
      },
      {
        path: 'projects/create',
        name: 'CreateProject',
        component: () => import('@/views/CreateProject.vue'),
        meta: { title: '创建项目', requiresAuth: true }
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/ProjectDetail.vue'),
        meta: { title: '项目详情', requiresAuth: true }
      },
      {
        path: 'projects/:id/tasks',
        name: 'ProjectTasks',
        component: () => import('@/views/ProjectTasks.vue'),
        meta: { title: '任务看板', requiresAuth: true }
      },
      {
        path: 'projects/:id/skills',
        name: 'ProjectSkills',
        component: () => import('@/views/ProjectSkills.vue'),
        meta: { title: '技能管理', requiresAuth: true }
      },
      // 技能相关路由
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/Skills.vue'),
        meta: { title: '技能库', requiresAuth: true }
      },
      {
        path: 'skills/:id',
        name: 'SkillDetail',
        component: () => import('@/views/SkillDetail.vue'),
        meta: { title: '技能详情', requiresAuth: true }
      },
      // Agent 相关路由
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/Agents.vue'),
        meta: { title: '智能体', requiresAuth: true }
      },
      {
        path: 'agents/:id',
        name: 'AgentDetail',
        component: () => import('@/views/AgentDetail.vue'),
        meta: { title: '智能体详情', requiresAuth: true }
      },
      // 任务相关路由
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/Tasks.vue'),
        meta: { title: '任务', requiresAuth: true }
      },
      {
        path: 'tasks/:id',
        name: 'TaskDetail',
        component: () => import('@/views/TaskDetail.vue'),
        meta: { title: '任务详情', requiresAuth: true }
      },
      // 调度器路由
      {
        path: 'scheduler',
        name: 'Scheduler',
        component: () => import('@/views/Scheduler.vue'),
        meta: { title: '调度器', requiresAuth: true }
      },
      // 沙箱相关路由
      {
        path: 'sandboxes',
        name: 'Sandboxes',
        component: () => import('@/views/Sandboxes.vue'),
        meta: { title: '沙箱', requiresAuth: true }
      },
      {
        path: 'sandboxes/:id',
        name: 'SandboxDetail',
        component: () => import('@/views/SandboxDetail.vue'),
        meta: { title: '沙箱详情', requiresAuth: true }
      },
      // 工作空间相关路由
      {
        path: 'workspaces',
        name: 'Workspaces',
        component: () => import('@/views/Workspaces.vue'),
        meta: { title: '工作空间', requiresAuth: true }
      },
      {
        path: 'workspaces/:id',
        name: 'WorkspaceFiles',
        component: () => import('@/views/WorkspaceFiles.vue'),
        meta: { title: '工作空间文件', requiresAuth: true }
      },
      // 设置相关路由
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '设置', requiresAuth: true }
      },
      {
        path: 'settings/theme',
        name: 'ThemeSettings',
        component: () => import('@/views/ThemeSettings.vue'),
        meta: { title: '主题设置', requiresAuth: true }
      },
      {
        path: 'settings/shortcuts',
        name: 'ShortcutSettings',
        component: () => import('@/views/ShortcutSettings.vue'),
        meta: { title: '快捷键设置', requiresAuth: true }
      },
      {
        path: 'settings/notifications',
        name: 'NotificationSettings',
        component: () => import('@/views/NotificationSettings.vue'),
        meta: { title: '通知设置', requiresAuth: true }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册', guest: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { title: '找回密码', guest: true }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPassword.vue'),
    meta: { title: '重置密码', guest: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 枫琳` : '枫琳 - 让智能自然融入生活';

  const userStore = useUserStore();

  // 如果有 token 但没有用户信息，获取用户信息
  if (userStore.accessToken && !userStore.user) {
    await userStore.fetchUser();
  }

  // 需要登录的页面
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  // 已登录用户不能访问的页面（登录、注册等）
  if (to.meta.guest && userStore.isLoggedIn) {
    next({ name: 'Home' });
    return;
  }

  next();
});

export default router;
