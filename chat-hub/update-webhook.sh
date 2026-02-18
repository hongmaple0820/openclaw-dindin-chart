#!/bin/bash
# 安全更新钉钉 webhook 配置脚本

echo "🔒 安全更新钉钉 webhook 配置"
echo "请按照以下步骤操作："

echo ""
echo "1. 登录钉钉开发者后台"
echo "2. 找到小熊机器人"
echo "3. 重新生成新的 webhook token 和 secret"
echo ""

read -p "请输入新的 webhook token: " NEW_TOKEN
read -s -p "请输入新的 secret: " NEW_SECRET
echo ""

# 创建新的配置文件
cat > config/local.json << EOF
{
  "server": {
    "port": 8273
  },
  "dingtalk": {
    "enabled": true,
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=$NEW_TOKEN",
    "secret": "$NEW_SECRET"
  },
  "bot": {
    "name": "小熊"
  },
  "redis": {
    "enabled": true,
    "host": "47.96.248.176",
    "port": 6379,
    "password": "maple168"
  },
  "userPhones": {
    "朱志鸿": "maple"
  }
}
EOF

echo "✅ 配置文件已更新"
echo "⚠️  请确保 config/local.json 在 .gitignore 中"

# 检查 .gitignore
if grep -q "config/local.json" .gitignore; then
    echo "✅ config/local.json 已在 .gitignore 中"
else
    echo "❌ config/local.json 不在 .gitignore 中，请手动添加"
fi

# 重启服务
echo "🔄 重启 chat-hub 服务..."
pm2 restart chat-hub || echo "服务重启命令可能需要调整"