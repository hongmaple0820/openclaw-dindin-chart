# MapleClaw 部署指南

**版本号**: v1.0.0
**部署日期**: 2026-03-12
**部署负责人**: 小猪
**状态**: 准备就绪

---

## 1. 部署环境

### 1.1 服务器信息

| 项目 | 信息 |
|------|------|
| 操作系统 | WSL2 Ubuntu |
| Node.js | v22.22.0 |
| 端口 | 8273 (API), 8274 (SSE) |

### 1.2 依赖服务

| 服务 | 版本 | 状态 |
|------|------|------|
| Redis | 6.x | ✅ 已连接 |
| SQLite | 3.x | ✅ 已配置 |

---

## 2. 部署检查清单

### 2.1 环境检查

- [x] Node.js 版本正确
- [x] npm 依赖安装完成
- [x] Redis 连接正常
- [x] 数据库目录存在
- [x] 环境变量配置完成

### 2.2 服务检查

- [x] chat-hub 服务运行中
- [x] API 端点响应正常
- [x] 健康检查通过
- [x] WebSocket 连接正常

### 2.3 安全检查

- [x] 无已知安全漏洞
- [x] 敏感信息已保护
- [x] 认证机制正常

---

## 3. 服务管理

### 3.1 启动服务

```bash
# chat-hub
cd ~/.openclaw/projects/mapleclaw/chat-hub
npm start

# 或使用 systemd (如果已配置)
systemctl --user start chat-hub
```

### 3.2 停止服务

```bash
# 查找进程
ps aux | grep "node.*chat-hub"

# 停止服务
pkill -f "node.*chat-hub"

# 或使用 systemd
systemctl --user stop chat-hub
```

### 3.3 重启服务

```bash
systemctl --user restart chat-hub
```

### 3.4 查看日志

```bash
# systemd 日志
journalctl --user -u chat-hub -f

# 或直接查看
tail -f ~/.openclaw/logs/chat-hub.log
```

---

## 4. 配置说明

### 4.1 chat-hub 配置

**位置**: `~/.openclaw/projects/mapleclaw/chat-hub/config/local.json`

**主要配置项**:
```json
{
  "port": 8273,
  "botName": "小熊",
  "redis": {
    "host": "47.96.248.176",
    "port": 6379
  },
  "dingtalk": {
    "webhook": { ... }
  }
}
```

### 4.2 chat-web 配置

**位置**: `~/.openclaw/projects/mapleclaw/chat-web/.env`

```
VITE_API_BASE_URL=http://localhost:8273
```

---

## 5. 监控与告警

### 5.1 健康检查

```bash
# API 健康检查
curl http://localhost:8273/api/observability/health

# 预期响应
{"success":true,"status":"healthy",...}
```

### 5.2 监控脚本

**位置**: `~/.openclaw/scripts/monitor-chat-hub.sh`

**定时任务**: 每 5 分钟检查一次

---

## 6. 回滚方案

### 6.1 回滚触发条件

- 服务启动失败
- 核心功能不可用
- 严重安全漏洞

### 6.2 回滚步骤

```bash
# 1. 停止服务
systemctl --user stop chat-hub

# 2. 切换到上一个稳定版本
cd ~/.openclaw/projects/mapleclaw
git checkout <上一个稳定版本的tag>

# 3. 重新安装依赖
cd chat-hub && npm install

# 4. 重启服务
systemctl --user start chat-hub

# 5. 验证服务
curl http://localhost:8273/api/observability/health
```

---

## 7. 备份策略

### 7.1 数据备份

```bash
# 备份 SQLite 数据库
cp ~/.openclaw/chat-data/messages.db ~/.openclaw/chat-data/messages.db.backup

# 备份用户数据库
cp ~/.openclaw/chat-data/admin.db ~/.openclaw/chat-data/admin.db.backup
```

### 7.2 定时备份

**建议**: 每日自动备份

```bash
# 添加到 crontab
0 2 * * * cp ~/.openclaw/chat-data/*.db ~/.openclaw/backups/
```

---

## 8. 常见问题

### 8.1 服务无法启动

**检查**:
1. 端口是否被占用: `lsof -i :8273`
2. Node.js 版本: `node -v`
3. 依赖是否安装: `npm install`

### 8.2 Redis 连接失败

**检查**:
1. Redis 服务: `redis-cli ping`
2. 网络连接: `telnet 47.96.248.176 6379`
3. 配置正确性: `config/local.json`

### 8.3 WebSocket 断开

**检查**:
1. 心跳机制是否启用
2. 网络稳定性
3. 服务器负载

---

## 9. 联系方式

**技术支持**: 小猪、小琳
**紧急联系**: maple

---

*部署指南创建时间: 2026-03-12*