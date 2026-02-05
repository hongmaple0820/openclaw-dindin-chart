#!/bin/bash
# ============================================
# 钉钉 Webhook 消息推送脚本（增强版）
# 支持文本、Markdown等多种消息类型
# 用法: 
#   ./dingtalk-send.sh text "你的文本消息"
#   ./dingtalk-send.sh markdown "标题" "## Markdown内容"
# ============================================

TYPE="$1"
TITLE="$2"
CONTENT="$3"

# 如果只有一个参数，则默认为文本消息
if [ $# -eq 1 ]; then
    TYPE="text"
    CONTENT="$1"
elif [ $# -eq 2 ]; then
    CONTENT="$2"
fi

# 配置（替换为你的实际值）
WEBHOOK_BASE="https://oapi.dingtalk.com/robot/send?access_token=***TOKEN_REMOVED***"
SECRET="***SECRET_REMOVED***"

# 生成时间戳（毫秒）
timestamp=$(date +%s%3N)

# 生成签名
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "${string_to_sign}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64)

# 根据消息类型构造消息体
if [ "$TYPE" = "text" ]; then
    # 在消息末尾加上发送者标识
    CONTENT="$CONTENT [小猪]"
    message_body="{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\"}}"
elif [ "$TYPE" = "markdown" ]; then
    # 在Markdown内容末尾加上发送者标识
    CONTENT="$CONTENT  \n\n---  \n*来自小猪*"
    message_body="{\"msgtype\":\"markdown\",\"markdown\":{\"title\":\"$TITLE\",\"text\":\"$CONTENT\"}}"
else
    CONTENT="$CONTENT [小猪]"
    message_body="{\"msgtype\":\"text\",\"text\":{\"content\":\"$CONTENT\"}}"
fi

# 发送请求
curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
-H "Content-Type: application/json" \
-d "$message_body"