# Chat-Hub 部署指南

> 版本: 1.0.0
> 更新时间: 2026-03-04

## 目录

1. [系统要求](#系统要求)
2. [快速部署](#快速部署)
3. [生产部署](#生产部署)
4. [Docker 部署](#docker-部署)
5. [环境变量说明](#环境变量说明)
6. [配置文件说明](#配置文件说明)
7. [服务管理](#服务管理)
8. [常见问题](#常见问题)

---

## 系统要求

### 硬件要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|---------|---------|
| CPU | 1 核 | 2 核+ |
| 内存 | 512 MB | 1 GB+ |
| 磁盘 | 1 GB | 5 GB+ |

### 软件要求

| 软件 | 版本要求 |
|------|---------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| Redis | >= 6.0（可选，用于消息中转） |
| SQLite | >= 3.35（better-sqlite3 自动安装） |

### 操作系统支持

- Ubuntu 20.04+ / Debian 11+
- CentOS 8+ / RHEL 8+
- macOS 12+
- Windows 10+（WSL2 推荐）

---

## 快速部署

### 1. 克隆项目

```bash
cd ~/.openclaw
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart/chat-hub
```

### 2. 安装依赖

```bash
npm install
npm run build
```

### 3. 创建配置文件

```bash
cp config/local.example.json config/local.json
```

编辑 `config/local.json`：

```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": ""
  },
  "bot": {
    "name": "小琳",
    "local": true
  },
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
    "secret": "SEC_YOUR_SECRET"
  },
  "port": 8273
}
```

### 4. 启动服务

```bash
# 前台运行（调试用）
npm start

# 或使用启动脚本
./start.sh
```

### 5. 验证部署

```bash
# 健康检查
curl http://localhost:8273/health

# 预期返回
{
  "status": "ok",
  "timestamp": 1709548800000,
  "database": {
    "messages": 0,
    "today": 0
  }
}
```

---

## 生产部署

### 1. 使用 PM2 管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name chat-hub

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs chat-hub
```

### 2. 使用 systemd 服务

```bash
# 复制服务文件
sudo cp chat-hub.service /etc/systemd/system/

# 编辑服务文件，修改路径
sudo nano /etc/systemd/system/chat-hub.service

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable chat-hub
sudo systemctl start chat-hub

# 查看状态
sudo systemctl status chat-hub
```

服务文件示例 `/etc/systemd/system/chat-hub.service`：

```ini
[Unit]
Description=Chat-Hub Message Service
After=network.target

[Service]
Type=simple
User=maple
WorkingDirectory=/home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 3. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8273;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### 4. SSL 配置（推荐）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d chat.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## Docker 部署

### 1. 构建镜像

```bash
# 在项目根目录
docker build -t chat-hub:latest .
```

### 2. 运行容器

```bash
docker run -d \
  --name chat-hub \
  -p 8273:8273 \
  -v ~/.openclaw/chat-data:/root/.openclaw/chat-data \
  -v $(pwd)/config:/app/config \
  -e NODE_ENV=production \
  chat-hub:latest
```

> 多实例 Docker Compose 如果已经把宿主机 `8274` 分配给第二个 `chat-hub`，则不要再把 Relay 暴露到同一个宿主机 `8274`。需要暴露 Relay 时，请显式设置不同的 `RELAY_PORT` 和端口映射。

### 3. Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  chat-hub:
    build: .
    ports:
      - "8273:8273"
    volumes:
      - ./config:/app/config
      - chat-data:/root/.openclaw/chat-data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=INFO
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  chat-data:
  redis-data:
```

启动：

```bash
docker-compose up -d
```

---

## 环境变量说明

创建 `.env` 文件（从 `.env.example` 复制）：

```bash
cp .env.example .env
```

### 核心变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | development | 运行环境 (development/production) |
| `LOG_LEVEL` | INFO | 日志级别 (ERROR/WARN/INFO/DEBUG) |

### Redis 配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_HOST` | localhost | Redis 主机地址 |
| `REDIS_PORT` | 6379 | Redis 端口 |
| `REDIS_PASSWORD` | (空) | Redis 密码 |

### 数据库配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DB_PATH` | ~/.openclaw/chat-data/chat-hub.db | 数据库路径 |

### 机器人配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BOT_NAME` | 小琳 | 机器人名称 |

### 钉钉配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DINGTALK_WEBHOOK` | (空) | 钉钉 Webhook URL |
| `DINGTALK_SECRET` | (空) | 钉钉签名密钥 |

### OpenClaw 网关

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `OPENCLAW_GATEWAY_URL` | (空) | OpenClaw 网关地址 |
| `OPENCLAW_GATEWAY_TOKEN` | (空) | OpenClaw 网关令牌 |

---

## 配置文件说明

### config/local.json

主要配置文件，覆盖默认配置：

```json
{
  "port": 8273,
  
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": "",
    "db": 0
  },
  
  "bot": {
    "name": "小琳",
    "local": true
  },
  
  "dingtalk": {
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx"
  },
  
  "channels": {
    "messages": "chat:messages",
    "replies": "chat:replies"
  },
  
  "groups": {
    "default": {
      "webhook": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
      "secret": "SECxxx"
    }
  },
  
  "users": {
    "admin": {
      "role": "admin",
      "permissions": ["read", "write", "admin"]
    }
  },
  
  "messageSending": {
    "enabled": true,
    "maxRetries": 3,
    "retryDelay": 1000
  }
}
```

### 配置字段说明

#### redis

| 字段 | 类型 | 说明 |
|------|------|------|
| host | string | Redis 服务器地址 |
| port | number | Redis 端口 |
| password | string | 密码（无密码留空） |
| db | number | 数据库编号 |

#### bot

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 机器人显示名称 |
| local | boolean | 是否本地模式（不连接 Redis） |

#### dingtalk

| 字段 | 类型 | 说明 |
|------|------|------|
| webhookBase | string | 钉钉机器人 Webhook URL |
| secret | string | 签名密钥 |

#### channels

| 字段 | 类型 | 说明 |
|------|------|------|
| messages | string | 消息频道名称 |
| replies | string | 回复频道名称 |

#### groups

多群配置，每个群可以有独立的 Webhook：

```json
{
  "groups": {
    "dev-team": {
      "webhook": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
      "secret": "SECxxx"
    },
    "test-team": {
      "webhook": "https://oapi.dingtalk.com/robot/send?access_token=yyy",
      "secret": "SECyyy"
    }
  }
}
```

---

## 服务管理

### PM2 命令

```bash
# 启动
pm2 start chat-hub

# 停止
pm2 stop chat-hub

# 重启
pm2 restart chat-hub

# 查看日志
pm2 logs chat-hub

# 查看监控
pm2 monit

# 保存进程列表
pm2 save
```

### Systemd 命令

```bash
# 启动
sudo systemctl start chat-hub

# 停止
sudo systemctl stop chat-hub

# 重启
sudo systemctl restart chat-hub

# 查看状态
sudo systemctl status chat-hub

# 查看日志
sudo journalctl -u chat-hub -f
```

### Docker 命令

```bash
# 启动
docker start chat-hub

# 停止
docker stop chat-hub

# 重启
docker restart chat-hub

# 查看日志
docker logs -f chat-hub

# 进入容器
docker exec -it chat-hub /bin/sh
```

---

## 常见问题

### 1. Redis 连接失败

**症状：**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**解决方案：**
1. 检查 Redis 是否运行：`redis-cli ping`
2. 检查 Redis 配置：`config/local.json` 中的 `redis` 部分
3. 检查防火墙是否开放端口
4. 如果不需要 Redis，设置 `bot.local: true`

### 2. 钉钉发送失败

**症状：**
```
Error: 签名验证失败
```

**解决方案：**
1. 检查 `webhookBase` URL 是否正确
2. 检查 `secret` 是否正确
3. 检查系统时间是否准确（签名依赖时间戳）

### 3. 数据库错误

**症状：**
```
Error: SQLITE_BUSY: database is locked
```

**解决方案：**
1. 确保只有一个实例访问数据库
2. 检查磁盘空间是否充足
3. 重启服务

### 4. 端口被占用

**症状：**
```
Error: listen EADDRINUSE: address already in use :::8273
```

**解决方案：**
1. 查找占用端口的进程：`lsof -i :8273`
2. 停止占用端口的进程
3. 或修改配置中的 `port`

### 5. 内存占用过高

**症状：**
服务运行一段时间后内存持续增长

**解决方案：**
1. 检查是否有大量未关闭的连接
2. 设置 Node.js 内存限制：`NODE_OPTIONS="--max-old-space-size=512"`
3. 定期重启服务（PM2 支持：`pm2 start --max-memory-restart 500M`）

### 6. 消息重复发送

**症状：**
同一条消息被发送多次

**解决方案：**
1. 检查是否有多个实例同时运行
2. 确保每条消息有唯一 ID
3. 检查 Redis 订阅是否有重复

### 7. 无法接收钉钉消息

**症状：**
钉钉群有消息但服务没有收到

**解决方案：**
1. 检查钉钉机器人 Outgoing 配置
2. 确认 Outgoing 地址正确：`http://your-server:8273/webhook/dingtalk`
3. 检查服务器防火墙是否开放端口
4. 检查钉钉机器人是否启用

### 8. SSE 连接断开

**症状：**
流式对话或实时推送中断

**解决方案：**
1. 检查 Nginx 配置：`proxy_buffering off;`
2. 增加超时时间：`proxy_read_timeout 86400s;`
3. 检查网络稳定性

### 9. 权限问题

**症状：**
```
Error: EACCES: permission denied
```

**解决方案：**
1. 确保数据目录有写权限
2. 使用非 root 用户运行
3. 检查文件所有权：`chown -R user:user ~/.openclaw`

### 10. 启动脚本权限

**症状：**
```
bash: ./start.sh: Permission denied
```

**解决方案：**
```bash
chmod +x start.sh
chmod +x install-service.sh
```

---

## 日志位置

- **PM2 日志**: `~/.pm2/logs/chat-hub-*.log`
- **Systemd 日志**: `journalctl -u chat-hub`
- **Docker 日志**: `docker logs chat-hub`
- **应用日志**: 控制台输出

---

## 数据备份

### SQLite 数据库备份

```bash
# 在线备份
sqlite3 ~/.openclaw/chat-data/chat-hub.db ".backup '${BACKUP_PATH}'"

# 或直接复制（需要停止服务）
cp ~/.openclaw/chat-data/chat-hub.db ~/backup/chat-hub-$(date +%Y%m%d).db
```

### 自动备份脚本

```bash
#!/bin/bash
BACKUP_DIR=~/backup/chat-hub
mkdir -p $BACKUP_DIR

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

# 备份数据库
sqlite3 ~/.openclaw/chat-data/chat-hub.db ".backup '$BACKUP_DIR/chat-hub-$(date +%Y%m%d-%H%M%S).db'"
```

---

## 监控告警

### 健康检查

```bash
# 简单检查
curl -f http://localhost:8273/health || alert "Chat-Hub is down"

# 详细检查
curl http://localhost:8273/health | jq '.status == "ok"'
```

### Prometheus 指标

访问 `/api/observability/metrics` 获取指标数据。

### 告警规则示例

```yaml
groups:
  - name: chat-hub
    rules:
      - alert: ChatHubDown
        expr: up{job="chat-hub"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Chat-Hub service is down"
```

---

## 更新升级

```bash
# 备份数据
cp -r ~/.openclaw/chat-data ~/backup/

# 拉取最新代码
git pull origin main

# 更新依赖
npm install

# 重启服务
pm2 restart chat-hub
# 或
sudo systemctl restart chat-hub
```

---

*文档维护：Chat-Hub Team*
*最后更新：2026-03-04*
