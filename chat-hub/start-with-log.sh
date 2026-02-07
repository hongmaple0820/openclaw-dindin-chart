#!/bin/bash
# chat-hub 启动脚本（带日志）
# 路径：~/.openclaw/openclaw-dindin-chart/chat-hub/start-with-log.sh

cd "$(dirname "$0")"

LOG_DIR="$HOME/.openclaw/logs"
mkdir -p "$LOG_DIR"

# 停止旧进程
if [ -f "$HOME/.openclaw/chat-hub.pid" ]; then
    OLD_PID=$(cat "$HOME/.openclaw/chat-hub.pid")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "停止旧进程 (PID: $OLD_PID)..."
        kill "$OLD_PID"
        sleep 2
        # 强制删除 PID 文件
        rm -f "$HOME/.openclaw/chat-hub.pid"
    else
        # 进程不存在，清理 PID 文件
        rm -f "$HOME/.openclaw/chat-hub.pid"
    fi
fi

# 启动新进程（不预写 PID，让进程自己写）
echo "启动 chat-hub..."
nohup node src/index.js > "$LOG_DIR/chat-hub.log" 2>&1 &
NEW_PID=$!

sleep 3

# 验证启动
if ps -p "$NEW_PID" > /dev/null 2>&1; then
    echo "✅ chat-hub 启动成功 (PID: $NEW_PID)"
    echo "📋 日志文件: $LOG_DIR/chat-hub.log"
    echo ""
    echo "查看日志: tail -f $LOG_DIR/chat-hub.log"
    echo "查看状态: curl http://localhost:3000/api/stats"
else
    echo "❌ chat-hub 启动失败"
    echo "查看错误: cat $LOG_DIR/chat-hub.log"
    exit 1
fi
