# 任务执行规则

> 版本: 1.0.0
> 规范 ID: `task-execution`

本文档定义了 Agent 执行任务的规则和规范。

---

## 1. 任务生命周期

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        任务生命周期                                      │
└─────────────────────────────────────────────────────────────────────────┘

  创建 → 排队 → 执行 → 完成/失败
    │       │       │       │
    ▼       ▼       ▼       ▼
  验证    调度    监控    清理
  参数    优先级  超时    归档
  权限    资源    日志    回调
```

---

## 2. 任务类型

### 2.1 同步任务

立即执行，等待结果返回。

```typescript
interface SyncTask {
  type: 'sync';
  action: string;
  params: Record<string, any>;
  timeout: number;  // 默认 30 秒
}
```

**示例**：
- 查询信息
- 发送单条消息
- 读取记忆

### 2.2 异步任务

后台执行，通过回调通知结果。

```typescript
interface AsyncTask {
  type: 'async';
  action: string;
  params: Record<string, any>;
  callback?: {
    type: 'webhook' | 'message' | 'event';
    url?: string;
    channelId?: string;
  };
}
```

**示例**：
- 生成报告
- 批量处理
- 长时间计算

### 2.3 定时任务

按计划执行。

```typescript
interface ScheduledTask {
  type: 'scheduled';
  action: string;
  params: Record<string, any>;
  schedule: {
    type: 'once' | 'recurring';
    time?: string;          // ISO 时间
    cron?: string;          // Cron 表达式
    timezone?: string;
  };
}
```

**示例**：
- 每日总结
- 定时提醒
- 周期报告

### 2.4 条件任务

满足条件时触发。

```typescript
interface ConditionalTask {
  type: 'conditional';
  action: string;
  params: Record<string, any>;
  condition: {
    type: 'event' | 'threshold' | 'state';
    expression: string;
    ttl?: number;  // 条件有效期
  };
}
```

**示例**：
- 天气预警
- 事件提醒
- 状态监控

---

## 3. 执行流程

### 3.1 任务创建

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        任务创建流程                                      │
└─────────────────────────────────────────────────────────────────────────┘

1. 接收任务请求
     │
     ▼
2. 参数验证
     │ ├── 必需参数检查
     │ ├── 参数类型验证
     │ └── 参数范围校验
     │
     ▼
3. 权限检查
     │ ├── Agent 权限
     │ ├── 资源权限
     │ └── 操作权限
     │
     ▼
4. 资源检查
     │ ├── 配额检查
     │ ├── 依赖检查
     │ └── 状态检查
     │
     ▼
5. 创建任务记录
     │
     ▼
6. 返回任务 ID
```

### 3.2 任务调度

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        任务调度流程                                      │
└─────────────────────────────────────────────────────────────────────────┘

任务队列
     │
     ├── 高优先级队列 (immediate)
     │    └── 实时任务、紧急任务
     │
     ├── 普通队列 (normal)
     │    └── 常规任务
     │
     └── 低优先级队列 (background)
          └── 后台任务、批量任务

调度策略:
1. 高优先级队列优先
2. 同优先级 FIFO
3. 资源可用性检查
4. 并发限制控制
```

### 3.3 任务执行

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        任务执行流程                                      │
└─────────────────────────────────────────────────────────────────────────┘

1. 获取任务
     │
     ▼
2. 设置执行上下文
     │ ├── 加载 Agent 信息
     │ ├── 加载会话上下文
     │ └── 设置环境变量
     │
     ▼
3. 执行前置钩子
     │
     ▼
4. 执行任务动作
     │ ├── 调用对应处理器
     │ ├── 监控执行状态
     │ └── 处理异常
     │
     ▼
5. 执行后置钩子
     │
     ▼
6. 更新任务状态
     │ ├── 记录结果
     │ ├── 更新统计
     │ └── 触发回调
     │
     ▼
7. 清理执行上下文
```

---

## 4. 权限控制

### 4.1 权限模型

```typescript
interface Permission {
  // 资源标识
  resource: string;
  
  // 允许的操作
  actions: string[];
  
  // 条件约束
  conditions?: {
    channel?: string[];      // 限制频道
    user?: string[];         // 限制用户
    time?: TimeRange;        // 限制时间
    rate?: RateLimit;        // 速率限制
  };
}
```

### 4.2 权限检查流程

```
请求操作
    │
    ▼
检查 Agent 权限
    │ ├── Agent 是否有该资源权限
    │ └── Agent 是否有该操作权限
    │
    ▼
检查条件约束
    │ ├── 频道限制
    │ ├── 用户限制
    │ ├── 时间限制
    │ └── 速率限制
    │
    ▼
返回结果
    ├── 允许: 继续执行
    └── 拒绝: 返回权限错误
```

### 4.3 默认权限配置

```typescript
const DEFAULT_PERMISSIONS: Permission[] = [
  // 消息权限
  {
    resource: 'messages',
    actions: ['send', 'read'],
    conditions: {
      rate: { maxPerMinute: 20 }
    }
  },
  
  // 记忆权限
  {
    resource: 'memory',
    actions: ['read', 'write', 'delete'],
    conditions: {
      user: ['self']  // 只能访问自己的记忆
    }
  },
  
  // 任务权限
  {
    resource: 'tasks',
    actions: ['create', 'read', 'update', 'delete'],
    conditions: {
      user: ['self']
    }
  }
];
```

---

## 5. 资源限制

### 5.1 配额管理

```typescript
interface Quota {
  // 消息配额
  messages: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  
  // API 调用配额
  apiCalls: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  
  // 存储配额
  storage: {
    memoryBytes: number;    // 记忆存储
    fileBytes: number;      // 文件存储
  };
  
  // 并发限制
  concurrency: {
    maxTasks: number;       // 最大并发任务
    maxConnections: number; // 最大连接数
  };
}
```

### 5.2 默认配额

| 资源类型 | 限制 | 说明 |
|---------|------|------|
| 消息/分钟 | 20 | 每分钟最大消息数 |
| 消息/小时 | 500 | 每小时最大消息数 |
| API 调用/分钟 | 100 | 每分钟最大 API 调用 |
| 并发任务 | 5 | 最大并发任务数 |
| 记忆存储 | 10MB | 记忆最大存储空间 |

### 5.3 配额检查

```typescript
async function checkQuota(agentId: string, resource: string): Promise<boolean> {
  const usage = await getUsage(agentId, resource);
  const quota = await getQuota(agentId, resource);
  
  if (usage >= quota) {
    throw new QuotaExceededError(resource, quota);
  }
  
  return true;
}
```

---

## 6. 错误处理

### 6.1 错误类型

```typescript
enum TaskErrorType {
  // 参数错误
  INVALID_PARAMS = 'invalid_params',
  MISSING_PARAMS = 'missing_params',
  
  // 权限错误
  PERMISSION_DENIED = 'permission_denied',
  QUOTA_EXCEEDED = 'quota_exceeded',
  
  // 执行错误
  TIMEOUT = 'timeout',
  INTERNAL_ERROR = 'internal_error',
  DEPENDENCY_ERROR = 'dependency_error',
  
  // 资源错误
  RESOURCE_NOT_FOUND = 'resource_not_found',
  RESOURCE_BUSY = 'resource_busy'
}
```

### 6.2 错误响应

```typescript
interface TaskError {
  type: TaskErrorType;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  retryAfter?: number;  // 重试等待时间（毫秒）
}

// 示例
const error: TaskError = {
  type: TaskErrorType.QUOTA_EXCEEDED,
  message: '消息配额已用尽',
  details: {
    limit: 20,
    used: 20,
    resetAt: Date.now() + 60000
  },
  retryable: true,
  retryAfter: 60000
};
```

### 6.3 重试策略

```typescript
interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;     // 初始延迟（毫秒）
  maxDelay: number;         // 最大延迟（毫秒）
  multiplier: number;       // 延迟倍数
  retryableErrors: TaskErrorType[];
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  retryableErrors: [
    TaskErrorType.TIMEOUT,
    TaskErrorType.INTERNAL_ERROR,
    TaskErrorType.DEPENDENCY_ERROR,
    TaskErrorType.RESOURCE_BUSY
  ]
};
```

---

## 7. 超时控制

### 7.1 超时配置

```typescript
interface TimeoutConfig {
  // 默认超时
  default: number;          // 30 秒
  
  // 按任务类型
  byType: {
    sync: number;           // 30 秒
    async: number;          // 5 分钟
    scheduled: number;      // 10 分钟
    conditional: number;    // 1 小时
  };
  
  // 按操作类型
  byAction: {
    sendMessage: number;    // 5 秒
    queryMemory: number;    // 10 秒
    createTask: number;     // 10 秒
    generateReport: number; // 5 分钟
  };
}
```

### 7.2 超时处理

```typescript
async function executeWithTimeout<T>(
  task: () => Promise<T>,
  timeout: number
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TaskTimeoutError(timeout));
    }, timeout);
  });
  
  try {
    return await Promise.race([task(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

## 8. 日志与监控

### 8.1 日志格式

```typescript
interface TaskLog {
  // 基本信息
  taskId: string;
  agentId: string;
  timestamp: number;
  
  // 执行信息
  action: string;
  params: Record<string, any>;
  result: 'success' | 'failure';
  
  // 性能信息
  duration: number;
  queueTime: number;
  
  // 错误信息
  error?: {
    type: TaskErrorType;
    message: string;
    stack?: string;
  };
}
```

### 8.2 监控指标

```typescript
interface TaskMetrics {
  // 计数器
  tasksCreated: number;
  tasksCompleted: number;
  tasksFailed: number;
  
  // 直方图
  executionTime: Histogram;
  queueTime: Histogram;
  
  // 仪表
  activeTasks: number;
  queuedTasks: number;
  
  // 按类型分组
  byType: Record<string, {
    count: number;
    avgDuration: number;
    errorRate: number;
  }>;
}
```

---

## 9. 回调机制

### 9.1 回调类型

```typescript
interface Callback {
  type: 'webhook' | 'message' | 'event';
  
  // Webhook 回调
  webhook?: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
  };
  
  // 消息回调
  message?: {
    channelId: string;
    template?: string;
  };
  
  // 事件回调
  event?: {
    eventBus: string;
    eventType: string;
  };
}
```

### 9.2 回调触发

```typescript
async function triggerCallback(
  callback: Callback,
  task: Task,
  result: TaskResult
): Promise<void> {
  const payload = {
    taskId: task.id,
    agentId: task.agentId,
    status: result.status,
    data: result.data,
    timestamp: Date.now()
  };
  
  switch (callback.type) {
    case 'webhook':
      await fetch(callback.webhook.url, {
        method: callback.webhook.method,
        headers: callback.webhook.headers,
        body: JSON.stringify(payload)
      });
      break;
      
    case 'message':
      await sendMessage(callback.message.channelId, 
        formatMessage(callback.message.template, payload));
      break;
      
    case 'event':
      await emitEvent(callback.event.eventBus, 
        callback.event.eventType, payload);
      break;
  }
}
```

---

## 10. 任务状态机

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        任务状态机                                        │
└─────────────────────────────────────────────────────────────────────────┘

        ┌──────────┐
        │  pending │ ← 初始状态
        └────┬─────┘
             │ 开始执行
             ▼
        ┌──────────┐
        │ running  │ ← 执行中
        └────┬─────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌──────────┐
│ success │    │  failed  │
└─────────┘    └────┬─────┘
                    │
              ┌─────┴─────┐
              │           │
              ▼           ▼
         ┌────────┐  ┌──────────┐
         │ retry  │  │ cancelled│
         └────────┘  └──────────┘
              │
              ▼
         (回到 pending)
```

---

## 11. 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本 |

---

*最后更新: 2026-03-07*