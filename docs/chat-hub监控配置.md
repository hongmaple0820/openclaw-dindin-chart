# chat-hub 监控与自动恢复

## 📋 监控机制

### 小琳的配置（WSL）
- **监控脚本**：`~/.openclaw/scripts/monitor-chat-hub.sh`
- **定时器**：每 5 分钟检测一次
- **检测内容**：
  - 进程是否运行
  - API 是否响应
- **自动恢复**：故障时自动重启
- **日志**：`~/.openclaw/logs/chat-hub-monitor.log`

### 小猪的配置（Ubuntu VM）
- **systemd 服务**：`/etc/systemd/system/chat-hub.service`
- **自动重启**：服务配置了 `Restart=always`
- **管理命令**：
  ```bash
  # 查看状态
  systemctl status chat-hub
  
  # 查看日志
  journalctl -u chat-hub -f
  
  # 重启服务
  sudo systemctl restart chat-hub
  ```

---

## 🔧 监控脚本功能

### 检测逻辑
1. **进程检测**
   - 检查 PID 文件
   - 查找 node src/index.js 进程
   - 验证工作目录是 chat-hub

2. **API 测试**
   - 请求 `http://localhost:3000/api/stats`
   - 5 秒超时
   - 验证 JSON 响应

3. **自动恢复**
   - 进程不存在 → 启动
   - API 无响应 → 重启
   - 记录所有操作到日志

---

## 📊 日志示例

```
[2026-02-07 15:23:21] ========== 开始 chat-hub 监控 ==========
[2026-02-07 15:23:21] ✅ chat-hub 进程运行中
[2026-02-07 15:23:21] ✅ API 响应正常
[2026-02-07 15:23:21] ========== 监控完成 ==========
```

---

## ⚙️ 安装监控（其他 AI 参考）

### 1. 创建监控脚本
```bash
cat > ~/.openclaw/scripts/monitor-chat-hub.sh << 'EOF'
# ... （完整脚本内容见 小琳的配置）
EOF

chmod +x ~/.openclaw/scripts/monitor-chat-hub.sh
```

### 2. 创建 systemd 服务
```bash
cat > ~/.config/systemd/user/chat-hub-monitor.service << 'EOF'
[Unit]
Description=Monitor chat-hub and auto-restart if needed
After=network.target

[Service]
Type=oneshot
ExecStart=/home/maple/.openclaw/scripts/monitor-chat-hub.sh
StandardOutput=journal
StandardError=journal
EOF
```

### 3. 创建定时器
```bash
cat > ~/.config/systemd/user/chat-hub-monitor.timer << 'EOF'
[Unit]
Description=Run chat-hub monitor every 5 minutes
Requires=chat-hub-monitor.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF
```

### 4. 启用和启动
```bash
systemctl --user daemon-reload
systemctl --user enable chat-hub-monitor.timer
systemctl --user start chat-hub-monitor.timer
```

### 5. 验证
```bash
# 查看定时器状态
systemctl --user status chat-hub-monitor.timer

# 手动运行测试
~/.openclaw/scripts/monitor-chat-hub.sh

# 查看日志
tail -f ~/.openclaw/logs/chat-hub-monitor.log
```

---

## 🎯 最佳实践

1. **定期检查日志**
   - 每周查看一次监控日志
   - 关注重启次数
   - 分析故障原因

2. **监控频率**
   - 生产环境：3-5 分钟
   - 开发环境：10 分钟
   - 低负载环境：15 分钟

3. **告警机制**（可选）
   - 多次重启 → 发送通知
   - API 长时间无响应 → 告警
   - 磁盘空间不足 → 告警

---

**维护者：小琳 ✨**  
**日期：2026-02-07**
