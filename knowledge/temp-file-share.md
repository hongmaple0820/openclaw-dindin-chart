# 临时文件共享系统

> 创建日期：2026-02-08  
> 作者：小琳 ✨  
> 用途：快速分享文件到外网，支持任何跨设备文件传输需求

---

## 📋 使用场景

- ✅ 迁移数据包下载
- ✅ 大文件临时共享
- ✅ 日志文件导出
- ✅ 文档临时分享
- ✅ AI 之间文件传递

**核心原则**：涉及外部文件需求时，优先使用此方案。

---

## 🚀 快速开始

### 方案 A：Python HTTP Server + Cloudflare Tunnel（推荐）

```bash
# 1. 创建临时目录
mkdir -p ~/.openclaw/temp-share
cd ~/.openclaw/temp-share

# 2. 放入要分享的文件
cp /path/to/file.zip ~/.openclaw/temp-share/

# 3. 启动 HTTP 服务器（后台）
python3 -m http.server 8888 > /tmp/http-server.log 2>&1 &
echo $! > ~/.openclaw/temp-share.pid

# 4. 暴露到外网
cloudflared tunnel --url http://localhost:8888 > /tmp/cloudflared-share.log 2>&1 &
echo $! > ~/.openclaw/cloudflared-share.pid

# 5. 获取公网 URL
sleep 3
grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-share.log | head -1
```

**输出示例**：
```
https://random-name-1234.trycloudflare.com
```

访问链接即可下载文件。

### 方案 B：使用 chat-hub 文件服务（内网）

```bash
# 1. 上传到 chat-hub
cp /path/to/file.zip ~/.openclaw/openclaw-dindin-chart/chat-hub/uploads/

# 2. 通过 chat-hub API 访问
# URL: http://localhost:3000/api/files/download?filename=file.zip
```

**限制**：需要接收方能访问到 localhost:3000。

---

## 🔧 完整脚本

### 一键分享脚本

创建 `~/.openclaw/scripts/share-file.sh`：

```bash
#!/bin/bash
# 临时文件分享脚本
# 用法: ./share-file.sh <file_path> [expiry_hours]

set -e

FILE_PATH="$1"
EXPIRY_HOURS="${2:-24}"  # 默认 24 小时过期

if [ -z "$FILE_PATH" ]; then
  echo "用法: $0 <file_path> [expiry_hours]"
  exit 1
fi

if [ ! -f "$FILE_PATH" ]; then
  echo "❌ 文件不存在: $FILE_PATH"
  exit 1
fi

SHARE_DIR="$HOME/.openclaw/temp-share"
HTTP_PORT=8888

# 创建临时目录
mkdir -p "$SHARE_DIR"

# 复制文件到共享目录
FILE_NAME=$(basename "$FILE_PATH")
cp "$FILE_PATH" "$SHARE_DIR/$FILE_NAME"
echo "✅ 文件已复制到: $SHARE_DIR/$FILE_NAME"

# 检查是否已有服务器运行
if [ -f "$SHARE_DIR/.server.pid" ]; then
  OLD_PID=$(cat "$SHARE_DIR/.server.pid")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "⚠️ 服务器已在运行 (PID: $OLD_PID)"
  else
    rm "$SHARE_DIR/.server.pid"
  fi
fi

# 启动 HTTP 服务器（如果未运行）
if ! lsof -i:$HTTP_PORT > /dev/null 2>&1; then
  cd "$SHARE_DIR"
  python3 -m http.server $HTTP_PORT > /tmp/http-server.log 2>&1 &
  HTTP_PID=$!
  echo $HTTP_PID > "$SHARE_DIR/.server.pid"
  echo "✅ HTTP 服务器已启动 (PID: $HTTP_PID)"
  sleep 1
fi

# 检查是否已有 Cloudflare Tunnel
if [ -f "$SHARE_DIR/.tunnel.pid" ]; then
  OLD_TUNNEL_PID=$(cat "$SHARE_DIR/.tunnel.pid")
  if ps -p "$OLD_TUNNEL_PID" > /dev/null 2>&1; then
    echo "⚠️ Cloudflare Tunnel 已在运行 (PID: $OLD_TUNNEL_PID)"
    # 读取已有的 URL
    if [ -f "$SHARE_DIR/.tunnel.url" ]; then
      TUNNEL_URL=$(cat "$SHARE_DIR/.tunnel.url")
    fi
  else
    rm "$SHARE_DIR/.tunnel.pid"
    rm -f "$SHARE_DIR/.tunnel.url"
  fi
fi

# 启动 Cloudflare Tunnel（如果未运行）
if [ -z "$TUNNEL_URL" ]; then
  cloudflared tunnel --url http://localhost:$HTTP_PORT > /tmp/cloudflared-share.log 2>&1 &
  TUNNEL_PID=$!
  echo $TUNNEL_PID > "$SHARE_DIR/.tunnel.pid"
  echo "✅ Cloudflare Tunnel 已启动 (PID: $TUNNEL_PID)"
  
  # 等待获取 URL
  for i in {1..10}; do
    sleep 1
    TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-share.log | head -1)
    if [ -n "$TUNNEL_URL" ]; then
      echo "$TUNNEL_URL" > "$SHARE_DIR/.tunnel.url"
      break
    fi
  done
fi

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ 无法获取 Cloudflare Tunnel URL"
  exit 1
fi

# 生成完整下载链接
DOWNLOAD_URL="$TUNNEL_URL/$FILE_NAME"

echo ""
echo "=========================================="
echo "  📦 文件已分享！"
echo "=========================================="
echo "文件名: $FILE_NAME"
echo "大小: $(du -h "$SHARE_DIR/$FILE_NAME" | cut -f1)"
echo ""
echo "🔗 下载链接:"
echo "$DOWNLOAD_URL"
echo ""
echo "⏰ 过期时间: ${EXPIRY_HOURS} 小时后"
echo "=========================================="

# 设置自动清理（后台任务）
(
  sleep $((EXPIRY_HOURS * 3600))
  rm -f "$SHARE_DIR/$FILE_NAME"
  echo "🗑️ 文件已过期删除: $FILE_NAME ($(date))" >> "$SHARE_DIR/cleanup.log"
) &

echo ""
echo "提示: 使用 stop-share.sh 停止服务"
```

### 停止分享脚本

创建 `~/.openclaw/scripts/stop-share.sh`：

```bash
#!/bin/bash
# 停止临时文件分享服务

SHARE_DIR="$HOME/.openclaw/temp-share"

# 停止 HTTP 服务器
if [ -f "$SHARE_DIR/.server.pid" ]; then
  HTTP_PID=$(cat "$SHARE_DIR/.server.pid")
  if ps -p "$HTTP_PID" > /dev/null 2>&1; then
    kill "$HTTP_PID"
    echo "✅ HTTP 服务器已停止 (PID: $HTTP_PID)"
  fi
  rm "$SHARE_DIR/.server.pid"
fi

# 停止 Cloudflare Tunnel
if [ -f "$SHARE_DIR/.tunnel.pid" ]; then
  TUNNEL_PID=$(cat "$SHARE_DIR/.tunnel.pid")
  if ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
    kill "$TUNNEL_PID"
    echo "✅ Cloudflare Tunnel 已停止 (PID: $TUNNEL_PID)"
  fi
  rm "$SHARE_DIR/.tunnel.pid"
  rm -f "$SHARE_DIR/.tunnel.url"
fi

# 清理临时文件
rm -rf "$SHARE_DIR"/*
echo "✅ 临时文件已清理"
```

赋予执行权限：
```bash
chmod +x ~/.openclaw/scripts/share-file.sh
chmod +x ~/.openclaw/scripts/stop-share.sh
```

---

## 📝 使用示例

### 示例 1：分享迁移数据包

```bash
# 1. 打包数据
cd ~/.openclaw
tar -czf openclaw-backup.tar.gz .openclaw.json workspace/MEMORY.md workspace/memory/

# 2. 分享文件（24小时有效）
~/.openclaw/scripts/share-file.sh openclaw-backup.tar.gz 24

# 输出：
# 🔗 下载链接: https://random-xyz.trycloudflare.com/openclaw-backup.tar.gz
```

### 示例 2：分享日志文件

```bash
# 分享日志（1小时有效）
~/.openclaw/scripts/share-file.sh ~/.openclaw/logs/heartbeat-monitor.log 1
```

### 示例 3：停止服务

```bash
~/.openclaw/scripts/stop-share.sh
```

---

## 🔒 安全注意事项

1. **不要分享敏感数据** - 密码、密钥、token 等
2. **设置合理过期时间** - 默认 24 小时，根据需要调整
3. **及时清理** - 文件分享完成后立即停止服务
4. **监控访问** - 检查 HTTP 服务器日志（/tmp/http-server.log）

---

## 🛠️ 故障排查

### 问题 1：端口被占用

```bash
# 查看占用端口的进程
lsof -i:8888

# 杀死进程
kill -9 <PID>
```

### 问题 2：Cloudflare Tunnel 无法启动

```bash
# 检查日志
tail -f /tmp/cloudflared-share.log

# 重启 Tunnel
pkill cloudflared
cloudflared tunnel --url http://localhost:8888
```

### 问题 3：文件下载失败

```bash
# 检查文件是否存在
ls -lh ~/.openclaw/temp-share/

# 检查 HTTP 服务器日志
tail -f /tmp/http-server.log
```

---

## 📊 监控和维护

### 查看当前分享的文件

```bash
ls -lh ~/.openclaw/temp-share/
```

### 查看访问日志

```bash
tail -f /tmp/http-server.log
```

### 查看清理日志

```bash
cat ~/.openclaw/temp-share/cleanup.log
```

---

## 🚀 高级功能

### 功能 1：批量分享

```bash
# 分享多个文件
for file in *.log; do
  ~/.openclaw/scripts/share-file.sh "$file" 2
done
```

### 功能 2：自定义端口

编辑 `share-file.sh`，修改 `HTTP_PORT=8888` 为其他端口。

### 功能 3：密码保护

使用 Python 的 `http.server` 模块无法直接支持密码保护，建议使用 nginx：

```bash
# 安装 nginx
sudo apt-get install nginx apache2-utils

# 创建密码文件
htpasswd -c ~/.openclaw/temp-share/.htpasswd share

# 配置 nginx（需要额外配置）
```

---

## 📖 最佳实践

1. **及时清理** - 分享完成后立即运行 `stop-share.sh`
2. **合理命名** - 文件名使用有意义的名称
3. **检查大小** - 大文件（>100MB）考虑压缩
4. **验证链接** - 分享前自己测试下载链接
5. **记录日志** - 保存分享记录（谁、何时、什么文件）

---

## 🔗 相关资源

- Cloudflare Tunnel 文档: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Python HTTP Server: https://docs.python.org/3/library/http.server.html
- localtunnel 替代方案: https://theboroer.github.io/localtunnel-www/

---

*文档版本：v1.0*  
*最后更新：2026-02-08 01:46*
