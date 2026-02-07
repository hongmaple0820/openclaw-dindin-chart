#!/bin/bash
# 快速测试脚本 - 验证 chat-hub 优化

echo "========================================="
echo "  chat-hub 快速测试"
echo "========================================="
echo ""

BASE_URL="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务是否运行
echo "🔍 检查服务状态..."
if curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ 服务正在运行${NC}"
else
    echo -e "${RED}❌ 服务未运行，请先启动:${NC}"
    echo "   cd chat-hub && npm start"
    exit 1
fi

echo ""
echo "📝 运行测试..."
echo ""

# 测试 1: 健康检查
echo "1️⃣  健康检查"
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}   ✅ 通过${NC}"
else
    echo -e "${RED}   ❌ 失败${NC}"
fi

# 测试 2: 正常消息
echo "2️⃣  发送正常消息"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/send" \
    -H "Content-Type: application/json" \
    -d '{"content":"测试消息 @小琳","sender":"TestBot"}')
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}   ✅ 通过${NC}"
    MSG_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "   消息ID: $MSG_ID"
else
    echo -e "${RED}   ❌ 失败${NC}"
fi

# 测试 3: 空消息验证
echo "3️⃣  空消息验证"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/send" \
    -H "Content-Type: application/json" \
    -d '{"content":"","sender":"Test"}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    echo -e "${GREEN}   ✅ 通过（正确拒绝）${NC}"
else
    echo -e "${RED}   ❌ 失败（应该拒绝空消息）${NC}"
fi

# 测试 4: XSS 防护
echo "4️⃣  XSS 防护"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/send" \
    -H "Content-Type: application/json" \
    -d '{"content":"<script>alert(1)</script>","sender":"Test"}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    echo -e "${GREEN}   ✅ 通过（正确拒绝）${NC}"
else
    echo -e "${RED}   ❌ 失败（应该拒绝 XSS）${NC}"
fi

# 测试 5: 搜索功能
echo "5️⃣  搜索功能"
RESPONSE=$(curl -s "$BASE_URL/api/search?q=测试")
if echo "$RESPONSE" | grep -q '"success":true'; then
    COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}   ✅ 通过（找到 $COUNT 条）${NC}"
else
    echo -e "${RED}   ❌ 失败${NC}"
fi

# 测试 6: 404 处理
echo "6️⃣  404 处理"
RESPONSE=$(curl -s "$BASE_URL/api/nonexistent")
if echo "$RESPONSE" | grep -q '"error":"Route not found"'; then
    echo -e "${GREEN}   ✅ 通过${NC}"
else
    echo -e "${RED}   ❌ 失败${NC}"
fi

# 测试 7: 统计信息
echo "7️⃣  统计信息"
RESPONSE=$(curl -s "$BASE_URL/api/stats")
if echo "$RESPONSE" | grep -q '"success":true'; then
    TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}   ✅ 通过（总消息: $TOTAL）${NC}"
else
    echo -e "${RED}   ❌ 失败${NC}"
fi

echo ""
echo "========================================="
echo "  测试完成！"
echo "========================================="
echo ""
echo "💡 提示:"
echo "  - 查看详细日志: export LOG_LEVEL=DEBUG && cd chat-hub && npm start"
echo "  - 运行完整测试: cd chat-hub && node test-optimizations.js"
echo "  - 查看优化文档: cat chat-hub/OPTIMIZATION-NOTES.md"
echo ""
