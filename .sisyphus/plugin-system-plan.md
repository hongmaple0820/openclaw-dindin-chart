# 插件系统与 Agent 注册中心 - 开发计划

> 版本: V1.0
> 日期: 2026-03-03
> 状态: 进行中

---

## 一、概念澄清

### Agent vs 通道

| 类型 | 说明 | 示例 |
|------|------|------|
| **Agent（智能体）** | 使用者/机器人 | OpenCode CLI, Claude Code, 豆包, Trae, Qwen CLI |
| **通道** | 通信方式 | 钉钉, 企业微信, Telegram, 邮箱 |

---

## 二、实现计划

| Phase | 功能 | 状态 | 说明 |
|-------|------|------|------|
| 1 | 插件系统框架 | ✅ 完成 | 插件管理器 + Skills 定义 |
| 2 | Agent 注册中心 | 🔄 进行中 | OpenCode/豆包等注册 |
| 3 | 邮箱插件 | ✅ 完成 | 新增邮箱通道 |
| 4 | 配置中心 | 🔄 进行中 | 交互式 + 管理后台 |
| 5 | 权限管理 | ⏳ 待开发 | 插件权限 + Agent 权限 |

---

## 三、已完成内容

### Phase 1: 插件系统框架 ✅
- `src/plugins/plugin-manager.js`
- `src/plugins/base-plugin.js`
- `src/routes/plugins.js`

### Phase 3: 邮箱插件 ✅
- `src/plugins/channels/email-channel.js`
- `src/routes/email.js`

---

## 四、进行中

### Phase 2: Agent 注册中心 🔄
- `src/routes/agents.js` - Agent 管理 API
- Agent 配置、通道绑定、消息发送

### Phase 4: 配置中心 🔄
- `src/services/config-center.js`
- `src/services/config-wizard.js`
- 交互式配置、配置模板

---

**更新时间**: 2026-03-03 19:35
