# 📮 钉钉使用技巧

## 消息格式支持

### OpenClaw 插件发送

| 格式 | 支持 |
|-----|------|
| 纯文本 | ✅ |
| Markdown | ✅（需配置 replyMode: markdown） |
| HTML（部分） | ✅ |
| 链接卡片 | ❌ |
| 按钮卡片 | ❌ |

### Webhook 发送

| 格式 | 支持 |
|-----|------|
| 纯文本 | ✅ |
| Markdown | ✅ |
| 链接卡片 | ✅ |
| 单按钮卡片 | ✅ |
| 多按钮卡片 | ✅ |

## 插件配置

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "你的clientId",
      "clientSecret": "你的secret",
      "replyMode": "markdown"  // 启用 Markdown 渲染
    }
  }
}
```

## Webhook 脚本

```bash
#!/bin/bash
WEBHOOK="你的webhook地址"
SECRET="你的加签密钥"

timestamp=$(date +%s%3N)
string_to_sign="${timestamp}\n${SECRET}"
sign=$(echo -ne "$string_to_sign" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | sed 's/+/%2B/g; s/\//%2F/g; s/=/%3D/g')
URL="${WEBHOOK}&timestamp=${timestamp}&sign=${sign}"

# 发送 Markdown 消息
curl -s "$URL" -H "Content-Type: application/json" \
  -d '{"msgtype":"markdown","markdown":{"title":"标题","text":"## 内容"}}'
```

---

*整理于 2024-02-04 by ✨ 小琳*
