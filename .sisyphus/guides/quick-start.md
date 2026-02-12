# 枫琳快速启动指南

## 🚀 5 分钟快速开始

### 前置要求
- Node.js 18+
- npm 或 yarn

### 1️⃣ 启动前端 (chat-web)

```bash
# 进入前端目录
cd chat-web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问: http://localhost:5173

### 2️⃣ 启动管理后台 (chat-admin-ui)

```bash
# 进入管理后台目录
cd chat-admin-ui

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问: http://localhost:5174

### 3️⃣ 启动后端服务 (chat-hub)

```bash
# 进入后端目录
cd chat-hub

# 安装依赖
npm install

# 复制配置文件
cp config/default.json config/local.json

# 编辑配置（可选）
# 修改 config/local.json 中的 Redis 等配置

# 启动服务
npm start
```

访问: http://localhost:3000

## 📱 移动端测试

### 方法 1: Chrome DevTools
1. 打开 http://localhost:5173
2. 按 F12 打开开发者工具
3. 按 Ctrl+Shift+M 切换到设备模式
4. 选择设备型号（如 iPhone 12）

### 方法 2: 局域网访问
```bash
# 启动时使用 --host 参数
npm run dev -- --host

# 访问显示的局域网地址
# 例如: http://192.168.1.100:5173
```

在手机浏览器中访问该地址

## 🎨 查看品牌效果

### 首页
- 品牌渐变标题
- 三色功能卡片
- 枫叶背景装饰
- 流畅动画效果

### 导航栏
- 品牌色 Logo
- 侧滑菜单（移动端）
- 悬停动画
- 激活状态

### 协作空间
- 实时消息
- 用户列表
- 枫语私语功能

### 管理后台
- 枫叶红渐变侧边栏
- 数据统计
- 用户管理

## 🔧 常见问题

### Q: 端口被占用？
```bash
# 修改端口
npm run dev -- --port 5175
```

### Q: 样式没有生效？
```bash
# 清除缓存重新启动
rm -rf node_modules/.vite
npm run dev
```

### Q: 移动端菜单不显示？
- 确保屏幕宽度 < 768px
- 检查浏览器控制台是否有错误
- 尝试刷新页面

### Q: 图标不显示？
- 确保已安装 @element-plus/icons-vue
- 检查 main.js 中是否正确注册图标

## 📚 更多文档

- [品牌设计规范](../design/brand.md) - 完整的视觉规范
- [品牌升级日志](../design/brand-changelog.md) - 详细的更新记录
- [项目 README](../../README.md) - 项目完整文档

## 🎯 下一步

1. ✅ 查看品牌效果
2. ✅ 测试移动端适配
3. ✅ 体验交互动画
4. ✅ 查看设计文档
5. ✅ 开始开发

## 💡 提示

- 使用 Chrome DevTools 的设备模式测试响应式
- 查看 brand.css 了解品牌色彩系统
- 查看 mobile.css 了解移动端适配
- 所有品牌色都使用 CSS 变量，易于维护

---

**祝你使用愉快！** 🍁

如有问题，请查看文档或提交 Issue。
