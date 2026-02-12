# 需求文档：前后台融合

## 简介

枫琳项目当前有两个独立的前端应用：chat-web（前台，端口 5173）和 chat-admin-ui（后台，端口 5174）。本需求旨在将这两个应用融合到一个项目中，通过路由和权限控制区分前后台功能，提供统一的用户体验和更好的可维护性。

## 术语表

- **Frontend_System**: 前台系统，指面向普通用户的功能模块（首页、协作空间、枫语私语、个人网盘等）
- **Admin_System**: 后台系统，指面向管理员的功能模块（控制面板、消息管理、用户管理、数据统计等）
- **DefaultLayout**: 前台布局组件，使用顶部导航栏
- **AdminLayout**: 后台布局组件，使用侧边栏导航
- **User**: 普通用户，可以访问前台功能
- **Admin**: 管理员用户，可以访问前台和后台功能
- **Router_Guard**: 路由守卫，用于权限验证和访问控制
- **User_Store**: 用户状态管理，存储用户信息和权限
- **Admin_Route_Group**: 后台路由组，所有以 /admin 开头的路由

## 需求

### 需求 1：后台布局组件创建

**用户故事：** 作为开发者，我想创建独立的后台布局组件，以便后台页面使用侧边栏导航而不是顶部导航。

#### 验收标准

1. THE Frontend_System SHALL create AdminLayout component with sidebar navigation
2. WHEN AdminLayout is rendered, THE Frontend_System SHALL display brand logo and admin title in sidebar header
3. WHEN AdminLayout is rendered, THE Frontend_System SHALL display navigation menu with Dashboard, Messages, Users, and Stats items
4. THE AdminLayout SHALL apply Fenlin brand styles including maple red (#C41E3A), autumn gold (#D4A017), and natural green (#228B22)
5. WHEN a navigation item is clicked, THE AdminLayout SHALL highlight the active route
6. THE AdminLayout SHALL include a main content area for rendering child routes
7. THE AdminLayout SHALL be responsive and adapt to mobile devices

### 需求 2：后台页面迁移

**用户故事：** 作为开发者，我想将所有后台页面从 chat-admin-ui 迁移到 chat-web，以便统一管理所有前端代码。

#### 验收标准

1. THE Frontend_System SHALL migrate Dashboard.vue from chat-admin-ui to chat-web/src/views/admin/
2. THE Frontend_System SHALL migrate Messages.vue from chat-admin-ui to chat-web/src/views/admin/
3. THE Frontend_System SHALL migrate Users.vue from chat-admin-ui to chat-web/src/views/admin/
4. THE Frontend_System SHALL migrate Stats.vue from chat-admin-ui to chat-web/src/views/admin/
5. THE Frontend_System SHALL migrate Images.vue from chat-admin-ui to chat-web/src/views/admin/
6. WHEN migrating pages, THE Frontend_System SHALL update all pages to use Element Plus components
7. WHEN migrating pages, THE Frontend_System SHALL apply Fenlin brand styles to all pages
8. WHEN migrating pages, THE Frontend_System SHALL ensure all API calls use the correct endpoints

### 需求 3：路由配置整合

**用户故事：** 作为开发者，我想配置统一的路由系统，以便通过 URL 路径区分前后台功能。

#### 验收标准

1. THE Frontend_System SHALL create Admin_Route_Group under /admin path
2. WHEN Admin_Route_Group is configured, THE Frontend_System SHALL use AdminLayout as the parent component
3. THE Frontend_System SHALL configure /admin/dashboard route for Dashboard page
4. THE Frontend_System SHALL configure /admin/messages route for Messages page
5. THE Frontend_System SHALL configure /admin/users route for Users page
6. THE Frontend_System SHALL configure /admin/stats route for Stats page
7. THE Frontend_System SHALL configure /admin/images route for Images page
8. WHEN user accesses /admin, THE Frontend_System SHALL redirect to /admin/dashboard
9. THE Frontend_System SHALL configure all admin routes with requiresAdmin meta field set to true
10. THE Frontend_System SHALL maintain existing frontend routes under DefaultLayout

### 需求 4：权限控制实现

**用户故事：** 作为系统管理员，我想确保只有管理员可以访问后台功能，以便保护敏感的管理功能。

#### 验收标准

1. WHEN Router_Guard checks a route with requiresAdmin meta, THE Frontend_System SHALL verify user admin status
2. IF user is not an admin and attempts to access admin route, THEN THE Frontend_System SHALL redirect to home page
3. IF user is not an admin and attempts to access admin route, THEN THE Frontend_System SHALL display error message "需要管理员权限"
4. WHEN user is an admin, THE Frontend_System SHALL allow access to all admin routes
5. THE Frontend_System SHALL check User_Store.isAdmin property for admin verification
6. WHEN user is not logged in and attempts to access admin route, THE Frontend_System SHALL redirect to login page

### 需求 5：前后台导航切换

**用户故事：** 作为管理员，我想在前后台之间方便地切换，以便同时管理系统和使用普通功能。

#### 验收标准

1. WHEN an Admin is logged in and viewing frontend, THE DefaultLayout SHALL display "管理后台" link in user dropdown menu
2. WHEN an Admin clicks "管理后台" link, THE Frontend_System SHALL navigate to /admin/dashboard
3. WHEN an Admin is viewing admin pages, THE AdminLayout SHALL display "返回前台" button in header
4. WHEN an Admin clicks "返回前台" button, THE Frontend_System SHALL navigate to home page
5. WHEN a non-admin User is logged in, THE DefaultLayout SHALL NOT display "管理后台" link
6. THE Frontend_System SHALL maintain user session when switching between frontend and admin

### 需求 6：品牌样式统一

**用户故事：** 作为产品设计师，我想确保前后台使用统一的品牌样式，以便提供一致的视觉体验。

#### 验收标准

1. THE Frontend_System SHALL apply Fenlin brand colors to all admin pages
2. THE Frontend_System SHALL use maple red (#C41E3A) as primary color in admin interface
3. THE Frontend_System SHALL use autumn gold (#D4A017) as accent color in admin interface
4. THE Frontend_System SHALL use natural green (#228B22) for success states in admin interface
5. THE Frontend_System SHALL import and apply brand.css styles to admin components
6. THE Frontend_System SHALL use Element Plus components with Fenlin brand theme
7. THE Frontend_System SHALL display maple leaf emoji (🍁) in admin branding elements

### 需求 7：移动端适配

**用户故事：** 作为移动设备用户，我想在手机上访问后台功能，以便随时随地管理系统。

#### 验收标准

1. WHEN AdminLayout is viewed on mobile device, THE Frontend_System SHALL collapse sidebar into hamburger menu
2. WHEN user clicks hamburger menu on mobile, THE AdminLayout SHALL expand sidebar overlay
3. WHEN user clicks outside sidebar on mobile, THE AdminLayout SHALL collapse sidebar
4. WHEN AdminLayout is viewed on mobile, THE Frontend_System SHALL adjust content padding for smaller screens
5. THE AdminLayout SHALL use responsive breakpoints at 768px for tablet and mobile
6. WHEN admin pages are viewed on mobile, THE Frontend_System SHALL ensure all content is readable and interactive
7. THE Frontend_System SHALL apply mobile.css styles to admin components for mobile optimization

### 需求 8：统一端口访问

**用户故事：** 作为用户，我想通过单一端口访问前后台功能，以便避免端口混淆和简化访问方式。

#### 验收标准

1. THE Frontend_System SHALL serve both frontend and admin pages on port 5173
2. WHEN user accesses http://localhost:5173/, THE Frontend_System SHALL display frontend home page
3. WHEN user accesses http://localhost:5173/admin, THE Frontend_System SHALL display admin dashboard
4. THE Frontend_System SHALL use Vue Router for client-side routing between frontend and admin
5. THE Frontend_System SHALL maintain single Vite dev server for both frontend and admin
6. THE Frontend_System SHALL build both frontend and admin into single production bundle

### 需求 9：开发工具配置

**用户故事：** 作为开发者，我想确保开发工具正确配置，以便顺利开发和构建融合后的应用。

#### 验收标准

1. THE Frontend_System SHALL maintain existing Vite configuration for development server
2. THE Frontend_System SHALL maintain existing Element Plus auto-import configuration
3. THE Frontend_System SHALL ensure all admin components can use Element Plus without manual imports
4. THE Frontend_System SHALL configure code splitting for admin routes to optimize bundle size
5. WHEN building for production, THE Frontend_System SHALL generate optimized bundles for frontend and admin
6. THE Frontend_System SHALL maintain hot module replacement for both frontend and admin during development

### 需求 10：错误处理和用户反馈

**用户故事：** 作为用户，我想在遇到权限问题或错误时收到清晰的提示，以便了解问题并采取正确的操作。

#### 验收标准

1. WHEN non-admin user attempts to access admin route, THE Frontend_System SHALL display error message using Element Plus Message component
2. WHEN route navigation fails, THE Frontend_System SHALL display appropriate error message
3. WHEN admin page fails to load, THE Frontend_System SHALL display error state with retry option
4. THE Frontend_System SHALL log navigation errors to console for debugging
5. WHEN user is redirected due to permission denial, THE Frontend_System SHALL preserve original URL in redirect query parameter
6. THE Frontend_System SHALL display loading state during route transitions

