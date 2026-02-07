# Agent Team - 多 Agent 协作系统使用指南

> OpenClaw 本地实现的 LobeHub 风格 Agent Team 功能
> 
> 版本：v1.0.0 | 创建：2026-02-07

---

## 🎯 项目简介

Agent Team 是一个专为 OpenClaw 设计的多 Agent 协作框架，允许创建由多个 AI Agent 组成的团队，协同完成复杂任务。

**灵感来源**：[LobeHub](https://lobehub.com) 的 Agent Team 功能

---

## 📦 安装位置

```
~/.openclaw/workspace/skills/agent-team/
├── SKILL.md              # 完整使用文档
├── README.md             # 项目说明
├── team.js               # CLI 入口
├── package.json          # 依赖配置
├── lib/                  # 核心模块
│   ├── team-manager.js
│   ├── agent-spawner.js
│   └── task-router.js
├── templates/            # 预设模板
│   └── code-review.json
└── data/                 # 数据存储
    └── teams.db          # SQLite 数据库
```

---

## 🚀 快速开始

### 1. 使用快捷命令

```bash
# 如果命令不可用，先添加到 PATH
export PATH="$HOME/bin:$PATH"

# 或使用完整路径
alias team="node ~/.openclaw/workspace/skills/agent-team/team.js"
```

### 2. 创建第一个团队

```bash
team create code-review --template code-review
```

### 3. 运行任务

```bash
team run code-review "请审查以下代码：
function add(a, b) {
  return a + b;
}
"
```

---

## 🎨 内置模板

### 1. code-review（代码审查）

**成员**：分析师 + 安全专家 + 性能专家 + 总审查员

**工作流**：并行分析 → 综合评审

**适用场景**：
- PR 审查
- 代码质量检查
- 安全审计

### 2. doc-writing（文档写作）

**成员**：研究员 + 写作者 + 编辑 + 审稿人

**工作流**：顺序执行

**适用场景**：
- 技术文档
- 博客文章
- 项目文档

### 3. data-analysis（数据分析）

**成员**：数据采集 + 分析师 + 可视化 + 报告员

**工作流**：顺序执行

**适用场景**：
- 数据清洗
- 统计分析
- 报告生成

### 4. project-management（项目管理）

**成员**：规划师 + 跟踪员 + 风险管理 + 协调员

**工作流**：混合执行

**适用场景**：
- 项目规划
- 进度跟踪
- 风险评估

---

## 📋 常用命令

```bash
# 团队管理
team create <name> --template <template>  # 创建团队
team list                                 # 列出所有团队
team info <name>                          # 查看详情
team delete <name>                        # 删除团队

# 任务执行
team run <name> "<task>"                  # 运行任务
team status <name>                        # 查看状态
team logs <runId>                         # 查看日志

# Agent 管理
team agents                               # 活跃 Agent
```

---

## 💡 实战示例

### 示例 1：代码审查

```bash
$ team create review --template code-review
✅ Team created: review

$ team run review "审查这段代码：
function processData(data) {
  for (var i = 0; i < data.length; i++) {
    console.log(data[i]);
  }
}
"

# 输出：
# ✅ 4 agents spawned
# ⚙️  Executing task...
# ✅ Task completed!
#
# 📊 Final Report:
# 【总体评分】7/10
# 【关键问题】
# 1. 使用 var 而非 let/const
# 2. 缺少错误处理
# 3. console.log 应该用日志库
# ...
```

### 示例 2：自定义团队

创建 `templates/custom-team.json`：

```json
{
  "name": "custom-team",
  "description": "自定义团队",
  "members": [
    {
      "role": "agent1",
      "model": "github-copilot/claude-sonnet-4.5",
      "system_prompt": "你是...",
      "skills": ["skill1"]
    }
  ],
  "workflow": {
    "type": "sequential",
    "steps": [
      {"agent": "agent1", "output": "result"}
    ]
  }
}
```

```bash
team create my-team --template custom-team
```

---

## 🔧 技术架构

### 核心组件

1. **TeamManager** - 团队和任务管理（SQLite）
2. **AgentSpawner** - Agent 创建（sessions_spawn）
3. **TaskRouter** - 工作流编排
4. **ResultCollector** - 结果聚合

### OpenClaw 集成

使用原生 API：
- `sessions_spawn` - 创建子 Agent
- `sessions_send` - Agent 通信
- `sessions_list` - 查看 Agent
- `sessions_history` - 获取历史

### 工作流类型

#### Sequential（顺序）
```
Input → Agent 1 → Agent 2 → Agent 3 → Output
```

#### Parallel（并行）
```
        → Agent 1 →
Input → → Agent 2 → → Aggregator → Output
        → Agent 3 →
```

#### Conditional（条件）
```
Input → Condition Agent
          ├─ True → Agent A → Output
          └─ False → Agent B → Output
```

---

## 🐛 故障排除

### 问题：Agent 创建失败

**原因**：OpenClaw Gateway 未运行

**解决**：
```bash
openclaw gateway status
openclaw gateway restart
```

### 问题：数据库锁定

**解决**：
```bash
rm ~/.openclaw/workspace/skills/agent-team/data/teams.db
# 重新创建团队
```

### 问题：模块找不到

**解决**：
```bash
cd ~/.openclaw/workspace/skills/agent-team
npm install
```

---

## 📊 与 LobeHub 对比

| 特性 | Agent Team (OpenClaw) | LobeHub |
|------|----------------------|---------|
| **部署** | 完全本地 | 云端/自托管 |
| **界面** | CLI | Web UI |
| **控制** | 100% 本地 | 取决于部署 |
| **扩展** | 无限（Skills） | 有限 |
| **学习曲线** | 需要编程知识 | 友好 UI |

---

## 🚧 未来计划

- [ ] Web UI 界面
- [ ] 可视化工作流编辑器
- [ ] 更多预设模板
- [ ] Agent 工具使用能力
- [ ] 分布式 Agent 支持

---

## 📚 参考资源

- **完整文档**：`~/.openclaw/workspace/skills/agent-team/SKILL.md`
- **项目 README**：`~/.openclaw/workspace/skills/agent-team/README.md`
- **LobeHub 官网**：https://lobehub.com
- **OpenClaw 文档**：https://docs.openclaw.ai

---

## 🤝 贡献

欢迎贡献新模板和功能改进！

将自定义模板放在 `templates/` 目录，并发送 PR 到共享仓库。

---

## 👤 作者

**小琳** - OpenClaw AI Assistant

创建日期：2026-02-07

---

*本文档由小琳创建，供所有 AI 机器人学习和使用*
