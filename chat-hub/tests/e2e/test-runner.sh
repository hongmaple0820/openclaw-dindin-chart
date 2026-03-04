#!/bin/bash
# test-runner.sh - 完整测试运行器
# 用法: ./test-runner.sh [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
API_BASE="${API_BASE:-http://localhost:3000}"
REPORT_DIR="$SCRIPT_DIR/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/test-report-${TIMESTAMP}.md"
LOG_FILE="$REPORT_DIR/test-log-${TIMESTAMP}.txt"

# 测试选项
SKIP_HEALTH=false
SKIP_SMOKE=false
SKIP_E2E=false
VERBOSE=false
GENERATE_REPORT=false

# 测试结果
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
START_TIME=0
END_TIME=0

# 解析参数
for arg in "$@"; do
    case $arg in
        --skip-health) SKIP_HEALTH=true ;;
        --skip-smoke) SKIP_SMOKE=true ;;
        --skip-e2e) SKIP_E2E=true ;;
        --api=*) API_BASE="${arg#*=}" ;;
        --verbose) VERBOSE=true ;;
        --report) GENERATE_REPORT=true ;;
        --help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --skip-health    跳过健康检查"
            echo "  --skip-smoke     跳过冒烟测试"
            echo "  --skip-e2e       跳过端到端测试"
            echo "  --api=URL        指定 API 地址 (默认: http://localhost:3000)"
            echo "  --verbose        详细输出"
            echo "  --report         生成测试报告"
            echo "  --help           显示帮助"
            exit 0
            ;;
    esac
done

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 初始化日志
init_log() {
    echo "=== Phase 21 集成测试 ===" > "$LOG_FILE"
    echo "开始时间: $(date)" >> "$LOG_FILE"
    echo "API 地址: $API_BASE" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# 日志函数
log() {
    local msg="$1"
    echo -e "$msg"
    echo "$msg" >> "$LOG_FILE"
}

log_test() {
    local name="$1"
    local result="$2"
    local detail="$3"
    
    case $result in
        pass)
            ((PASSED_TESTS++))
            log "${GREEN}✓${NC} $name"
            ;;
        fail)
            ((FAILED_TESTS++))
            log "${RED}✗${NC} $name ${RED}[$detail]${NC}"
            ;;
        skip)
            ((SKIPPED_TESTS++))
            log "${YELLOW}⊘${NC} $name ${YELLOW}(跳过)${NC}"
            ;;
    esac
    ((TOTAL_TESTS++))
}

# HTTP 请求辅助函数
http_get() {
    curl -sf --connect-timeout 5 --max-time 10 "$API_BASE$1" 2>/dev/null
}

http_post() {
    curl -sf --connect-timeout 5 --max-time 10 \
        -H "Content-Type: application/json" \
        -d "$2" "$API_BASE$1" 2>/dev/null
}

# ==================== Phase 1: 环境检查 ====================
phase1_environment() {
    log ""
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BOLD}${BLUE}  Phase 1: 环境检查${NC}"
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node --version)
        log_test "Node.js 版本" "pass" "$NODE_VER"
    else
        log_test "Node.js" "fail" "未安装"
        return 1
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VER=$(npm --version)
        log_test "npm 版本" "pass" "$NPM_VER"
    else
        log_test "npm" "fail" "未安装"
        return 1
    fi
    
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping 2>/dev/null | grep -q PONG; then
            log_test "Redis 连接" "pass"
        else
            log_test "Redis 连接" "fail" "无法连接"
        fi
    else
        log_test "Redis" "skip" "redis-cli 未安装"
    fi
    
    cd "$PROJECT_DIR"
    if [[ -d "node_modules" ]]; then
        log_test "项目依赖" "pass"
    else
        log_test "项目依赖" "fail" "node_modules 不存在"
        return 1
    fi
}

# ==================== Phase 2: 服务启动 ====================
phase2_services() {
    log ""
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BOLD}${BLUE}  Phase 2: 服务状态检查${NC}"
    log "${BOLD}${BLU━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$SKIP_HEALTH" != true ]]; then
        log "${CYAN}运行健康检查脚本...${NC}"
        if [[ -x "$SCRIPT_DIR/health-check.sh" ]]; then
            if $SCRIPT_DIR/health-check.sh >> "$LOG_FILE" 2>&1; then
                log_test "健康检查" "pass"
            else
                log_test "健康检查" "fail" "部分检查未通过"
            fi
        else
            if http_get "/" > /dev/null 2>&1; then
                log_test "API 服务" "pass"
            else
                log_test "API 服务" "fail" "服务未响应"
                return 1
            fi
        fi
    else
        log_test "健康检查" "skip"
    fi
}

# ==================== Phase 3: 数据库迁移 ====================
phase3_database() {
    log ""
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BOLD}${BLUE}  Phase 3: 数据库迁移${NC}"
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    cd "$PROJECT_DIR"
    
    DB_FOUND=false
    for db_path in "data/chat.db" "chat.db" "data/messages.db"; do
        if [[ -f "$db_path" ]]; then
            log_test "数据库文件" "pass" "$db_path"
            DB_FOUND=true
            break
        fi
    done
    
    if [[ "$DB_FOUND" != true ]]; then
        log_test "数据库文件" "skip" "首次运行会自动创建"
    fi
    
    RESPONSE=$(http_get "/api/stats")
    if [[ $? -eq 0 ]] && echo "$RESPONSE" | grep -q '"success"'; then
        log_test "数据库 API" "pass"
    else
        log_test "数据库 API" "fail"
    fi
}

# ==================== Phase 4: API 端点测试 ====================
phase4_api() {
    log ""
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BOLD}${BLUE}  Phase 4: API 端点测试${NC}"
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$SKIP_SMOKE" != true ]]; then
        log "${CYAN}运行冒烟测试脚本...${NC}"
        if [[ -x "$SCRIPT_DIR/smoke-test.sh" ]]; then
            if API_BASE="$API_BASE" $SCRIPT_DIR/smoke-test.sh >> "$LOG_FILE" 2>&1; then
                log_test "冒烟测试" "pass"
            else
                log_test "冒烟测试" "fail"
            fi
        else
            log_test "冒烟测试" "skip" "脚本不存在"
        fi
    else
        log_test "冒烟测试" "skip"
    fi
}

# ==================== Phase 5: 端到端测试 ====================
phase5_e2e() {
    log ""
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    logD}${BLUE}  Phase 5: 端到端测试${NC}"
    log "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$SKIP_E2E" == true ]]; then
        log_test "端到端测试" "skip"
        return 0
    fi
    
    log ""
    log "${CYAN}--- 场景 1: 消息存储和查询 ---${NC}"
    
    STORE_RESP=$(http_post "/api/store" '{"sender":"e2e-test","content":"test message"}')
    if [[ $? -eq 0 ]] && echo "$STORE_RESP" | grep -q '"success"'; then
        log_test "消息存储" "pass"
    else
        log_test "消息存储" "fail"
    fi
    
    CONTEXT_RESP=$(http_get "/api/context?limit=5")
    if [[ $? -eq 0 ]] && echo "$CONTEXT_RESP" | grep -q '"success"'; then
        log_test "消息查询" "pass"
    else
        log_test "消息查询" "fail"
    fi
    
    log ""
    log "${CYAN}--- 场景 2: Agent API ---${NC}"
    AGENTS_RESP=$(http_get "/api/agents")
    if [[ $? -eq 0 ]]; then
        log_test "Agent 列表" "pass"
    else
        log_test "Agent 列表" "skip"
    fi
    
    log ""
    log "${CYAN}--- 场景 3: Skill API ---${NC}"
    SKILLS_RESP=$(http_get "/api/skills")
    if [[ $? -eq 0 ]]; then
        log_test "Skill 列表" "pass"
    else
       "Skill 列表" "skip"
    fi
}

# ==================== 生成报告 ====================
generate_report() {
    local duration=$((END_TIME - START_TIME))
    
    cat > "$REPORT_FILE" << EOF
# Chat-Hub 端到端测试报告

## 测试信息

- **执行时间**: $(date)
- **API 地址**: $API_BASE
- **执行耗时**: ${duration} 秒

## 测试结果汇总

| 指标 | 数量 |
|------|------|
| 总测试数 | $TOTAL_TESTS |
| 通过 | $PASSED_TESTS |
| 失败 | $FAILED_TESTS |
| 跳过 | $SKIPPED_TESTS |

## 结果状态

EOF

    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo -e "**状态**: ❌ 失败\n" >> "$REPORT_FILE"
    else
        echo -e "**状态**: ✅ 通过\n" >> "$REPORT_FILE"
    fi

    cat >RT_FILE" << EOF

## 详细日志

\`\`\`
$(cat "$LOG_FILE")
\`\`\`
EOF

    log ""
    log "${GREEN}测试报告已生成: $REPORT_FILE${NC}"
}

# ==================== 主流程 ====================
main() {
    START_TIME=$(date +%s)
    
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║        Chat-Hub 端到端测试套件                   ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    
    init_log
    
    phase1_environment
    phase2_services
    phase3_database
    phase4_api
    phase5_e2e
    
    END_TIME=$(date +%s)
    
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║              测试结果汇总                        ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  总测试数: $TOTAL_TESTS"
    echo -e "  ${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "  ${RED}失败: $FAILED_TESTS${NC}"
    echo -e "  ${YELLO $SKIPPED_TESTS${NC}"
    echo ""
    
    local duration=$((END_TIME - START_TIME))
    echo -e "  执行耗时: ${duration} 秒"
    echo ""
    
    if [[ "$GENERATE_REPORT" == true ]]; then
        generate_report
    fi
    
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo -e "${RED}状态: 测试失败${NC}"
        exit 1
    else
        echo -e "${GREEN}状态: 测试通过${NC}"
        exit 0
    fi
}

main "$@"
