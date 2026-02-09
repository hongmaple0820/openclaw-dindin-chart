#!/bin/bash
# 高级搜索 API 测试脚本
# 作者：小猪 🐷
# 日期：2026-02-08

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

echo "=========================================="
echo "  chat-hub 高级搜索 API 测试"
echo "=========================================="
echo ""

# 测试函数
test_api() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    echo -n "测试: $name ... "
    
    response=$(curl -s "$url")
    
    if echo "$response" | grep -q "$expected"; then
        echo "✅ 通过"
        ((PASS++))
    else
        echo "❌ 失败"
        echo "  URL: $url"
        echo "  期望包含: $expected"
        echo "  实际响应: ${response:0:200}..."
        ((FAIL++))
    fi
}

# 测试 1: 基础搜索（向后兼容）
test_api "基础搜索" \
    "$BASE_URL/api/search?q=test&limit=5" \
    '"success":true'

# 测试 2: 高级搜索 - 关键词
test_api "高级搜索-关键词" \
    "$BASE_URL/api/search/advanced?q=test&pageSize=5" \
    '"success":true'

# 测试 3: 高级搜索 - 分页
test_api "高级搜索-分页" \
    "$BASE_URL/api/search/advanced?q=test&page=1&pageSize=5" \
    '"totalPages"'

# 测试 4: 高级搜索 - 发送者筛选
test_api "高级搜索-发送者筛选" \
    "$BASE_URL/api/search/advanced?sender=%E5%B0%8F%E7%90%B3&pageSize=3" \
    '"sender":"小琳"'

# 测试 5: 高级搜索 - 高亮关键词
test_api "高级搜索-关键词高亮" \
    "$BASE_URL/api/search/advanced?q=test&highlight=true&pageSize=1" \
    '**test**'

# 测试 6: 高级搜索 - 不高亮
test_api "高级搜索-不高亮" \
    "$BASE_URL/api/search/advanced?q=test&highlight=false&pageSize=1" \
    '"originalContent"'

# 测试 7: 高级搜索 - 时间范围（最近1小时）
NOW=$(date +%s)000
HOUR_AGO=$(( $(date +%s) - 3600 ))000
test_api "高级搜索-时间范围" \
    "$BASE_URL/api/search/advanced?startTime=$HOUR_AGO&endTime=$NOW&pageSize=3" \
    '"success":true'

# 测试 8: 高级搜索 - 组合条件（关键词需要 URL 编码）
test_api "高级搜索-组合条件" \
    "$BASE_URL/api/search/advanced?q=%E4%BB%BB%E5%8A%A1&sender=%E5%B0%8F%E7%8C%AA&pageSize=5" \
    '"success":true'

# 测试 9: 高级搜索 - hasMore 字段
test_api "高级搜索-hasMore字段" \
    "$BASE_URL/api/search/advanced?pageSize=1" \
    '"hasMore"'

echo ""
echo "=========================================="
echo "  测试结果: $PASS 通过, $FAIL 失败"
echo "=========================================="

if [ $FAIL -eq 0 ]; then
    echo "🎉 所有测试通过！"
    exit 0
else
    echo "⚠️ 有测试失败，请检查"
    exit 1
fi
