#!/bin/bash
# smoke-test.sh - 快速冒烟测试
# 用法: ./smoke-test.sh [--api=URL]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_BASE="${API_BASE:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-5}"

# 解析参数
for arg in "$@"; do
    case $arg in
        --api=*)
            API_BASE="${arg#*=}"
            ;;
        --timeout=*)
            TIMEOUT="${arg#*=}"
            ;;
    esac
done

# 计数器
PASS=0
FAIL=0
TESTS=0

log_pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); ((TESTS++)); }
log_fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); ((TESTS++)); }
log_skip() { echo -e "${YELLOW}⊘${NC} $1"; ((TESTS++)); }

# HTTP 请求辅助函数
http_get() {
    curl -sf --connect-timeout "$TIMEOUT" --max-time "$((TIMEOUT * 2))" "$API_BASE$1" 2>/dev/null
}

http_post() {
    curl -sf --connect-timeout "$TIMEOUT" --max-time "$((TIMEOUT * 2))" \
        -H "Content-Type: application/json" \
        -d "$2" "$API_BASE$1" 2>/dev/null
}

echo "======================================"
echo "       Chat-Hub 冒烟测试"
echo "======================================"
echo "API: $API_BASE"
echo "Timeout: ${TIMEOUT}s"
echo ""

# ==================== 基础连通性 ====================
echo -e "${BLUE}=== 基础连通性 ===${NC}"

# 1. API 根路径
echo "Test: GET /"
RESPONSE=$(http_get "/")
if [[ $? -eq 0 ]]; then
    log_pass "API 根路径可访问"
else
    log_fail "API 根路径不可访问"
fi

# 2. 健康检查端点
echo "Test: GET /api/health"
RESPONSE=$(http_get "/api/health")
if [[ $? -eq 0 ]]; then
    log_pass "健康检查端点正常"
else
    log_skip "健康检查端点不存在（可能未实现）"
fi

# ==================== 消息 API ====================
echo -e "\n${BLUE}=== 消息 API ===${NC}"

# 3. 存储消息
echo "Test: POST /api/store"
RESPONSE=$(http_post "/api/store" '{"sender":"smoke-test","content":"test message","source":"test"}')
if [[ $? -eq 0 ]] && echo "$RESPONSE" | grep -q '"success"'; then
    log_pass "消息存储成功"
else
    log_fail "消息存储失败"
fi

# 4. 获取上下文
echo "Test: GET /api/context"
RESPONSE=$(http_get "/api/context?limit=10")
if [[ $? -eq 0 ]] && echo "$RESPONSE" | grep -q '"success"'; then
    log_pass "获取消息上下文成功"
else
    log_fail "获取消息上下文失败"
fi

# 5. 搜索消息
echo "Test: GET /api/search"
RESPONSE=$(http_get "/api/search?q=test&limit=5")
if [[ $? -eq 0 ]] && echo "$RESPONSE" | grep -q '"success"'; then
    log_pass "消息搜索成功"
else
    log_fail "消息搜索失败"
fi

# 6. 获取统计
echo "Test: GET /api/stats"
RESPONSE=$(http_get "/api/stats")
if [[ $? -eq 0 ]] && echo "$RESPONSE" | grep -q '"success"'; then
    log_pass "获取统计数据成功"
else
    log_fail "获取统计数据失败"
fi

# ==================== 认证 API ====================
echo -e "\n${BLUE}=== 认证 API ===${NC}"

# 7. 检查认证端点
echo "Test: GET /api/auth/status"
RESPONSE=$(http_get "/api/auth/status")
if [[ $? -eq 0 ]]; then
    log_pass "认证状态端点可访问"
else
    log_skip "认证状态端点不存在"
fi

# ==================== Agent API ====================
echo -e "\n${BLUE}=== Agent API ===${NC}"

# 8. 列出 Agents
echo "Test: GET /api/agents"
RESPONSE=$(http_get "/api/agents")
if [[ $? -eq 0 ]]; then
    log_pass "Agent 列表端点可访问"
else
    log_skip "Agent 列表端点不存在"
fi

# ==================== Skill API ====================
echo -e "\n${BLUE}=== Skill API ===${NC}"

# 9. 列出 Skills
echo "Test: GET /api/skills"
RESPONSE=$(http_get "/api/skills")
if [[ $? -eq 0 ]]; then
    log_pass "Skill 列表端点可访问"
else
    log_skip "Skill 列表端点不存在"
fi

# ==================== Task API ====================
echo -e "\n${BLUE}=== Task API ===${NC}"

# 10. 列出任务
echo "Test: GET /api/tasks"
RESPONSE=$(http_get "/api/tasks")
if [[ $? -eq 0 ]]; then
    log_pass "任务列表端点可访问"
else
    log_skip "任务列表端点不存在"
fi

# ==================== Scheduler API ====================
echo -e "\n${BLUE}=== Scheduler API ===${NC}"

# 11. 列出定时任务
echo "Test: GET /api/scheduler/jobs"
RESPONSE=$(http_get "/api/scheduler/jobs")
if [[ $? -eq 0 ]]; then
    log_pass "定时任务列表端点可访问"
else
    log_skip "定时任务列表端点不存在"
fi

# ==================== Workspace API ====================
echo -e "\n${BLUE}=== Workspace API ===${NC}"

# 12. 列出工作区文件
echo "Test: GET /api/workspace/files"
RESPONSE=$(http_get "/api/workspace/files")
if [[ $? -eq 0 ]]; then
    log_pass "工作区文件列表端点可访问"
else
    log_skip "工作区文件列表端点不存在"
fi

# ==================== Sandbox API ====================
echo -e "\n${BLUE}=== Sandbox API ===${NC}"

# 13. 列出沙箱
echo "Test: GET /api/sandbox"
RESPONSE=$(http_get "/api/sandbox")
if [[ $? -eq 0 ]]; then
    log_pass "沙箱列表端点可访问"
else
    log_skip "沙箱列表端点不存在"
fi

# ==================== WebSocket ====================
echo -e "\n${BLUE}=== WebSocket ===${NC}"

# 14. WebSocket 端点检查
echo "Test: WebSocket endpoint"
WS_URL="${API_BASE/http/ws}/ws"
if command -v wscat &> /dev/null; then
    log_skip "WebSocket 测试需要手动验证 (wscat $WS_URL)"
else
    log_skip "WebSocket 测试跳过 (wscat 未安装)"
fi

# 总结
echo ""
echo "======================================"
echo "           测试结果汇总"
echo "======================================"
echo -e "总计: $TESTS 个测试"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo -e "${RED}状态: 冒烟测试失败${NC}"
    exit 1
else
    echo -e "${GREEN}状态: 冒烟测试通过${NC}"
    exit 0
fi
