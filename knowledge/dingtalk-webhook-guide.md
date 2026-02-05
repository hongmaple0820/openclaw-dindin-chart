# 📮 钉钉 Webhook 完全指南

> 整理者：✨ 小琳 | 更新于 2026-02-05

## 一、基础知识

### Webhook vs 插件

| 方式 | 优点 | 缺点 |
|------|------|------|
| **OpenClaw 插件** | 集成简单，双向通信 | 只能回复，不能主动发 |
| **Webhook 机器人** | 支持主动推送，格式丰富 | 单向，需要自己处理签名 |

**结论**：需要主动推送消息时，用 Webhook。

### 消息格式支持

| 格式 | 插件 | Webhook |
|------|------|---------|
| 纯文本 | ✅ | ✅ |
| Markdown | ✅ | ✅ |
| 链接卡片 | ❌ | ✅ |
| 按钮卡片 | ❌ | ✅ |
| @ 用户 | ❌ | ✅ |

---

## 二、@ 用户功能

### 核心原理

**两个地方必须同时设置：**

1. 消息内容中包含 `@手机号` 或 `@所有人`
2. JSON 的 `at` 字段中指定 `atMobiles` 或 `isAtAll`

缺一不可！

### JSON 示例

**@ 所有人：**
```json
{
  "msgtype": "text",
  "text": {
    "content": "【紧急通知】@所有人 请立即查看"
  },
  "at": {
    "isAtAll": true
  }
}
```

**@ 指定用户：**
```json
{
  "msgtype": "text",
  "text": {
    "content": "【任务分配】@13800138000 请跟进项目进度"
  },
  "at": {
    "atMobiles": ["13800138000"],
    "isAtAll": false
  }
}
```

**@ 多个用户：**
```json
{
  "msgtype": "text",
  "text": {
    "content": "@13800138000 @13900139000 请查看"
  },
  "at": {
    "atMobiles": ["13800138000", "13900139000"],
    "isAtAll": false
  }
}
```

---

## 三、完整 Shell 脚本

支持 @ 用户的钉钉推送脚本：

```bash
#!/bin/bash
# dingtalk-notify.sh - 支持 @ 用户的钉钉推送
# 
# 用法:
#   ./dingtalk-notify.sh "消息内容"              # 普通发送
#   ./dingtalk-notify.sh "消息内容" all          # @所有人
#   ./dingtalk-notify.sh "消息内容" lin          # @指定用户
#   ./dingtalk-notify.sh "消息内容" lin maple    # @多人

MESSAGE="$1"
shift

if [ -z "$MESSAGE" ]; then
  echo "用法: $0 \"消息内容\" [all|用户名...]"
  exit 1
fi

# ===== 配置区域 =====
WEBHOOK_BASE="你的Webhook地址"
SECRET="你的加签密钥"

# 用户手机号映射
declare -A USERS
USERS["lin"]="16670151072"
USERS["琳琳"]="16670151072"
USERS["maple"]="19976618156"
USERS["鸿枫"]="19976618156"
# ===== 配置结束 =====

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
curl -s "${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY"
```

---

## 四、Node.js 实现

```javascript
const crypto = require('crypto');
const axios = require('axios');

// 配置
const WEBHOOK_BASE = '你的Webhook地址';
const SECRET = '你的加签密钥';

// 用户手机号映射
const USER_PHONES = {
  'lin': '16670151072',
  '琳琳': '16670151072',
  'maple': '19976618156',
  '鸿枫': '19976618156'
};

/**
 * 生成钉钉签名
 */
function generateSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}

/**
 * 解析 @ 目标
 * @param {string|string[]} targets - 'all' | 'lin' | ['lin', 'maple']
 */
function parseAtTargets(targets) {
  const result = { atMobiles: [], isAtAll: false, atText: '' };
  if (!targets) return result;

  const list = Array.isArray(targets) ? targets : [targets];
  for (const t of list) {
    if (t === 'all') {
      result.isAtAll = true;
      result.atText = '@所有人 ';
    } else if (USER_PHONES[t]) {
      result.atMobiles.push(USER_PHONES[t]);
      result.atText += `@${USER_PHONES[t]} `;
    }
  }
  return result;
}

/**
 * 发送消息
 * @param {string} content - 消息内容
 * @param {string|string[]} atTargets - @ 目标
 */
async function sendText(content, atTargets = null) {
  const timestamp = Date.now();
  const sign = generateSign(SECRET, timestamp);
  const url = `${WEBHOOK_BASE}&timestamp=${timestamp}&sign=${sign}`;

  const { atMobiles, isAtAll, atText } = parseAtTargets(atTargets);

  const body = {
    msgtype: 'text',
    text: { content: `${atText}${content}` },
    at: { atMobiles, isAtAll }
  };

  const res = await axios.post(url, body);
  return res.data;
}

// 使用示例
sendText('测试消息');                    // 普通发送
sendText('紧急通知', 'all');             // @所有人
sendText('请查看', 'maple');             // @指定用户
sendText('请查看', ['lin', 'maple']);    // @多人
```

---

## 五、Python 实现

```python
import requests
import json
import time
import hmac
import hashlib
import base64
import urllib.parse

# 配置
WEBHOOK_BASE = "你的Webhook地址"
SECRET = "你的加签密钥"

# 用户手机号映射
USER_PHONES = {
    "lin": "16670151072",
    "琳琳": "16670151072",
    "maple": "19976618156",
    "鸿枫": "19976618156"
}

def generate_sign(secret, timestamp):
    """生成钉钉签名"""
    string_to_sign = f"{timestamp}\n{secret}"
    hmac_code = hmac.new(
        secret.encode('utf-8'),
        string_to_sign.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
    return sign

def send_text(content, at_targets=None):
    """
    发送消息
    at_targets: 'all' | 'lin' | ['lin', 'maple']
    """
    timestamp = str(int(time.time() * 1000))
    sign = generate_sign(SECRET, timestamp)
    url = f"{WEBHOOK_BASE}&timestamp={timestamp}&sign={sign}"

    # 解析 @ 目标
    at_mobiles = []
    is_at_all = False
    at_text = ""

    if at_targets:
        targets = at_targets if isinstance(at_targets, list) else [at_targets]
        for t in targets:
            if t == "all":
                is_at_all = True
                at_text = "@所有人 "
            elif t in USER_PHONES:
                at_mobiles.append(USER_PHONES[t])
                at_text += f"@{USER_PHONES[t]} "

    data = {
        "msgtype": "text",
        "text": {"content": f"{at_text}{content}"},
        "at": {"atMobiles": at_mobiles, "isAtAll": is_at_all}
    }

    response = requests.post(url, json=data)
    return response.json()

# 使用示例
send_text("测试消息")                     # 普通发送
send_text("紧急通知", "all")              # @所有人
send_text("请查看", "maple")              # @指定用户
send_text("请查看", ["lin", "maple"])     # @多人
```

---

## 六、避坑指南

### 1. 自定义关键词

钉钉要求 Webhook 机器人必须设置「自定义关键词」或「加签」。

- 如果用关键词：确保消息内容包含设定的关键词
- 推荐用加签：更灵活，不限制消息内容

### 2. 手机号必须准确

- `atMobiles` 里的手机号必须是用户在钉钉绑定的手机号
- 用户必须在群内，否则 @ 不生效

### 3. @ 的两个条件缺一不可

```
❌ 只在 content 里写 @手机号 → 不生效
❌ 只在 at.atMobiles 里填手机号 → 不生效
✅ 两个地方都写 → 生效
```

### 4. 避免滥用 @所有人

`isAtAll` 会打扰所有群成员，仅在紧急情况使用。

### 5. 发送频率限制

钉钉限制：每分钟最多 20 条消息。建议加发送间隔（1秒）。

---

## 七、Markdown 格式 @ 用户

```json
{
  "msgtype": "markdown",
  "markdown": {
    "title": "任务提醒",
    "text": "### 任务提醒\n\n@13800138000 请在下班前完成以下任务：\n\n- [ ] 代码审查\n- [ ] 更新文档"
  },
  "at": {
    "atMobiles": ["13800138000"]
  }
}
```

---

*掌握这些，钉钉机器人就能玩出花了！* 🚀
