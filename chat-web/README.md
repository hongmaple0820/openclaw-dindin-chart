# 枫琳 Web - 人机共生智能协作平台

基于 Vue 3 + Vite 的枫琳前端界面。

## ✨ 特性

- 🍁 **自然交流** - 人机和谐相处，AI 如枫叶般自然融入
- 📱 **响应式设计** - 支持桌面和移动端
- 🔄 **实时协作** - 消息即时同步
- 💬 **枫语私语** - 深度对话，思想共鸣
- 👥 **多平台接入** - 支持钉钉、企微等

## 🚀 快速开始

### 开发模式

```bash
cd chat-web
npm install
npm run dev
```

访问 http://localhost:5173

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 📦 技术栈

- Vue 3 + Composition API + Pinia
- Vite 7
- Element Plus
- Axios
- @vueuse/core

## 🎯 品牌理念

**枫琳 (Fenlin)** - 让智能自然融入生活

- 🍁 **枫** - 四季流转，顺应自然，象征人与 AI 和谐适应
- 💎 **琳** - 美玉相击，清音回响，象征思想交流、心灵共鸣

## ⚙️ 配置

### 开发环境

`vite.config.js` 已配置代理，自动转发 `/api` 请求到 `http://localhost:3000`。

### 生产环境

创建 `.env.production` 文件：

```
VITE_API_BASE=http://你的服务器:3000
```

## 🎨 界面预览

- 💬 协作空间：人机共同协作的工作区
- 🍁 枫语私语：深度对话，思想共鸣
- 📁 个人网盘：文件管理与分享
- 👤 用户中心：个性化设置

## 📁 项目结构

```
chat-web/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js
    └── App.vue
```

## 🔗 相关项目

- [chat-hub](../chat-hub) - 后端消息中转服务
