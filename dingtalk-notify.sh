#!/bin/bash
# ============================================
# 钉钉 Webhook 消息推送脚本
# 用法: ./dingtalk-notify.sh "你的消息内容"
# ============================================
MESSAGE="$1"
# 配置（替换为你的实际值）
WEBHOOK_BASE="https://oapi.dingtalk.com/robot/send?access_token=***TOKEN_REMOVED***"
SECRET="***SECRET_REMOVED***"

# 生成时间戳（毫秒）
timestamp=$(date +%s%3N)

# 生成签名
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "${string_to_sign}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64)

# 发送请求
curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
-H "Content-Type: application/json" \
-d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$MESSAGE\"}}"