# OpenClaw 心跳监控机制

> 解决 AI 卡死无响应的问题，自动检测并重启网关

## 问题背景

OpenClaw AI 有时会卡死无响应，需要手动重启网关才能恢复。这个心跳机制可以自动检测并处理这种情况。

## 检测流程

```
每 5 分钟触发检测
         ↓
发送 ping，等待 30s
         ↓ 无响应
重试，等待 40s（递增避免误报）
         ↓ 无响应  
最后一次，等待 50s
         ↓ 无响应
重启网关 + 发送钉钉通知
```

**为什么等待时间递增？** 避免因网络延迟或临时负载导致的误报。

## 安装步骤

### 1. 创建监控脚本

```bash
mkdir -p ~/.openclaw/workspace/scripts
cat > ~/.openclaw/workspace/scripts/heartbeat-monitor.sh << 'SCRIPT'
#!/bin/bash
#
# OpenClaw 心跳监控脚本
# 每 5 分钟检测 AI 是否响应，无响应则重启网关
#

LOG_FILE="$HOME/.openclaw/logs/heartbeat-monitor.log"
OPENCLAW_BIN="$HOME/.npm-global/bin/openclaw"
PING_MESSAGE="[HEARTBEAT_PING] 请回复 PONG"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_ping() {
    local wait_time=$1
    log "发送心跳 ping，等待 ${wait_time}s..."
    
    "$OPENCLAW_BIN" system event --text "$PING_MESSAGE" --mode now 2>/dev/null
    sleep "$wait_time"
    
    if "$OPENCLAW_BIN" gateway status 2>/dev/null | grep -q "running"; then
        local status_check=$("$OPENCLAW_BIN" status 2>&1)
        if echo "$status_check" | grep -qE "(Session|session|Model|model)"; then
            log "✅ 收到响应，AI 正常"
            return 0
        fi
    fi
    
    log "⚠️ 未收到响应"
    return 1
}

main() {
    log "========== 开始心跳检测 =========="
    
    # 第一次：等待 30 秒
    if send_ping 30; then exit 0; fi
    
    # 第二次：等待 40 秒
    log "第一次无响应，重试..."
    if send_ping 40; then exit 0; fi
    
    # 第三次：等待 50 秒
    log "第二次无响应，最后一次重试..."
    if send_ping 50; then exit 0; fi
    
    # 三次都失败，重启网关
    log "❌ 三次心跳均无响应，重启网关..."
    
    # 发送钉钉通知（可选）
    if [ -f "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" ]; then
        "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" "⚠️ OpenClaw AI 无响应，正在自动重启网关..."
    fi
    
    "$OPENCLAW_BIN" gateway restart
    log "✅ 网关已重启"
    
    sleep 10
    
    if "$OPENCLAW_BIN" gateway status 2>/dev/null | grep -q "running"; then
        log "✅ 网关重启成功"
        if [ -f "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" ]; then
            "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" "✅ OpenClaw 网关已自动重启恢复"
        fi
    else
        log "❌ 网关重启失败，需要人工干预"
        if [ -f "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" ]; then
            "$HOME/.openclaw/workspace/scripts/dingtalk-notify.sh" "❌ OpenClaw 网关重启失败，请人工检查！"
        fi
    fi
}

main "$@"
SCRIPT

chmod +x ~/.openclaw/workspace/scripts/heartbeat-monitor.sh
```

### 2. 配置 systemd 定时器（用户级，无需 sudo）

```bash
mkdir -p ~/.config/systemd/user

# 创建服务文件
cat > ~/.config/systemd/user/openclaw-heartbeat.service << 'EOF'
[Unit]
Description=OpenClaw Heartbeat Monitor

[Service]
Type=oneshot
ExecStart=/home/maple/.openclaw/workspace/scripts/heartbeat-monitor.sh
Environment=PATH=/home/maple/.npm-global/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
EOF

# 创建定时器
cat > ~/.config/systemd/user/openclaw-heartbeat.timer << 'EOF'
[Unit]
Description=Run OpenClaw Heartbeat Monitor every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 启用并启动
systemctl --user daemon-reload
systemctl --user enable openclaw-heartbeat.timer
systemctl --user start openclaw-heartbeat.timer
```

**注意**：将脚本中的 `/home/maple` 替换为你的实际用户目录。

## 管理命令

```bash
# 查看状态
systemctl --user status openclaw-heartbeat.timer

# 手动触发一次检测
systemctl --user start openclaw-heartbeat.service

# 查看日志
cat ~/.openclaw/logs/heartbeat-monitor.log

# 停止定时器
systemctl --user stop openclaw-heartbeat.timer

# 禁用定时器
systemctl --user disable openclaw-heartbeat.timer
```

## AI 响应配置

在 `HEARTBEAT.md` 或系统提示中添加：

```markdown
当收到 `[HEARTBEAT_PING] 请回复 PONG` 消息时，直接回复 `PONG`
```

## 可选：钉钉通知

如果需要在重启时收到钉钉通知，创建通知脚本：

```bash
cat > ~/.openclaw/workspace/scripts/dingtalk-notify.sh << 'EOF'
#!/bin/bash
# 钉钉通知脚本
WEBHOOK_URL="你的钉钉机器人 Webhook URL"
MESSAGE="$1"

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$MESSAGE\"}}"
EOF

chmod +x ~/.openclaw/workspace/scripts/dingtalk-notify.sh
```

## 文件位置

| 文件 | 路径 |
|------|------|
| 监控脚本 | `~/.openclaw/workspace/scripts/heartbeat-monitor.sh` |
| 服务文件 | `~/.config/systemd/user/openclaw-heartbeat.service` |
| 定时器 | `~/.config/systemd/user/openclaw-heartbeat.timer` |
| 日志 | `~/.openclaw/logs/heartbeat-monitor.log` |

---

*作者：小琳 | 日期：2026-02-06*
