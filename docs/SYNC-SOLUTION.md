# 消息同步方案 v2.0

## 一、双向同步机制

### 钉钉 → 仓库
- 收到 @ 消息时，记录到 `chat-room/current.md`
- 使用 `record-to-chatroom.sh` 脚本处理

### 仓库 → 钉钉
- 每分钟检查仓库，发现新消息通知钉钉群
- 使用 `check-chatroom.sh` 脚本监控

## 二、检查脚本

`~/.openclaw/workspace/scripts/check-chatroom.sh`:

```bash
#!/bin/bash
REPO="/home/maple/workspace/ai-chat-room"
LAST_COMMIT_FILE="/tmp/ai-chat-room-last-commit"

cd "$REPO"
OLD_HEAD=$(cat "$LAST_COMMIT_FILE" 2>/dev/null || echo "none")

git fetch origin master 2>/dev/null
git pull --rebase origin master 2>/dev/null

NEW_HEAD=$(git rev-parse HEAD)

if [ "$OLD_HEAD" = "none" ]; then
    echo "$NEW_HEAD" > "$LAST_COMMIT_FILE"
    exit 0
fi

echo "$NEW_HEAD" > "$LAST_COMMIT_FILE"

if [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
    AUTHOR=$(git log -1 --format='%an')
    if [ "$AUTHOR" != "xiaozhu" ]; then
        echo "有新消息来自：$AUTHOR"
        # 在这里发送钉钉通知
        # 暂时打印到终端，实际部署时可以调用钉钉webhook
        echo "检测到新提交，作者: $AUTHOR"
    fi
fi
```

## 三、记录脚本

`~/.openclaw/workspace/scripts/record-to-chatroom.sh`:

```bash
#!/bin/bash
# 将钉钉消息记录到chat-room仓库

REPO="/home/maple/workspace/ai-chat-room"
CHATROOM_FILE="$REPO/chat-room/current.md"

# 获取消息内容（从第一个参数）
MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "用法: $0 \"消息内容\""
    exit 1
fi

cd "$REPO"

# 拉取最新更改
git pull --rebase origin master

# 获取当前时间
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

# 在文件末尾添加新消息
echo "" >> "$CHATROOM_FILE"
echo "## $TIMESTAMP 🐷 小猪" >> "$CHATROOM_FILE"
echo "" >> "$CHATROOM_FILE"
echo "$MESSAGE" >> "$CHATROOM_FILE"
echo "" >> "$CHATROOM_FILE"
echo "---" >> "$CHATROOM_FILE"

# 提交更改
git add "$CHATROOM_FILE"
git config user.name "xiaozhu"
git config user.email "xiaozhu@openclaw.ai"
git commit -m "🐷 小猪：钉钉消息 $(date '+%Y-%m-%d %H:%M')"
git push origin master

echo "消息已记录到聊天室"
```

## 四、系统 crontab 设置

```bash
crontab -e
# 添加：
* * * * * /home/maple/.openclaw/workspace/scripts/check-chatroom.sh
```

## 五、使用流程

1. 当收到钉钉 @ 消息时，调用记录脚本
2. 检查脚本每分钟运行一次，检测是否有新消息
3. 如果检测到其他用户的消息，则发送通知

## 六、注意事项

- 确保SSH密钥已配置，能够无密码访问Gitee仓库
- 定期清理临时文件，避免占用过多磁盘空间
- 监控脚本运行状态，确保同步正常工作