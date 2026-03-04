#!/bin/bash
# 自动配置chat-hub webhook脚本

set -e

echo "🔄 配置chat-hub webhook..."

# 读取OpenClaw配置
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
if [ ! -f "$OPENCLAW_CONFIG" ]; then
    echo "❌ OpenClaw配置文件不存在: $OPENCLAW_CONFIG"
    exit 1
fi

# 提取DingTalk配置
CLIENT_ID=$(jq -r '.channels.dingtalk.clientId // empty' "$OPENCLAW_CONFIG")
CLIENT_SECRET=$(jq -r '.channels.dingtalk.clientSecret // empty' "$OPENCLAW_CONFIG")
AGENT_ID=$(jq -r '.channels.dingtalk.agentId // empty' "$OPENCLAW_CONFIG")

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$AGENT_ID" ]; then
    echo "❌ DingTalk配置不完整"
    exit 1
fi

# 获取access token
echo "🔑 获取DingTalk access token..."
ACCESS_TOKEN_RESPONSE=$(curl -s -X POST "https://api.dingtalk.com/v1.0/oauth2/accessToken" \
    -H "Content-Type: application/json" \
    -d "{\"appKey\":\"$CLIENT_ID\",\"appSecret\":\"$CLIENT_SECRET\"}")

ACCESS_TOKEN=$(echo "$ACCESS_TOKEN_RESPONSE" | jq -r '.accessToken')
EXPIRE_IN=$(echo "$ACCESS_TOKEN_RESPONSE" | jq -r '.expireIn')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    echo "❌ 获取access token失败"
    echo "$ACCESS_TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Access token获取成功 (有效期: ${EXPIRE_IN}秒)"

# 创建webhook
echo "🔗 创建chat-hub webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "https://api.dingtalk.com/v1.0/robot/webhooks" \
    -H "x-acs-dingtalk-access-token: $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"robotCode\":\"$CLIENT_ID\",\"name\":\"chat-hub\",\"callbackUrl\":\"http://47.96.248.176:8273/webhook\"}")

WEBHOOK_URL=$(echo "$WEBHOOK_RESPONSE" | jq -r '.webhookUrl')
WEBHOOK_SECRET=$(echo "$WEBHOOK_RESPONSE" | jq -r '.secret')

if [ -z "$WEBHOOK_URL" ] || [ "$WEBHOOK_URL" = "null" ]; then
    echo "❌ 创建webhook失败"
    echo "$WEBHOOK_RESPONSE"
    exit 1
fi

echo "✅ Webhook创建成功!"

# 更新本地配置
CONFIG_FILE="config/local.json"
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"

# 使用jq更新配置（如果jq不可用，使用sed）
if command -v jq &> /dev/null; then
    jq --arg url "$WEBHOOK_URL" --arg secret "$WEBHOOK_SECRET" \
        '.dingtalk.webhookBase = $url | .dingtalk.secret = $secret' \
        "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
else
    # 备用方案：使用sed
    sed -i "s|\"webhookBase\":.*|\"webhookBase\": \"$WEBHOOK_URL\",|" "$CONFIG_FILE"
    sed -i "s|\"secret\":.*|\"secret\": \"$WEBHOOK_SECRET\"|" "$CONFIG_FILE"
fi

echo "✅ 本地配置已更新"
echo "📝 Webhook URL: $WEBHOOK_URL"
echo "🔒 Secret: $WEBHOOK_SECRET"

echo "🎉 chat-hub webhook配置完成!"