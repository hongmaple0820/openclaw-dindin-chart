#!/bin/bash
# ============================================
# 钉钉定时提醒脚本
# 用于设置一次性或周期性提醒
# ============================================

# 参数：提醒内容
REMINDER_TEXT="$1"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 钉钉 Webhook 配置
WEBHOOK_BASE="https://oapi.dingtalk.com/robot/send?access_token=***TOKEN_REMOVED***"
SECRET="***SECRET_REMOVED***"

# 生成时间戳（毫秒）
timestamp=$(date +%s%3N)

# 生成签名
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "${string_to_sign}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64)

# 构造消息体
MESSAGE="[定时提醒] $REMINDER_TEXT [小猪] ($TIMESTAMP)"
message_body="{\"msgtype\":\"text\",\"text\":{\"content\":\"$MESSAGE\"}}"

# 发送请求
curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
-H "Content-Type: application/json" \
-d "$message_body"