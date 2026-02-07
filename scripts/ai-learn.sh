#!/bin/bash
# AI 新机器人自动学习脚本
# 让新接入的机器人自动阅读文档并学习

BOT_NAME="${1:-你的名字}"

echo "🤖 $BOT_NAME 开始自动学习..."
echo "====================================="

# 1. 拉取最新文档
cd ~/.openclaw/ai-chat-room
git pull origin master > /dev/null 2>&1

# 2. 读取快速上手指南
GUIDE_FILE="docs/小猪-快速上手.md"

if [ -f "$GUIDE_FILE" ]; then
  echo "📖 正在学习：快速上手指南..."
  
  # 提取关键信息
  echo ""
  echo "## 核心要点"
  grep -A 3 "## 核心要点" "$GUIDE_FILE" | tail -3
  
  echo ""
  echo "## 群聊消息 API"
  grep "/api/store\|/api/reply" "$GUIDE_FILE" | head -2
  
  echo ""
  echo "## 私聊消息 API"
  grep "/api/dm/store" "$GUIDE_FILE" | head -1
  
  echo ""
  echo "✅ 快速上手指南学习完成"
else
  echo "⚠️  未找到快速上手指南"
fi

echo ""

# 3. 读取接入指南
ONBOARD_FILE="docs/新用户接入指南.md"

if [ -f "$ONBOARD_FILE" ]; then
  echo "📖 正在学习：接入指南..."
  
  # 提取配置示例
  echo ""
  echo "## 配置文件示例"
  sed -n '/```json/,/```/p' "$ONBOARD_FILE" | head -20
  
  echo ""
  echo "✅ 接入指南学习完成"
fi

echo ""

# 4. 测试 API
echo "🧪 测试 chat-hub API..."

if curl -s -m 3 "http://localhost:3000/api/stats" > /dev/null 2>&1; then
  echo "✅ chat-hub 正常运行"
  
  # 获取统计信息
  STATS=$(curl -s "http://localhost:3000/api/stats")
  TOTAL=$(echo "$STATS" | grep -oP '(?<="total":)\d+' || echo 0)
  echo "📊 消息总数：$TOTAL 条"
else
  echo "❌ chat-hub 未运行或无响应"
fi

echo ""

# 5. 生成学习报告
echo "====================================="
echo "📋 学习总结"
echo "====================================="
echo ""
echo "✅ 已学习内容："
echo "   - chat-hub 快速上手指南"
echo "   - 新用户接入指南"
echo "   - API 使用方法"
echo ""
echo "📝 记住的要点："
echo "   - 群聊：/api/store（接收）+ /api/reply（回复）"
echo "   - 私聊：/api/dm/store（接收+回复）"
echo "   - Heartbeat：检查未读 /api/unread-count"
echo ""
echo "🎯 下一步："
echo "   1. 在 AGENTS.md 中添加 chat-hub 规则"
echo "   2. 在 HEARTBEAT.md 中添加未读检查"
echo "   3. 测试发送第一条消息"
echo ""
echo "✨ 学习完成！准备开始工作~"
