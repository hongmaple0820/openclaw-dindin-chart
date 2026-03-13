#!/bin/bash
# ==============================================
# OpenClaw 公开安装脚本 (优化兼容版 v2.1)
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
#   1. 移除 set -e，增强容错性 (单步失败不中断)
#   2. 自动检测网络，失败时切换清华/阿里镜像源
#   3. 自动配置 npm 淘宝镜像 (npmmirror)
#   4. 保留完整的作者信息与版权声明
# 
# 最后更新: 2026-03-13 (优化版)
# 原始版本: 2026-03-11 (v2.0)
# ==============================================

# --- 颜色定义 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- 打印横幅 (保留作者信息) ---
print_banner() {
    echo -e "${BLUE}=============================================="
    echo -e "🚀 OpenClaw 完整安装 (优化兼容版)"
    echo -e "==============================================${NC}"
    echo -e "📦 项目: mapleclaw - AI 协作开源项目"
    echo -e "👨‍💻 作者: ${YELLOW}maple (hongmaple)${NC}"
    echo -e "🏠 主页: https://gitee.com/hongmaple/mapleclaw"
    echo -e "🤝 团队: 枫林 AI 协作团队"
    echo -e "📅 更新时间: 2026-03-13"
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
        log_warn "需要 sudo 权限。请在提示时输入密码。"
        sudo -v || {
            log_error "无法获取 sudo 权限。部分安装步骤将失败。"
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
    # 测试官方 nodesource
    if timeout 5 curl -s --head https://deb.nodesource.com &>/dev/null; then
        NODE_SOURCE_URL="https://deb.nodesource.com/setup_22.x"
        log_info "网络良好，使用官方 NodeSource 源"
    else
        # 降级为清华镜像
        NODE_SOURCE_URL="https://mirrors.tuna.tsinghua.edu.cn/nodesource/deb/setup_22.x"
        log_warn "官方源连接超时，已自动切换至 [清华大学镜像源]"
    fi
}

# ==============================================
# 阶段 1: 安装系统依赖
# ==============================================
install_dependencies() {
    log_info ">>> 阶段 1/7: 安装系统依赖..."
    
    # 1. Node.js 22
    if command -v node &> /dev/null; then
        VER=$(node -v)
        log_ok "Node.js 已存在: $VER"
        if [[ $(echo $VER | cut -d. -f1 | tr -d 'v') -lt 22 ]]; then
            log_warn "检测到 Node.js 版本 < 22，建议升级以获得最佳体验。"
        fi
    else
        log_info "正在安装 Node.js 22 (这可能需要几分钟)..."
        if curl -fsSL "$NODE_SOURCE_URL" | sudo -E bash -; then
            if sudo apt-get install -y nodejs; then
                log_ok "Node.js 22 安装成功"
                ((SUCCESS++))
            else
                log_error "Node.js 安装失败 (apt-get 错误)"
                ((FAILED++))
            fi
        else
            log_error "Node.js 源脚本下载失败"
            ((FAILED++))
        fi
    fi

    # 2. Git
    if ! command -v git &> /dev/null; then
        log_info "安装 Git..."
        sudo apt-get install -y git && log_ok "Git 安装成功" && ((SUCCESS++)) || { log_error "Git 安装失败"; ((FAILED++)); }
    else
        log_skip "Git 已存在"
    fi

    # 3. Python3
    if ! command -v python3 &> /dev/null; then
        log_info "安装 Python3..."
        sudo apt-get install -y python3 python3-pip && log_ok "Python3 安装成功" && ((SUCCESS++)) || { log_error "Python3 安装失败"; ((FAILED++)); }
    else
        log_skip "Python3 已存在"
    fi
    
    # 4. 配置 NPM 镜像 (关键优化)
    log_info "配置 npm 镜像为淘宝源 (npmmirror)..."
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
            log_error "OpenClaw 安装失败 (请检查 npm 网络或权限)"
            ((FAILED++))
            return 1 # 核心组件失败，后续可能无法运行，但继续执行配置
        fi
    fi
}

# ==============================================
# 阶段 3: 创建配置模板 (保留原逻辑)
# ==============================================
create_configs() {
    log_info ">>> 阶段 3/7: 创建配置模板..."
    mkdir -p ~/.openclaw/workspace/{memory,skills}
    mkdir -p ~/.openclaw/logs

    # 辅助函数：如果文件不存在则创建
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

    safe_create ~/.openclaw/workspace/IDENTITY.md "# IDENTITY.md - Who Am I?\n\n- **Name:** 你的名字\n- **Creature:** AI 助手\n- **Vibe:** 可靠、高效、专注\n- **Emoji:** ✨"
    safe_create ~/.openclaw/workspace/USER.md "# USER.md - About Your Human\n\n- **Name:** 用户名\n- **Timezone:** Asia/Shanghai"
    safe_create ~/.openclaw/workspace/SOUL.md "# SOUL.md - Who You Are\n\n## Core Truths\n- Be genuinely helpful.\n- Have opinions.\n- Earn trust through competence."
    safe_create ~/.openclaw/workspace/AGENTS.md "# AGENTS.md - Your Workspace\n\n## Session Startup\n1. Read SOUL.md\n2. Read USER.md\n3. Read memory/"
    safe_create ~/.openclaw/workspace/HEARTBEAT.md "# HEARTBEAT.md\n\nKeep empty to skip."
    safe_create ~/.openclaw/workspace/TOOLS.md "# TOOLS.md - Local Notes\n\nSkills define how tools work."

    # 主配置文件
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
# 阶段 4: 安装 Skills (精简核心版)
# ==============================================
install_skills() {
    log_info ">>> 阶段 4/7: 安装基础 Skills..."
    log_warn "为避免批量安装超时，仅安装核心技能。其他技能可手动安装。"
    
    CORE_SKILLS=("weather" "healthcheck")
    INSTALLED_COUNT=0
    
    for skill in "${CORE_SKILLS[@]}"; do
        log_info "尝试安装: $skill ..."
        if npx clawhub@latest install "$skill" 2>/dev/null; then
            log_ok "$skill 安装成功"
            ((INSTALLED_COUNT++))
            ((SUCCESS++))
        else
            log_warn "$skill 安装失败 (可能是网络波动或技能暂未发布)"
            ((WARNINGS++))
        fi
    done
    
    echo ""
    log_info "💡 提示: 更多技能请访问项目主页查看，并使用 'npx clawhub@latest install <名称>' 安装。"
}

# ==============================================
# 阶段 5: 智能搜索工具 (简化占位)
# ==============================================
install_search_tool() {
    log_info ">>> 阶段 5/7: 配置智能搜索工具..."
    mkdir -p ~/.openclaw/workspace/skills/smart-search
    
    # 创建基础脚本框架
    cat > ~/.openclaw/workspace/skills/smart-search/search.sh << 'SEARCH_EOF'
#!/bin/bash
# 智能搜索工具 (简化版)
# 完整版请参考项目仓库 scripts 目录
echo "🔍 搜索功能已就绪 (简化版)"
echo "查询: $*"
SEARCH_EOF
    chmod +x ~/.openclaw/workspace/skills/smart-search/search.sh
    log_ok "搜索工具框架已创建"
    ((SUCCESS++))

    if ! grep -q "alias search=" ~/.bashrc 2>/dev/null; then
        echo 'alias search="~/.openclaw/workspace/skills/smart-search/search.sh"' >> ~/.bashrc
        log_ok "命令别名 'search' 已添加到 ~/.bashrc"
        log_info "请运行 'source ~/.bashrc' 生效"
    else
        log_skip "命令别名已存在"
    fi
}

# ==============================================
# 阶段 6 & 7: 收尾与总结
# ==============================================
finish() {
    echo ""
    echo -e "${BLUE}=============================================="
    echo -e "✅ 安装流程结束"
    echo -e "==============================================${NC}"
    echo -e "📊 统计: 成功 ${GREEN}$SUCCESS${NC} | 警告 ${YELLOW}$WARNINGS${NC} | 失败 ${RED}$FAILED${NC} | 跳过 $SKIPPED"
    echo ""
    
    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}⚠️ 注意: 有部分步骤失败。${NC}"
        echo "   如果是网络问题，请检查代理或稍后重试。"
        echo "   如果是权限问题，请确保使用了 sudo。"
    else
        echo -e "${GREEN}🎉 恭喜！所有关键步骤已完成。${NC}"
    fi
    
    echo ""
    echo "📝 接下来你可以:"
    echo "   1. 刷新环境: source ~/.bashrc"
    echo "   2. 编辑身份: nano ~/.openclaw/workspace/IDENTITY.md"
    echo "   3. 配置密钥: nano ~/.openclaw/openclaw.json"
    echo "   4. 启动服务: openclaw gateway start"
    echo ""
    echo -e "🏠 项目主页: ${BLUE}https://gitee.com/hongmaple/mapleclaw${NC}"
    echo -e "👨‍💻 感谢作者: ${YELLOW}maple (hongmaple)${NC} 及 枫林 AI 协作团队"
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