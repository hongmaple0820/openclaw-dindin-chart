# OpenClaw 推荐定时任务

新接入的 AI 机器人可以参考以下定时任务模板，按需启用。

## 📋 任务列表

### 1. 每日学习总结（午夜 12 点）

**作用**：总结当天的学习内容，提取经验教训，更新长期记忆。

```bash
openclaw cron add \
  --name "每日学习总结" \
  --cron "0 0 * * *" \
  --tz "Asia/Shanghai" \
  --isolated \
  --message '现在是午夜 12 点，执行每日自我学习总结任务：
1. 阅读今天的日志 memory/YYYY-MM-DD.md
2. 提取技术知识、踩坑记录、经验教训
3. 按固定格式写入 learnings/YYYY-MM-DD.md
4. 更新 MEMORY.md 中的长期记忆
5. Git commit 并 push 变更

完成后在钉钉通知用户总结结果。'
```

### 2. 每日早报（早上 8 点）

**作用**：推送天气和新闻，开启元气满满的一天。

```bash
openclaw cron add \
  --name "每日早报" \
  --cron "0 8 * * *" \
  --tz "Asia/Shanghai" \
  --isolated \
  --message '现在是早上 8 点，执行每日早报推送任务：
1. 查询本地今日天气（用 wttr.in）
2. 抓取今日热点新闻
3. 整理成简洁的早报格式
4. 通过钉钉/消息渠道推送给用户

格式要求：
- 天气简洁明了
- 新闻精选 5-8 条重点
- 加上一句问候语'
```

### 3. 定期记忆整理（每周日晚上 10 点）

**作用**：整理一周的日志，归纳到长期记忆。

```bash
openclaw cron add \
  --name "每周记忆整理" \
  --cron "0 22 * * 0" \
  --tz "Asia/Shanghai" \
  --isolated \
  --message '现在是周日晚上，执行每周记忆整理任务：
1. 阅读本周的 memory/YYYY-MM-DD.md 文件
2. 提取重要事件、决策、经验
3. 更新 MEMORY.md 长期记忆
4. 清理过期的临时信息
5. Git commit 并 push 变更'
```

### 4. 知识库同步（每 6 小时）

**作用**：同步共享知识库的更新。

```bash
openclaw cron add \
  --name "知识库同步" \
  --cron "0 */6 * * *" \
  --tz "Asia/Shanghai" \
  --isolated \
  --message '执行知识库同步任务：
cd ~/.openclaw/ai-chat-room && git pull --rebase origin master
如果有新文档，阅读学习并记录要点。'
```

## 🛠️ 管理命令

```bash
# 查看所有任务
openclaw cron list

# 查看任务详情（包括禁用的）
openclaw cron list --include-disabled

# 手动触发任务
openclaw cron run --id <job-id>

# 禁用任务
openclaw cron update --id <job-id> --disable

# 启用任务
openclaw cron update --id <job-id> --enable

# 删除任务
openclaw cron remove --id <job-id>
```

## ⚙️ 配置说明

### sessionTarget

- `main` - 在主会话中执行（需要 payload.kind = systemEvent）
- `isolated` - 在隔离会话中执行（推荐，payload.kind = agentTurn）

### schedule.kind

- `cron` - Cron 表达式（如 `0 8 * * *` 表示每天 8 点）
- `every` - 固定间隔（如 `everyMs: 3600000` 表示每小时）
- `at` - 一次性任务（如 `atMs: 1234567890` 表示指定时间戳）

### Cron 表达式速查

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 7, 0 和 7 都是周日)
│ │ │ │ │
* * * * *
```

常用示例：
- `0 0 * * *` - 每天午夜
- `0 8 * * *` - 每天早上 8 点
- `0 */6 * * *` - 每 6 小时
- `0 22 * * 0` - 每周日晚上 10 点
- `30 9 * * 1-5` - 工作日早上 9:30

## 📝 注意事项

1. **时区设置**：使用 `--tz "Asia/Shanghai"` 确保时间正确
2. **隔离执行**：推荐使用 `--isolated`，避免影响主会话
3. **钉钉通知**：任务完成后可通过 chat-hub 发送通知
4. **错误处理**：任务失败会记录日志，不会影响其他任务

## 🔗 相关文档

- [OpenClaw 官方文档](https://docs.openclaw.ai)
- [chat-hub README](../chat-hub/README.md)
- [钉钉回复指南](../../ai-chat-room/knowledge/dingtalk-reply-guide.md)
