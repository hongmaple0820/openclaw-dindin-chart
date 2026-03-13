#!/bin/bash
# ==============================================
# OpenClaw 公开安装脚本 (Node.js 24 LTS 优化版 v2.2)
# 
# 原版作者：maple (hongmaple)
# 团队：枫林 AI 协作团队
# 项目地址:
#   - Gitee: https://gitee.com/hongmaple/mapleclaw
#   - GitHub: https://github.com/hongmaple0820/mapleclaw
# 
# 相关项目:
#   - chat-hub: 多通道 AI 消息中心
#   - 枫林: AI 协作通讯平台
# 
# 优化说明:
#   1. 升级至 Node.js 24 LTS (最新稳定版)
#   2. 移除 set -e，增强容错性
#   3. 自动检测网络，切换清华/阿里镜像源
#   4. 自动配置 npm 淘宝镜像
#   5. 保留完整的作者信息与版权声明
# 
# 最后更新: 2026-03-13 (Node.js 24 版)
# 原始版本: 2026-03-11 (v2.0)
# ==============================================

# --- 颜色定义 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- 打印横幅 ---
print_banner() {
    echo -e "${BLUE}=============================================="
    echo -e "🚀 OpenClaw 完整安装 (Node.js 24 LTS 优化版)"
    echo -e "==============================================${NC}"
    echo -e "📦 项目: mapleclaw - AI 协作开源项目"
    echo -e "👨‍💻 作者: ${YELLOW}maple (hongmaple)${NC}"
    echo -e "🏠 主页: https://gitee.com/hongmaple/mapleclaw"
    echo -e "🤝 团队: 枫林 AI 协作团队"
    echo -e "📅 更新时间: 2026-03-13"
    echo -e "🟢 Node.js: ${GREEN}24 LTS (最新稳定版)${NC}"
    echo ""
}

# --- 辅助函数 ---
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok() { echo -e "${GREEN}[✓]${NC} $1"; }
log_skip() { echo -e "${BLUE}[-]${NC} $1"; }

# --- 全局统计 ---
SUCCESS=0
WARNINGS=0
FAILED=0
SKIPPED=0

# --- 1. 权限检查 ---
check_sudo() {
    log_info "检查 sudo 权限..."
    if ! sudo -n true 2>/dev/null; then
        log_warn "需要 sudo 权限，请在提示时输入密码"
        sudo -v || {
            log_error "无法获取 sudo 权限"
            return 1
        }
    fi
    log_ok "sudo 权限验证通过"
}

# --- 2. 网络检测与源选择 ---
NODE_SOURCE_URL=""
NPM_REGISTRY="https://registry.npmmirror.com"

check_network() {
    log_info "检测网络连接..."
    if timeout 5 curl -s --head https://deb.nodesource.com &>/dev/null; then
        NODE_SOURCE_URL="https://deb.nodesource.com/setup_24.x"
        log_info "网络良好，使用官方 NodeSource 源 (Node.js 24)"
    else
        NODE_SOURCE_URL="https://mirrors.tuna.tsinghua.edu.cn/nodesource/deb/setup_24.x"
        log_warn "官方源连接超时，已切换至 [清华大学镜像源] (Node.js 24)"
    fi
}

# ==============================================
# 阶段 1: 安装系统依赖
# ==============================================
install_dependencies() {
    log_info ">>> 阶段 1/7: 安装系统依赖 (Node.js 24 LTS)..."
    
    # 1. Node.js 24
    if command -v node &> /dev/null; then
        VER=$(node -v)
        MAJOR=$(echo $VER | cut -d. -f1 | tr -d 'v')
        log_ok "Node.js 已存在: $VER"
        if [ "$MAJOR" -lt 22 ]; then
            log_warn "Node.js 版本 < 22，建议升级到 v24 LTS"
            read -p "是否现在升级到 Node.js 24? (y/n): " upgrade
            if [ "$upgrade" = "y" ]; then
                log_info "正在升级 Node.js 到 v24..."
                curl -fsSL "$NODE_SOURCE_URL" | sudo -E bash -
                sudo apt-get install -y nodejs
                node -v
            fi
        elif [ "$MAJOR" -ge 24 ]; then
            log_ok "Node.js 版本符合推荐要求 (≥24)"
        fi
    else
        log_info "正在安装 Node.js 24 LTS..."
        if curl -fsSL "$NODE_SOURCE_URL" | sudo -E bash -; then
            if sudo apt-get install -y nodejs; then
                log_ok "Node.js 24 LTS 安装成功"
                node -v
                ((SUCCESS++))
            else
                log_error "Node.js 安装失败"
                ((FAILED++))
            fi
        else
            log_error "Node.js 源脚本下载失败"
            ((FAILED++))
        fi
    fi

    # 2. Git
    if ! command -v git &> /dev/null; then
        sudo apt-get install -y git && log_ok "Git 安装成功" && ((SUCCESS++)) || { log_error "Git 安装失败"; ((FAILED++)); }
    else
        log_skip "Git 已存在"
    fi

    # 3. Python3
    if ! command -v python3 &> /dev/null; then
        sudo apt-get install -y python3 python3-pip && log_ok "Python3 安装成功" && ((SUCCESS++)) || { log_error "Python3 安装失败"; ((FAILED++)); }
    else
        log_skip "Python3 已存在"
    fi
    
    # 4. 配置 NPM 镜像
    log_info "配置 npm 镜像为淘宝源..."
    npm config set registry "$NPM_REGISTRY"
    log_ok "npm 镜像配置完成"
    ((SUCCESS++))
}

# ==============================================
# 阶段 2: 安装 OpenClaw 核心
# ==============================================
install_openclaw_core() {
    log_info ">>> 阶段 2/7: 安装 OpenClaw 核心..."
    if command -v openclaw &> /dev/null; then
        log_skip "OpenClaw 已安装: $(openclaw --version)"
        ((SKIPPED++))
    else
        log_info "正在全局安装 openclaw..."
        if sudo npm install -g openclaw; then
            log_ok "OpenClaw 安装成功"
            ((SUCCESS++))
        else
            log_error "OpenClaw 安装失败"
            ((FAILED++))
        fi
    fi
}

# ==============================================
# 阶段 3: 创建配置模板
# ==============================================
create_configs() {
    log_info ">>> 阶段 3/7: 创建配置模板..."
    mkdir -p ~/.openclaw/workspace/{memory,skills}
    mkdir -p ~/.openclaw/logs

    safe_create() {
        local file=$1
        local content=$2
        if [ ! -f "$file" ]; then
            echo -e "$content" > "$file"
            log_ok "创建: $file"
            ((SUCCESS++))
        else
            log_skip "已存在: $file"
            ((SKIPPED++))
        fi
    }

    safe_create ~/.openclaw/workspace/IDENTITY.md "# IDENTITY.md\n- **Name:** AI Assistant\n- **Vibe:** Helpful"
    safe_create ~/.openclaw/workspace/USER.md "# USER.md\n- **Name:** User\n- **Timezone:** Asia/Shanghai"
    safe_create ~/.openclaw/workspace/SOUL.md "# SOUL.md\nBe helpful."
    safe_create ~/.openclaw/workspace/AGENTS.md "# AGENTS.md\nWorkspace config."
    safe_create ~/.openclaw/workspace/HEARTBEAT.md "# HEARTBEAT.md\nEmpty."
    safe_create ~/.openclaw/workspace/TOOLS.md "# TOOLS.md\nLocal tools."

    if [ ! -f ~/.openclaw/openclaw.json ]; then
        cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "model": "bailian/qwen-turbo",
  "channels": {},
  "browser": { "enabled": true },
  "tts": { "enabled": true }
}
EOF
        log_ok "创建: ~/.openclaw/openclaw.json"
        ((SUCCESS++))
    else
        log_skip "配置文件已存在"
        ((SKIPPED++))
    fi
}

# ==============================================
# 阶段 4: 安装 Skills
# ==============================================
install_skills() {
    log_info ">>> 阶段 4/7: 安装基础 Skills..."
    log_warn "仅安装核心技能，其他可手动安装"
    
    for skill in weather healthcheck; do
        log_info "尝试安装: $skill ..."
        if npx clawhub@latest install "$skill" 2>/dev/null; then
            log_ok "$skill 安装成功"
            ((SUCCESS++))
        else
            log_warn "$skill 安装失败"
            ((WARNINGS++))
        fi
    done
}

# ==============================================
# 阶段 5: 智能搜索工具
# ==============================================
install_search_tool() {
    log_info ">>> 阶段 5/7: 配置智能搜索工具..."
    mkdir -p ~/.openclaw/workspace/skills/smart-search
    echo '#!/bin/bash\necho "Search tool"' > ~/.openclaw/workspace/skills/smart-search/search.sh
    chmod +x ~/.openclaw/workspace/skills/smart-search/search.sh
    log_ok "搜索工具框架已创建"
    ((SUCCESS++))
}

# ==============================================
# 完成
# ==============================================
finish() {
    echo ""
    echo -e "${BLUE}=============================================="
    echo -e "✅ 安装流程结束"
    echo -e "==============================================${NC}"
    echo -e "📊 统计: 成功 ${GREEN}$SUCCESS${NC} | 警告 ${YELLOW}$WARNINGS${NC} | 失败 ${RED}$FAILED${NC}"
    echo ""
    echo "📝 下一步:"
    echo "   1. source ~/.bashrc"
    echo "   2. nano ~/.openclaw/workspace/IDENTITY.md"
    echo "   3. openclaw gateway start"
    echo ""
    echo -e "🏠 项目: ${BLUE}https://gitee.com/hongmaple/mapleclaw${NC}"
    echo -e "👨‍💻 感谢作者: ${YELLOW}maple (hongmaple)${NC}"
    echo "=============================================="
}

# --- 主执行流 ---
print_banner
check_sudo
check_network
install_dependencies
install_openclaw_core
create_configs
install_skills
install_search_tool
finish