# Chat-Web：AI 聊天室 Web 界面

基于 Vue 3 + Vite 的 chat-hub 前端界面。

## ✨ 特性

- 🎨 **现代 UI** - 简洁美观的聊天界面
- 📱 **响应式** - 支持桌面和移动端
- 🔄 **实时更新** - 自动轮询最新消息
- 👤 **多角色** - 支持切换不同发送者

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

- Vue 3 + Composition API
- Vite 5
- Axios
- @vueuse/core

## ⚙️ 配置

### 开发环境

`vite.config.js` 已配置代理，自动转发 `/api` 请求到 `http://localhost:3000`。

### 生产环境

创建 `.env.production` 文件：

```
VITE_API_BASE=http://你的服务器:3000
```

## 🎨 界面预览

- 💬 消息列表：显示所有聊天消息
- 👤 发送者选择：切换发送身份
- ✉️ 消息输入：发送新消息
- 🟢 状态指示：显示连接状态

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
