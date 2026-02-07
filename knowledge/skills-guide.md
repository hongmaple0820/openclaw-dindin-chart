# OpenClaw Skills 使用指南

> 本文档维护所有已安装的 OpenClaw 技能，供 AI 机器人学习和使用
> 
> 最后更新：2026-02-07

---

## 📦 技能安装方法

### 方法 1：ClawHub CLI（推荐）
```bash
npx clawhub@latest install <skill-slug>
```

### 方法 2：搜索技能
```bash
npx clawhub@latest search <关键词>
```

### 方法 3：克隆完整仓库
```bash
git clone https://github.com/VoltAgent/awesome-openclaw-skills.git ~/.openclaw/awesome-openclaw-skills
```

---

## 🗂️ 已安装技能清单

### 🛠️ 开发工具（9个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| github | v1.0.0 | GitHub 操作 | `npx clawhub@latest install github` |
| git-essentials | v1.0.0 | Git 基础命令 | `npx clawhub@latest install git-essentials` |
| docker-essentials | v1.0.0 | Docker 容器管理 | `npx clawhub@latest install docker-essentials` |
| kubernetes | v1.0.0 | K8s 集群管理 | `npx clawhub@latest install kubernetes` |
| pm2 | v1.0.0 | Node.js 进程管理 | `npx clawhub@latest install pm2` |
| ssh-essentials | v1.0.0 | SSH 连接工具 | `npx clawhub@latest install ssh-essentials` |
| nginx-gen | v1.0.0 | Nginx 配置生成 | `npx clawhub@latest install nginx-gen` |
| database | v1.1.0 | 数据库操作 | `npx clawhub@latest install database` |
| redis | v1.1.0 | Redis 管理 | `npx clawhub@latest install redis` |

### 🤖 AI & 自动化（6个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| automation-workflows | v0.1.0 | 自动化工作流 | `npx clawhub@latest install automation-workflows` |
| n8n-workflow-automation | v1.0.0 | n8n 工作流自动化 | `npx clawhub@latest install n8n-workflow-automation` |
| moltbook-interact | v1.0.1 | Moltbook 社交网络 | `npx clawhub@latest install moltbook-interact` |
| telegram | v1.0.1 | Telegram 集成 | `npx clawhub@latest install telegram` |
| brainstorming | - | 头脑风暴 | 已内置 |

### 🔍 代码质量（3个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| pr-reviewer | v1.0.0 | PR 代码审查 | `npx clawhub@latest install pr-reviewer` |
| ai-code-review | v1.0.1 | AI 代码审查助手 | `npx clawhub@latest install ai-code-review` |
| eslint-config-gen | v1.0.1 | ESLint 配置生成 | `npx clawhub@latest install eslint-config-gen` |

### 🚀 CI/CD & 部署（2个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| github-action-gen | v1.0.2 | GitHub Actions 生成器 | `npx clawhub@latest install github-action-gen` |
| vercel | v1.0.1 | Vercel 平台部署 | `npx clawhub@latest install vercel` |

### 🔐 安全工具（1个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| security-sentinel | v1.1.2 | 安全扫描和审计 | `npx clawhub@latest install security-sentinel` |

### 📚 文档工具（5个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| ai-api-docs | v1.0.2 | API 文档生成 | `npx clawhub@latest install ai-api-docs` |
| readme-gen | v1.0.0 | README 生成器 | `npx clawhub@latest install readme-gen` |
| diagram-generator | - | 图表生成 | 已内置 |
| changelog-generator | - | 变更日志 | 已内置 |
| markdown-formatter | v1.0.0 | Markdown 格式化 | `npx clawhub@latest install markdown-formatter` |

### 💾 数据库（2个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| postgres | v1.1.0 | PostgreSQL 管理 | `npx clawhub@latest install postgres` |
| redis | v1.1.0 | Redis 管理 | `npx clawhub@latest install redis` |

### 🎨 前端开发（2个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| react-expert | v0.1.0 | React 开发专家 | `npx clawhub@latest install react-expert` |
| type-gen | v1.0.1 | JSON → TypeScript 类型生成 | `npx clawhub@latest install type-gen` |

### 📈 性能监控（2个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| perf-profiler | v1.0.0 | 性能分析 | `npx clawhub@latest install perf-profiler` |
| log-analyzer | v1.0.0 | 日志分析 | `npx clawhub@latest install log-analyzer` |

### 📊 数据处理（4个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| csv-analyzer | - | CSV 分析 | 已内置 |
| jq-json-processor | v1.0.0 | JSON 处理 | `npx clawhub@latest install jq-json-processor` |
| root-cause-tracing | - | 根因分析 | 已内置 |
| tdd | - | 测试驱动开发 | 已内置 |

### 🌐 实用工具（4个）

| 技能名 | 版本 | 用途 | 安装命令 |
|--------|------|------|----------|
| weather | v1.0.0 | 天气查询 | `npx clawhub@latest install weather` |
| system-monitor | v1.0.0 | 系统监控 | `npx clawhub@latest install system-monitor` |
| youtube-transcript | - | YouTube 字幕 | 已内置 |
| ppt-style-guide | - | PPT 样式 | 已内置 |

---

## 🔍 技能分类索引

### 按用途分类

#### Web 开发
- react-expert, type-gen, vercel, github-action-gen

#### DevOps
- docker-essentials, kubernetes, nginx-gen, pm2, ssh-essentials

#### 数据库
- database, postgres, redis

#### 代码质量
- pr-reviewer, ai-code-review, eslint-config-gen, security-sentinel

#### 文档生成
- ai-api-docs, readme-gen, markdown-formatter, diagram-generator

#### AI 工具
- automation-workflows, n8n-workflow-automation, moltbook-interact

#### 通信工具
- telegram

#### 监控调试
- perf-profiler, log-analyzer, system-monitor

---

## 💡 使用示例

### 1. GitHub 操作
```bash
# 使用 github 技能
"查看我的 GitHub 仓库"
"创建一个新分支"
"合并 PR"
```

### 2. 代码审查
```bash
# 使用 pr-reviewer 技能
"审查这个 PR"
"检查代码质量"
```

### 3. 部署应用
```bash
# 使用 vercel 技能
"部署到 Vercel"
"检查部署状态"
```

### 4. 生成文档
```bash
# 使用 ai-api-docs 技能
"为这个 API 生成文档"
"生成 OpenAPI 规范"
```

### 5. 安全扫描
```bash
# 使用 security-sentinel 技能
"扫描项目安全漏洞"
"检查依赖安全性"
```

---

## 📚 官方资源

- **ClawHub 技能库**：https://github.com/openclaw/skills
- **Awesome Skills**：https://github.com/VoltAgent/awesome-openclaw-skills
- **技能搜索**：https://clawhub.com
- **官方文档**：https://docs.openclaw.ai

---

## 🚀 常见问题

### Q1：如何更新已安装的技能？
```bash
npx clawhub@latest update <skill-slug>
# 或更新所有
npx clawhub@latest update
```

### Q2：如何查看已安装的技能？
```bash
npx clawhub@latest list
# 或查看文件夹
ls ~/.openclaw/workspace/skills/
```

### Q3：如何删除技能？
```bash
rm -rf ~/.openclaw/workspace/skills/<skill-name>
```

### Q4：技能不工作怎么办？
1. 检查技能的 SKILL.md 文档
2. 查看是否需要额外的依赖
3. 检查权限和环境变量

---

## 📝 贡献指南

如果你安装了新技能，请更新这个文档：

1. 添加到对应的分类表格
2. 更新技能总数
3. 提交到 Git 仓库
4. 通知其他机器人

---

*本文档由小琳维护，供所有 AI 机器人共享使用*
