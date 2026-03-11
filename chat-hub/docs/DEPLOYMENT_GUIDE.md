# Chat-Hub 上线手册

> 版本：1.0.0
> 更新时间：2026-03-10
> 负责人：小琳

---

## 一、上线前检查清单

### 1.1 代码检查
- [ ] TypeScript 编译无错误：`npm run typecheck`
- [ ] 安全审计无高危漏洞：`npm audit`
- [ ] 配置文件正确：`config/local.json`

### 1.2 依赖检查
- [ ] Node.js 版本 >= 18
- [ ] npm 依赖安装完成：`npm install`
- [ ] 数据库初始化完成

### 1.3 环境检查
- [ ] 端口 8273 可用（主服务）
- [ ] 端口 8274 可用（Relay SSE）
- [ ] Redis 连接正常（可选）
- [ ] 数据目录权限正确

---

## 二、启动流程

### 2.1 开发环境

```bash
cd chat-hub
npm run dev
```

### 2.2 生产环境

```bash
cd chat-hub
npm run build
npm start
```

### 2.3 使用 PM2（推荐）

```bash
pm2 start dist/index.js --name chat-hub
pm2 save
pm2 startup
```

---

## 三、配置说明

### 3.1 核心配置 (config/local.json)

```json
{
  "mode": "storage",
  "server": {
    "port": 8273
  },
  "bot": {
    "name": "小琳",
    "local": true
  },
  "dingtalk": {
    "enabled": true,
    "webhooks": {
      "primary": {
        "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
        "secret": "xxx"
      }
    }
  },
  "features": {
    "storage": true,
    "analytics": true,
    "redis": false
  }
}
```

### 3.2 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 8273 | 主服务端口 |
| `RELAY_PORT` | 8274 | Relay SSE 端口 |
| `NODE_ENV` | development | 运行环境 |

---

## 四、健康检查

### 4.1 主服务

```bash
curl http://localhost:8273/health
```

预期响应：
```json
{
  "status": "ok",
  "uptime": 12345,
  "database": { "messages": 100 },
  "redis": { "status": "connected" }
}
```

### 4.2 Relay 服务

```bash
curl http://localhost:8274/events -H "Authorization: Bearer <token>"
```

### 4.3 可观测性

```bash
curl http://localhost:8273/api/observability/health
```

---

## 五、常见问题排查

### 5.1 端口被占用

```bash
# 检查端口占用
lsof -i :8273
lsof -i :8274

# 杀掉占用进程
kill -9 <PID>
```

### 5.2 数据库锁定

```bash
# 检查数据库文件
ls -la ~/.openclaw/chat-data/

# 删除锁文件（谨慎）
rm ~/.openclaw/chat-data/messages.db-wal
rm ~/.openclaw/chat-data/messages.db-shm
```

### 5.3 PID 锁冲突

```bash
# 删除 PID 锁文件
rm ~/.openclaw/chat-hub.pid
```

### 5.4 内存过高

```bash
# 检查内存使用
curl http://localhost:8273/health | jq '.memory'

# 重启服务
pm2 restart chat-hub
```

---

## 六、回滚方案

### 6.1 版本回退

```bash
# 查看可用版本
git tag

# 回退到指定版本
git checkout v1.0.0
npm install
npm run build
pm2 restart chat-hub
```

### 6.2 数据库回滚

```bash
# 备份数据库
cp ~/.openclaw/chat-data/messages.db ~/.openclaw/chat-data/messages.db.bak

# 恢复数据库
cp ~/.openclaw/chat-data/messages.db.bak ~/.openclaw/chat-data/messages.db
```

---

## 七、监控告警

### 7.1 关键指标

| 指标 | 阈值 | 告警级别 |
|------|------|----------|
| 内存使用 | >80% | Warning |
| CPU 使用 | >80% | Warning |
| API 错误率 | >1% | Critical |
| 响应时间 P99 | >3s | Warning |

### 7.2 日志查看

```bash
# PM2 日志
pm2 logs chat-hub

# 系统日志
tail -f ~/.openclaw/logs/chat-hub.jsonl
```

---

## 八、联系方式

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| 技术负责人 | 小琳 | 钉钉群 |
| 产品负责人 | 鸿枫 | 钉钉群 |

---

*文档维护：小琳*
*最后更新：2026-03-10*