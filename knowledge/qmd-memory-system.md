# 🧠 qmd 本地记忆系统集成指南

> 通过 qmd + MCP 实现 Agent 精准记忆检索，Token 消耗降低 90%

## 1. 核心价值

| 传统方案 | qmd 方案 |
|:---------|:---------|
| 每次把整个 MEMORY.md 塞进 context | Agent 先检索，只取相关片段 |
| 2000 Token 的记忆 → 2000 Token 消耗 | 2000 Token 的记忆 → 200 Token 消耗 |
| 大量无关内容干扰模型 | 精准内容提升准确度 |
| 依赖云端 API | 完全本地运行，零 API 成本 |

**实测效果**：
- 混合搜索准确率：**93%**
- Token 消耗：降低约 **90%**

---

## 2. qmd 是什么

qmd 是 Shopify 创始人 Tobi 用 Rust 写的本地语义搜索引擎，专为 AI Agent 设计。

**核心特性**：
- 支持 Markdown 笔记、会议记录、文档等
- 混合搜索：BM25 全文 + 向量语义 + LLM 重排序
- 完全本地运行，使用 GGUF 模型
- 原生 MCP 集成

**自动下载的模型**：
- Embedding：jina-embeddings-v3（~330MB）
- Reranker：jina-reranker-v2-base-multilingual（~640MB）

---

## 3. 安装步骤

### 3.1 安装依赖

```bash
# 安装 unzip（bun 安装需要）
sudo apt-get install -y unzip

# 安装 bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 安装 qmd
bun install -g https://github.com/tobi/qmd
```

### 3.2 验证安装

```bash
qmd --version
```

首次运行会自动下载模型，需要等待几分钟。

---

## 4. 创建记忆库

### 4.1 为 OpenClaw 工作区创建记忆库

```bash
cd ~/.openclaw/workspace

# 创建日常日志库（memory 目录）
qmd collection add memory/*.md --name daily-logs
qmd embed daily-logs memory/*.md

# 创建工作空间库（根目录核心文件）
qmd collection add *.md --name workspace
qmd embed workspace *.md

# 创建学习笔记库
qmd collection add learnings/*.md --name learnings
qmd embed learnings learnings/*.md
```

### 4.2 查看集合列表

```bash
qmd list
```

---

## 5. 测试检索

```bash
# 混合搜索（推荐，准确率最高）
qmd search daily-logs "钉钉消息处理" --hybrid

# 纯语义搜索
qmd search daily-logs "如何回复群消息"

# 关键词搜索
qmd search workspace "chat-hub"
```

---

## 6. MCP 集成配置

### 6.1 OpenClaw 配置

在 `~/.openclaw/openclaw.json` 中添加 MCP 服务：

```json
{
  "mcpServers": {
    "qmd": {
      "command": "/home/maple/.bun/bin/qmd",
      "args": ["mcp"]
    }
  }
}
```

### 6.2 可用的 MCP 工具

| 工具 | 说明 |
|:-----|:-----|
| `query` | 混合搜索（推荐，精度最高） |
| `vsearch` | 纯语义检索 |
| `search` | 关键词检索 |
| `get` | 根据 ID 获取文档内容 |
| `multi_get` | 批量获取文档内容 |
| `status` | 健康检查 |

---

## 7. 自动更新 Embedding

### 7.1 添加到 HEARTBEAT.md

```markdown
### qmd 记忆库更新（每日 1-2 次）

检查 memory/ 目录是否有新文件，如有则更新：

```bash
cd ~/.openclaw/workspace
qmd embed daily-logs memory/*.md
qmd embed workspace *.md
qmd embed learnings learnings/*.md
```
```

### 7.2 或使用 cron 任务

```bash
# 每 6 小时更新一次
0 */6 * * * cd ~/.openclaw/workspace && qmd embed daily-logs memory/*.md && qmd embed workspace *.md
```

---

## 8. 使用流程

```
用户提问
    │
    ▼
┌─────────────────┐
│ Agent 调用 qmd  │  ← MCP: query "用户问题关键词"
│ 检索相关记忆    │
└────────┬────────┘
         │ 返回 200 Token 精准片段
         ▼
┌─────────────────┐
│ 拼接到提示词    │
│ 发送给大模型    │
└────────┬────────┘
         │
         ▼
     准确回答
```

**对比**：
- ❌ 传统：直接把 2000 Token 的 MEMORY.md 塞进去
- ✅ qmd：先检索，只取 200 Token 相关内容

---

## 9. 适用场景

| 场景 | 效果 |
|:-----|:-----|
| 回忆用户偏好 | Token 减少 90% |
| 跨文件知识检索 | 准确率 93% |
| 历史对话查询 | 无需手动指定文件 |
| 项目知识库 | 精准定位相关文档 |

---

## 10. 我们的应用计划

### 10.1 为 AI 聊天室集成

- 将聊天历史索引到 qmd
- 小琳/小猪可以精准回忆"之前讨论过什么"

### 10.2 为 MapleAI 集成

- 用户知识库使用 qmd 检索
- 降低 RAG 的 Token 消耗

---

*创建日期：2026-02-06*
*来源：qmd + MCP + OpenClaw 集成方案*
