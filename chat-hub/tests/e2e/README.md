# Chat-Hub 端到端测试套件

完整的端到端测试脚本，用于验证 Chat-Hub 的所有功能。

## 文件说明

| 文件 | 说明 |
|------|------|
| `test-runner.sh` | 主测试运行器，执行完整测试流程 |
| `health-check.sh` | 健康检查脚本，检查服务状态 |
| `smoke-test.sh` | 冒烟测试脚本，快速验证核心功能 |
| `test-report.md` | 测试报告模板 |
| `reports/` | 测试报告输出目录 |

## 快速开始

### 1. 确保服务运行

```bash
cd /home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub
npm start
```

### 2. 运行测试

```bash
cd tests/e2e

# 完整测试（生成报告）
./test-runner.sh --report

# 仅健康检查
./health-check.sh

# 仅冒烟测试
./smoke-test.sh
```

## 测试阶段

### Phase 1: 环境检查
- 检查 Node.js、npm 版本
- 检查 Redis 连接
- 检查项目依赖

### Phase 2: 服务状态检查
- 检查 API 服务是否运行
- 检查进程状态
- 检查端口监听

### Phase 3: 数据库迁移
- 检查数据库文件
- 验证数据库 API

### Phase 4: API 端点测试
- 测试所有 REST API 端点
- 验证响应格式
- 检查错误处理

### Phase 5: 端到端测试
- 消息存储和查询
- Agent 创建和对话
- Skill 执行
- 任务管理
- 定时任务配置
- 沙箱创建和代码执行
- 工作区文件操作

## 命令选项

### test-runner.sh

```bash
./test-runner.sh [选项]

选项:
  --skip-health    跳过健康检查
  --skip-smoke     跳过冒烟测试
  --skip-e2e       跳过端到端测试
  --api=URL        指定 API 地址 (默认: http://localhost:3000)
  --verbose        详细输出
  --report         生成测试报告
  --help           显示帮助
```

### health-check.sh

```bash
./health-check.sh [--verbose]

选项:
  --verbose, -v    详细输出
```

### smoke-test.sh

```bash
./smoke-test.sh [--api=URL] [--timeout=SECONDS]

选项:
  --api=URL        指定 API 地址
  --timeout=N      请求超时时间（秒）
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| API_BASE | API 地址 | http://localhost:3000 |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| DB_PATH | 数据库路径 | ./data/chat.db |
| TIMEOUT | 请求超时 | 5 |

## 示例

### 完整测试流程

```bash
# 1. 启动服务
cd /home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub
npm start &

# 2. 等待服务启动
sleep 3

# 3. 运行测试
cd tests/e2e
./test-runner.sh --report --verbose

# 4. 查看报告
ls -lh reports/
cat reports/test-report-*.md
```

### 快速健康检查

```bash
cd tests/e2e
./health-check.sh
```

### 指定 API 地址

```bash
# 测试远程服务
API_BASE=http://192.168.1.100:3000 ./test-runner.sh

# 或使用参数
./test-runner.sh --api=http://192.168.1.100:3000
```

### CI/CD 集成

```bash
#!/bin/bash
# ci-test.sh

set -e

# 启动服务
npm start &
SERVER_PID=$!

# 等待服务启动
sleep 5

# 运行测试
cd tests/e2e
./test-runner.sh --report

# 清理
kill $SERVER_PID
```

## 测试报告

测试报告保存在 `reports/` 目录：

```
reports/
├── test-report-20260304_105430.md
├── test-log-20260304_105430.txt
└── ...
```

报告包含：
- 测试信息（时间、环境、配置）
- 测试结果汇总（通过/失败/跳过）
- 详细日志
- 建议和改进方向

## 故障排查

### 服务未启动

```bash
# 检查进程
ps aux | grep node

# 启动服务
cd /home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub
npm start
```

### Redis 连接失败

```bash
# 检查 Redis
redis-cli ping

# 启动 Redis
redis-server
```

### 端口被占用

```bash
# 检查端口
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

## 贡献

欢迎提交 Issue 和 PR 改进测试套件！

## 许可

MIT
