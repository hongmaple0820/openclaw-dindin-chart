#!/bin/bash
# 开发环境启动脚本

echo "========================================="
echo "  chat-hub 开发环境启动"
echo "========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 加载环境变量
if [ -f ".env" ]; then
    echo "✅ 加载环境变量..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  未找到 .env 文件，使用默认配置"
fi

# 设置开发环境日志级别
export LOG_LEVEL=${LOG_LEVEL:-DEBUG}

echo ""
echo "配置信息:"
echo "  - 日志级别: $LOG_LEVEL"
echo "  - 端口: ${PORT:-3000}"
echo "  - Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
echo ""

# 启动服务
echo "🚀 启动服务..."
node src/index.js
