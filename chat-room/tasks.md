# 📋 AI 聊天室任务看板

> 实时更新任务状态，避免重复工作
> 更新时间：2026-02-06 09:15
> 更新人：小琳

---

## ✅ 已完成

| ID | 任务 | 负责人 | 完成时间 |
|----|------|--------|----------|
| T001-T008 | 基础架构（chat-hub、SQLite、Redis） | 小琳/小猪 | 2026-02-05 |
| T009 | 聊天室前端页面 | 小猪 | 2026-02-06 04:00 |
| T010 | 私聊功能后端 API | 小琳 | 2026-02-06 05:36 |
| T011 | 私聊功能前端页面 | 小琳 | 2026-02-06 05:36 |
| T012 | 注册 bug 修复 | 小琳 | 2026-02-06 05:20 |
| T013 | 开源准备（许可证、隐私清理） | 小琳 | 2026-02-06 04:30 |
| T014 | 钉钉私聊集成 | 小猪 | 2026-02-06 06:00 |
| T015 | Redis 实时通知（私信） | 小琳 | 2026-02-06 06:30 |
| T016 | 自动化测试（API + E2E） | 小琳 | 2026-02-06 06:30 |
| T017 | 智能对话管理器 | 小琳 | 2026-02-06 07:00 |
| T018 | 群聊已读功能 | 小琳 | 2026-02-06 07:25 |
| T019 | MCP 工具插件开发 | 小琳 | 2026-02-06 08:30 |
| T020 | Gitee 开源发布 | maple | 2026-02-06 07:30 |

---

## 🔄 进行中

*暂无*

---

## 📝 待开始（小猪负责）

### 🔴 高优先级

| ID | 任务 | 说明 | 预估时间 |
|----|------|------|----------|
| T021 | **前端实时通知订阅** | chat-web 订阅 Redis 消息，实现页面实时更新 | 2h |
| T022 | **GitHub 仓库同步** | 同步代码到 GitHub 镜像仓库 | 30min |
| T023 | **统计后端部署** | 部署 analytics 收集服务 | 1h |

### 🟡 中优先级

| ID | 任务 | 说明 | 预估时间 |
|----|------|------|----------|
| T024 | **消息搜索优化** | 全文搜索、时间范围筛选、发送者筛选 | 2h |
| T025 | **用户头像系统** | 上传头像、默认头像生成 | 1.5h |
| T026 | **消息编辑/删除** | 支持编辑和删除自己的消息 | 1h |
| T027 | **@ 提及功能** | 前端支持 @ 用户，高亮显示 | 1h |

### 🟢 低优先级

| ID | 任务 | 说明 | 预估时间 |
|----|------|------|----------|
| T028 | **消息表情回应** | 对消息添加表情反应 | 1.5h |
| T029 | **文件/图片上传** | 聊天中上传图片和文件 | 2h |
| T030 | **演示视频录制** | B 站上传部署教程视频 | 2h |
| T031 | **技术平台发布** | 掘金、CSDN、知乎发文 | 1h |

---

## 📖 任务详情

### T021 前端实时通知订阅

**目标**：让 chat-web 页面能实时收到新消息，不需要刷新

**技术方案**：
1. 后端：在 chat-admin-api 中添加 WebSocket 或 SSE 接口
2. 前端：chat-web 订阅该接口
3. 收到消息时自动更新页面

**参考代码**：
```javascript
// chat-admin-api/src/routes/events.js
const express = require('express');
const router = express.Router();

// SSE 事件流
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 订阅 Redis 消息
  const subscriber = redis.duplicate();
  subscriber.subscribe('chat:messages', 'chat:replies');
  
  subscriber.on('message', (channel, message) => {
    res.write(`data: ${message}\n\n`);
  });
  
  req.on('close', () => {
    subscriber.unsubscribe();
    subscriber.quit();
  });
});

module.exports = router;
```

**验收标准**：
- [ ] 打开 chat-web 页面
- [ ] 另一个窗口发送消息
- [ ] 页面自动显示新消息（无需刷新）

---

### T022 GitHub 仓库同步

**目标**：把 Gitee 代码同步到 GitHub

**步骤**：
1. 创建 GitHub 仓库：hongmaple/openclaw-dindin-chart
2. 添加 remote：`git remote add github git@github.com:hongmaple/openclaw-dindin-chart.git`
3. 推送：`git push github main`
4. 更新 README 和文档中的 GitHub 链接

**注意**：需要 maple 提供 GitHub 权限

---

### T023 统计后端部署

**目标**：收集匿名使用统计

**步骤**：
1. 参考 `docs/usage-tracking-plan.md` 中的代码
2. 部署到服务器（可以用 Vercel/Railway 免费部署）
3. 修改 `chat-hub/src/analytics.js` 中的 endpoint
4. 测试统计收集

---

### T024 消息搜索优化

**目标**：更强大的消息搜索功能

**需求**：
- 全文搜索（模糊匹配）
- 时间范围筛选（今天、本周、自定义）
- 发送者筛选
- 搜索结果高亮

**涉及文件**：
- `chat-hub/src/message-store.js`（后端搜索）
- `chat-web/src/views/Messages.vue`（前端 UI）

---

## ⚠️ 工作规范

### 开始任务前
1. `git pull origin master` 获取最新代码
2. 在群里说「@小琳 我开始做 T021」
3. 创建分支：`git checkout -b feat/t021-realtime`

### 完成任务后
1. 测试通过
2. `git add -A && git commit -m "✨ T021: 前端实时通知"`
3. `git push origin feat/t021-realtime`
4. 在群里说「@小琳 @鸿枫 T021 已完成，请审核」

### 遇到问题
1. 卡住超过 30 分钟就求助
2. 在群里说明问题和已尝试的方案
3. 等待反馈，不要闷头死磕

---

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| 总提交 | 80+ |
| 代码行数 | 8000+ |
| 开发天数 | 4 |
| 完成任务 | 20 |
| 待完成 | 11 |
| 参与者 | 1 人类 + 2 AI |

---

*小猪加油！有问题随时问我 🐷✨*
