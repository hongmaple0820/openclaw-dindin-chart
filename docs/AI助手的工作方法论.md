# AI 助手的工作方法论

> 作者：小琳 ✨  
> 日期：2026-02-07  
> 主题：如何像人类一样思考、规划和完成复杂任务

---

## 📋 目录

1. [核心理念](#核心理念)
2. [思考框架](#思考框架)
3. [工具使用](#工具使用)
4. [实战案例](#实战案例)
5. [经验总结](#经验总结)

---

## 核心理念

### 🎯 1. 主动思考，不要被动执行

**❌ 错误示范：**
```
用户："帮我做个 PPT"
AI："好的，请提供内容"
```

**✅ 正确做法：**
```
用户："帮我做个 PPT"
AI：先思考几个问题：
  1. PPT 主题是什么？
  2. 目标受众是谁？
  3. 需要多少页？
  4. 有什么素材可用？
  
然后制定计划：
  1. 用 think 工具分析需求
  2. 用 Marp 生成 PPT
  3. 用 Mermaid 画配图
  4. 输出最终文件
```

**关键区别：**
- 被动执行只会做最少的事
- 主动思考会把任务做完整

---

### 🧠 2. 使用 MCP think 工具结构化思考

**什么时候用 think？**
- 任务复杂，需要多步骤
- 需要分析利弊、做决策
- 要规划方案、制定计划
- 遇到问题需要推理

**think 工具的使用：**
```javascript
// 第一步：分析问题
think({
  thought: "用户要做 PPT，需要确定：主题、页数、工具",
  thoughtNumber: 1,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

// 第二步：选择工具
think({
  thought: "Marp 适合技术类 PPT，支持 Markdown，可以用 Mermaid 画图",
  thoughtNumber: 2,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

// 第三步：规划内容
think({
  thought: "PPT 结构：封面 → 目录 → 正文 → 总结，每页一个核心观点",
  thoughtNumber: 3,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

// 第四步：确定行动
think({
  thought: "先创建 Markdown 文件，用 Mermaid 画流程图，最后用 Marp 渲染",
  thoughtNumber: 4,
  totalThoughts: 4,
  nextThoughtNeeded: false
});
```

**效果：**
- 思路清晰，不遗漏
- 方案合理，有依据
- 执行高效，少返工

---

### 🔧 3. 灵活组合工具，不要单打独斗

**可用工具清单：**

| 分类 | 工具 | 用途 |
|---|---|---|
| **思考** | think | 结构化推理 |
| **文件** | read/write/edit | 读写编辑文件 |
| **执行** | exec | 运行命令 |
| **搜索** | web_search/web_fetch | 搜索和抓取网页 |
| **浏览器** | browser | 自动化操作网页 |
| **绘图** | Mermaid (exec) | 流程图、架构图 |
| **PPT** | Marp (exec) | Markdown 转 PPT |
| **数据库** | sqlite_query | 查询和管理数据 |
| **消息** | message | 发送通知 |

**组合使用示例：**

#### 场景 1：做技术分享 PPT
```
1. think - 规划 PPT 结构
2. web_search - 搜索相关资料
3. write - 创建 Markdown 文件
4. exec (mmdc) - 生成配图
5. exec (marp) - 渲染 PPT
6. message - 发送完成通知
```

#### 场景 2：画系统架构图
```
1. think - 分析系统组件和关系
2. write - 创建 Mermaid 脚本
3. exec (mmdc) - 渲染成 PNG
4. read - 验证输出
```

#### 场景 3：抓取网页数据
```
1. think - 确定抓取策略
2. browser - 打开网页
3. browser (snapshot) - 获取页面结构
4. browser (act) - 点击和提取数据
5. sqlite_query - 存入数据库
```

---

## 思考框架

### 📊 1. 问题分解法（适合复杂任务）

**步骤：**
1. **理解目标** - 用户到底要什么？
2. **拆解子任务** - 分成几个独立步骤？
3. **识别依赖** - 哪些步骤必须先做？
4. **选择工具** - 每步用什么工具？
5. **执行验证** - 每步完成后检查结果

**案例：做一份数据报告**

```
目标：生成 2024 年销售数据报告（PDF）

拆解：
  1. 从数据库读取数据
  2. 用 Python 分析和可视化
  3. 用 Quarto 写报告
  4. 渲染成 PDF

依赖：
  1 → 2 → 3 → 4（必须按顺序）

工具：
  1. sqlite_query
  2. exec (python)
  3. write (QMD 文件)
  4. exec (quarto render)

验证：
  - 每步完成后检查输出文件
  - 最终打开 PDF 确认
```

---

### 🎯 2. 目标倒推法（适合不确定的需求）

**步骤：**
1. **假设最终结果** - 如果做好了是什么样？
2. **倒推必要条件** - 要达成结果需要什么？
3. **识别缺失信息** - 哪些信息还不知道？
4. **主动询问** - 向用户确认细节
5. **执行计划** - 按倒推的步骤做

**案例：用户说"帮我准备明天的会议"**

```
倒推：
  最终结果 = 会议 PPT + 演讲稿

  需要什么？
    - 会议主题
    - 参会人员
    - 时长
    - 重点内容

  缺失信息：
    - 主题不明确
    - 时长不知道

  主动询问：
    "会议主题是什么？大概多长时间？"

  执行：
    1. 根据回答规划内容
    2. 创建 PPT 和演讲稿
    3. 发送给用户确认
```

---

### 🔄 3. 迭代优化法（适合需要调整的任务）

**步骤：**
1. **快速出初版** - 不求完美，先有个东西
2. **展示给用户** - 让用户看到并反馈
3. **收集意见** - 哪里需要改？
4. **迭代优化** - 逐步完善
5. **确认完成** - 用户满意为止

**案例：设计一个 Logo**

```
初版：
  - 简单的文字 + 图形
  - 2-3 个配色方案

展示：
  "这是三个方案，您觉得哪个方向更好？"

迭代：
  - 调整颜色
  - 修改图形
  - 尝试不同字体

完成：
  "最终版本如附件，满意吗？"
```

---

## 工具使用

### 🎨 1. Mermaid 绘图

**支持的图表类型：**
- 流程图（flowchart）
- 时序图（sequenceDiagram）
- 类图（classDiagram）
- 状态图（stateDiagram）
- 甘特图（gantt）
- ER 图（erDiagram）

**完整流程：**

#### 第 1 步：用 think 规划图表
```javascript
think({
  thought: "要画聊天系统的架构图，包括：钉钉、chat-hub、Redis、AI",
  thoughtNumber: 1,
  totalThoughts: 2,
  nextThoughtNeeded: true
});

think({
  thought: "用 flowchart 类型，从上到下布局，用箭头表示消息流向",
  thoughtNumber: 2,
  totalThoughts: 2,
  nextThoughtNeeded: false
});
```

---

#### 第 2 步：创建 Mermaid 脚本
```javascript
write({
  path: "architecture.mmd",
  content: `graph TD
    A[钉钉群聊] -->|Webhook| B[chat-hub]
    B -->|存储| C[SQLite]
    B -->|通知| D[Redis]
    D -->|Pub/Sub| E[OpenClaw]
    E -->|处理| F[小琳]
    E -->|处理| G[小猪]
    F -->|回复| B
    G -->|回复| B
    B -->|发送| A
    
    style B fill:#f9f,stroke:#333,stroke-width:4px
    style D fill:#bbf,stroke:#333,stroke-width:2px`
});
```

---

#### 第 3 步：安装中文字体（如果是第一次）
```bash
# 检查是否需要安装
fc-list | grep -i "wqy\|noto\|source"

# 如果没有输出，需要安装
sudo apt-get install -y fonts-wqy-microhei fonts-wqy-zenhei

# 刷新字体缓存
fc-cache -fv
```

---

#### 第 4 步：配置 Puppeteer（WSL 环境）
```javascript
write({
  path: "puppeteer-config.json",
  content: JSON.stringify({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  })
});
```

---

#### 第 5 步：渲染图片
```bash
# 基础命令
mmdc -i architecture.mmd -o architecture.png

# WSL 环境完整命令
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  mmdc -i architecture.mmd -o architecture.png -p puppeteer-config.json
```

---

#### 第 6 步：验证输出
```javascript
exec({ command: "ls -lh architecture.png" });
// 检查文件大小，确认生成成功
```

---

### 📊 2. Marp 制作 PPT

**完整流程：**

#### 第 1 步：规划 PPT 结构
```javascript
think({
  thought: "PPT 主题：OpenClaw 入门，目标：新手能快速上手",
  thoughtNumber: 1,
  totalThoughts: 3,
  nextThoughtNeeded: true
});

think({
  thought: "结构：封面 → 什么是 OpenClaw → 核心功能 → 快速开始 → Q&A",
  thoughtNumber: 2,
  totalThoughts: 3,
  nextThoughtNeeded: true
});

think({
  thought: "每页一个核心观点，配图 + 代码示例，用 Mermaid 画架构图",
  thoughtNumber: 3,
  totalThoughts: 3,
  nextThoughtNeeded: false
});
```

---

#### 第 2 步：创建 Markdown 文件
```markdown
---
marp: true
theme: default
paginate: true
---

# OpenClaw 入门指南

快速上手 AI 助手框架

---

## 什么是 OpenClaw？

- 🤖 个人 AI 助手框架
- 🔧 支持多种 AI 模型
- 📱 集成消息平台（钉钉、Telegram）
- 🌐 浏览器自动化

---

## 系统架构

![architecture](architecture.png)

---

## 快速开始

```bash
# 安装
npm install -g openclaw

# 初始化
openclaw wizard

# 启动
openclaw gateway
```

---

## Q&A

有问题随时问！

📧 Email: support@openclaw.ai
🌐 Docs: docs.openclaw.ai
```

---

#### 第 3 步：渲染 PPT
```bash
# HTML 格式（推荐，方便分享）
marp --no-stdin slides.md -o slides.html

# PDF 格式
marp --no-stdin slides.md --pdf -o slides.pdf

# PPTX 格式（需要 Office）
marp --no-stdin slides.md --pptx -o slides.pptx
```

**注意：** 必须加 `--no-stdin`，否则会卡住！

---

#### 第 4 步：验证输出
```javascript
exec({ command: "ls -lh slides.*" });
// 检查生成的文件
```

---

### 🌐 3. 浏览器自动化

**完整流程：**

#### 第 1 步：规划操作步骤
```javascript
think({
  thought: "目标：在阿里云注册账号并获取 API Key",
  thoughtNumber: 1,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "步骤：打开网站 → 登录 → 进入 API Key 管理 → 创建 Key → 复制",
  thoughtNumber: 2,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "需要用户提供：用户名、密码（或让用户手动登录）",
  thoughtNumber: 3,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "安全考虑：敏感操作让用户手动完成，AI 只负责导航和截图",
  thoughtNumber: 4,
  totalThoughts: 4,
  nextThoughtNeeded: false
});
```

---

#### 第 2 步：打开浏览器
```javascript
browser({
  action: "open",
  profile: "openclaw",
  targetUrl: "https://dashscope.console.aliyun.com/"
});
```

---

#### 第 3 步：导航和截图
```javascript
// 等待页面加载
browser({
  action: "snapshot",
  profile: "openclaw",
  targetId: "xxx"  // 从上一步返回
});

// 找到"API Key 管理"按钮并点击
browser({
  action: "act",
  profile: "openclaw",
  targetId: "xxx",
  request: {
    kind: "click",
    ref: "button[aria-label='API Key管理']"
  }
});
```

---

#### 第 4 步：提示用户
```
"浏览器已打开 API Key 管理页面，请手动创建 Key 并复制给我"
```

---

### 📊 4. 数据处理和可视化

**完整流程：**

#### 第 1 步：从数据库读取
```javascript
sqlite_query({
  sql: "SELECT month, SUM(amount) as total FROM sales GROUP BY month",
  database: "~/.openclaw/data/sales.db"
});
```

---

#### 第 2 步：用 Python 分析
```python
import pandas as pd
import matplotlib.pyplot as plt

# 读取数据
data = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    'total': [150000, 200000, 180000, 220000, 250000]
})

# 绘图
plt.figure(figsize=(10, 6))
plt.bar(data['month'], data['total'])
plt.title('月度销售额')
plt.xlabel('月份')
plt.ylabel('销售额（元）')
plt.savefig('sales.png')
```

---

#### 第 3 步：生成报告（Quarto）
```markdown
---
title: "2024 年销售报告"
format: pdf
---

## 执行摘要

总销售额：¥1,000,000

## 月度趋势

![月度销售额](sales.png)

## 结论

销售呈上升趋势，预计...
```

---

#### 第 4 步：渲染
```bash
quarto render report.qmd
```

---

## 实战案例

### 案例 1：技术分享 PPT

**任务：** 做一个"如何配置免费大模型"的 PPT

**思考过程：**
```javascript
// 第 1 步：分析需求
think({
  thought: "目标受众：新手，需要简单易懂，配图 + 代码示例",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// 第 2 步：规划结构
think({
  thought: "结构：封面 → 为什么免费模型 → 模型对比 → 配置步骤 → 常见问题",
  thoughtNumber: 2,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// 第 3 步：选择工具
think({
  thought: "用 Marp 做 PPT，用 Mermaid 画对比表格和流程图",
  thoughtNumber: 3,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// 第 4 步：准备素材
think({
  thought: "从 MEMORY.md 读取模型配置经验，从文档读取代码示例",
  thoughtNumber: 4,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// 第 5 步：执行
think({
  thought: "创建 Markdown → 画配图 → 渲染 PPT → 验证",
  thoughtNumber: 5,
  totalThoughts: 5,
  nextThoughtNeeded: false
});
```

**执行步骤：**
1. `read MEMORY.md` - 读取模型配置经验
2. `write slides.md` - 创建 PPT 内容
3. `write comparison.mmd` - 创建对比图
4. `exec mmdc ...` - 渲染对比图
5. `exec marp ...` - 渲染 PPT
6. `read slides.html` - 验证输出

---

### 案例 2：系统架构图

**任务：** 画 chat-hub 的架构图

**思考过程：**
```javascript
think({
  thought: "chat-hub 包含：钉钉、chat-hub、SQLite、Redis、OpenClaw、小琳、小猪",
  thoughtNumber: 1,
  totalThoughts: 3,
  nextThoughtNeeded: true
});

think({
  thought: "消息流向：钉钉 → chat-hub → Redis → OpenClaw → AI → 回复",
  thoughtNumber: 2,
  totalThoughts: 3,
  nextThoughtNeeded: true
});

think({
  thought: "用 flowchart TD（从上到下），重点标注 chat-hub 和 Redis",
  thoughtNumber: 3,
  totalThoughts: 3,
  nextThoughtNeeded: false
});
```

**执行步骤：**
1. `write architecture.mmd` - 创建 Mermaid 脚本
2. `write puppeteer-config.json` - 配置沙盒
3. `exec mmdc ...` - 渲染 PNG
4. `exec ls -lh architecture.png` - 验证输出

---

### 案例 3：网页数据抓取

**任务：** 抓取阿里云产品价格

**思考过程：**
```javascript
think({
  thought: "目标：获取百炼和火山方舟的免费额度信息",
  thoughtNumber: 1,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "策略：用 browser 打开页面 → snapshot 获取结构 → 提取文本",
  thoughtNumber: 2,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "安全：只读取公开信息，不登录，不保存敏感数据",
  thoughtNumber: 3,
  totalThoughts: 4,
  nextThoughtNeeded: true
});

think({
  thought: "备选：如果 browser 不可用，用 web_fetch 抓取 HTML",
  thoughtNumber: 4,
  totalThoughts: 4,
  nextThoughtNeeded: false
});
```

**执行步骤：**
1. `browser open` - 打开页面
2. `browser snapshot` - 获取页面结构
3. `browser act (click)` - 点击"价格"标签
4. `browser snapshot` - 再次获取
5. 提取文本并整理

---

## 经验总结

### ✅ 成功经验

1. **先思考再行动**
   - 用 think 工具规划方案
   - 识别依赖和风险
   - 选择合适的工具

2. **主动补充信息**
   - 用户需求不明确时主动问
   - 提供多个方案供选择
   - 预判可能的问题

3. **灵活组合工具**
   - 不局限于单一工具
   - 根据任务选择最佳组合
   - 遇到限制时换方案

4. **验证每一步**
   - 执行后检查输出
   - 发现问题立即调整
   - 最终确认用户满意

5. **记录和分享**
   - 把经验写入 MEMORY.md
   - 整理成文档放知识库
   - 帮助其他 AI 学习

---

### ❌ 常见错误

1. **不思考直接执行**
   - 结果往往不符合预期
   - 浪费时间和资源

2. **只用一个工具**
   - 遇到限制就卡住
   - 不会变通

3. **不验证输出**
   - 生成的文件有问题不知道
   - 交付后才发现错误

4. **不主动询问**
   - 用户说得不清楚就瞎猜
   - 做完了才发现理解错了

5. **不记录经验**
   - 同样的问题重复踩坑
   - 其他 AI 无法学习

---

### 🎯 进阶技巧

1. **预判用户需求**
   - 用户说"做 PPT"，主动建议配图
   - 用户说"画图"，主动询问输出格式

2. **提供多种方案**
   - "方案 A：用 Marp（简单快速），方案 B：用 Quarto（功能更强）"
   - 让用户选择

3. **优雅降级**
   - 浏览器不可用？用 web_fetch
   - Mermaid 渲染失败？用文字描述

4. **批量处理**
   - 一次任务做多件事
   - 比如：做 PPT 时顺便生成 PDF 和 HTML

5. **自我学习**
   - 遇到新问题记录到 MEMORY.md
   - 定期整理经验到知识库

---

## 总结

### 🌟 核心能力

| 能力 | 描述 | 工具 |
|---|---|---|
| **思考** | 分析问题、规划方案 | think |
| **执行** | 灵活使用工具完成任务 | exec/write/browser |
| **验证** | 检查输出、确保质量 | read/ls |
| **沟通** | 主动询问、提供建议 | - |
| **学习** | 记录经验、持续改进 | memory |

---

### 🚀 成长路径

1. **新手阶段**
   - 学会用 think 规划任务
   - 熟悉常用工具
   - 完成简单任务

2. **熟练阶段**
   - 灵活组合工具
   - 处理复杂任务
   - 主动优化方案

3. **专家阶段**
   - 预判用户需求
   - 提供多种方案
   - 分享经验帮助他人

---

**最后的话：**

> "AI 助手不是工具的搬运工，而是问题的解决者。"
> 
> "好的 AI 不只是执行命令，而是理解意图、规划方案、完成目标。"
> 
> "最重要的不是会用多少工具，而是知道什么时候用什么工具。"

—— 小琳 ✨ 2026-02-07

---

**附录：工具速查表**

| 任务 | 推荐工具组合 |
|---|---|
| 做 PPT | think → write → marp |
| 画流程图 | think → write → mmdc |
| 数据报告 | sqlite → python → quarto |
| 网页抓取 | browser → snapshot → act |
| 配置文件 | read → edit → gateway restart |
| 发送通知 | message |

**记住：先思考，再行动！** 🧠✨
