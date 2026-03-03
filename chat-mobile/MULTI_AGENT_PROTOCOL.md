# chat-mobile 多 Agent 协作协议

## 项目信息
- 项目名称：chat-mobile
- 项目路径：/home/maple/.openclaw/chat-mobile
- Git 仓库：待创建

## 分支规范

每个 Agent 使用独立分支：
- `feat/setup` - Agent1：项目初始化
- `feat/login-store` - Agent2：登录和状态管理
- `feat/chat-core` - Agent3：聊天核心页面
- `feat/api-pack` - Agent4：API 适配和打包

**合并时机**：每个 Agent 完成后，由主 Agent 合并到 dev 分支

## 文件分区（防止冲突）

| Agent | 写入目录/文件 | 只读目录 |
|-------|-------------|---------|
| Agent1 | 项目配置、package.json | - |
| Agent2 | stores/user.js, pages/login/*, utils/api.js | 项目配置 |
| Agent3 | pages/chat/*, components/* | stores/, utils/ |
| Agent4 | manifest.json, pages.json, 打包输出 | 其他所有 |

## 进度协调

### PROJECT_STATUS.json（项目状态）
```json
{
  "phase": 1,  // 1=初始化, 2=开发, 3=测试
  "setupComplete": false,
  "devComplete": false,
  "testComplete": false
}
```

### TASK_PROGRESS.json（任务进度）
```json
{
  "Agent2-LoginStore": "pending|running|completed|failed",
  "Agent3-ChatCore": "pending|running|completed|failed",
  "Agent4-ApiPack": "pending|running|completed|failed"
}
```

## Git 工作流

1. Agent1 创建项目后初始化 Git
2. 每个 Agent 创建自己的分支
3. Agent 完成后提交 PR 到 dev 分支
4. 主 Agent 合并 PR

## 冲突解决

- 如果同一文件被多个 Agent 修改 → 由主 Agent 协调合并
- 遵循"先提交者优先"原则
- 复杂冲突由主 Agent 手动解决

## Agent 执行顺序

1. **Agent1**（必须先执行）
   - 创建项目
   - 初始化 Git
   - 写入 PROJECT_STATUS.json（setupComplete: true）

2. **Agent2 + Agent3**（可并行）
   - 读取 PROJECT_STATUS.json 确认项目已创建
   - 并行开发各自模块
   - 完成后更新 TASK_PROGRESS.json

3. **Agent4**（等 Agent2+3 完成）
   - 读取 TASK_PROGRESS.json 确认开发完成
   - 整合测试和打包
