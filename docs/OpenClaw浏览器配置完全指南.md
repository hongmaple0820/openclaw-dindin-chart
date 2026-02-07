# OpenClaw 浏览器配置完全指南

> 作者：小琳 ✨  
> 日期：2026-02-07  
> 适用环境：WSL、Linux、macOS

---

## 📋 目录

1. [为什么需要浏览器](#为什么需要浏览器)
2. [安装 Playwright Chromium](#安装-playwright-chromium)
3. [WSL 环境配置](#wsl-环境配置)
4. [systemd 服务配置](#systemd-服务配置)
5. [常见问题排查](#常见问题排查)
6. [使用技巧](#使用技巧)

---

## 为什么需要浏览器

OpenClaw 的浏览器功能（Computer Use）让 AI 能够：
- 🌐 自动化网页操作（填表、点击、截图）
- 📊 抓取网页数据
- 🔍 自动化测试
- 🎨 可视化交互

**使用场景：**
- 帮用户注册账号、填写表单
- 抓取网页内容（比 web_fetch 更强大）
- 自动化操作（购物、预约、抢票）
- 截图保存网页

---

## 安装 Playwright Chromium

### 方法一：npm 安装（推荐）

```bash
# 进入 OpenClaw 目录
cd ~/.npm-global/lib/node_modules/openclaw

# 安装 Playwright
npm install playwright

# 下载 Chromium 浏览器
npx playwright install chromium
```

**安装位置：**
- 浏览器：`~/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`
- 版本：Chrome 145.0.7632.6

---

### 方法二：系统包管理器

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# Arch Linux
sudo pacman -S chromium

# macOS
brew install --cask chromium
```

⚠️ **注意：** 系统安装的 Chromium 可能与 Playwright 不兼容，推荐用方法一。

---

## WSL 环境配置

### 问题：WSL 没有图形界面

OpenClaw 默认用无头模式（headless），但有时需要看到浏览器窗口调试。

### 解决方案：WSLg

**WSLg** 是 Windows 11 自带的 WSL 图形界面支持。

#### 1. 确认 WSLg 可用

```bash
# 检查 DISPLAY 环境变量
echo $DISPLAY
# 应该输出: :0

# 检查 Wayland
echo $WAYLAND_DISPLAY
# 应该输出: wayland-0
```

如果没有输出，更新 WSL：

```powershell
# 在 Windows PowerShell 中运行
wsl --update
wsl --shutdown
# 重新启动 WSL
```

---

#### 2. 配置环境变量

在 `~/.bashrc` 添加：

```bash
# WSL 图形界面支持
export DISPLAY=:0
export WAYLAND_DISPLAY=wayland-0
```

重新加载：
```bash
source ~/.bashrc
```

---

#### 3. 测试图形界面

```bash
# 安装测试工具
sudo apt-get install x11-apps

# 测试窗口
xeyes
```

如果能看到一个眼睛窗口，说明 WSLg 工作正常！

---

## OpenClaw 浏览器配置

### 1. 基础配置

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "browser": {
    "enabled": true,
    "executablePath": "/home/maple/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome",
    "noSandbox": true,
    "defaultProfile": "openclaw",
    "headless": false
  }
}
```

**配置说明：**
- `enabled`: 启用浏览器功能
- `executablePath`: Chromium 可执行文件路径
- `noSandbox`: WSL 环境必须设为 true
- `defaultProfile`: 浏览器配置文件名
- `headless`: false = 显示窗口，true = 无头模式

---

### 2. systemd 服务配置

**问题：** systemd 服务不会继承 shell 的环境变量，导致浏览器启动失败。

**解决方案：** 在服务文件中显式声明环境变量。

#### 编辑服务文件

```bash
vim ~/.config/systemd/user/openclaw-gateway.service
```

添加 `Environment=` 行：

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
ExecStart=/home/maple/.npm-global/bin/openclaw gateway
Restart=always
RestartSec=10
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
Environment=PATH=/home/maple/.npm-global/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

#### 重载并重启

```bash
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway.service
```

---

### 3. 启动脚本（备选方案）

如果 systemd 配置不方便，可以用启动脚本：

```bash
# ~/start-openclaw.sh
#!/bin/bash
export DISPLAY=:0
export WAYLAND_DISPLAY=wayland-0
export PATH=$PATH:$HOME/.npm-global/bin
openclaw gateway
```

```bash
chmod +x ~/start-openclaw.sh

# 用脚本启动
~/start-openclaw.sh
```

---

## 常见问题排查

### 🔴 1. 浏览器控制超时

**错误：**
```
Can't reach the openclaw browser control service (timed out after 20000ms)
```

**排查步骤：**

```bash
# 1. 检查浏览器是否在运行
ps aux | grep chromium

# 2. 检查 CDP 端口
netstat -tuln | grep 18800

# 3. 重启浏览器
openclaw browser stop
openclaw browser start

# 4. 查看日志
journalctl --user -u openclaw-gateway.service -n 50
```

**常见原因：**
- DISPLAY 环境变量丢失
- 浏览器进程意外退出
- 防火墙阻止端口 18800

---

### 🔴 2. 浏览器无法启动

**错误：**
```
Error: Failed to launch browser
```

**检查清单：**

| 检查项 | 命令 | 预期结果 |
|---|---|---|
| Chromium 存在 | `ls ~/.cache/ms-playwright/chromium-1208/` | 有文件 |
| 执行权限 | `ls -l ~/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome` | `-rwxr-xr-x` |
| 依赖库 | `ldd chrome | grep "not found"` | 无输出 |
| DISPLAY 变量 | `echo $DISPLAY` | `:0` |

**安装依赖库（如果缺失）：**

```bash
sudo apt-get install -y \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libasound2
```

---

### 🔴 3. 无头模式 vs GUI 模式

**何时用无头模式：**
- 服务器环境（无图形界面）
- 后台自动化任务
- 节省资源

**何时用 GUI 模式：**
- 调试脚本
- 观察操作过程
- 截图验证

**切换方法：**

```json
// 无头模式
"browser": {
  "headless": true
}

// GUI 模式（需要 WSLg）
"browser": {
  "headless": false
}
```

---

### 🔴 4. Snap Chromium 不兼容

**问题：**
Ubuntu 默认从 Snap 安装 Chromium，但 Snap 版在 WSL 中有兼容性问题。

**解决方案：**
用 Playwright 自带的 Chromium。

```bash
# 卸载 Snap 版本
sudo snap remove chromium

# 用 Playwright 版本
npx playwright install chromium
```

---

## 使用技巧

### 📸 1. 截图网页

```bash
# AI 会帮你操作浏览器截图
"帮我截图 https://www.aliyun.com 的首页"
```

AI 会：
1. 打开浏览器
2. 访问网址
3. 截图保存
4. 返回截图路径

---

### 🔍 2. 抓取数据

```bash
# AI 可以自动化操作网页
"帮我抓取 https://example.com 的价格信息"
```

AI 会：
1. 打开网页
2. 找到价格元素
3. 提取文本
4. 返回结果

---

### 📝 3. 自动填表

```bash
# AI 可以帮你填写表单
"帮我在这个网站注册账号，用户名 test@example.com，密码 123456"
```

⚠️ **安全提示：** 不要让 AI 处理真实的敏感信息！

---

### 🎮 4. 交互式调试

```bash
# 查看浏览器状态
openclaw browser status

# 列出所有标签页
openclaw browser tabs

# 手动打开网页（AI 不介入）
openclaw browser open --url https://example.com
```

---

## 高级配置

### 🎯 1. 多浏览器配置

```json
{
  "browser": {
    "profiles": {
      "openclaw": {
        "port": 18800,
        "headless": false
      },
      "testing": {
        "port": 18801,
        "headless": true
      }
    }
  }
}
```

使用时指定 profile：
```bash
"用 testing profile 打开网页"
```

---

### 🎯 2. 用户数据目录

浏览器会话、Cookie、缓存保存在：
```
~/.openclaw/browser/openclaw/user-data/
```

**清理缓存：**
```bash
rm -rf ~/.openclaw/browser/openclaw/user-data/
```

---

### 🎯 3. 截图和录制

```json
{
  "browser": {
    "screenshots": {
      "enabled": true,
      "path": "~/.openclaw/screenshots"
    },
    "recording": {
      "enabled": false,
      "path": "~/.openclaw/recordings"
    }
  }
}
```

---

## 性能优化

### ⚡ 1. 减少资源占用

```json
{
  "browser": {
    "args": [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-zygote",
      "--single-process"
    ]
  }
}
```

---

### ⚡ 2. 加速加载

```json
{
  "browser": {
    "args": [
      "--disable-images",
      "--disable-javascript"  // 谨慎使用，可能破坏功能
    ]
  }
}
```

---

## 安全提示

1. **不要在公共环境使用 GUI 模式**
   - 浏览器窗口可能被他人看到

2. **不要让 AI 访问敏感网站**
   - 银行、支付、邮箱等

3. **定期清理浏览器数据**
   - Cookie、缓存可能包含敏感信息

4. **使用隔离的浏览器 profile**
   - 不要用个人浏览器配置

---

## 总结

### ✅ 成功配置的标志

```bash
# 运行检查
openclaw browser status

# 预期输出：
# ✓ Browser enabled: true
# ✓ Profile: openclaw
# ✓ Running: true
# ✓ CDP ready: true
# ✓ Port: 18800
# ✓ Headless: false
```

### 🎯 最佳实践

1. **WSL 环境必须配置 DISPLAY 和 WAYLAND_DISPLAY**
2. **systemd 服务必须显式声明环境变量**
3. **用 Playwright Chromium，不用系统 Snap 版**
4. **noSandbox=true 在 WSL 必须开启**
5. **调试时用 GUI 模式，生产环境用无头模式**

---

**经验签名：**
> "浏览器是 AI 的眼睛，配置好了，世界就是你的游乐场。" 🌐  
> —— 小琳 ✨
