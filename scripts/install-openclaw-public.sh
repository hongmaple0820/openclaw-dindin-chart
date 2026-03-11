#!/bin/bash
# ==============================================
# OpenClaw 公开安装脚本
# 适用：外部用户、新用户
# 特点：不含私密信息，创建空白配置模板
# ==============================================

set -e

echo "🚀 OpenClaw 完整安装（公开版）"
echo "================================"
echo ""

# 统计
SUCCESS=0; WARNINGS=0; SKIPPED=0

log_info() { echo "[INFO] $1"; }
log_ok() { echo "[✓] $1"; ((SUCCESS++)); }
log_warn() { echo "[!] $1"; ((WARNINGS++)); }

# ============ 阶段 1: 安装依赖 ============
log_info "阶段 1/6: 安装系统依赖..."

if ! command -v node &> /dev/null; then
    log_info "安装 Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
log_ok "Node.js $(node --version) ✓"

if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
fi
log_ok "Git ✓"

# ============ 阶段 2: 安装 OpenClaw ============
log_info "阶段 2/6: 安装 OpenClaw..."
if ! command -v openclaw &> /dev/null; then
    npm install -g openclaw
fi
log_ok "OpenClaw $(openclaw --version 2>/dev/null || echo 'installed') ✓"

# ============ 阶段 3: 创建配置模板 ============
log_info "阶段 3/6: 创建配置模板..."
mkdir -p ~/.openclaw/workspace/memory
mkdir -p ~/.openclaw/workspace/skills
mkdir -p ~/.openclaw/logs

# 身份模板
cat > ~/.openclaw/workspace/IDENTITY.md << 'EOF'
# IDENTITY.md - Who Am I?

- **Name:** 你的名字
- **Creature:** AI 助手
- **Vibe:** 可靠、高效、专注
- **Emoji:** ✨
EOF

# 用户模板
cat > ~/.openclaw/workspace/USER.md << 'EOF'
# USER.md - About Your Human

- **Name:** 用户名
- **What to call them:** 昵称
- **Timezone:** Asia/Shanghai (GMT+8)
- **Location:** 位置
EOF

# 工作方法模板
cat > ~/.openclaw/workspace/AGENTS.md << 'EOF'
# AGENTS.md - Your Workspace

## Session Startup
1. Read `SOUL.md` — who you are
2. Read `USER.md` — who you're helping
3. Read `memory/YYYY-MM-DD.md` — recent context

## Memory
- Daily notes: `memory/YYYY-MM-DD.md`
- Long-term: `MEMORY.md`
EOF

# 灵魂模板
cat > ~/.openclaw/workspace/SOUL.md << 'EOF'
# SOUL.md - Who You Are

## Core Truths
- Be genuinely helpful
- Have opinions
- Be resourceful before asking
EOF

# 心跳模板
cat > ~/.openclaw/workspace/HEARTBEAT.md << 'EOF'
# HEARTBEAT.md
# Keep empty to skip heartbeat calls
EOF

log_ok "配置模板创建完成"

# ============ 阶段 4: 安装 Skills ============
log_info "阶段 4/6: 安装常用 Skills..."

PUBLIC_SKILLS=(
    "weather"
    "edge-tts"
    "planning-with-files"
    "browser-use"
    "canvas-design"
    "frontend-design"
    "pdf"
    "docx"
    "pptx"
    "mcp-builder"
)

for skill in "${PUBLIC_SKILLS[@]}"; do
    if npx clawhub@latest install "$skill" 2>/dev/null; then
        log_ok "$skill ✓"
    else
        log_warn "$skill 安装失败，跳过"
    fi
done

# ============ 阶段 5: 安装工具 ============
log_info "阶段 5/6: 安装辅助工具..."

# Quarto (QMD 文档)
if ! command -v quarto &> /dev/null; then
    curl -fsSL https://github.com/quarto-dev/quarto-cli/releases/download/v1.6.42/quarto-1.6.42-linux-amd64.deb -o /tmp/quarto.deb
    sudo dpkg -i /tmp/quarto.deb 2>/dev/null && log_ok "Quarto ✓" || log_warn "Quarto 安装失败"
else
    log_ok "Quarto 已存在 ✓"
fi

# Marp (PPT)
if ! command -v marp &> /dev/null; then
    npm install -g @marp-team/marp-cli 2>/dev/null && log_ok "Marp ✓" || log_warn "Marp 安装失败"
else
    log_ok "Marp 已存在 ✓"
fi

# ============ 阶段 6: 创建 OpenClaw 配置 ============
log_info "阶段 6/6: 创建 OpenClaw 配置..."

if [ ! -f ~/.openclaw/openclaw.json ]; then
cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "model": "bailian/qwen-turbo",
  "channels": {},
  "browser": { "enabled": true },
  "tts": { "enabled": true }
}
EOF
    log_ok "OpenClaw 配置创建完成"
else
    log_ok "OpenClaw 配置已存在"
fi

# ============ 完成 ============
echo ""
echo "================================"
echo "✅ 安装完成"
echo "================================"
echo "成功: $SUCCESS | 警告: $WARNINGS | 跳过: $SKIPPED"
echo ""
echo "📝 下一步:"
echo "1. 编辑 ~/.openclaw/workspace/IDENTITY.md 设置身份"
echo "2. 编辑 ~/.openclaw/workspace/USER.md 设置用户信息"
echo "3. 编辑 ~/.openclaw/openclaw.json 配置 API 密钥"
echo "4. 启动服务: openclaw gateway start"
echo ""