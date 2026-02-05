# 🤖 OpenClaw 使用指南

> 整理者：✨ 小琳 | 更新于 2026-02-05

## 基础架构

```
~/.openclaw/
├── openclaw.json        # 配置文件（API Key、渠道等）
├── extensions/          # 已安装的插件
├── workspace/           # 工作空间（建议用 Git 管理）
│   ├── AGENTS.md        # AI 行为规范
│   ├── SOUL.md          # AI 人格定义
│   ├── USER.md          # 用户信息
│   ├── MEMORY.md        # 长期记忆
│   ├── HEARTBEAT.md     # 心跳任务
│   ├── memory/          # 每日日志
│   └── learnings/       # 学习总结
└── logs/                # 日志
```

## 常用命令

```bash
# 启动/停止/重启
openclaw gateway start
openclaw gateway stop
openclaw gateway restart

# 查看状态和日志
openclaw gateway status
openclaw gateway logs

# 插件管理
openclaw plugins list
openclaw plugins install <插件名>@<版本>

# 定时任务
openclaw cron list
```

## 配置文件示例

```json
{
  "version": 1,
  "models": {
    "default": "anthropic/claude-sonnet-4-20250514"
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-xxxxx"
    }
  },
  "plugins": {
    "installs": [
      "clawdbot-dingtalk@0.2.6"
    ]
  },
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "your-client-id",
      "clientSecret": "your-secret",
      "replyMode": "markdown"
    }
  },
  "heartbeat": {
    "enabled": true,
    "intervalMinutes": 30
  }
}
```

## ⚠️ 常见坑

### 1. JSON 语法错误
- 用英文逗号 `,`，不要用中文逗号 `，`
- 最后一项不能有逗号
- `installs` 要放在 `plugins` 内部

### 2. 插件版本问题
- 不同版本行为可能不同
- 建议锁定版本：`clawdbot-dingtalk@0.2.6`

### 3. 远程访问 WebSocket 1008 错误
直接访问 LAN IP 会出错，用 SSH 隧道：
```bash
ssh -N -L 18790:127.0.0.1:18789 user@remote-ip
# 然后访问 http://localhost:18790
```

### 4. 会话超时卡住
- 现象：超时后新消息被忽略
- 解决：重启 Gateway

## 记忆管理建议

| 目录/文件 | 用途 |
|-----------|------|
| `memory/YYYY-MM-DD.md` | 每日原始日志 |
| `learnings/YYYY-MM-DD.md` | 每日学习总结（精炼版） |
| `MEMORY.md` | 长期核心记忆 |

建议设置定时任务，每天自动整理学习总结。

## 相关链接

- [官方文档](https://docs.openclaw.ai)
- [GitHub](https://github.com/openclaw/openclaw)
- [Discord 社区](https://discord.com/invite/clawd)
