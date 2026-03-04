#!/bin/bash
# ============================================
# 钉钉定时提醒脚本
# 用法: ./dingtalk-reminder.sh "提醒内容"
# ============================================

REMINDER_TEXT="$1"

if [ -z "$REMINDER_TEXT" ]; then
  echo "用法: $0 \"提醒内容\""
  exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 钉钉 Webhook 配置
WEBHOOK_BASE="https://oapi.dingtalk.com/robot/send?access_token=***TOKEN_REMOVED***"
SECRET="***SECRET_REMOVED***"

# 生成时间戳（毫秒）
timestamp=$(date +%s%3N)

# 生成签名
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "${string_to_sign}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64 | sed 's/+/%2B/g; s/\//%2F/g; s/=/%3D/g')

# 构造消息
MESSAGE="⏰ [定时提醒] $REMINDER_TEXT ($TIMESTAMP)"

# 发送请求
response=$(curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
  -H "Content-Type: application/json" \
  -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$MESSAGE\"}}")

echo "$response"
