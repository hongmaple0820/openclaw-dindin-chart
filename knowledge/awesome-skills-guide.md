# 热门实用 Agent Skills 大全

> 整理时间：2026-02-06
> 总计：90+ 个高质量 Skills

## 📦 Skills 资源站

- **skillsmp.com** - 6 万+ Skills 市场
- **agentskills.io** - 官方标准规范
- **github.com/anthropics/skills** - Anthropic 官方示例
- **github.com/VoltAgent/awesome-agent-skills** - 200+ 社区精选
- **github.com/ComposioHQ/awesome-claude-skills** - 分类整理

## ⚡ 安装方法

### Claude Code
```bash
# 添加市场
/plugin marketplace add anthropics/skills

# 安装单个 skill
/plugin install skill-name@marketplace-name

# 或直接说
安装skills: github.com/xxx/xxx
```

### OpenClaw
把 SKILL.md 放到 `~/.openclaw/skills/` 或项目的 `skills/` 目录

---

## 🔥 推荐工作流连招

### 前端三件套
- `frontend-design`（好看）+ `imagen`（生图）+ `vercel-deploy`（部署）

### 开发连招
- `planning-with-files`（计划）+ `ralph-wiggum`（自主迭代）

### 头脑风暴
- `superpowers`（追问确定方案）+ `brainstorming`（生成 Skill）

---

## 📄 文档处理类 (1-6)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 1 | **docx** | 创建、编辑、分析 Word 文档 | github.com/anthropics/skills |
| 2 | **pdf** | 提取文本、表格、合并 PDF | 同上 |
| 3 | **pptx** | 读取、生成幻灯片 | 同上 |
| 4 | **xlsx** | Excel 公式、图表、数据转换 | 同上 |
| 5 | **Markdown to EPUB** | Markdown 转电子书 | github.com/smerchek/claude-epub-skill |
| 6 | **markitdown** ⭐ | PDF/PPT/图像/音频 → Markdown（微软出品） | github.com/microsoft/markitdown |

## 💻 开发工具类 (7-16)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 7 | **web-artifacts-builder** | React + Tailwind 构建 HTML 组件 | github.com/anthropics/skills |
| 8 | **mcp-builder** | 创建 MCP 服务器 | 同上 |
| 9 | **playwright-skill** | Playwright 浏览器自动化测试 | github.com/lackeyjb/playwright-skill |
| 10 | **D3.js Visualization** | D3 数据可视化 | github.com/chrisvoncsefalvay/claude-d3js-skill |
| 11 | **test-driven-development** | TDD 测试驱动开发 | github.com/obra/superpowers |
| 12 | **skill-creator** ⭐ | 创建新 Skill 的官方工具 | github.com/anthropics/skills |
| 13 | **planning-with-files** ⭐ | Manus 式持久化计划文件 | github.com/OthmanAdi/planning-with-files |
| 14 | **ralph-wiggum** ⭐ | 自主迭代直到代码能用 | skillsmp.com |
| 15 | **dev-agent-skills** | Git 备份，AI 删了也能救 | github.com/fvadicamo/dev-agent-skills |
| 16 | **using-git-worktrees** | 并行开发分支 | github.com/obra/superpowers |

## ☁️ 云服务类 (17-21)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 17 | **aws-skills** | AWS CDK、成本优化、Serverless | github.com/zxkane/aws-skills |
| 18 | **cloudflare/agents-sdk** | Cloudflare AI 代理 | github.com/cloudflare/skills |
| 19 | **cloudflare/wrangler** | Workers、KV、R2、D1 部署 | 同上 |
| 20 | **supabase/postgres** | Supabase PostgreSQL 最佳实践 | github.com/supabase/agent-skills |
| 21 | **terraform** | HashiCorp 基础设施即代码 | github.com/hashicorp |

## ⚛️ 前端框架类 (22-29)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 22 | **react-best-practices** | React 模式（Vercel 出品） | github.com/vercel-labs/agent-skills |
| 23 | **next-best-practices** | Next.js 最佳实践 | github.com/vercel-labs/next-skills |
| 24 | **react-native-skills** | React Native 性能优化 | github.com/vercel-labs/agent-skills |
| 25 | **shadcn-ui** | shadcn/ui 组件库 | github.com/google-labs-code/stitch-skills |
| 26 | **web-design-guidelines** | Web 设计规范 | github.com/vercel-labs/agent-skills |
| 27 | **frontend-design** ⭐ | 避免 AI 风格，大胆设计 | github.com/anthropics/skills |
| 28 | **vercel-deploy-claimable** ⭐ | 一键部署到 Vercel | github.com/vercel-labs/agent-skills |
| 29 | **composition-patterns** | React 组件组合模式 | 同上 |

## 🔒 安全审计类 (30-34)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 30 | **building-secure-contracts** | 智能合约安全（6 条链） | github.com/trailofbits/skills |
| 31 | **differential-review** | Git 历史安全审查 | 同上 |
| 32 | **insecure-defaults** | 检测硬编码密钥、弱加密 | 同上 |
| 33 | **firebase-apk-scanner** | Android APK 安全扫描 | 同上 |
| 34 | **constant-time-analysis** | 时序攻击检测 | 同上 |

## 🤗 AI/ML 类 (35-42)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 35 | **hugging-face-cli** | HF Hub 模型管理 | github.com/huggingface/skills |
| 36 | **hugging-face-model-trainer** | TRL 训练：SFT、DPO、GRPO | 同上 |
| 37 | **hugging-face-evaluation** | 模型评估 | 同上 |
| 38 | **hugging-face-datasets** | 数据集管理 | 同上 |
| 39 | **hugging-face-trackio** | ML 实验追踪 | 同上 |
| 40 | **imagen** ⭐ | Gemini API 生成图像 | github.com/sanjay3290/ai-skills |
| 41 | **deep-research** | Gemini 自主多步骤研究 | 同上 |
| 42 | **AI-research-SKILLs** | AI 研究工程技能库 | github.com/Orchestra-Research/AI-research-SKILLs |

## 🎨 创意设计类 (43-49)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 43 | **algorithmic-art** | p5.js 生成艺术 | github.com/anthropics/skills |
| 44 | **canvas-design** | PNG/PDF 视觉设计 | 同上 |
| 45 | **slack-gif-creator** | 适配 Slack 的 GIF | 同上 |
| 46 | **theme-factory** | 10 种预设主题 | 同上 |
| 47 | **brand-guidelines** | Anthropic 品牌规范 | 同上 |
| 48 | **Remotion** | React 代码生成视频 | github.com/remotion-dev/skills |
| 49 | **fal.ai** | AI 图像/视频 API | github.com/fal-ai/skills |

## 🎨 UI/UX 设计类 (50-54)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 50 | **ui-ux-pro-max** ⭐⭐ | 100+ 行业规则、67 种风格、96 色板（28k Star） | github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| 51 | **claude-designer-skill** | Jobs 式完美主义设计 | github.com/joeseesun/claude-designer-skill |
| 52 | **claude-dolphin** | WCAG 2.2 AA 无障碍审计 | github.com/nyldn/claude-dolphin |
| 53 | **ai-design-components** | UI/UX + 后端组件设计 | github.com/ancoleman/ai-design-components |
| 54 | **design-skills** | UI/UX 设计技能 | github.com/mae616/design-skills |

## 🎮 游戏开发类 (55-59)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 55 | **Godot-Claude-Skills** | Godot 引擎开发 | github.com/Randroids-Dojo/Godot-Claude-Skills |
| 56 | **OH-Unity-GameDev-Skills** | Unity 游戏开发 | github.com/OstrichHermit/OH-Unity-GameDev-Skills |
| 57 | **love2d-pocket-bomber** | Love2D 游戏 | github.com/chongdashu/love2d-pocket-bomber-game |
| 58 | **skills-weaver** | RPG 游戏（Claude Agent SDK） | github.com/nicmarti/skills-weaver |
| 59 | **solana-game-skill** | Solana 区块链游戏 | github.com/solanabr/solana-game-skill |

## 🦸 Superpowers 工作流 (60-65)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 60 | **superpowers** ⭐⭐ | 完整软件开发工作流（20+ 技能） | github.com/obra/superpowers |
| 61 | **systematic-debugging** | 4 阶段根因分析 | 同上 |
| 62 | **writing-plans** | 任务拆成 2-5 分钟步骤 | 同上 |
| 63 | **subagent-driven-development** | 子代理开发+代码审查 | 同上 |
| 64 | **dispatching-parallel-agents** | 并发子代理 | 同上 |
| 65 | **brainstorming** ⭐ | 头脑风暴生成 Skill | 同上 |

## 🧠 上下文工程类 (66-70)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 66 | **context-fundamentals** | 上下文窗口原理 | github.com/muratcankoylan/Agent-Skills-for-Context-Engineering |
| 67 | **memory-systems** | 短期/长期/图记忆架构 | 同上 |
| 68 | **multi-agent-patterns** | 协调者/P2P/层级架构 | 同上 |
| 69 | **prompt-engineering** | 提示工程最佳实践 | github.com/NeoLabHQ/context-engineering-kit |
| 70 | **tool-design** | 工具设计模式 | github.com/muratcankoylan/Agent-Skills-for-Context-Engineering |

## 🔬 科学研究类 (71-73)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 71 | **claude-scientific-skills** ⭐⭐ | 140+ 科研技能（K-Dense） | github.com/K-Dense-AI/claude-scientific-skills |
| 72 | **科学数据库** | OpenAlex/PubMed/UniProt 等 28+ | 同上 |
| 73 | **科研 Python 包** | RDKit/Scanpy/PyTorch 等 55+ | 同上 |

## 💼 商业营销类 (74-78)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 74 | **content-creator** | 品牌声音、SEO、15+ 模板 | github.com/alirezarezvani/claude-skills |
| 75 | **marketing-demand-acquisition** | CAC 计算、全漏斗策略 | 同上 |
| 76 | **social-media-analyzer** | 社媒分析、ROI、竞品 | 同上 |
| 77 | **ceo-advisor** | 战略分析、财务建模 | 同上 |
| 78 | **cto-advisor** | 技术债务、架构决策 | 同上 |

## 🏢 企业级 Skills (79-86)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 79 | **Stripe** | 支付集成最佳实践 | github.com/stripe/ai |
| 80 | **Expo** | React Native 移动开发 | github.com/expo |
| 81 | **Sentry** | 错误监控集成 | github.com/getsentry |
| 82 | **Better Auth** | 现代认证方案 | github.com/better-auth/skills |
| 83 | **Tinybird** | 实时数据分析 | github.com/tinybirdco/skills |
| 84 | **Sanity** | CMS 内容管理 | github.com/sanity-io/skills |
| 85 | **Neon** | Serverless Postgres | github.com/neondatabase/skills |
| 86 | **WordPress** | WP 开发最佳实践 | github.com/wordpress/skills |

## 🔧 实用工具类 (87-95)

| # | 名称 | 说明 | 链接 |
|---|------|------|------|
| 87 | **Skill_Seekers** ⭐ | 任意文档网站转 Skill | github.com/yusufkaraaslan/Skill_Seekers |
| 88 | **loki-mode** | 37 代理创业系统 | github.com/asklokesh/claudeskill-loki-mode |
| 89 | **web-asset-generator** | favicon/图标/社交图片 | github.com/alonw0/web-asset-generator |
| 90 | **claude-mem** | 自动压缩会话记忆 | github.com/thedotmack/claude-mem |
| 91 | **ios-simulator-skill** | iOS 模拟器自动化 | github.com/conorluddy/ios-simulator-skill |
| 92 | **notebooklm-skill** ⭐ | NotebookLM 云端知识库 | github.com/PleasePrompto/notebooklm-skill |
| 93 | **obsidian-skills** | Obsidian Markdown/Canvas | github.com/kepano/obsidian-skills |
| 94 | **pg-aiguide** | PostgreSQL 最佳实践 | github.com/timescale/pg-aiguide |
| 95 | **ffuf-web-fuzzing** | Web 渗透测试 | github.com/jthack/ffuf_claude_skill |

---

## 🎯 按场景推荐

### 新手入门
1. `skill-creator` - 学会创建 Skill
2. `superpowers` - 完整开发工作流
3. `frontend-design` - 前端开发

### 全栈开发
1. `planning-with-files` + `ralph-wiggum` - 计划+迭代
2. `test-driven-development` - TDD
3. `dev-agent-skills` - Git 备份

### UI/UX 设计
1. `ui-ux-pro-max` - 超全设计系统
2. `frontend-design` - 避免 AI 风格
3. `imagen` - 生成图像素材

### 科研工作
1. `claude-scientific-skills` - 140+ 科研技能
2. `notebooklm-skill` - 知识库管理
3. `deep-research` - 自主研究

### 安全审计
1. Trail of Bits 系列 - 专业安全
2. `insecure-defaults` - 配置检测
3. `differential-review` - 代码审查

---

*最后更新：2026-02-06*
