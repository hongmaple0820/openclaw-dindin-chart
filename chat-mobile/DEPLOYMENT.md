# chat-mobile 部署指南

## 📦 项目完成情况

### ✅ 已完成的功能

1. **登录页面** (`src/pages/login/index.vue`)
   - 用户名/密码输入
   - 表单验证
   - 登录 API 调用
   - Token 存储

2. **聊天页面** (`src/pages/chat/index.vue`)
   - 消息列表（scroll-view）
   - 发送消息
   - 滚动到底部
   - 时间格式化
   - 下拉刷新

3. **API 模块** (`src/api/index.ts`)
   - 统一请求封装
   - Token 自动注入
   - 消息 API
   - 文件上传 API

4. **状态管理** (`src/stores/user.ts`)
   - 用户登录状态
   - Token 管理
   - 用户信息存储

5. **配置管理** (`src/config/index.ts`)
   - API 地址配置
   - 环境变量支持

## 🚀 本地开发

### 前置条件

```bash
# 检查 Node.js 版本
node -v  # 需要 >= 14

# 检查 npm
npm -v
```

### 安装依赖

```bash
cd /home/maple/.openclaw/chat-mobile
npm install
```

### 启动开发服务器

**H5 开发**：
```bash
npm run dev:h5
# 访问 http://localhost:5173
```

**微信小程序**：
```bash
npm run dev:mp-weixin
# 使用微信开发者工具打开 dist/dev/mp-weixin
```

**App 开发**：
需要使用 HBuilderX IDE

## 📱 打包发布

### Android APK

**方式一：HBuilderX**
1. 打开 HBuilderX
2. 导入项目
3. 发行 → 原生 App-云打包
4. 选择 Android
5. 等待打包完成

**方式二：CLI**（需要配置）
```bash
npm run build:app-android
```

### iOS

需要 Mac 电脑 + Xcode：
```bash
npm run build:app-ios
```

## 🔧 配置说明

### API 地址配置

编辑 `src/config/index.ts`：

```typescript
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'http://your-server.com:8273'  // 改成你的服务器地址
  : 'http://localhost:8273'         // 本地开发地址
```

### chat-hub 服务

确保 chat-hub 服务正在运行：
```bash
# 检查服务状态
curl http://localhost:8273/api/stats

# 如果没运行，启动服务
cd /home/maple/.openclaw/openclaw-dindin-chart-dev/chat-hub
npm start
```

## 🧪 测试

### 功能测试清单

- [ ] 登录功能
  - [ ] 输入用户名/密码
  - [ ] 点击登录按钮
  - [ ] 验证 Token 存储
  - [ ] 跳转到聊天页面

- [ ] 聊天功能
  - [ ] 加载历史消息
  - [ ] 发送新消息
  - [ ] 消息实时显示
  - [ ] 滚动到底部
  - [ ] 下拉刷新

### API 测试

```bash
# 测试登录 API
curl -X POST http://localhost:8273/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# 测试消息 API
curl http://localhost:8273/api/context?limit=10
```

## 📝 已知问题

1. **uni CLI 未安装**
   - 问题：`sh: 1: uni: not found`
   - 解决：需要全局安装 `@dcloudio/cli` 或使用 HBuilderX

2. **跨域问题**
   - H5 开发时可能遇到跨域
   - 解决：配置 vite.config.ts 的 proxy

3. **缺少的功能**（可选）
   - 图片上传
   - @ 提及
   - 表情选择
   - 私聊切换
   - 在线用户列表

## 🎯 下一步计划

### 短期（1-2天）
1. 安装 uni-app CLI 或使用 HBuilderX
2. 本地测试所有功能
3. 修复发现的 bug
4. 打包 Android APK

### 中期（1周）
1. 添加图片上传功能
2. 优化 UI 样式
3. 添加加载动画
4. 错误处理优化

### 长期（1个月）
1. 添加 @ 提及功能
2. 添加表情选择
3. 实现私聊功能
4. 添加在线用户列表
5. 推送通知

## 📞 技术支持

遇到问题时：
1. 检查 chat-hub 服务是否运行
2. 检查 API 地址配置是否正确
3. 查看浏览器控制台错误
4. 查看 uni-app 官方文档

---
**文档更新时间**：2026-02-28 13:30
**项目状态**：核心功能完成，可进行测试
