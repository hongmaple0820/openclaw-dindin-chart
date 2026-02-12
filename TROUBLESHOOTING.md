# 枫琳项目故障排查指南

## 🔍 常见问题

### 问题 1: chat-web 显示成后台管理页面

**症状：**
- 访问 chat-web 时看到的是管理后台界面
- 页面显示侧边栏和管理功能

**可能原因：**

#### 1. 端口冲突
两个项目可能在同一个端口运行。

**解决方案：**
```bash
# 确认正确的端口
chat-web: http://localhost:5173
chat-admin-ui: http://localhost:5174

# 如果端口被占用，修改端口
# chat-web/vite.config.js
server: {
  port: 5173,  # 改成其他端口，如 5175
}

# 或启动时指定端口
npm run dev -- --port 5175
```

#### 2. 访问了错误的 URL
**检查访问的 URL：**
- ✅ 正确：`http://localhost:5173`
- ❌ 错误：`http://localhost:5174`
- ❌ 错误：`http://localhost:5173/admin/`

#### 3. 浏览器缓存问题
**解决方案：**
```bash
# 清除浏览器缓存
Ctrl + Shift + Delete (Chrome)
Ctrl + Shift + R (强制刷新)

# 或使用无痕模式
Ctrl + Shift + N (Chrome)
```

#### 4. 项目启动顺序混乱
**解决方案：**
```bash
# 1. 停止所有运行的服务
# 按 Ctrl + C 停止所有终端

# 2. 清理端口
# Windows
netstat -ano | findstr :5173
taskkill /PID <进程ID> /F

# 3. 重新启动
# 终端 1: chat-web
cd chat-web
npm run dev

# 终端 2: chat-admin-ui
cd chat-admin-ui
npm run dev

# 终端 3: chat-hub
cd chat-hub
npm start
```

### 问题 2: 样式没有生效

**症状：**
- 页面显示但没有品牌色
- 枫叶装饰不显示
- 动画效果缺失

**解决方案：**
```bash
# 1. 确认样式文件已引入
# 检查 chat-web/src/main.js
import './styles/brand.css';
import './styles/mobile.css';

# 2. 清除 Vite 缓存
rm -rf node_modules/.vite
npm run dev

# 3. 重新安装依赖
rm -rf node_modules
npm install
npm run dev
```

### 问题 3: 移动端菜单不显示

**症状：**
- 汉堡菜单按钮不显示
- 点击没有反应
- 侧滑菜单不出现

**解决方案：**
```bash
# 1. 确认屏幕宽度 < 768px
# Chrome DevTools: F12 → Ctrl+Shift+M

# 2. 检查 JavaScript 错误
# 打开浏览器控制台查看错误

# 3. 确认组件正确导入
# 检查 DefaultLayout.vue 中的 Menu 图标
import { Menu } from '@element-plus/icons-vue';
```

### 问题 4: 页面空白

**症状：**
- 访问页面显示空白
- 控制台有错误

**解决方案：**
```bash
# 1. 检查控制台错误
F12 → Console

# 2. 常见错误修复
# 错误: Cannot find module '@/xxx'
# 解决: 检查文件路径和导入语句

# 错误: Failed to resolve component
# 解决: 确认组件已正确注册

# 3. 重启开发服务器
Ctrl + C
npm run dev
```

## 🔧 完整的启动流程

### 方法 1: 分别启动（推荐）

```bash
# 终端 1: 启动前端
cd chat-web
npm install  # 首次运行
npm run dev
# 访问: http://localhost:5173

# 终端 2: 启动管理后台
cd chat-admin-ui
npm install  # 首次运行
npm run dev
# 访问: http://localhost:5174

# 终端 3: 启动后端
cd chat-hub
npm install  # 首次运行
npm start
# API: http://localhost:3000
```

### 方法 2: 使用脚本启动

创建启动脚本 `start-all.bat` (Windows):
```batch
@echo off
echo 启动枫琳项目...

start cmd /k "cd chat-web && npm run dev"
timeout /t 2
start cmd /k "cd chat-admin-ui && npm run dev"
timeout /t 2
start cmd /k "cd chat-hub && npm start"

echo 所有服务已启动！
echo.
echo 前端: http://localhost:5173
echo 管理后台: http://localhost:5174
echo 后端API: http://localhost:3000
pause
```

## 📱 移动端测试

### Chrome DevTools
```bash
1. 打开 http://localhost:5173
2. 按 F12 打开开发者工具
3. 按 Ctrl+Shift+M 切换到设备模式
4. 选择设备（如 iPhone 12）
5. 测试功能
```

### 真机测试
```bash
# 1. 启动时使用 --host
npm run dev -- --host

# 2. 查看显示的局域网地址
# 例如: http://192.168.1.100:5173

# 3. 在手机浏览器访问该地址
```

## 🐛 调试技巧

### 1. 查看网络请求
```bash
F12 → Network
# 查看 API 请求是否成功
# 检查返回的数据
```

### 2. 查看 Vue DevTools
```bash
# 安装 Vue DevTools 浏览器扩展
# 查看组件状态和数据
```

### 3. 查看控制台日志
```bash
F12 → Console
# 查看错误信息
# 查看 console.log 输出
```

### 4. 检查元素样式
```bash
F12 → Elements
# 选择元素
# 查看应用的 CSS
# 检查是否有样式冲突
```

## 📋 检查清单

### 启动前检查
- [ ] Node.js 版本 >= 18
- [ ] npm 已安装
- [ ] 端口 5173, 5174, 3000 未被占用
- [ ] 依赖已安装 (node_modules 存在)

### 运行时检查
- [ ] 前端正常启动 (http://localhost:5173)
- [ ] 管理后台正常启动 (http://localhost:5174)
- [ ] 后端 API 正常启动 (http://localhost:3000)
- [ ] 浏览器控制台无错误
- [ ] 页面样式正常显示

### 功能检查
- [ ] 首页品牌效果显示
- [ ] 导航菜单正常工作
- [ ] 移动端菜单可以展开
- [ ] 登录/注册页面正常
- [ ] 页面切换流畅

## 🆘 获取帮助

如果以上方法都无法解决问题：

1. **查看浏览器控制台**
   - 截图错误信息
   - 记录错误堆栈

2. **查看终端输出**
   - 记录启动时的错误
   - 查看编译警告

3. **检查文件完整性**
   - 确认所有文件都存在
   - 检查文件内容是否正确

4. **重新安装**
   ```bash
   # 删除 node_modules
   rm -rf node_modules
   rm -rf package-lock.json
   
   # 重新安装
   npm install
   ```

## 📞 联系支持

- 查看文档: [README.md](./README.md)
- 查看设计规范: [BRAND-DESIGN.md](./BRAND-DESIGN.md)
- 查看快速启动: [QUICK-START.md](./QUICK-START.md)

---

**更新时间**: 2026-02-12  
**适用版本**: v1.12.0+
