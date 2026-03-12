# Golutra 项目参考分析报告

> **声明**：本报告仅作设计参考分析，不复制任何代码实现。所有分析基于对架构、设计模式和用户体验的理解。

---

## 一、项目概述

**Golutra** 是一个基于 Tauri 的跨平台桌面应用，定位为"多智能体工作空间"。核心理念是将现有的 CLI 工具（Claude Code、Gemini CLI、Codex、OpenCode、Qwen Code 等）升级为统一的 AI 协作中枢。

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面容器 | Tauri (Rust + WebView) |
| 前端 | Vue 3 + TypeScript + Pinia |
| 终端渲染 | xterm.js |
| 国际化 | vue-i18n |
| 样式 | Tailwind CSS |

---

## 二、好友系统设计分析

### 2.1 核心概念

Golutra 的"好友系统"实际上是一个**成员管理系统**，而非传统的社交好友系统。核心概念包括：

```
┌─────────────────────────────────────────────────────────────┐
│                      Workspace (工作区)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Members (成员)                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐│   │
│  │  │  Owner  │  │  Admin  │  │Assistant│  │ Member  ││   │
│  │  │ (人类)  │  │ (人类)  │  │  (AI)   │  │ (人类)  ││   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Contacts (联系人)                    │   │
│  │         全局联系人，跨工作区持久化                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 成员类型与角色

| 角色类型 | 说明 | 终端能力 |
|---------|------|---------|
| `owner` | 工作区所有者 | 无 |
| `admin` | 管理员（人类） | 无 |
| `assistant` | AI 助手 | 有（Claude、Gemini 等） |
| `member` | 普通成员 | 可选 |

### 2.3 双层好友架构

**设计亮点**：采用"项目成员 + 全局联系人"双层架构

1. **项目成员（Project Friends）**
   - 绑定到特定 Workspace
   - 存储在项目数据文件中
   - 包含终端配置信息

2. **全局联系人（Global Friends）**
   - 跨工作区持久化
   - 存储在本地存储中
   - 可快速添加到新项目

### 2.4 成员状态系统

```
MemberStatus: 'online' | 'working' | 'dnd' | 'offline'
TerminalStatus: 'connecting' | 'connected' | 'working' | 'disconnected' | 'pending'
```

**设计特点**：
- 分离"用户手动状态"和"终端连接状态"
- 双状态点指示器（一个点显示用户状态，一个点显示终端状态）
- 状态有优先级逻辑：终端成员不显示 'working' 用户状态

### 2.5 可借鉴设计

1. **统一成员抽象**：AI 和人类使用相同的 Member 数据结构，便于统一管理
2. **分层存储**：项目级成员数据 + 全局联系人列表
3. **状态分离**：手动状态与系统状态分开管理
4. **邀请流程**：区分 Admin/Assistant/Member 三种邀请入口

---

## 三、Agent 与用户关系分析

### 3.1 关系模型

```
┌─────────────────────────────────────────────────────────┐
│                     Workspace                             │
│                                                          │
│   User (Owner)                                           │
│       │                                                  │
│       ├── 拥有 ──→ Workspace                             │
│       │                                                  │
│       ├── 管理 ──→ Members (包括 AI Agents)              │
│       │                                                  │
│       └── 通过 Chat 与 Agent 交互                         │
│                  │                                       │
│                  ↓                                       │
│          ┌──────────────┐                               │
│          │ Conversation │                               │
│          │  (会话/频道)  │                               │
│          └──────────────┘                               │
│                  │                                       │
│                  ↓                                       │
│          ┌──────────────┐                               │
│          │   Terminal   │                               │
│          │   (执行层)    │                               │
│          └──────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Agent 的定义

在 Golutra 中，Agent 被定义为 `assistant` 角色的成员：

```typescript
// Agent 成员的关键属性
{
  roleType: 'assistant',
  terminalType: 'claude' | 'gemini' | 'codex' | 'qwen' | 'opencode',
  terminalCommand: 'claude',  // 启动命令
  terminalStatus: 'connected' | 'working' | ...,
  unlimitedAccess: boolean,   // 是否有完整文件系统访问权限
  sandboxed: boolean          // 是否沙箱化
}
```

### 3.3 交互模式

1. **Chat 交互**：用户在聊天界面 @ Agent
2. **终端注入**：直接向 Agent 的终端会话注入命令
3. **自动调度**：根据对话内容自动派发任务给 Agent

### 3.4 设计亮点

1. **Agent = 成员**：Agent 被视为工作区的"虚拟成员"，拥有与人类成员相似的数据结构
2. **终端绑定**：每个 Agent 绑定一个终端会话，执行实际工作
3. **权限分级**：通过 `unlimitedAccess` 和 `sandboxed` 控制 Agent 的能力边界

---

## 四、角色系统分析

### 4.1 终端成员注册表设计

Golutra 在 Rust 端实现了优雅的终端成员注册表：

```
TerminalDefaultMemberConfig
├── id: 成员标识
├── terminal_type: 终端类型 (claude, gemini, codex...)
├── default_command: 默认启动命令
├── unlimited_access_flag: 无限制访问标志
├── resume_command_template: 会话恢复模板
└── post_ready_plan: 终端就绪后执行计划
```

### 4.2 预定义 Agent 配置

| Agent | 默认命令 | 无限制标志 | 特点 |
|-------|---------|-----------|------|
| Claude | `claude` | `--dangerously-skip-permissions` | 安全性跳过 |
| Gemini | `gemini` | `--yolo` | 直接执行模式 |
| Codex | `codex` | - | OpenAI 代码助手 |
| Qwen | `qwen` | - | 阿里通义 |
| OpenCode | `opencode` | - | 开源代码助手 |
| Shell | - | - | 纯终端 |

### 4.3 就绪后执行计划（Post Ready Plan）

**设计亮点**：终端就绪后自动执行的步骤链

```
TerminalPostReadyStep:
├── Input: 输入特定字符串
├── ExtractSessionId: 提取会话 ID
├── WaitForPattern: 等待特定输出模式
└── Introduction: 插入引导提示词
```

这允许在 Agent 启动后自动进行初始化操作，例如：
- 发送 onboarding 提示词
- 提取会话 ID 以便后续恢复
- 等待 Agent 准备就绪

### 4.4 可借鉴设计

1. **配置注册表模式**：用静态配置替代硬编码逻辑
2. **标志位管理**：统一管理不同 Agent 的特殊参数
3. **会话恢复**：通过模板支持会话恢复
4. **后置钩子**：支持终端就绪后的自动化操作

---

## 五、UI/UX 设计分析

### 5.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│ [自定义标题栏]                    [最小化] [最大化] [关闭] │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  侧边栏   │              主内容区域                       │
│          │                                              │
│  - Chat  │   ┌─────────────────────────────────────┐   │
│  - Friends│   │                                     │   │
│  - Store │   │    根据当前 Tab 切换内容              │   │
│  - Plugins│   │                                     │   │
│  - Settings│   └─────────────────────────────────────┘   │
│  - Workspaces│                                           │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### 5.2 关键 UI 组件

#### 5.2.1 FriendsView（好友列表）

**设计特点**：
- 分组显示：项目成员 vs 全局联系人
- 卡片式布局：响应式网格（2-3列）
- 快捷操作：发消息、状态菜单、删除
- 头像点击打开终端（AI 成员）
- 状态指示器：双点设计（用户状态 + 终端状态）

#### 5.2.2 InviteMenu（邀请菜单）

**设计特点**：
- 三种邀请入口：Admin、Assistant、Member
- 图标 + 标题 + 描述的组合
- Hover 动效：背景色变化 + 阴影
- 毛玻璃背景效果

#### 5.2.3 MemberStatusDots（状态指示器）

**设计特点**：
- 双点设计：一个显示用户状态，一个显示终端状态
- Hover 显示详细状态 Tooltip
- Tooltip 自动定位：避免超出视口
- 视觉层次：当前状态高亮

### 5.3 视觉设计语言

| 元素 | 设计 |
|------|------|
| 颜色主题 | 深色主题，primary 强调色 |
| 圆角 | 大圆角（rounded-xl, rounded-2xl） |
| 间距 | 宽松的 padding 和 gap |
| 动效 | 微妙的 transition 和 hover 效果 |
| 毛玻璃 | backdrop-blur 实现半透明效果 |
| 图标 | Material Symbols Outlined |

### 5.4 可借鉴设计

1. **双层状态指示器**：同时展示用户状态和系统状态
2. **分组卡片布局**：项目成员与全局联系人的清晰分离
3. **邀请分类入口**：不同角色类型的独立邀请流程
4. **Tooltip 智能定位**：自动调整位置避免溢出
5. **深色主题一致性**：统一的视觉语言

---

## 六、设计模式分析

### 6.1 架构分层

```
┌────────────────────────────────────────────┐
│              UI Gateway (Tauri Commands)    │
├────────────────────────────────────────────┤
│              Application Layer              │
│          (chat, command, project)           │
├────────────────────────────────────────────┤
│              Orchestration Layer            │
│     (dispatch, chat_outbox, terminal_*)     │
├────────────────────────────────────────────┤
│              Domain Services                │
│    (message_service, terminal_engine)       │
├────────────────────────────────────────────┤
│              Runtime / Storage              │
└────────────────────────────────────────────┘
```

### 6.2 前端状态管理

**Pinia Store 分层**：

```
stores/
├── workspaceStore.ts      # 工作区管理
├── projectStore.ts        # 项目数据（成员、技能、路线图）
├── chatStore.ts           # 聊天状态
├── contactsStore.ts       # 联系人状态
├── terminalOrchestratorStore.ts  # 终端协调
├── terminalMemberStore.ts        # 终端成员
├── toastStore.ts          # 通知
└── navigationStore.ts     # 导航
```

### 6.3 关键设计模式

#### 6.3.1 Composable 模式

`useFriendInvites` 是一个典型的 Composable，封装了：
- 邀请菜单状态
- 邀请处理逻辑
- 与多个 Store 的交互

```typescript
// Composable 职责聚合
export const useFriendInvites = () => {
  // 聚合多个 Store
  const projectStore = useProjectStore();
  const chatStore = useChatStore();
  const terminalOrchestratorStore = useTerminalOrchestratorStore();
  
  // 封装业务逻辑
  const handleInvite = async (model, type) => { ... };
  
  return {
    showInviteMenu,
    handleInvite,
    // ...
  };
};
```

#### 6.3.2 数据规范化模式

`projectStore.ts` 中的数据规范化设计：

```typescript
// 输入：可能不完整的成员数据
// 输出：完整、一致的成员数据
const normalizeMembers = (members: Member[]) =>
  members.map((member) => {
    // 补齐缺失字段
    // 修正不一致数据
    // 提供默认值
  });
```

#### 6.3.3 终端协调器模式

`terminalOrchestratorStore` 作为终端调用的统一入口：

```typescript
// 统一的终端调用入口
const ensureMemberSession = async (member, options) => {
  // 1. 检查终端配置
  // 2. 调用底层 terminalMemberStore
  // 3. 错误处理和资源限制通知
};

// 消息派发到终端
const dispatchConversationToTerminals = async (payload) => {
  // 1. 解析 @mentions
  // 2. 确定目标 Agent
  // 3. 串行派发任务
};
```

#### 6.3.4 注册表模式

Rust 端的终端成员注册表：

```rust
// 静态配置注册表
pub(crate) const DEFAULT_TERMINAL_MEMBERS: [TerminalDefaultMemberConfig; 6] = [
    GEMINI_DEFAULT_MEMBER,
    CODEX_DEFAULT_MEMBER,
    // ...
];

// 运行时查询
pub(crate) fn resolve_default_member(terminal_type: &str) 
    -> Option<&'static TerminalDefaultMemberConfig> {
    DEFAULT_TERMINAL_MEMBERS.iter()
        .find(|member| member.terminal_type == normalized)
}
```

### 6.4 可借鉴设计模式

1. **分层架构**：清晰的 UI Gateway → Application → Orchestration → Domain 分层
2. **Composable 封装**：将复杂业务逻辑封装为可复用的 Composable
3. **数据规范化**：统一处理输入数据，保证一致性
4. **协调器模式**：为跨模块操作提供统一入口
5. **配置注册表**：用静态配置替代硬编码，便于扩展

---

## 七、对 MapleClaw 的借鉴建议

### 7.1 好友/成员系统

1. **采用双层架构**：项目成员 + 全局联系人
2. **统一成员抽象**：AI Agent 和人类用户使用相同的数据结构
3. **分离状态管理**：手动状态与系统状态分开存储

### 7.2 Agent 管理

1. **终端绑定设计**：每个 Agent 关联一个终端会话
2. **权限分级**：通过标志位控制 Agent 的能力范围
3. **后置钩子**：支持 Agent 启动后的自动化初始化

### 7.3 UI/UX

1. **状态指示器**：双点设计，同时显示用户状态和系统状态
2. **分组布局**：清晰区分项目成员和全局联系人
3. **邀请入口**：区分不同角色类型的邀请流程

### 7.4 架构设计

1. **分层架构**：前后端都采用清晰的分层设计
2. **Composable 模式**：封装复杂业务逻辑
3. **注册表模式**：Agent 配置采用静态注册表

---

## 八、总结

Golutra 的设计体现了几个核心理念：

1. **Agent 即成员**：将 AI Agent 视为工作区的"虚拟成员"，与人类用户使用统一的抽象
2. **终端为中心**：Agent 的能力通过终端会话实现，终端是执行层
3. **分层解耦**：通过清晰的分层架构和协调器模式，实现模块间的松耦合
4. **配置驱动**：使用静态配置注册表，便于扩展新的 Agent 类型

这些设计理念对于构建一个多 Agent 协作系统具有很好的参考价值。

---

*报告生成时间：2026-03-12*