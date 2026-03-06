# Docker 沙箱执行环境

为 AI Agent 提供安全的命令执行环境。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent 请求                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   SandboxManager                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐    │
│  │ 创建沙箱    │ │ 执行命令    │ │ 资源限制 & 超时     │    │
│  └─────────────┘ └─────────────┘ └─────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Docker Engine                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Sandbox Container                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Security Options:                              │  │  │
│  │  │  - no-new-privileges                            │  │  │
│  │  │  - read-only root filesystem                    │  │  │
│  │  │  - capability dropping (CAP_DROP ALL)           │  │  │
│  │  │  - network isolation (default: none)            │  │  │
│  │  │  - user namespace (sandbox user)                │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Resource Limits:                               │  │  │
│  │  │  - CPU: 0.1 - 4 cores                           │  │  │
│  │  │  - Memory: 64 - 4096 MB                         │  │  │
│  │  │  - Disk: 64 - 10240 MB                          │  │  │
│  │  │  - PIDs: 128 max                                │  │  │
│  │  │  - Timeout: 1 - 3600 seconds                    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 安全措施

### 1. 网络隔离
- 默认禁用网络 (`--network none`)
- 可配置允许访问的主机白名单
- 支持 bridge 网络模式

### 2. 文件系统隔离
- 只读根文件系统 (`--read-only`)
- 独立的工作区目录
- tmpfs 用于临时文件
- 无权限访问宿主机文件系统

### 3. 用户权限限制
- 非 root 用户运行 (`sandbox:sandbox`)
- 禁止提权 (`--security-opt no-new-privileges`)
- 移除所有 Linux capabilities (`--cap-drop ALL`)
- 仅保留必要的 capabilities

### 4. 资源限制
- CPU 限制: 0.1 - 4 核
- 内存限制: 64 - 4096 MB
- 磁盘限制: 64 - 10240 MB
- 进程数限制: 128
- 执行超时: 1 - 3600 秒

## API 端点

### 创建沙箱
```http
POST /api/sandbox/create
Content-Type: application/json

{
  "name": "my-sandbox",
  "cpuLimit": 1,
  "memoryLimit": 512,
  "timeout": 60,
  "networkEnabled": false,
  "environmentVars": {
    "NODE_ENV": "production"
  }
}
```

### 执行命令
```http
POST /api/sandbox/:id/execute
Content-Type: application/json

{
  "command": "node -e \"console.log('Hello')\"",
  "timeout": 30
}
```

### 执行代码
```http
POST /api/sandbox/:id/execute
Content-Type: application/json

{
  "code": "console.log('Hello, World!');",
  "language": "javascript",
  "timeout": 30
}
```

### 删除沙箱
```http
DELETE /api/sandbox/:id
```

## 使用示例

### Node.js
```typescript
import { SandboxManager } from './sandbox';

// 创建管理器
const manager = new SandboxManager(db, {
  defaultCpuLimit: 1,
  defaultMemoryLimit: 512,
  defaultTimeout: 60
});

// 初始化
await manager.init();

// 创建沙箱
const sandbox = await manager.create({
  name: 'test-sandbox',
  cpuLimit: 1,
  memoryLimit: 256
});

// 执行代码
const result = await manager.executeCode(
  sandbox.id,
  'console.log("Hello, World!");',
  'javascript',
  { timeout: 10 }
);

console.log(result.stdout); // Hello, World!

// 清理
await manager.destroy(sandbox.id);
```

### Python
```python
import requests

# 创建沙箱
response = requests.post('http://localhost:8273/api/sandbox/create', json={
    'name': 'python-sandbox',
    'memoryLimit': 256
})
sandbox = response.json()['data']

# 执行 Python 代码
response = requests.post(
    f'http://localhost:8273/api/sandbox/{sandbox["id"]}/execute',
    json={
        'code': 'print("Hello from Python!")',
        'language': 'python'
    }
)
print(response.json()['data']['stdout'])

# 清理
requests.delete(f'http://localhost:8273/api/sandbox/{sandbox["id"]}')
```

## 构建沙箱镜像

```bash
cd docker/sandbox
docker-compose -f docker-compose.sandbox.yml build
```

## 配置选项

```typescript
interface SandboxConfig {
  defaultImage: string;      // 默认镜像
  defaultCpuLimit: number;   // 默认 CPU 限制
  defaultMemoryLimit: number; // 默认内存限制
  defaultDiskLimit: number;  // 默认磁盘限制
  defaultTimeout: number;    // 默认超时时间
  maxTimeout: number;        // 最大超时时间
  enableGpu: boolean;        // 是否启用 GPU
  enableNetwork: boolean;    // 是否默认启用网络
  dockerPath: string;        // Docker 命令路径
  sandboxImage: string;      // 沙箱镜像名称
  workspaceBase: string;     // 工作区基础路径
  maxContainers: number;     // 最大容器数量
  cleanupInterval: number;   // 清理间隔
}
```

## 注意事项

1. **Docker 权限**: 运行服务需要 Docker daemon 访问权限
2. **资源监控**: 建议配置 Docker 资源监控
3. **日志管理**: 沙箱日志会自动记录到数据库
4. **自动清理**: 过期沙箱会自动清理
5. **安全审计**: 所有操作都有审计日志