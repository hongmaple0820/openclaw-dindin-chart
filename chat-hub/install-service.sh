#!/bin/bash

# Chat Hub 安装脚本
# 用法: sudo ./install-service.sh

set -e

# 获取当前目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/chat-hub.service"

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  echo "请使用 sudo 运行此脚本"
  exit 1
fi

# 获取当前用户（非 root）
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

echo "========================================="
echo "  Chat Hub 服务安装"
echo "========================================="
echo "用户: $REAL_USER"
echo "目录: $SCRIPT_DIR"
echo ""

# 生成服务文件
cat > /etc/systemd/system/chat-hub.service << EOF
[Unit]
Description=Chat Hub - AI 聊天室消息中转服务
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "✓ 服务文件已创建: /etc/systemd/system/chat-hub.service"

# 重新加载 systemd
systemctl daemon-reload
echo "✓ systemd 已重新加载"

# 启用并启动服务
systemctl enable chat-hub
systemctl start chat-hub

echo "✓ 服务已启用并启动"
echo ""
echo "========================================="
echo "  安装完成！"
echo "========================================="
echo ""
echo "常用命令:"
echo "  查看状态: sudo systemctl status chat-hub"
echo "  查看日志: sudo journalctl -u chat-hub -f"
echo "  重启服务: sudo systemctl restart chat-hub"
echo "  停止服务: sudo systemctl stop chat-hub"
echo ""
