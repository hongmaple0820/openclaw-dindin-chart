# chat-web 安全分析报告

> 分析日期：2026-02-13
> 分析范围：chat-web 前端 + chat-admin-api 后端

---

## 📋 概述

本文档对 chat-web 项目的注册和认证系统进行全面安全分析，识别潜在漏洞并提出优化建议。

---

## 🔍 当前架构

### 系统组件

```
chat-web (前端 Vue 3)
    ↓ HTTP
chat-admin-api (后端 Express)
    ↓ SQLite
用户数据库

chat-hub (消息中转)
    ↓ SQLite (独立)
用户数据库
```

### 关键发现

项目存在 **两套独立的用户系统**：
1. **chat-admin-api** - 后台管理 API，使用 SQLite
2. **chat-hub/auth.js** - 消息中转系统，使用独立的 SQLite 数据库

---

## 🚨 发现的问题

### 问题 P1: 机器人可通过 Web 注册 [严重]

**位置**: `chat-web/src/views/Register.vue:44-53`

**问题描述**:
注册页面提供了"普通用户"和"机器人"两个选项，机器人可以通过 Web 前端自行注册。

**当前代码**:
```vue
<el-form-item label="账号类型">
  <el-radio-group v-model="form.type">
    <el-radio value="human">普通用户</el-radio>
    <el-radio value="bot">机器人</el-radio>
  </el-radio-group>
</el-form-item>
```

**影响**:
- 自动化脚本可以批量注册机器人账号
- 机器人可以伪装成人类用户
- 绕过人工审核流程

**建议修复**:
1. 移除前端账号类型选择
2. 仅允许通过后台管理或配置文件创建机器人账号

---

### 问题 P2: 无防机器人机制 [严重]

**位置**: `chat-web/src/views/Register.vue`

**问题描述**:
注册流程没有任何人机验证机制：
- ❌ 无图形验证码
- ❌ 无滑块验证
- ❌ 无邮箱/手机验证码（可选但未强制）
- ❌ 无 IP 频率限制

**影响**:
- 自动化脚本可以无限批量注册
- 暴力破解密码成本低
- DDoS 攻击风险高

**建议修复**:
1. 集成图形验证码（如 vue-captcha）
2. 添加注册频率限制（同一 IP 每小时最多 5 次）
3. 强制邮箱验证

---

### 问题 P3: 前后端验证规则不一致 [中等]

**位置**:
- 前端: `chat-web/src/views/Register.vue:167-169`
- 后端: `chat-admin-api/src/routes/auth.js:18-22`

**问题描述**:

| 层面 | 用户名规则 |
|------|-----------|
| 前端正则 | `/^[a-zA-Z0-9_]{2,20}$\|^[\u4e00-\u9fa5]{2,10}$/` |
| 后端正则 | `/^[a-zA-Z0-9_]{3,20}$/` |

- 前端允许中文用户名，后端不允许
- 前端最小 2 位，后端最小 3 位

**影响**:
- 用户在前端通过验证，但在后端被拒绝
- 用户体验不一致
- 可能被利用进行验证绕过

**建议修复**:
统一前后端验证规则：
```javascript
// 统一使用
const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
```

---

### 问题 P4: 两套用户系统不互通 [中等]

**位置**:
- `chat-admin-api/src/models/user.js`
- `chat-hub/src/auth.js`

**问题描述**:
项目使用两个独立的用户数据库：
1. `chat-admin-api` - 管理后台用户
2. `chat-hub` - 消息中转系统用户

**影响**:
- 用户需要在两个系统分别注册/登录
- 管理员无法统一管理所有用户
- 数据不一致

**建议修复**:
1. 统一使用 chat-admin-api 作为用户中心
2. chat-hub 通过 API 调用进行用户认证
3. 或使用共享的 SQLite 数据库

---

### 问题 P5: 注册无速率限制 [中等]

**位置**: `chat-admin-api/src/routes/auth.js`

**问题描述**:
注册接口没有请求频率限制，同一 IP 可以无限次发送注册请求。

**影响**:
- 暴力破解风险
- 资源消耗攻击
- 垃圾账号泛滥

**建议修复**:
```javascript
const rateLimit = require('express-rate-limit');

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 5, // 最多 5 次
  message: { success: false, error: '注册过于频繁，请稍后再试' }
});

router.post('/register', registerLimiter, async (req, res) => {
  // ...
});
```

---

### 问题 P6: 密码强度验证不足 [低]

**位置**: `chat-admin-api/src/routes/auth.js`

**当前验证**:
```javascript
if (password.length < config.password.minLength) { // minLength = 6
  return res.status(400).json({ error: '密码长度不能少于6位' });
}
```

**问题**:
- 只检查长度，未检查复杂度
- 允许弱密码（如 "123456"）

**建议修复**:
```javascript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
if (!PASSWORD_REGEX.test(password)) {
  return res.status(400).json({
    error: '密码需包含大小写字母和数字，至少8位'
  });
}
```

---

### 问题 P7: 错误信息泄露 [低]

**位置**: 多处

**问题描述**:
登录失败时，返回的错误信息可能泄露用户存在性：
- "用户名或密码错误" ✓ 正确
- "用户不存在" ✗ 泄露
- "邮箱已被使用" ✗ 泄露

**建议修复**:
统一使用模糊错误信息：
```javascript
// 错误示例
if (!user) return res.status(401).json({ error: '用户不存在' });

// 正确示例
if (!user) return res.status(401).json({ error: '用户名或密码错误' });
```

---

## ✅ 已有的安全措施

| 措施 | 状态 | 位置 |
|------|------|------|
| 密码 bcrypt 加密 | ✅ | user.js |
| JWT Token 认证 | ✅ | auth.js |
| 管理员审核机制 | ✅ | chat-hub/auth.js |
| 登录日志记录 | ✅ | LoginLogModel |
| 密码最小长度限制 | ✅ | auth.js |
| 邮箱格式验证 | ✅ | auth.js |

---

## 🛠️ 优化建议优先级

| 优先级 | 问题 | 预计工作量 |
|--------|------|-----------|
| P1 | 移除前端 bot 注册选项 | 低 |
| P2 | 添加验证码/频率限制 | 中 |
| P3 | 统一验证规则 | 低 |
| P4 | 统一用户系统 | 高 |
| P5 | 增强密码强度 | 低 |

---

## 📝 机器人认证规范（新增）

为区分人类用户和机器人，建议采用以下方案：

### 方案 A：配置文件（推荐）

机器人通过配置文件认证，不通过 Web 注册：

```json
// chat-hub/config/local.json
{
  "bot": {
    "name": "小琳",
    "apiKey": "sk-bot-xxxxx",
    "type": "bot"
  }
}
```

### 方案 B：专属 Skills

创建机器人认证 Skill：

```
/bot-register
```

仅允许通过 Skills 创建机器人账号。

---

## 📊 影响评估总结

| 风险等级 | 数量 | 建议处理时间 |
|----------|------|--------------|
| 🔴 严重 | 2 | 1 周内 |
| 🟡 中等 | 3 | 1 个月内 |
| 🟢 低 | 2 | 3 个月内 |

---

*最后更新：2026-02-13*
