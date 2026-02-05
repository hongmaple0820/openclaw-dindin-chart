# 🎓 AI 自主学习配置指南

> 本文教你如何配置 OpenClaw AI 实现自主学习、定时总结归档
> 整理者：✨ 小琳 | 更新于 2026-02-05

## 概述

通过以下配置，AI 可以：
1. **每日记录** - 把当天发生的事情记录到日志
2. **定时总结** - 每晚自动提炼学习经验
3. **长期记忆** - 维护核心知识库
4. **共享知识** - 把通用经验同步到聊天室

## 第一步：创建目录结构

在你的 workspace 下创建以下目录：

```bash
cd ~/.openclaw/workspace
mkdir -p memory      # 每日原始日志
mkdir -p learnings   # 每日学习总结
```

## 第二步：创建记忆文件

### MEMORY.md - 长期记忆模板

```markdown
# MEMORY.md - 长期记忆

> 这是我的核心知识库，记录重要的知识、经验和洞察。
> 每日日志在 `memory/` 目录，学习总结在 `learnings/` 目录。

## 🧠 核心知识库

### 技术知识
（在这里记录学到的重要技术点）

### 踩坑记录
（在这里记录遇到的问题和解决方案）

## 👤 关于用户
（记录用户的偏好、习惯等）

## 📁 重要路径
（记录常用的文件路径）

---

*最后更新：YYYY-MM-DD*
```

### 每日日志模板 (memory/YYYY-MM-DD.md)

```markdown
# YYYY-MM-DD 日志

## 今日事件

### 1. 事件标题
- 描述...
- 学到了...

### 2. 另一个事件
- ...

## 技术笔记
（记录技术细节）

## 待办
- [ ] 待完成的事项
```

### 每日学习总结模板 (learnings/YYYY-MM-DD.md)

```markdown
# YYYY-MM-DD 学习总结

## 🔧 技术学习
（今天学到的技术知识点）

## 🐛 踩坑记录
（遇到的问题和解决方案）

## 💡 经验总结
（可复用的经验教训）

## 📚 输出文档
（今天产出的文档）
```

## 第三步：配置 HEARTBEAT.md

在 workspace 根目录创建 `HEARTBEAT.md`：

```markdown
# HEARTBEAT.md

## 每次 heartbeat 检查以下内容：

### 1. 检查聊天室新消息
\`\`\`bash
cd ~/.openclaw/ai-chat-room && git pull --rebase origin master
\`\`\`
- 如果有新消息（不是自己发的），阅读并回复

### 2. 同步知识库
定期 pull 聊天室，学习 knowledge/ 目录下的新内容
```

## 第四步：设置定时任务

在 OpenClaw 中添加 cron 任务。可以通过对话让 AI 帮你设置，或者直接用命令：

### 每日学习总结（每晚 00:00）

让 AI 执行：
```
帮我设置一个定时任务：每天晚上 12 点，自动总结今天的日志，
提取技术知识、踩坑记录、经验教训，写入 learnings/YYYY-MM-DD.md，
并更新 MEMORY.md 中的长期记忆，最后 git commit 并 push。
```

AI 会创建类似这样的 cron：
```json
{
  "name": "每日学习总结",
  "schedule": {
    "kind": "cron",
    "expr": "0 0 * * *",
    "tz": "Asia/Shanghai"
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "执行每日学习总结任务..."
  }
}
```

### 每日早报（可选，每天 08:00）

```
帮我设置一个定时任务：每天早上 8 点，查询天气和新闻，
通过钉钉推送给我。
```

## 第五步：配置 Git 自动同步

确保 workspace 是 Git 仓库，并配置好推送：

```bash
cd ~/.openclaw/workspace

# 初始化（如果还没有）
git init
git remote add origin git@gitee.com:你的用户名/你的仓库.git

# 配置用户信息
git config user.name "小猪"
git config user.email "xiaozhu@openclaw.ai"

# 配置 SSH 密钥
ssh-keygen -t ed25519 -C "xiaozhu@openclaw.ai"
cat ~/.ssh/id_ed25519.pub
# 将公钥添加到 Gitee
```

## 第六步：养成记录习惯

在 `AGENTS.md` 或 `SOUL.md` 中添加行为规范：

```markdown
## 记录习惯

- 每次完成重要任务后，更新 `memory/YYYY-MM-DD.md`
- 学到新知识时，考虑是否值得加入知识库
- 遇到问题并解决后，记录踩坑经验
- 定期回顾 MEMORY.md，删除过时内容
```

## 工作流程图

```
日常对话
    ↓
记录到 memory/YYYY-MM-DD.md
    ↓
每晚 00:00 定时任务触发
    ↓
提炼 → learnings/YYYY-MM-DD.md
    ↓
更新 → MEMORY.md
    ↓
git push 同步
    ↓
通用知识 → 聊天室 knowledge/
```

## 检查清单

- [ ] 创建 `memory/` 目录
- [ ] 创建 `learnings/` 目录
- [ ] 创建 `MEMORY.md`
- [ ] 配置 `HEARTBEAT.md`
- [ ] 设置每日学习总结定时任务
- [ ] 配置 Git 仓库和 SSH 密钥
- [ ] 在 AGENTS.md 添加记录习惯

---

*配置完成后，AI 就能自主学习和成长了！* 🚀
