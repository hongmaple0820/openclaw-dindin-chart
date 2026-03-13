#!/bin/bash
# ==============================================
# OpenClaw 安装脚本 (Node.js 24 纯净版)
# 
# 原版作者：maple (hongmaple)
# 团队：枫林 AI 协作团队
# 项目地址:
#   - Gitee: https://gitee.com/hongmaple/mapleclaw
#   - GitHub: https://github.com/hongmaple0820/mapleclaw
# 
# 功能：
#   1. 彻底卸载旧版 Node.js (22 及以下)
#   2. 清理 npm 缓存和全局包
#   3. 安装 Node.js 24 LTS (最新稳定版)
#   4. 安装 OpenClaw 及配置
# 
# 最后更新: 2026-03-13
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
    echo -e "🚀 OpenClaw 安装 (Node.js 24 纯净版)"
    echo -e "==============================================${NC}"
    echo -e "📦 项目: mapleclaw - AI 协作开源项目"
    echo -e "👨‍💻 作者: ${YELLOW}maple (hongmaple)${NC}"
    echo -e "🏠 主页: https://gitee.com/hongmaple/mapleclaw"
    echo -e "🤝 团队: 枫林 AI 协作团队"
    echo -e "📅 更新时间: 2026-03-13"
    echo -e "🟢 Node.js: ${GREEN}24 LTS (纯净安装)${NC}"
    echo ""
}

# --- 辅助函数 ---
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok() { echo -e "${GREEN}[✓]${NC} $1"; }
log_step() { echo -e "${BLUE}>>>${NC} $1"; }

# ==============================================
# 阶段 1: 彻底卸载旧版 Node.js
# ==============================================
uninstall_old_node() {
    log_step "阶段 1/6: 彻底卸载旧版 Node.js"
    
    # 检查当前版本
    if command -v node &> /dev/null; then
        OLD_VER=$(node -v)
        log_info "检测到当前 Node.js: $OLD_VER"
        
        # 卸载 apt 安装的 nodejs
        log_info "移除 apt 安装的 nodejs..."
        sudo apt-get remove --purge -y nodejs npm 2>/dev/null && \
            log_ok "已移除 apt 包" || \
            log_warn "apt 包移除完成或无需移除"
        
        # 清理残留
        sudo apt-get autoremove -y 2>/dev/null
        sudo apt-get autoclean -y 2>/dev/null
        
        # 删除残留目录
        sudo rm -rf /usr/local/lib/node_modules 2>/dev/null
        sudo rm -rf /usr/lib/node_modules 2>/dev/null
        sudo rm -f /usr/bin/node 2>/dev/null
        sudo rm -f /usr/bin/npm 2>/dev/null
        sudo rm -f /usr/local/bin/node 2>/dev/null
        sudo rm -f /usr/local/bin/npm 2>/dev/null
        
        log_ok "旧版 Node.js 已清理"
    else
        log_info "未检测到 Node.js，跳过卸载"
    fi
    
    # 清理 npm 缓存
    log_info "清理 npm 缓存..."
    npm cache clean --force 2>/dev/null || true
    rm -rf ~/.npm 2>/dev/null
    log_ok "npm 缓存已清理"
    
    # 验证卸载
    if command -v node &> /dev/null; then
        log_warn "Node.js 仍有残留，请手动检查"
    else
        log_ok "Node.js 已完全卸载"
    fi
    echo ""
}

# ==============================================
# 阶段 2: 网络检测与源选择
# ==============================================
NODE_SOURCE_URL=""
NPM_REGISTRY="https://registry.npmmirror.com"

check_network() {
    log_step "阶段 2/6: 检测网络连接"
    
    if timeout 5 curl -s --head https://deb.nodesource.com &>/dev/null; then
        NODE_SOURCE_URL="https://deb.nodesource.com/setup_24.x"
        log_ok "使用官方 NodeSource 源 (Node.js 24)"
    else
        NODE_SOURCE_URL="https://mirrors.tuna.tsinghua.edu.cn/nodesource/deb/setup_24.x"
        log_warn "官方源超时，切换至 [清华大学镜像源]"
    fi
    echo ""
}

# ==============================================
# 阶段 3: 安装 Node.js 24 LTS
# ==============================================
install_node24() {
    log_step "阶段 3/6: 安装 Node.js 24 LTS"
    
    log_info "添加 NodeSource 源..."
    if curl -fsSL "$NODE_SOURCE_URL" | sudo -E bash -; then
        log_ok "NodeSource 源添加成功"
    else
        log_error "NodeSource 源添加失败"
        return 1
    fi
    
    log_info "安装 Node.js..."
    if sudo apt-get install -y nodejs; then
        log_ok "Node.js 安装成功"
        node -v
        npm -v
    else
        log_error "Node.js 安装失败"
        return 1
    fi
    
    # 配置 npm 镜像
    log_info "配置 npm 淘宝镜像..."
    npm config set registry "$NPM_REGISTRY"
    log_ok "npm 镜像已设置为: $(npm config get registry)"
    echo ""
}

# ==============================================
# 阶段 4: 安装 OpenClaw 核心
# ==============================================
install_openclaw() {
    log_step "阶段 4/6: 安装 OpenClaw 核心"
    
    log_info "更新 npm..."
    sudo npm install -g npm@latest
    
    log_info "安装 openclaw (这可能需要几分钟)..."
    if sudo npm install -g openclaw; then
        log_ok "OpenClaw 安装成功"
        openclaw --version 2>/dev/null || log_warn "版本检查失败，但可能已安装"
    else
        log_error "OpenClaw 安装失败"
        log_warn "请检查上方错误信息，常见原因:"
        log_warn "  1. 网络问题 - 检查代理或稍后重试"
        log_warn "  2. 权限问题 - 确保有 sudo 权限"
        log_warn "  3. npm 问题 - 运行 npm cache clean --force"
        return 1
    fi
    echo ""
}

# ==============================================
# 阶段 5: 创建配置模板
# ==============================================
create_configs() {
    log_step "阶段 5/6: 创建配置模板"
    
    mkdir -p ~/.openclaw/workspace/{memory,skills}
    mkdir -p ~/.openclaw/logs
    
    safe_create() {
        local file=$1
        local content=$2
        if [ ! -f "$file" ]; then
            echo -e "$content" > "$file"
            log_ok "创建: $file"
        else
            echo -e "${BLUE}[-]${NC} 已存在: $file"
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
    else
        echo -e "${BLUE}[-]${NC} 配置文件已存在"
    fi
    echo ""
}

# ==============================================
# 阶段 6: 安装基础 Skills
# ==============================================
install_skills() {
    log_step "阶段 6/6: 安装基础 Skills"
    
    log_info "尝试安装核心技能..."
    for skill in weather healthcheck; do
        if npx clawhub@latest install "$skill" 2>/dev/null; then
            log_ok "$skill 安装成功"
        else
            echo -e "${YELLOW}[-]${NC} $skill 安装跳过 (可手动安装)"
        fi
    done
    
    log_info "更多技能: npx clawhub@latest install <技能名>"
    echo ""
}

# ==============================================
# 完成
# ==============================================
finish() {
    echo -e "${BLUE}=============================================="
    echo -e "✅ 安装完成!"
    echo -e "==============================================${NC}"
    echo ""
    echo "📊 环境信息:"
    echo "   Node.js: $(node -v)"
    echo "   npm: $(npm -v)"
    echo "   OpenClaw: $(openclaw --version 2>/dev/null || echo '待验证')"
    echo ""
    echo "📝 下一步操作:"
    echo "   1. 刷新环境: source ~/.bashrc"
    echo "   2. 编辑身份: nano ~/.openclaw/workspace/IDENTITY.md"
    echo "   3. 配置密钥: nano ~/.openclaw/openclaw.json"
    echo "   4. 启动服务: openclaw gateway start"
    echo ""
    echo -e "🏠 项目: ${BLUE}https://gitee.com/hongmaple/mapleclaw${NC}"
    echo -e "👨‍💻 感谢作者: ${YELLOW}maple (hongmaple)${NC} 及 枫林 AI 协作团队"
    echo "=============================================="
}

# ==============================================
# 主执行流
# ==============================================
print_banner

# 确认卸载
log_warn "即将卸载现有 Node.js 并安装 Node.js 24"
read -p "是否继续? (y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_info "已取消"
    exit 0
fi

uninstall_old_node
check_network
install_node24
install_openclaw
create_configs
install_skills
finish