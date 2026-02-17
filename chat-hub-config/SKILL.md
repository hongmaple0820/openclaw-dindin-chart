---
name: "chat-hub-config"
description: "chat-hub 机器人配置管理 Skill，提供配置检查、备份恢复、交互式向导、健康诊断和自动修复等功能。用于机器人项目接入配置和运行维护场景。"
---

# Chat-Hub Config Skill

chat-hub-config 是一个全面的机器人配置管理解决方案，提供从项目接入、配置、运行、使用、停止、重启到版本更新的全流程管理能力。

## 功能概述

| 模块 | 功能 | 命令 |
|------|------|------|
| 配置检查 | 验证配置完整性和有效性 | `check` |
| 配置向导 | 交互式引导完成配置 | `setup` |
| 健康诊断 | 系统诊断并生成报告 | `diagnose` |
| 备份恢复 | 配置备份和恢复 | `backup` / `restore` |
| 自动修复 | 一键修复常见问题 | `repair` |
| 运行管理 | 启动/停止/重启服务 | `start` / `stop` / `restart` |
| 版本更新 | 检查和更新版本 | `update` |

## 快速开始

### 1. 配置检查

首次使用或遇到问题时，先运行配置检查：

```bash
openclaw skill chat-hub-config check
```

这将检查以下配置项：
- Dingtalk Webhook 配置
- Dingtalk Secret 密钥
- Redis 连接配置
- Bot 名称配置
- 端口配置

### 2. 配置向导

如果配置不完整，使用交互式配置向导：

```bash
openclaw skill chat-hub-config setup
```

向导会引导你完成：
1. 确认项目路径
2. 配置 Dingtalk Webhook
3. 配置 Dingtalk Secret
4. 配置 Redis（可选）
5. 配置 Bot 名称
6. 验证配置

### 3. 健康诊断

遇到问题时运行诊断：

```bash
openclaw skill chat-hub-config diagnose
```

诊断项目：
- 配置文件状态
- 服务运行状态
- 网络连接性
- 端口可用性
- 依赖服务状态

### 4. 配置备份

定期备份配置：

```bash
# 默认备份
openclaw skill chat-hub-config backup

# 指定备份名称
openclaw skill chat-hub-config backup --name my-backup
```

### 5. 配置恢复

从备份恢复：

```bash
openclaw skill chat-hub-config restore --name my-backup
```

### 6. 自动修复

常见问题一键修复：

```bash
openclaw skill chat-hub-config repair
```

可修复的问题：
- 缺失的配置文件
- 损坏的配置项
- 权限问题
- 环境变量缺失

### 7. 运行管理

```bash
# 启动服务
openclaw skill chat-hub-config start

# 停止服务
openclaw skill chat-hub-config stop

# 重启服务
openclaw skill chat-hub-config restart
```

### 8. 版本更新

```bash
# 检查更新
openclaw skill chat-hub-config update --check

# 执行更新
openclaw skill chat-hub-config update
```

## 命令详解

### check - 配置检查

```bash
openclaw skill chat-hub-config check [选项]
```

选项：
- `--verbose` - 显示详细检查信息
- `--fix` - 自动修复可修复的问题
- `--format json` - JSON 格式输出

示例：

```bash
# 基本检查
openclaw skill chat-hub-config check

# 详细检查
openclaw skill chat-hub-config check --verbose

# 检查并自动修复
openclaw skill chat-hub-config check --fix
```

### setup - 配置向导

```bash
openclaw skill chat-hub-config setup [选项]
```

选项：
- `--force` - 强制重新配置
- `--step <step>` - 从指定步骤开始

示例：

```bash
# 完整配置流程
openclaw skill chat-hub-config setup

# 强制重新配置
openclaw skill chat-hub-config setup --force

# 从 Redis 配置开始
openclaw skill chat-hub-config setup --step redis
```

### diagnose - 健康诊断

```bash
openclaw skill chat-hub-config diagnose [选项]
```

选项：
- `--full` - 完整诊断（包含网络测试）
- `--report <path>` - 保存诊断报告到文件

示例：

```bash
# 标准诊断
openclaw skill chat-hub-config diagnose

# 完整诊断
openclaw skill chat-hub-config diagnose --full

# 保存报告
openclaw skill chat-hub-config diagnose --report ./diagnose-report.txt
```

### backup - 配置备份

```bash
openclaw skill chat-hub-config backup [选项]
```

选项：
- `--name <name>` - 备份名称
- `--path <path>` - 自定义备份路径
- `--include-logs` - 包含日志文件

示例：

```bash
# 自动命名备份
openclaw skill chat-hub-config backup

# 指定名称
openclaw skill chat-hub-config backup --name prod-backup-20260213

# 包含日志
openclaw skill chat-hub-config backup --include-logs
```

### restore - 配置恢复

```bash
openclaw skill chat-hub-config restore [选项]
```

选项：
- `--name <name>` - 备份名称
- `--list` - 列出可用备份
- `--dry-run` - 模拟恢复

示例：

```bash
# 列出所有备份
openclaw skill chat-hub-config restore --list

# 恢复指定备份
openclaw skill chat-hub-config restore --name prod-backup-20260213

# 模拟恢复（不实际修改）
openclaw skill chat-hub-config restore --name backup --dry-run
```

### repair - 自动修复

```bash
openclaw skill chat-hub-config repair [选项]
```

选项：
- `--list` - 列出可修复的问题
- `--fix <issue>` - 修复指定问题
- `--all` - 修复所有问题

示例：

```bash
# 列出可修复问题
openclaw skill chat-hub-config repair --list

# 修复所有问题
openclaw skill chat-hub-config repair --all

# 修复指定问题
openclaw skill chat-hub-config repair --fix missing-config
```

### start/stop/restart - 运行管理

```bash
# 启动
openclaw skill chat-hub-config start

# 停止
openclaw skill chat-hub-config stop

# 重启
openclaw skill chat-hub-config restart

# 查看状态
openclaw skill chat-hub-config status
```

### update - 版本更新

```bash
# 检查更新
openclaw skill chat-hub-config update --check

# 执行更新
openclaw skill chat-hub-config update

# 指定版本
openclaw skill chat-hub-config update --version 1.2.0
```

## 配置文件说明

### 配置文件位置

- 默认配置：`chat-hub/config/default.json`
- 本地配置：`chat-hub/config/local.json`
- 环境变量：`.env`

### 配置项说明

```json
{
  "bot": {
    "name": "Bot",           // 机器人名称
    "local": true,          // 本地模式
    "prefix": ""            // 消息前缀
  },
  "dingtalk": {
    "enabled": true,        // 是否启用（可选，默认true）
    "webhookBase": "",     // Webhook URL（可选，不配置则限制部分功能）
    "secret": ""           // 加签密钥 (SEC开头，可选)
  },
  "redis": {
    "enabled": true,
    "host": "localhost",
    "port": 6379,
    "password": ""
  },
  "server": {
    "port": 3000            // 服务端口
  },
  "cors": {
    "origins": ["*"],       // 跨域来源白名单
    "credentials": true,    // 是否支持 credentials
    "maxAge": 86400         // 预检请求缓存时间（秒）
  },
  "rateLimit": {
    "enabled": true,         // 是否启用速率限制
    "windowMs": 60000,       // 时间窗口（毫秒）
    "maxRequests": 100,      // 最大请求数
    "auth": {
      "windowMs": 900000,    // 认证接口时间窗口
      "maxRequests": 10      // 认证接口最大请求数
    },
    "message": {
      "windowMs": 60000,     // 消息接口时间窗口
      "maxRequests": 30      // 消息接口最大请求数
    }
  },
  "auth": {
    "jwtSecret": "",        // JWT 密钥（可选）
    "refreshTokenExpires": 2592000000 // Refresh Token 过期时间
  }
}
```

> **注意**: `dingtalk.webhookBase` 和 `dingtalk.secret` 为可选配置。不配置时系统仍可运行，但第三方集成功能将受限。

## 多 Bot 独立配置

### 概述

系统支持多 Bot 独立 webhook 配置，每个 Bot 可以有自己独立的钉钉群和 webhook。

### Bot 管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/bots` | 获取所有 Bot |
| GET | `/api/v1/bots/:id` | 获取单个 Bot |
| POST | `/api/v1/bots` | 创建 Bot |
| PUT | `/api/v1/bots/:id` | 更新 Bot |
| DELETE | `/api/v1/bots/:id` | 删除 Bot |
| POST | `/api/v1/bots/:id/test` | 测试发送 |
| POST | `/api/v1/bots/:id/send` | 发送消息 |
| POST | `/api/v1/bots/route-test` | 测试路由 |

### 创建 Bot

```bash
# 创建 Bot
curl -X POST http://localhost:3000/api/v1/bots \
  -H "Content-Type: application/json" \
  -d '{
    "username": "小琳",
    "displayName": "小琳 AI",
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "webhookSecret": "SECxxx",
    "isDefault": true
  }'
```

### Webhook 配置模式

| 模式 | webhookSecret | webhookToken | 说明 |
|------|---------------|--------------|------|
| 加签名 | ✅ | ❌ | 使用 SEC 密钥签名 |
| 仅Token | ❌ | ✅ | 仅使用 access_token |
| URL内置 | ❌ | ❌ | Token 已在 URL 中 |

### 智能路由

系统自动根据消息内容路由到对应 Bot：

```
1. @目标匹配 → @小琳 → 小琳 Bot (conf: 1.0)
2. 名字提及 → "问小琳" → 小琳 Bot (conf: 0.8)
3. 上下文延续 → 追问 → 上一个 Bot (conf: 0.6)
4. 默认 → 无匹配 → 默认 Bot (conf: 0.5)
```

### 测试路由

```bash
# 测试消息路由
curl -X POST http://localhost:3000/api/v1/bots/route-test \
  -H "Content-Type: application/json" \
  -d '{
    "content": "问一下小琳怎么看这个问题"
  }'
```

### 配置示例

```json
{
  "bot": {
    "name": "Bot",
    "multiBot": true
  }
}
```

## 功能权限控制

### 概述

系统支持基于 webhook 配置状态的功能权限控制。当用户未配置 webhook 时，系统会自动限制部分高级功能的使用权限，但仍允许使用基础前端交互功能。

### 配置状态与功能对应关系

| 配置状态 | 可用功能 | 受限功能 |
|----------|----------|----------|
| webhook 未配置 | 基础前端交互 | 第三方集成、机器人自动回复、消息同步 |
| webhook 已配置 | 所有功能 | 无 |

### 受限功能列表

当 webhook 未配置时，以下功能将被限制：

1. **第三方软件集成** - 包括但不限于：
   - 钉钉集成
   - 企业微信群聊功能
   - 其他第三方消息平台

2. **机器人自主回复功能** - 包括：
   - 自动回复触发
   - AI 对话集成
   - 消息自动转发

3. **消息同步功能** - 包括：
   - 消息推送到第三方平台
   - 跨平台消息同步

### 检查配置状态

```bash
# 查看配置状态
openclaw skill chat-hub-config check

# 运行诊断查看功能状态
openclaw skill chat-hub-config diagnose
```

### 启用完整功能

要启用所有功能，只需配置 webhook：

```bash
# 运行配置向导
openclaw skill chat-hub-config setup

# 或手动编辑配置文件
# chat-hub/config/local.json
```

## 常见问题与解决方案

### 问题 1：钉钉消息无法收到

**症状**：机器人发送消息，钉钉无法收到

**可能原因**：
1. Webhook URL 配置错误
2. Secret 密钥配置错误或缺失
3. 签名生成失败

**解决方案**：
```bash
# 1. 检查配置
openclaw skill chat-hub-config check

# 2. 重新配置钉钉
openclaw skill chat-hub-config setup

# 3. 运行诊断
openclaw skill chat-hub-config diagnose
```

### 问题 2：服务无法启动

**症状**：运行 start 命令后服务立即退出

**可能原因**：
1. 端口被占用
2. 配置文件损坏
3. 依赖服务未启动

**解决方案**：
```bash
# 1. 检查端口占用
netstat -ano | findstr 3000

# 2. 诊断问题
openclaw skill chat-hub-config diagnose

# 3. 修复配置
openclaw skill chat-hub-config repair --all
```

### 问题 3：Redis 连接失败

**症状**：连接 Redis 超时或被拒绝

**可能原因**：
1. Redis 未启动
2. 主机/端口配置错误
3. 密码错误

**解决方案**：
```bash
# 1. 检查 Redis 状态
redis-cli ping

# 2. 重新配置 Redis
openclaw skill chat-hub-config setup --step redis
```

### 问题 4：配置文件丢失

**症状**：启动时提示配置文件不存在

**解决方案**：
```bash
# 1. 列出可用备份
openclaw skill chat-hub-config restore --list

# 2. 恢复配置
openclaw skill chat-hub-config restore --name <backup-name>
```

## 避坑指南

### 1. 配置验证

- ⚠️ **必填项**：Dingtalk Webhook 和 Secret 必须同时配置
- ⚠️ **Secret 格式**：必须是 SEC 开头的加签密钥，不是 access_token
- ⚠️ **WebHook URL**：必须是完整的 URL，包含 access_token

### 2. 备份恢复

- ✅ 建议每次重大配置变更前进行备份
- ✅ 恢复前建议先使用 `--dry-run` 预览
- ✅ 备份文件会包含时间戳，便于追溯

### 3. 运行管理

- ✅ 使用 `stop` 而非直接 kill 进程，确保优雅关闭
- ✅ 重启前会自动备份当前配置
- ✅ 查看日志排查问题时使用 `start --log`

### 4. 版本更新

- ✅ 更新前会自动创建配置备份
- ✅ 可以使用 `--check` 先查看更新内容
- ✅ 更新失败可使用 `--rollback` 回滚

### 5. 自动修复

- ⚠️ 修复前会提示需要确认的操作
- ⚠️ 某些修复可能需要重启服务
- ✅ 可使用 `--list` 先查看可修复的问题

## 最佳实践

### 1. 首次部署流程

```bash
# 1. 检查环境
openclaw skill chat-hub-config check

# 2. 配置项目
openclaw skill chat-hub-config setup

# 3. 诊断检查
openclaw skill chat-hub-config diagnose

# 4. 启动服务
openclaw skill chat-hub-config start
```

### 2. 日常维护流程

```bash
# 每周检查
openclaw skill chat-hub-config check

# 定期备份
openclaw skill chat-hub-config backup --name weekly-$(date +%Y%m%d)

# 问题诊断
openclaw skill chat-hub-config diagnose --full
```

### 3. 问题排查流程

```bash
# 1. 查看状态
openclaw skill chat-hub-config status

# 2. 运行诊断
openclaw skill chat-hub-config diagnose

# 3. 尝试自动修复
openclaw skill chat-hub-config repair --all

# 4. 如需帮助，生成诊断报告
openclaw skill chat-hub-config diagnose --report issue.txt
```

## 配置验证代码集成

在 `chat-hub/src/index.js` 中添加配置验证：

```javascript
// 配置验证
if (config.dingtalk.enabled && (!config.dingtalk.webhookBase || !config.dingtalk.secret)) {
  console.error('⚠️ 钉钉已启用但配置不完整！');
  console.log('请运行: openclaw skill chat-hub-config setup');
}
```

## 技术支持

如遇到无法解决的问题：

1. 运行完整诊断：`openclaw skill chat-hub-config diagnose --full --report report.txt`
2. 查看 chat-hub 日志
3. 检查钉钉机器人 Webhook 设置
4. 确认网络连通性

---

**版本**: 1.2.0
**最后更新**: 2026-02-17
