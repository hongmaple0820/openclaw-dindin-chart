#!/bin/bash
# health-check.sh - 检查所有服务状态
# 用法: ./health-check.sh [--verbose]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERBOSE=false
[[ "$1" == "--verbose" || "$1" == "-v" ]] && VERBOSE=true

# 配置
API_BASE="${API_BASE:-http://localhost:3000}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# 计数器
PASS=0
FAIL=0
WARN=0

log_pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; ((WARN++)); }
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }

echo "======================================"
echo "       Chat-Hub 健康检查"
echo "======================================"
echo ""

# 1. 检查 Node.js 进程
echo -e "${BLUE}[1/7] 检查 Node.js 进程${NC}"
if pgrep -f "node.*chat-hub" > /dev/null || pgrep -f "node.*index.js" > /dev/null; then
    PID=$(pgrep -f "node.*chat-hub" | head -1)
    [[ -z "$PID" ]] && PID=$(pgrep -f "node.*index.js" | head -1)
    log_pass "Chat-Hub 进程运行中 (PID: $PID)"
    $VERBOSE && ps -p "$PID" -o pid,vsz,rss,pcpu,comm 2>/dev/null
else
    log_fail "Chat-Hub 进程未运行"
fi

# 2. 检查 Redis 连接
echo -e "\n${BLUE}[2/7] 检查 Redis 连接${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
        log_pass "Redis 连接正常 ($REDIS_HOST:$REDIS_PORT)"
        $VERBOSE && redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO server 2>/dev/null | grep -E "redis_version|uptime_in_seconds"
    else
        log_fail "Redis 连接失败 ($REDIS_HOST:$REDIS_PORT)"
    fi
else
    log_warn "redis-cli 未安装，跳过 Redis 检查"
fi

# 3. 检查 API 端口
echo -e "\n${BLUE}[3/7] 检查 API 端口${NC}"
if curl -sf --connect-timeout 3 "$API_BASE/api/health" > /dev/null 2>&1; then
    log_pass "API 服务响应正常 ($API_BASE)"
elif curl -sf --connect-timeout 3 "$API_BASE/" > /dev/null 2>&1; then
    log_warn "API 服务运行但无 /api/health 端点"
else
    log_fail "API 服务无响应 ($API_BASE)"
fi

# 4. 检查数据库文件
echo -e "\n${BLUE}[4/7] 检查数据库文件${NC}"
DB_PATH="${DB_PATH:-./data/chat.db}"
if [[ -f "$DB_PATH" ]]; then
    SIZE=$(du -h "$DB_PATH" | cut -f1)
    log_pass "数据库文件存在 ($SIZE)"
    $VERBOSE && sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null
else
    # 检查其他可能的数据库位置
    ALT_DB="./chat.db"
    if [[ -f "$ALT_DB" ]]; then
        SIZE=$(du -h "$ALT_DB" | cut -f1)
        log_pass "数据库文件存在 ($SIZE)"
        DB_PATH="$ALT_DB"
    else
        log_warn "数据库文件不存在 (首次运行会自动创建)"
    fi
fi

# 5. 检查必要目录
echo -e "\n${BLUE}[5/7] 检查必要目录${NC}"
DIRS_OK=true
for dir in "data" "uploads" "logs" "config"; do
    if [[ -d "$dir" ]]; then
        log_pass "目录存在: $dir"
    else
        log_warn "目录不存在: $dir"
        DIRS_OK=false
    fi
done

# 6. 检查配置文件
echo -e "\n${BLUE}[6/7] 检查配置文件${NC}"
if [[ -f "config/local.json" ]]; then
    log_pass "本地配置文件存在 (config/local.json)"
    $VERBOSE && cat config/local.json | head -20
elif [[ -f "config/default.json" ]]; then
    log_warn "仅默认配置文件存在，建议创建 config/local.json"
else
    log_fail "配置文件不存在"
fi

# 7. 检查日志错误
echo -e "\n${BLUE}[7/7] 检查最近日志错误${NC}"
LOG_FILE="logs/chat-hub.log"
if [[ -f "$LOG_FILE" ]]; then
    ERROR_COUNT=$(grep -c "ERROR\|error\|Error" "$LOG_FILE" 2>/dev/null || echo "0")
    if [[ "$ERROR_COUNT" -gt 0 ]]; then
        log_warn "发现 $ERROR_COUNT 条错误日志"
        $VERBOSE && tail -10 "$LOG_FILE"
    else
        log_pass "无错误日志"
    fi
else
    log_info "日志文件不存在"
fi

# 总结
echo ""
echo "======================================"
echo "           检查结果汇总"
echo "======================================"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo -e "${YELLOW}警告: $WARN${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo -e "${RED}状态: 不健康${NC}"
    exit 1
elif [[ $WARN -gt 0 ]]; then
    echo -e "${YELLOW}状态: 基本正常（有警告）${NC}"
    exit 0
else
    echo -e "${GREEN}状态: 健康${NC}"
    exit 0
fi
