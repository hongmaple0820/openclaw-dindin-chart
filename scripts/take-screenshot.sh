#!/bin/bash
# ~/scripts/take-screenshot.sh
# 截图脚本

# 检查是否安装了截图工具
if ! command -v scrot &> /dev/null; then
    echo "错误: 未找到 scrot。请先安装: sudo apt install scrot"
    exit 1
fi

FILENAME="screenshot-$(date +%Y%m%d-%H%M%S).png"
FILEPATH="$HOME/Pictures/$FILENAME"

# 创建 Pictures 目录（如果不存在）
mkdir -p "$HOME/Pictures"

# 截全屏
scrot "$FILEPATH"

if [ $? -eq 0 ]; then
    echo "截图已保存: $FILEPATH"
    echo "文件大小: $(du -h "$FILEPATH" | cut -f1)"
else
    echo "截图失败"
    exit 1
fi