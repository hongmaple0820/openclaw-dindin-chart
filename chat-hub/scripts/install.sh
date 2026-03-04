#!/bin/bash
#
# Chat-Hub 一键安装脚本
# 
# 用法: curl -fsSL https://get.hiclaw.io/chat-hub | bash
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# 检查依赖
check_dependencies() {
    log_step "检查依赖..."
    
    local missing=()
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing+=("node")
    else
        log_info "Node.js $(node -v) 已安装"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    else
        log_info "npm $(npm -v) 已安装"
    fi
    
    # 检查 Docker (可选)
    if command -v docker &> /dev/null; then
        log_info "Docker $(docker --version) 已安装"
        HAS_DOCKER=true
    else
        log_warn "Docker 未安装，将使用本地部署"
        HAS_DOCKER=false
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "缺少依赖: ${missing[*]}"
        log_info "请先安装 Node.js 18+: https://nodejs.org/"
        exit 1
    fi
}

# 安装 chat-hub
install_chat_hub() {
    log_step "安装 Chat-Hub..."
    
    INSTALL_DIR="${HOME}/.hiclaw/chat-hub"
    
    # 创建目录
    mkdir -p "$INSTALL_DIR"
    
    # 克隆仓库
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "更新现有安装..."
        cd "$INSTALL_DIR"
        git pull origin dev
    else
        log_info "克隆仓库..."
        git clone -b dev https://gitee.com/hongmaple/openclaw-dindin-chart.git "$INSTALL_DIR"
        cd "$INSTALL_DIR/chat-hub"
    fi
    
    # 安装依赖
    log_info "安装依赖..."
    npm install
    
    # 创建数据目录
    mkdir -p "${HOME}/.hiclaw/data"
    
    log_info "安装完成: $INSTALL_DIR"
}

# 配置 chat-hub
configure_chat_hub() {
    log_step "配置 Chat-Hub..."
    
    CONFIG_FILE="${HOME}/.hiclaw/config.yaml"
    
    if [ -f "$CONFIG_FILE" ]; then
        log_info "配置文件已存在: $CONFIG_FILE"
        return
    fi
    
    # 交互式配置
    echo ""
    echo "请选择部署模式:"
    echo "  1) 独立部署 (不连接云端)"
    echo "  2) 连接云端 (需要云端 Token)"
    read -p "请选择 [1/2]: " mode_choice
    
    case $mode_choice in
        2)
            read -p "请输入云端 Token: " cloud_token
            read -p "云端端点 (默认: https://cloud.hiclaw.io): " cloud_endpoint
            cloud_endpoint=${cloud_endpoint:-"https://cloud.hiclaw.io"}
            
            cat > "$CONFIG_FILE" << EOF
# Chat-Hub 配置文件
cloud:
  enabled: true
  endpoint: $cloud_endpoint
  token: $cloud_token
  sync:
    config: true
    skills: manual
    mcp: manual
    sessions: manual
    media: false

server:
  port: 8273
  
database:
  path: ~/.hiclaw/data/chat-hub.db
EOF
            log_info "配置文件已创建: $CONFIG_FILE"
            ;;
        *)
            cat > "$CONFIG_FILE" << EOF
# Chat-Hub 配置文件
cloud:
  enabled: false

server:
  port: 8273
  
database:
  path: ~/.hiclaw/data/chat-hub.db
EOF
            log_info "配置文件已创建: $CONFIG_FILE"
            ;;
    esac
}

# 启动 chat-hub
start_chat_hub() {
    log_step "启动 Chat-Hub..."
    
    cd "${HOME}/.hiclaw/chat-hub/chat-hub"
    
    # 使用 pm2 管理
    if command -v pm2 &> /dev/null; then
        log_info "使用 PM2 启动..."
        pm2 start src/server.js --name chat-hub
        pm2 save
    else
        log_info "安装 PM2..."
        npm install -g pm2
        pm2 start src/server.js --name chat-hub
        pm2 startup
        pm2 save
    fi
    
    log_info "Chat-Hub 已启动"
    log_info "访问: http://localhost:8273"
}

# Docker 部署
docker_deploy() {
    if [ "$HAS_DOCKER" != true ]; then
        return
    fi
    
    log_step "Docker 部署选项..."
    
    read -p "是否使用 Docker 部署? [y/N]: " use_docker
    
    if [[ "$use_docker" =~ ^[Yy]$ ]]; then
        log_info "使用 Docker 部署..."
        
        cd "${HOME}/.hiclaw/chat-hub/chat-hub"
        
        # 构建镜像
        docker build -t hiclaw/chat-hub:latest .
        
        # 启动容器
        docker run -d \
            --name chat-hub \
            -p 8273:8273 \
            -v ~/.hiclaw/data:/data \
            -v ~/.hiclaw/config.yaml:/app/config.yaml \
            hiclaw/chat-hub:latest
        
        log_info "Docker 容器已启动"
        exit 0
    fi
}

# 主函数
main() {
    echo ""
    echo "================================"
    echo "   Chat-Hub 一键安装脚本"
    echo "================================"
    echo ""
    
    check_dependencies
    install_chat_hub
    docker_deploy
    configure_chat_hub
    start_chat_hub
    
    echo ""
    log_info "安装完成！"
    echo ""
    echo "下一步:"
    echo "  1. 访问 http://localhost:8273"
    echo "  2. 查看日志: pm2 logs chat-hub"
    echo "  3. 停止服务: pm2 stop chat-hub"
    echo "  4. 配置文件: ~/.hiclaw/config.yaml"
    echo ""
}

main "$@"