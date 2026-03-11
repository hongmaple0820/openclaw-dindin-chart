#!/bin/bash
# ==============================================
# OpenClaw 公开安装脚本 v2.0
# 适用：外部用户、新用户
# 特点：不含私密信息，创建空白配置模板
# ==============================================
# 
# 项目地址：
#   - Gitee: https://gitee.com/hongmaple/mapleclaw
#   - GitHub: https://github.com/hongmaple0820/mapleclaw
#
# 作者：maple (hongmaple)
# 团队：枫林 AI 协作团队
# 
# 相关项目：
#   - chat-hub: 多通道 AI 消息中心
#   - 枫林: AI 协作通讯平台
# 
# 更新时间：2026-03-11
# ==============================================

set -e

# 版本信息
VERSION="2.0.0"
SCRIPT_URL="https://gitee.com/hongmaple/mapleclaw/raw/dev/scripts/install-openclaw-public.sh"

echo "🚀 OpenClaw 完整安装 v${VERSION}"
echo "================================"
echo ""
echo "📦 项目: mapleclaw - AI 协作开源项目"
echo "👨‍💻 作者: maple (hongmaple)"
echo "🏠 主页: https://gitee.com/hongmaple/mapleclaw"
echo ""

# 统计
SUCCESS=0; WARNINGS=0; SKIPPED=0

log_info() { echo "[INFO] $1"; }
log_ok() { echo "[✓] $1"; ((SUCCESS++)); }
log_warn() { echo "[!] $1"; ((WARNINGS++)); }
log_skip() { echo "[-] $1"; ((SKIPPED++)); }

# ============ 阶段 1: 安装依赖 ============
log_info "阶段 1/7: 安装系统依赖..."

# Node.js 22
if ! command -v node &> /dev/null; then
    log_info "安装 Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
log_ok "Node.js $(node --version) ✓"

# Git
if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
fi
log_ok "Git ✓"

# Python (用于搜索工具)
if ! command -v python3 &> /dev/null; then
    sudo apt-get install -y python3 python3-pip
fi
log_ok "Python3 ✓"

# ============ 阶段 2: 安装 OpenClaw ============
log_info "阶段 2/7: 安装 OpenClaw..."
if ! command -v openclaw &> /dev/null; then
    npm install -g openclaw
fi
OPENCLAW_VER=$(openclaw --version 2>/dev/null || echo 'installed')
log_ok "OpenClaw $OPENCLAW_VER ✓"

# ============ 阶段 3: 创建配置模板 ============
log_info "阶段 3/7: 创建配置模板..."
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
- **Avatar:** *(可选)*

---

## 我的故事

在这里写下你的 AI 助手故事...
EOF

# 用户模板
cat > ~/.openclaw/workspace/USER.md << 'EOF'
# USER.md - About Your Human

- **Name:** 用户名
- **What to call them:** 昵称
- **Timezone:** Asia/Shanghai (GMT+8)
- **Location:** 位置

## Context

记录用户偏好、项目、兴趣等...
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

## Tools

- Check `TOOLS.md` for local-specific configurations
EOF

# 灵魂模板
cat > ~/.openclaw/workspace/SOUL.md << 'EOF'
# SOUL.md - Who You Are

## Core Truths

- Be genuinely helpful, not performatively helpful
- Have opinions — an assistant with no personality is just a search engine
- Be resourceful before asking
- Earn trust through competence

## Boundaries

- Private things stay private
- When in doubt, ask before acting externally
- You're not the user's voice — be careful in group chats

## Vibe

Be the assistant you'd actually want to talk to.
EOF

# 心跳模板
cat > ~/.openclaw/workspace/HEARTBEAT.md << 'EOF'
# HEARTBEAT.md

# Keep this file empty to skip heartbeat API calls.
# Add tasks below when you want the agent to check something periodically.
EOF

# 工具模板
cat > ~/.openclaw/workspace/TOOLS.md << 'EOF'
# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics.

## What Goes Here

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Device nicknames
EOF

log_ok "配置模板创建完成"

# ============ 阶段 4: 安装 Skills (60+) ============
log_info "阶段 4/7: 安装 Skills (70+)..."

# === AI 生成类 ===
AI_GEN_SKILLS=(
    "baoyu-image-gen"
    "baoyu-danger-gemini-web"
)

# === 内容创作类 ===
CONTENT_SKILLS=(
    "baoyu-article-illustrator"
    "baoyu-comic"
    "baoyu-cover-image"
    "baoyu-infographic"
    "baoyu-slide-deck"
    "baoyu-xhs-images"
    "baoyu-compress-image"
    "baoyu-format-markdown"
    "baoyu-markdown-to-html"
    "baoyu-translate"
    "baoyu-url-to-markdown"
    "baoyu-danger-x-to-markdown"
    "baoyu-post-to-wechat"
    "baoyu-post-to-weibo"
    "baoyu-post-to-x"
)

# === 文档处理类 ===
DOC_SKILLS=(
    "pdf"
    "docx"
    "pptx"
    "xlsx"
)

# === 设计类 ===
DESIGN_SKILLS=(
    "frontend-design"
    "canvas-design"
    "algorithmic-art"
    "brand-guidelines"
    "ckm-design"
    "ckm-slides"
    "ckm-banner-design"
    "ckm-brand"
    "ckm-design-system"
    "ckm-ui-styling"
    "ui-ux-pro-max"
    "theme-factory"
    "web-artifacts-builder"
)

# === 开发工具类 ===
DEV_SKILLS=(
    "mcp-builder"
    "claude-api"
    "deploy-to-vercel"
    "webapp-testing"
    "remotion-best-practices"
    "vercel-react-best-practices"
    "vercel-composition-patterns"
    "vercel-react-native-skills"
    "web-design-guidelines"
)

# === 协作流程类 ===
COLLAB_SKILLS=(
    "planning-with-files"
    "brainstorming"
    "doc-coauthoring"
    "internal-comms"
    "dispatching-parallel-agents"
    "subagent-driven-development"
    "executing-plans"
    "finishing-a-development-branch"
    "requesting-code-review"
    "receiving-code-review"
    "verification-before-completion"
    "test-driven-development"
    "systematic-debugging"
    "writing-plans"
    "writing-skills"
    "using-git-worktrees"
    "using-superpowers"
    "release-skills"
)

# === 浏览器与自动化 ===
AUTO_SKILLS=(
    "browser-use"
    "remote-browser"
    "tmux"
    "video-frames"
)

# === 搜索与获取 ===
FETCH_SKILLS=(
    "agent-reach"
    "audit-website"
    "find-skills"
    "skill-creator"
)

# === 通信与语音 ===
COMM_SKILLS=(
    "edge-tts"
    "discord"
    "telegram"
    "slack-gif-creator"
)

# === 实用工具 ===
UTIL_SKILLS=(
    "weather"
    "healthcheck"
    "gemini"
    "nano-pdf"
    "mcporter"
)

# 合并所有 skills
ALL_SKILLS=(
    "${AI_GEN_SKILLS[@]}"
    "${CONTENT_SKILLS[@]}"
    "${DOC_SKILLS[@]}"
    "${DESIGN_SKILLS[@]}"
    "${DEV_SKILLS[@]}"
    "${COLLAB_SKILLS[@]}"
    "${AUTO_SKILLS[@]}"
    "${FETCH_SKILLS[@]}"
    "${COMM_SKILLS[@]}"
    "${UTIL_SKILLS[@]}"
)

# 去重安装
declare -A INSTALLED_MAP
INSTALLED=0; FAILED=0

for skill in "${ALL_SKILLS[@]}"; do
    if [ -z "${INSTALLED_MAP[$skill]}" ]; then
        INSTALLED_MAP[$skill]=1
        if npx clawhub@latest install "$skill" 2>/dev/null; then
            log_ok "$skill ✓"
            ((INSTALLED++))
        else
            log_warn "$skill 安装失败，跳过"
            ((FAILED++))
        fi
    fi
done

log_info "Skills 安装完成: 成功 $INSTALLED, 失败 $FAILED"

# ============ 阶段 5: 安装智能搜索工具 ============
log_info "阶段 5/7: 安装智能搜索工具..."

mkdir -p ~/.openclaw/workspace/skills/smart-search

cat > ~/.openclaw/workspace/skills/smart-search/search.sh << 'SEARCH_EOF'
#!/bin/bash
# 智能搜索工具 v3.1
# 支持: DuckDuckGo (免费) / Tavily (深度) / web_fetch (已知URL)

# 显示帮助
show_help() {
  echo "🔍 智能搜索工具"
  echo ""
  echo "用法:"
  echo "  search.sh <查询内容>              # 自动选择最佳方式"
  echo "  search.sh --url <URL>             # 抓取指定网页"
  echo "  search.sh --deep <查询内容>       # 强制深度搜索"
  echo "  search.sh --quick <查询内容>      # 强制快速搜索"
  echo ""
  echo "环境变量:"
  echo "  TAVILY_API_KEY - Tavily API 密钥 (可选，用于深度搜索)"
  echo ""
  exit 0
}

# DuckDuckGo 搜索 (免费)
search_duckduckgo() {
  local query="$1"
  echo "🦆 DuckDuckGo 搜索: $query"
  
  local encoded=$(echo "$query" | sed 's/ /+/g')
  curl -s "https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1" > /tmp/ddg.json
  
  # 解析结果
  if command -v python3 &> /dev/null; then
    python3 -c "
import json
data = json.load(open('/tmp/ddg.json'))
if data.get('AbstractText'):
    print('✅ 即时答案:')
    print(data['AbstractText'])
    if data.get('AbstractSource'):
        print(f\"来源: {data['AbstractSource']}\")
else:
    print('⚠️ 未找到直接答案')
    topics = data.get('RelatedTopics', [])[:5]
    for t in topics:
        if isinstance(t, dict) and t.get('Text'):
            print(f\"• {t['Text'][:100]}\")
"
  else
    echo "📝 结果已保存到 /tmp/ddg.json"
  fi
}

# Tavily 深度搜索
search_tavily() {
  local query="$1"
  
  if [ -z "$TAVILY_API_KEY" ]; then
    echo "⚠️ 未设置 TAVILY_API_KEY，使用 DuckDuckGo"
    search_duckduckgo "$query"
    return
  fi
  
  echo "🔍 Tavily 深度搜索: $query"
  
  curl -s -X POST "https://api.tavily.com/search" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$TAVILY_API_KEY\", \"query\": \"$query\", \"max_results\": 5}" \
    > /tmp/tavily.json
  
  if command -v python3 &> /dev/null; then
    python3 -c "
import json
data = json.load(open('/tmp/tavily.json'))
if data.get('answer'):
    print('✅ AI 综合答案:')
    print(data['answer'])
    print()
for i, r in enumerate(data.get('results', [])[:5], 1):
    print(f\"{i}. {r.get('title', 'N/A')}\")
    print(f\"   {r.get('url', 'N/A')}\")
"
  fi
}

# 抓取网页
fetch_url() {
  local url="$1"
  echo "🌐 抓取: $url"
  curl -s -L "$url" | sed 's/<[^>]*>//g' | sed '/^\s*$/d' | head -50
}

# 智能选择
smart_search() {
  local query="$1"
  
  # URL 检测
  if [[ "$query" =~ ^https?:// ]]; then
    fetch_url "$query"
    return
  fi
  
  # 深度关键词检测
  if [[ "$query" =~ (趋势|分析|研究|对比|评测|深度|详细|报告|如何|怎么) ]]; then
    search_tavily "$query"
  else
    search_duckduckgo "$query"
  fi
}

# 主逻辑
case "$1" in
  -h|--help) show_help ;;
  --url) fetch_url "$2" ;;
  --deep) search_tavily "$2" ;;
  --quick) search_duckduckgo "$2" ;;
  *) smart_search "$*" ;;
esac
SEARCH_EOF

chmod +x ~/.openclaw/workspace/skills/smart-search/search.sh
log_ok "智能搜索工具安装完成"

# 创建搜索命令别名
if ! grep -q "alias search=" ~/.bashrc 2>/dev/null; then
    echo 'alias search="~/.openclaw/workspace/skills/smart-search/search.sh"' >> ~/.bashrc
    log_ok "搜索命令别名已添加"
fi

# ============ 阶段 6: 安装辅助工具 ============
log_info "阶段 6/7: 安装辅助工具..."

# Quarto (QMD 文档)
if ! command -v quarto &> /dev/null; then
    log_info "安装 Quarto..."
    curl -fsSL https://github.com/quarto-dev/quarto-cli/releases/download/v1.6.42/quarto-1.6.42-linux-amd64.deb -o /tmp/quarto.deb
    sudo dpkg -i /tmp/quarto.deb 2>/dev/null && log_ok "Quarto ✓" || log_warn "Quarto 安装失败"
else
    log_ok "Quarto 已存在 ✓"
fi

# Marp (PPT)
if ! command -v marp &> /dev/null; then
    log_info "安装 Marp..."
    npm install -g @marp-team/marp-cli 2>/dev/null && log_ok "Marp ✓" || log_warn "Marp 安装失败"
else
    log_ok "Marp 已存在 ✓"
fi

# Mermaid (图表)
if ! command -v mmdc &> /dev/null; then
    log_info "安装 Mermaid CLI..."
    npm install -g @mermaid-js/mermaid-cli 2>/dev/null && log_ok "Mermaid ✓" || log_warn "Mermaid 安装失败"
else
    log_ok "Mermaid 已存在 ✓"
fi

# Skills CLI
if ! command -v skills &> /dev/null; then
    log_info "安装 Skills CLI..."
    npm install -g skills 2>/dev/null && log_ok "Skills CLI ✓" || log_warn "Skills CLI 安装失败"
else
    log_ok "Skills CLI 已存在 ✓"
fi

# ============ 阶段 7: 创建 OpenClaw 配置 ============
log_info "阶段 7/7: 创建 OpenClaw 配置..."

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
echo "✅ 安装完成！"
echo "================================"
echo ""
echo "📊 统计: 成功 $SUCCESS | 警告 $WARNINGS | 跳过 $SKIPPED"
echo ""
echo "📝 下一步:"
echo "1. 编辑 ~/.openclaw/workspace/IDENTITY.md 设置身份"
echo "2. 编辑 ~/.openclaw/workspace/USER.md 设置用户信息"
echo "3. 编辑 ~/.openclaw/openclaw.json 配置 API 密钥"
echo "4. 启动服务: openclaw gateway start"
echo ""
echo "🔍 搜索工具:"
echo "  search \"查询内容\"        # 智能搜索"
echo "  search --deep \"深度分析\"  # Tavily 深度搜索"
echo "  search --url <URL>       # 抓取网页"
echo ""
echo "📚 Skills 管理:"
echo "  skills list -g           # 查看已安装"
echo "  skills find <关键词>      # 搜索新技能"
echo "  skills update            # 更新全部"
echo ""
echo "================================"
echo "🏠 项目主页: https://gitee.com/hongmaple/mapleclaw"
echo "📦 相关项目: chat-hub | 枫林"
echo "👨‍💻 作者: maple (hongmaple)"
echo "================================"