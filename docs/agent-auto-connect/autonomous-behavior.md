# 自主行为机制设计

> 版本: 1.0.0
> 规范 ID: `autonomous-behavior`

本文档定义了 Agent 自主行为的机制和规范。

---

## 1. 行为概述

### 1.1 什么是自主行为

自主行为是指 Agent 在没有明确指令的情况下，根据规则、条件或计划主动执行的操作。

### 1.2 行为分类

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        行为分类                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  响应式行为 (Reactive)                                                    │
│  触发: 收到消息/事件                                                       │
│  示例: 自动回复、智能转发                                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  主动行为 (Proactive)                                                     │
│  触发: 内部条件/判断                                                       │
│  示例: 主动提醒、内容推荐                                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  定时行为 (Scheduled)                                                     │
│  触发: 时间计划                                                            │
│  示例: 每日总结、定时播报                                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  学习行为 (Learning)                                                      │
│  触发: 模式识别                                                            │
│  示例: 自适应回复、个性化推荐                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 行为框架

### 2.1 核心架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        自主行为框架                                       │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   触发源     │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ 消息触发器   │ │ 事件触发器   │ │ 时间触发器   │
    └──────────────┘ └──────────────┘ └──────────────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  条件评估器  │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │              │
                    ▼              ▼
             ┌──────────┐   ┌──────────┐
             │ 满足条件 │   │ 不满足   │
             └────┬─────┘   └──────────┘
                  │
                  ▼
           ┌──────────────┐
           │  行为执行器  │
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │  结果处理器  │
           └──────────────┘
```

### 2.2 行为定义

```typescript
interface Behavior {
  // 基本信息
  id: string;
  name: string;
  description: string;
  
  // 触发条件
  trigger: BehaviorTrigger;
  
  // 执行条件
  condition?: BehaviorCondition;
  
  // 执行动作
  action: BehaviorAction;
  
  // 约束
  constraints?: BehaviorConstraints;
  
  // 元数据
  metadata?: {
    priority: number;
    cooldown: number;      // 冷却时间（毫秒）
    maxExecutions: number; // 最大执行次数
  };
}
```

---

## 3. 触发器

### 3.1 消息触发器

```typescript
interface MessageTrigger {
  type: 'message';
  
  // 匹配规则
  match: {
    patterns?: string[];        // 正则表达式
    keywords?: string[];        // 关键词
    mentions?: string[];        // @ 提及
    channels?: string[];        // 频道
    senders?: string[];         // 发送者
  };
  
  // 排除规则
  exclude?: {
    patterns?: string[];
    keywords?: string[];
  };
}

// 示例
const weatherTrigger: MessageTrigger = {
  type: 'message',
  match: {
    keywords: ['天气', '气温', '预报'],
    channels: ['AI聊天室', '技术讨论']
  },
  exclude: {
    patterns: ['不.*天气']  // 排除否定句
  }
};
```

### 3.2 事件触发器

```typescript
interface EventTrigger {
  type: 'event';
  
  // 事件类型
  events: string[];  // 如: 'user.join', 'task.complete'
  
  // 过滤条件
  filter?: {
    source?: string;
    target?: string;
    data?: Record<string, any>;
  };
}

// 示例
const welcomeTrigger: EventTrigger = {
  type: 'event',
  events: ['user.join'],
  filter: {
    channel: 'AI聊天室'
  }
};
```

### 3.3 时间触发器

```typescript
interface TimeTrigger {
  type: 'time';
  
  // 调度配置
  schedule: {
    type: 'once' | 'cron' | 'interval';
    
    // 单次
    time?: string;              // ISO 时间
    
    // Cron
    cron?: string;              // Cron 表达式
    
    // 间隔
    interval?: number;          // 间隔（毫秒）
    
    // 时区
    timezone?: string;
  };
  
  // 有效期
  validFrom?: string;
  validUntil?: string;
}

// 示例
const dailyReportTrigger: TimeTrigger = {
  type: 'time',
  schedule: {
    type: 'cron',
    cron: '0 9 * * *',  // 每天 9:00
    timezone: 'Asia/Shanghai'
  }
};
```

### 3.4 条件触发器

```typescript
interface ConditionTrigger {
  type: 'condition';
  
  // 条件表达式
  expression: string;           // 条件表达式
  
  // 检查间隔
  checkInterval: number;        // 检查间隔（毫秒）
  
  // 触发限制
  triggerOnce?: boolean;        // 只触发一次
  resetCondition?: string;      // 重置条件
}

// 示例
const alertTrigger: ConditionTrigger = {
  type: 'condition',
  expression: 'weather.temperature > 35',
  checkInterval: 60000,  // 每分钟检查
  resetCondition: 'weather.temperature < 30'
};
```

---

## 4. 条件评估

### 4.1 条件定义

```typescript
interface BehaviorCondition {
  // 上下文条件
  context?: {
    inConversation?: boolean;   // 是否在对话中
    lastMessageTime?: number;   // 上次消息时间
    activeAgents?: string[];    // 活跃 Agent
  };
  
  // 用户条件
  user?: {
    id?: string;
    role?: string;
    permissions?: string[];
  };
  
  // 环境条件
  environment?: {
    time?: TimeRange;
    dayOfWeek?: number[];
    channel?: string[];
  };
  
  // 状态条件
  state?: {
    [key: string]: any;
  };
  
  // 组合条件
  and?: BehaviorCondition[];
  or?: BehaviorCondition[];
  not?: BehaviorCondition;
}
```

### 4.2 条件表达式

支持简单的表达式语言：

```
// 比较运算
value == "target"
value != "target"
value > 10
value >= 10
value < 10
value <= 10

// 逻辑运算
condition1 && condition2
condition1 || condition2
!condition

// 包含运算
value in ["a", "b", "c"]
value contains "substring"

// 时间运算
now > "2026-03-08T09:00:00"
hour(now) in [9, 10, 11]
```

### 4.3 评估器实现

```typescript
class ConditionEvaluator {
  evaluate(condition: BehaviorCondition, context: Context): boolean {
    // 上下文条件
    if (condition.context) {
      const { inConversation, lastMessageTime, activeAgents } = condition.context;
      
      if (inConversation !== undefined) {
        if (inConversation && !context.conversation) return false;
        if (!inConversation && context.conversation) return false;
      }
      
      // 更多条件检查...
    }
    
    // 组合条件
    if (condition.and) {
      return condition.and.every(c => this.evaluate(c, context));
    }
    
    if (condition.or) {
      return condition.or.some(c => this.evaluate(c, context));
    }
    
    if (condition.not) {
      return !this.evaluate(condition.not, context);
    }
    
    return true;
  }
}
```

---

## 5. 行为执行

### 5.1 执行动作

```typescript
interface BehaviorAction {
  // 动作类型
  type: 'send_message' | 'call_api' | 'create_task' | 'update_state' | 'custom';
  
  // 动作参数
  params: Record<string, any>;
  
  // 模板
  templates?: {
    [key: string]: string;      // 支持变量插值
  };
  
  // 错误处理
  onError?: {
    action: 'ignore' | 'retry' | 'fallback';
    retryCount?: number;
    fallback?: BehaviorAction;
  };
}
```

### 5.2 动作类型

#### 发送消息

```typescript
const sendMessageAction: BehaviorAction = {
  type: 'send_message',
  params: {
    channel: '{{trigger.channel}}',
    content: '你好！有什么可以帮你的？',
    sender: '{{agent.name}}'
  }
};
```

#### 调用 API

```typescript
const callApiAction: BehaviorAction = {
  type: 'call_api',
  params: {
    method: 'POST',
    url: 'http://localhost:8273/api/v1/messages/reply',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      content: '{{response}}',
      sender: '{{agent.name}}'
    }
  }
};
```

#### 创建任务

```typescript
const createTaskAction: BehaviorAction = {
  type: 'create_task',
  params: {
    title: '跟进用户请求',
    description: '用户 {{trigger.sender}} 询问了 {{trigger.content}}',
    assignee: '{{agent.id}}',
    priority: 'normal'
  }
};
```

---

## 6. 约束与限制

### 6.1 执行约束

```typescript
interface BehaviorConstraints {
  // 冷却时间
  cooldown: number;           // 两次执行之间的最小间隔（毫秒）
  
  // 最大执行次数
  maxExecutions: number;      // 最大执行次数
  maxExecutionsPer?: {
    minute: number;
    hour: number;
    day: number;
  };
  
  // 时间窗口
  timeWindow?: {
    start: string;            // 开始时间 "09:00"
    end: string;              // 结束时间 "18:00"
    timezone: string;
  };
  
  // 环境限制
  environment?: {
    channels?: string[];      // 允许的频道
    users?: string[];         // 允许的用户
  };
}
```

### 6.2 约束检查器

```typescript
class ConstraintChecker {
  private executionHistory: Map<string, number[]> = new Map();
  
  check(behaviorId: string, constraints: BehaviorConstraints): boolean {
    const history = this.executionHistory.get(behaviorId) || [];
    const now = Date.now();
    
    // 冷却检查
    if (constraints.cooldown) {
      const lastExecution = history[history.length - 1];
      if (lastExecution && now - lastExecution < constraints.cooldown) {
        return false;
      }
    }
    
    // 频率检查
    if (constraints.maxExecutionsPer?.minute) {
      const minuteAgo = now - 60000;
      const recentExecutions = history.filter(t => t > minuteAgo);
      if (recentExecutions.length >= constraints.maxExecutionsPer.minute) {
        return false;
      }
    }
    
    // 时间窗口检查
    if (constraints.timeWindow) {
      const currentHour = new Date().getHours();
      const [startHour] = constraints.timeWindow.start.split(':').map(Number);
      const [endHour] = constraints.timeWindow.end.split(':').map(Number);
      if (currentHour < startHour || currentHour >= endHour) {
        return false;
      }
    }
    
    return true;
  }
  
  record(behaviorId: string): void {
    const history = this.executionHistory.get(behaviorId) || [];
    history.push(Date.now());
    this.executionHistory.set(behaviorId, history);
  }
}
```

---

## 7. 行为注册与管理

### 7.1 行为注册

```typescript
interface BehaviorRegistry {
  // 注册行为
  register(behavior: Behavior): void;
  
  // 注销行为
  unregister(behaviorId: string): void;
  
  // 更新行为
  update(behaviorId: string, updates: Partial<Behavior>): void;
  
  // 查询行为
  query(filter: BehaviorFilter): Behavior[];
  
  // 启用/禁用
  enable(behaviorId: string): void;
  disable(behaviorId: string): void;
}
```

### 7.2 行为存储

```typescript
interface BehaviorStore {
  // 持久化
  save(behavior: Behavior): Promise<void>;
  
  // 加载
  load(behaviorId: string): Promise<Behavior>;
  
  // 列表
  list(filter?: BehaviorFilter): Promise<Behavior[]>;
  
  // 删除
  delete(behaviorId: string): Promise<void>;
}
```

---

## 8. 预定义行为

### 8.1 消息响应行为

```typescript
const autoReplyBehavior: Behavior = {
  id: 'auto-reply',
  name: '自动回复',
  description: '当被 @ 或提及时自动回复',
  
  trigger: {
    type: 'message',
    match: {
      mentions: ['{{agent.name}}'],
      keywords: ['{{agent.name}}']
    }
  },
  
  condition: {
    context: { inConversation: false }
  },
  
  action: {
    type: 'send_message',
    params: {
      content: '收到！我正在处理你的请求...',
      channel: '{{trigger.channel}}'
    }
  },
  
  constraints: {
    cooldown: 5000,
    maxExecutionsPer: { minute: 10 }
  }
};
```

### 8.2 定时报告行为

```typescript
const dailyReportBehavior: Behavior = {
  id: 'daily-report',
  name: '每日报告',
  description: '每天早上发送群活跃度报告',
  
  trigger: {
    type: 'time',
    schedule: {
      type: 'cron',
      cron: '0 9 * * *',
      timezone: 'Asia/Shanghai'
    }
  },
  
  action: {
    type: 'send_message',
    params: {
      content: `
📅 每日报告 - {{date}}

📊 昨日统计：
- 消息数: {{stats.messages}}
- 活跃用户: {{stats.users}}
- 热门话题: {{stats.topics}}

祝大家今天愉快！
      `.trim(),
      channel: 'AI聊天室'
    }
  },
  
  constraints: {
    timeWindow: { start: '08:00', end: '10:00', timezone: 'Asia/Shanghai' }
  }
};
```

### 8.3 事件通知行为

```typescript
const userJoinBehavior: Behavior = {
  id: 'user-join-welcome',
  name: '新用户欢迎',
  description: '新用户加入时发送欢迎消息',
  
  trigger: {
    type: 'event',
    events: ['user.join']
  },
  
  action: {
    type: 'send_message',
    params: {
      content: '欢迎 {{user.name}} 加入 AI 聊天室！🎉',
      channel: 'AI聊天室'
    }
  },
  
  constraints: {
    cooldown: 10000  // 防止短时间内多次加入
  }
};
```

---

## 9. 监控与调试

### 9.1 行为日志

```typescript
interface BehaviorLog {
  behaviorId: string;
  timestamp: number;
  
  // 触发信息
  trigger: {
    type: string;
    source: any;
  };
  
  // 条件评估
  condition: {
    passed: boolean;
    details: Record<string, boolean>;
  };
  
  // 执行结果
  execution: {
    success: boolean;
    duration: number;
    result?: any;
    error?: string;
  };
}
```

### 9.2 调试接口

```typescript
interface BehaviorDebugger {
  // 模拟触发
  simulate(behaviorId: string, trigger: any): Promise<ExecutionResult>;
  
  // 查看状态
  getStatus(behaviorId: string): BehaviorStatus;
  
  // 查看历史
  getHistory(behaviorId: string, limit?: number): BehaviorLog[];
  
  // 手动执行
  execute(behaviorId: string): Promise<ExecutionResult>;
}
```

---

## 10. 安全考虑

### 10.1 权限控制

- 行为执行需要相应权限
- 敏感操作需要额外授权
- 频率限制防止滥用

### 10.2 审计日志

- 记录所有行为执行
- 包含触发原因
- 可追溯责任

### 10.3 异常处理

- 执行失败不影响系统稳定
- 超时自动终止
- 错误上报机制

---

## 11. 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本 |

---

*最后更新: 2026-03-07*