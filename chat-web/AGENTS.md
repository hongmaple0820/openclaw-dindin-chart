# Chat-Web 知识库

**生成**: 2026-03-08 | **Commit**: cbdda51 | **Branch**: dev

---

## 概述

枫琳前端界面 - Vue 3 + Vite 7 + Element Plus + Pinia。支持 Web 和 Tauri 桌面应用。

---

## 目录结构

```
chat-web/
├── src/
│   ├── main.js            # 入口
│   ├── App.vue            # 根组件
│   ├── api/               # API 接口封装
│   │   ├── auth.js        # 认证 API
│   │   ├── dm.js          # 私信 API
│   │   └── user.js        # 用户 API
│   ├── components/        # 公共组件
│   ├── layouts/           # 布局组件
│   ├── router/            # 路由配置
│   ├── stores/            # Pinia 状态管理
│   ├── styles/            # 样式文件
│   │   ├── brand.css      # 品牌样式（枫叶红等）
│   │   ├── global.css     # 全局样式
│   │   └── mobile.css     # 移动端适配
│   ├── tauri/             # Tauri 桌面应用
│   ├── utils/             # 工具函数
│   └── views/             # 页面组件
├── vite.config.js         # Vite 配置
└── .env.development       # 环境变量
```

---

## 页面列表

| 路由 | 页面 | 用途 |
|------|------|------|
| `/` | Home.vue | 首页 |
| `/chat` | Chat.vue | 协作空间（群聊） |
| `/dm` | DM.vue | 枫语私语 |
| `/files` | FileManagement.vue | 个人网盘 |
| `/login` | Login.vue | 登录 |
| `/register` | Register.vue | 注册 |
| `/profile` | Profile.vue | 个人中心 |

---

## 常用命令

```bash
# 开发
npm run dev           # Vite 开发服务器
npm run build         # 生产构建

# Tauri 桌面应用
npm run tauri:dev     # Tauri 开发模式
npm run tauri:build   # Tauri 构建
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | 框架 |
| Vite | 7.2 | 构建工具 |
| Element Plus | 2.13 | UI 组件库 |
| Pinia | 3.0 | 状态管理 |
| Vue Router | 4.6 | 路由 |
| Axios | 1.13 | HTTP 客户端 |
| @vueuse/core | 14.2 | 组合式函数 |

---

## 品牌设计

### 色彩系统
```css
--fenlin-primary: #C41E3A;      /* 枫叶红 */
--fenlin-secondary: #D4A017;    /* 秋金黄 */
--fenlin-accent: #228B22;       /* 自然绿 */
```

### 设计规范
- 圆角：8px / 12px / 16px / 24px
- 动画：`all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- 响应式：支持 320px - 768px 移动端

---

## 状态管理

```javascript
// stores/user.js
const userStore = useUserStore();
userStore.setUser(userData);  // 设置用户
userStore.logout();           // 登出
```

---

## API 调用示例

```javascript
import { login, sendMessage } from '@/api';

// 登录
const result = await login({ username, password });

// 发送消息
await sendMessage({ content, sender: '用户' });
```

---

## 开发规范

### 组件命名
- 页面：`PascalCase.vue`（如 `Chat.vue`）
- 组件：`PascalCase.vue`（如 `FileUpload.vue`）

### 样式
- 使用 `scoped` 样式
- 品牌色使用 CSS 变量

### 添加新页面
1. 在 `src/views/` 创建页面组件
2. 在 `src/router/index.js` 添加路由
3. 在导航中添加入口

---

## 注意事项

- **代理配置**：`vite.config.js` 已配置 `/api` 代理到后端
- **移动端适配**：使用 `mobile.css` 媒体查询
- **Tauri**：仅在桌面应用模式下加载 `src/tauri/` 代码

---

## 相关文档

- [项目根目录 AGENTS.md](../AGENTS.md)
- [品牌设计规范](../.sisyphus/design/brand.md)