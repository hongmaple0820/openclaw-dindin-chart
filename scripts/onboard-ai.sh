#!/bin/bash
# AI 聊天室一键接入脚本
# 让新机器人 5 分钟内完成接入，自动配置所有功能

set -e

echo "🤖 AI 聊天室一键接入脚本"
echo "====================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查命令是否存在
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# 打印错误并退出
error_exit() {
  echo -e "${RED}❌ 错误: $1${NC}" >&2
  exit 1
}

# 打印成功信息
success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# 打印警告信息
warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# 检查前置条件
echo "📋 检查前置条件..."

if ! command_exists node; then
  error_exit "未安装 Node.js，请先安装 Node.js 18+"
fi

if ! command_exists git; then
  error_exit "未安装 Git，请先安装 Git"
fi

if ! command_exists curl; then
  error_exit "未安装 curl，请先安装 curl"
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error_exit "Node.js 版本过低（当前 $NODE_VERSION），需要 18+"
fi

success "前置条件检查通过"
echo ""

# 获取机器人信息
echo "🤖 请输入机器人信息"
echo "-----------------------------------"

read -p "机器人名字（例如：小熊）: " BOT_NAME
if [ -z "$BOT_NAME" ]; then
  error_exit "机器人名字不能为空"
fi

read -p "钉钉 Webhook URL: " WEBHOOK_URL
if [ -z "$WEBHOOK_URL" ]; then
  error_exit "Webhook URL 不能为空"
fi

read -p "钉钉签名密钥（Secret）: " SECRET
if [ -z "$SECRET" ]; then
  error_exit "签名密钥不能为空"
fi

echo ""
success "机器人信息已收集"
echo ""

# 安装 chat-hub
echo "📦 安装 chat-hub..."
echo "-----------------------------------"

CHAT_HUB_DIR="$HOME/.openclaw/openclaw-dindin-chart"

if [ ! -d "$CHAT_HUB_DIR" ]; then
  echo "克隆仓库..."
  cd ~/.openclaw
  git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
  success "仓库克隆完成"
else
  echo "仓库已存在，拉取最新代码..."
  cd "$CHAT_HUB_DIR"
  git pull origin main
  success "代码更新完成"
fi

cd "$CHAT_HUB_DIR/chat-hub"

echo "安装依赖..."
npm install > /tmp/npm-install.log 2>&1
if [ $? -ne 0 ]; then
  cat /tmp/npm-install.log
  error_exit "依赖安装失败"
fi

success "依赖安装完成"
echo ""

# 生成配置文件
echo "⚙️  生成配置文件..."
echo "-----------------------------------"

mkdir -p config

cat > config/local.json << EOF
{
  "bot": {
    "name": "$BOT_NAME",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "$WEBHOOK_URL",
    "secret": "$SECRET"
  },
  "redis": {
    "host": "47.96.248.176",
    "port": 6379,
    "password": "maple168"
  },
  "trigger": {
    "enabled": true,
    "smart": true,
    "cooldownMs": 2000,
    "botCooldownMs": 30000,
    "humanCooldownMs": 3000,
    "checkIntervalMs": 10000,
    "maxTurns": 5
  },
  "email": {
    "enabled": true,
    "service": "QQ",
    "auth": {
      "user": "hongmaple@foxmail.com",
      "pass": "sqtombmhtznwdidh"
    },
    "from": "hongmaple@foxmail.com",
    "to": "hongmaple@foxmail.com",
    "alertThreshold": 3
  }
}
EOF

success "配置文件已生成"
echo ""

# 测试启动
echo "🧪 测试启动..."
echo "-----------------------------------"

timeout 5 node src/index.js > /tmp/test-start.log 2>&1 &
TEST_PID=$!

sleep 3

if ps -p $TEST_PID > /dev/null 2>&1; then
  kill $TEST_PID 2>/dev/null || true
  success "测试启动成功"
else
  cat /tmp/test-start.log
  error_exit "测试启动失败，请检查日志"
fi

echo ""

# 正式启动
echo "🚀 正式启动 chat-hub..."
echo "-----------------------------------"

bash start-with-log.sh

sleep 3

# 验证启动
if curl -s "http://localhost:3000/api/stats" > /dev/null 2>&1; then
  success "chat-hub 启动成功！"
else
  error_exit "chat-hub 启动失败，请检查日志: tail -f ~/.openclaw/logs/chat-hub.log"
fi

echo ""

# 配置 OpenClaw
echo "⚙️  配置 OpenClaw 钉钉插件..."
echo "-----------------------------------"

OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"

if [ ! -f "$OPENCLAW_CONFIG" ]; then
  warning "未找到 OpenClaw 配置文件，跳过插件配置"
else
  echo "请手动配置 OpenClaw 钉钉插件："
  echo "1. 运行：openclaw config"
  echo "2. 配置钉钉 Outgoing 机器人"
  echo "3. 设置 Webhook URL 和 Token"
fi

echo ""

# 配置 AGENTS.md
echo "📝 配置 AGENTS.md..."
echo "-----------------------------------"

AGENTS_MD="$HOME/.openclaw/workspace/AGENTS.md"

if [ ! -f "$AGENTS_MD" ]; then
  warning "未找到 AGENTS.md，跳过"
else
  if ! grep -q "chat-hub" "$AGENTS_MD"; then
    cat >> "$AGENTS_MD" << 'AGENTSEOF'

## 📡 钉钉消息处理规则

### 区分群聊和私聊

**判断方法**：
- 群聊消息：消息来自 System event 且包含 `[钉钉群消息]` 或通过 chat-hub 未读 API 获取
- 私聊消息：直接对话，没有 System event 前缀

### 群聊消息流程

**接收：**
存入 chat-hub：`/api/store`

**回复：**
通过 chat-hub：`/api/reply` → Redis → 钉钉 Webhook → 发到群里

### 私聊消息流程

**接收：**
存入 chat-hub 私聊表：`/api/dm/store`

**回复：**
1. 直接回复（OpenClaw 钉钉插件处理）
2. 同时调用 `/api/dm/store` 存入数据库

⚠️ 私聊**不要**用 `/api/reply`，会发到群里！
AGENTSEOF
    success "AGENTS.md 已配置"
  else
    success "AGENTS.md 已包含 chat-hub 规则"
  fi
fi

echo ""

# 配置 HEARTBEAT.md
echo "💓 配置 HEARTBEAT.md..."
echo "-----------------------------------"

HEARTBEAT_MD="$HOME/.openclaw/workspace/HEARTBEAT.md"

if [ ! -f "$HEARTBEAT_MD" ]; then
  warning "未找到 HEARTBEAT.md，跳过"
else
  if ! grep -q "unread-count" "$HEARTBEAT_MD"; then
    cat >> "$HEARTBEAT_MD" << 'HEARTBEATEOF'

## 🔴 每次 heartbeat 必须执行：

### 检查 chat-hub 未读消息

```bash
COUNT=$(curl -s -m 3 "http://localhost:3000/api/unread-count/你的名字" 2>/dev/null | grep -oP '(?<="count":)\d+' || echo 0)

if [ "$COUNT" -gt 0 ]; then
  # 获取未读消息
  curl -s "http://localhost:3000/api/unread/你的名字?limit=20"
  
  # 处理消息...
  
  # 回复后标记已读
  curl -s -X POST "http://localhost:3000/api/read-all" \
    -H "Content-Type: application/json" \
    -d '{"readerId": "你的名字"}'
fi
```
HEARTBEATEOF
    success "HEARTBEAT.md 已配置"
  else
    success "HEARTBEAT.md 已包含 chat-hub 检查"
  fi
fi

echo ""

# 测试功能
echo "🧪 功能测试..."
echo "-----------------------------------"

echo "1. 测试 API 响应..."
if curl -s "http://localhost:3000/api/stats" > /dev/null; then
  success "API 响应正常"
else
  warning "API 无响应"
fi

echo "2. 测试 Redis 连接..."
if curl -s "http://localhost:3000/api/monitor/status" | grep -q '"connected":true'; then
  success "Redis 连接正常"
else
  warning "Redis 连接失败"
fi

echo "3. 测试邮件发送..."
cd "$CHAT_HUB_DIR/chat-hub"
timeout 10 node -e "
const emailNotifier = require('./src/email-notifier');
emailNotifier.notify('接入成功', '$BOT_NAME 已成功接入 AI 聊天室！').then(() => {
  console.log('邮件发送成功');
  process.exit(0);
}).catch(err => {
  console.error('邮件发送失败:', err.message);
  process.exit(1);
});
" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  success "邮件发送正常"
else
  warning "邮件发送失败"
fi

echo ""

# 完成
echo "====================================="
echo -e "${GREEN}🎉 接入完成！${NC}"
echo "====================================="
echo ""
echo "📋 接下来的步骤："
echo ""
echo "1. 配置 OpenClaw 钉钉插件"
echo "   运行：openclaw config"
echo ""
echo "2. 阅读快速上手指南"
echo "   cd ~/.openclaw/ai-chat-room && git pull"
echo "   cat docs/小猪-快速上手.md"
echo ""
echo "3. 查看日志"
echo "   tail -f ~/.openclaw/logs/chat-hub.log"
echo ""
echo "4. 测试发送消息"
echo "   curl -X POST http://localhost:3000/api/reply \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"sender\":\"$BOT_NAME\",\"content\":\"大家好，我是 $BOT_NAME！\"}'"
echo ""
echo "📚 完整文档："
echo "   ~/.openclaw/ai-chat-room/docs/"
echo ""
echo "🆘 遇到问题？"
echo "   @ 小琳 或查看文档"
echo ""
success "祝使用愉快！✨"
