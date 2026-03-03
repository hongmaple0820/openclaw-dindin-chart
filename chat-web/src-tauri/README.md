# Tauri 桌面端配置

## 构建要求

### 1. 安装 Rust
```bash
# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 重启终端后验证
rustc --version
cargo --version
```

### 2. 系统依赖

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
```powershell
# 安装 Visual Studio Build Tools (C++ 桌面开发)
# 或安装完整的 Visual Studio
```

## 开发命令

```bash
# 开发模式 (热重载)
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

## 图标生成

项目提供了 `generate-icons.sh` 脚本自动生成各平台图标。

需要 ImageMagick：
```bash
# Linux
sudo apt install imagemagick

# macOS
brew install imagemagick
```

运行脚本：
```bash
cd src-tauri
./generate-icons.sh
```

或手动准备以下图标：
- `icons/32x32.png` - 32x32 PNG
- `icons/128x128.png` - 128x128 PNG  
- `icons/icon.png` - 512x512 PNG (用于 Linux)
- `icons/icon.icns` - macOS 图标集
- `icons/icon.ico` - Windows 图标

## 项目结构

```
src-tauri/
├── Cargo.toml        # Rust 依赖配置
├── tauri.conf.json   # Tauri 主配置
├── build.rs          # Rust 构建脚本
├── src/
│   ├── main.rs       # 主入口 (托盘、窗口控制)
│   └── lib.rs        # 库文件
├── capabilities/
│   └── default.json  # 权限配置
├── icons/            # 应用图标
└── README.md         # 本文档
```

## 桌面端功能

### 系统托盘
- 最小化到托盘
- 左键点击托盘图标显示窗口
- 右键菜单：显示/隐藏/退出

### 窗口控制
- 关闭按钮 = 最小化到托盘（不退出）
- 真正退出需要右键托盘 → 退出

### 系统通知
- 新消息通知
- 自动请求通知权限
- 降级到浏览器通知（Web 版）

## 前端 API 使用

```javascript
import { isTauri, window as windowApi, notifications, app } from '@/tauri'

// 检测环境
if (isTauri()) {
  // 桌面端特有逻辑
}

// 发送通知
await notifications.send('新消息', '您有一条新消息')

// 窗口控制
await windowApi.minimize()
await windowApi.toggleMaximize()
await windowApi.hide()  // 隐藏到托盘
```

## 输出文件

构建完成后，安装包位于：
- **Linux**: `src-tauri/target/release/bundle/deb/`, `src-tauri/target/release/bundle/appimage/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`, `src-tauri/target/release/bundle/macos/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
