# Chat-Hub 端到端测试报告

> 模板文件 - 实际报告由 test-runner.sh 自动生成

## 测试信息

| 字段 | 值 |
|------|-----|
| 执行时间 | YYYY-MM-DD HH:MM:SS |
| API 地址 | http://localhost:3000 |
| 执行耗时 | X 秒 |
| 测试环境 | Linux/Node.js 版本 |

## 测试结果汇总

| 指标 | 数量 |
|------|------|
| 总测试数 | 0 |
| 通过 | 0 |
| 失败 | 0 |
| 跳过 | 0 |

## 测试阶段

### Phase 1: 环境检查
- Node.js 版本
- npm 版本
- Redis 连接
- 项目依赖

### Phase 2: 服务状态检查
- API 服务
- 进程状态
- 端口监听

### Phase 3: 数据库迁移
- 数据库文件
- 迁移脚本
- 数据库 API

### Phase 4: API 端点测试
- 基础连通性
- 消息 API
- 认证 API
- Agent API
- Skill API
- Task API
- Scheduler API
- Workspace API
- Sandbox API

### Phase 5: 端到端测试
- 消息存储和查询
- Agent 创建和对话
- Skill 执行
- 任务管理
- 定时任务
- 沙箱执行
- 工作区操作

## 使用说明

### 运行测试

```bash
# 完整测试
./test-runner.sh --report

# 仅健康检查
./health-check.sh

# 仅冒烟测试
./smoke-test.sh

# 指定 API 地址
./test-runner.sh --api=http://localhost:3000

# 跳过某些阶段
./test-runner.sh --skip-health --skip-smoke
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| API_BASE | API 地址 | http://localhost:3000 |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| DB_PATH | 数据库路径 | ./data/chat.db |
| TIMEOUT | 请求超时 | 5 |
