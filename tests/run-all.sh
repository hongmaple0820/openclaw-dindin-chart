#!/bin/bash
# 自动化测试运行脚本
# 作者：小琳
# 日期：2026-02-06

set -e

echo "=========================================="
echo "  MapleChatRoom 自动化测试"
echo "=========================================="
echo ""

# 检查服务状态
echo "🔍 检查服务状态..."
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ chat-admin-api 未运行"
    exit 1
fi
echo "✅ chat-admin-api 运行中"

if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ chat-hub 未运行"
    exit 1
fi
echo "✅ chat-hub 运行中"

if ! curl -s http://localhost:5173 > /dev/null; then
    echo "⚠️  前端未运行（跳过 E2E 测试）"
    SKIP_E2E=1
fi

echo ""
echo "=========================================="
echo "  1. API 测试"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.."
node tests/api-test.js

if [ -z "$SKIP_E2E" ]; then
    echo ""
    echo "=========================================="
    echo "  2. E2E 浏览器测试"
    echo "=========================================="
    echo ""
    
    node tests/e2e-test.js
else
    echo ""
    echo "⚠️  跳过 E2E 测试（前端未运行）"
fi

echo ""
echo "=========================================="
echo "  ✅ 所有测试完成！"
echo "=========================================="
