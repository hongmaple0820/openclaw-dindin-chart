#!/bin/bash
# ============================================
# 钉钉 Webhook 消息推送脚本（支持 @ 用户）
# 
# 用法:
#   ./dingtalk-notify.sh "消息内容"              # 普通发送
#   ./dingtalk-notify.sh "消息内容" all          # @所有人
#   ./dingtalk-notify.sh "消息内容" user1        # @user1
#   ./dingtalk-notify.sh "消息内容" user1 user2  # @多人
#
# 配置:
#   1. 复制此脚本为 dingtalk-notify-local.sh
#   2. 填写下方的 WEBHOOK_BASE、SECRET 和 USERS
#   3. 将 dingtalk-notify-local.sh 加入 .gitignore
# ============================================

MESSAGE="$1"
shift  # 移除第一个参数，剩下的是 @ 目标

if [ -z "$MESSAGE" ]; then
  echo "用法: $0 \"消息内容\" [all|user1|user2|...]"
  exit 1
fi

# ========== 配置（请修改为你的配置）==========
WEBHOOK_BASE="https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN"
SECRET="YOUR_SECRET"

# 用户手机号映射（请修改为你的用户）
declare -A USERS
USERS["user1"]="13800000001"
USERS["user2"]="13800000002"
# ============================================

# 生成时间戳和签名
timestamp=$(date +%s%3N)
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "${string_to_sign}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64 | sed 's/+/%2B/g; s/\//%2F/g; s/=/%3D/g')

# 构造 @ 参数
IS_AT_ALL="false"
AT_MOBILES=""
AT_TEXT=""

for target in "$@"; do
  if [ "$target" = "all" ] || [ "$target" = "所有人" ]; then
    IS_AT_ALL="true"
    AT_TEXT="@所有人 "
  elif [ -n "${USERS[$target]}" ]; then
    phone="${USERS[$target]}"
    if [ -z "$AT_MOBILES" ]; then
      AT_MOBILES="\"$phone\""
    else
      AT_MOBILES="$AT_MOBILES, \"$phone\""
    fi
    AT_TEXT="${AT_TEXT}@${phone} "
  fi
done

# 构造完整消息
FULL_MESSAGE="${AT_TEXT}${MESSAGE}"

# 构造 JSON
if [ -n "$AT_MOBILES" ]; then
  JSON_BODY="{\"msgtype\":\"text\",\"text\":{\"content\":\"$FULL_MESSAGE\"},\"at\":{\"atMobiles\":[$AT_MOBILES],\"isAtAll\":$IS_AT_ALL}}"
else
  JSON_BODY="{\"msgtype\":\"text\",\"text\":{\"content\":\"$FULL_MESSAGE\"},\"at\":{\"isAtAll\":$IS_AT_ALL}}"
fi

# 发送请求
response=$(curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY")

echo "$response"
