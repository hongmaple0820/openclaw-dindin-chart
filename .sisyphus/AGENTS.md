# 枫琳 AI 聊天室 - 项目规范

> 本文档定义了项目的核心规范，供 AI 编码代理参考。

---

## 📋 项目概述

**项目名称**: 枫琳 AI 聊天室 (Fenlin AI ChatRoom)  
**项目定位**: 人机共生智能协作平台  
**核心价值**: 让 AI 如枫叶般自然融入生活与工作

### 技术栈

- **后端**: Node.js + Express + SQLite + Redis
- **前端**: Vue 3 + Vite + Element Plus + Pinia
- **部署**: Docker + Nginx

### 项目结构

```
openclaw-dindin-chart/
├── chat-hub/              # 核心：消息中转服务
├── chat-web/              # 前端：用户界面
├── chat-admin-api/        # 后台：管理 API
├── chat-admin-ui/         # 后台：管理界面
├── docs/                  # 文档网站 (docsify)
├── .sisyphus/             # 项目规范文档
└── tasks/                 # 任务列表
```

---

## 🎨 代码风格

### JavaScript/TypeScript

- 使用 **2 空格缩进**
- 使用 **单引号** `'string'`
- 语句末尾 **加分号** `;`
- 使用 `const` 优先，其次 `let`，**禁用 `var`**
- 使用 **箭头函数** `() => {}`
- 使用 **模板字符串** `` `${var}` ``

### 命名规范

```javascript
// 变量/函数：camelCase
const userName = 'maple';
function getUserById(id) {}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 类/组件：PascalCase
class UserService {}
const LoginPage = () => {};

// 文件名：kebab-case 或 PascalCase
// user-service.js 或 UserService.js
```

### Vue 组件规范

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup>
// Composition API
import { ref, onMounted } from 'vue';

// Props
const props = defineProps({
  userId: String
});

// Emits
const emit = defineEmits(['update']);

// 响应式数据
const loading = ref(false);

// 方法
const handleSubmit = async () => {
  // ...
};

// 生命周期
onMounted(() => {
  // ...
});
</script>

<style scoped>
/* 样式 */
</style>
```

---

## 📁 目录结构规范

### 后端 (chat-admin-api / chat-hub)

```
src/
├── config/         # 配置文件
├── middleware/     # 中间件
├── models/         # 数据模型
├── routes/         # 路由/控制器
├── services/       # 业务逻辑
├── utils/          # 工具函数
└── index.js        # 入口文件
```

### 前端 (chat-admin-ui / chat-web)

```
src/
├── api/            # API 接口
├── assets/         # 静态资源
├── components/     # 公共组件
├── composables/    # 组合式函数
├── layouts/        # 布局组件
├── router/         # 路由配置
├── stores/         # 状态管理 (Pinia)
├── styles/         # 全局样式
├── utils/          # 工具函数
├── views/          # 页面组件
├── App.vue         # 根组件
└── main.js         # 入口文件
```

---

## 📝 注释规范

### 文件头注释

```javascript
/**
 * 用户服务
 * 处理用户相关的业务逻辑
 * 
 * @author 小琳
 * @date 2026-02-06
 */
```

### 函数注释

```javascript
/**
 * 根据 ID 获取用户信息
 * @param {string} userId - 用户 ID
 * @returns {Promise<User>} 用户对象
 * @throws {Error} 用户不存在时抛出错误
 */
async function getUserById(userId) {
  // ...
}
```

### 行内注释

```javascript
// 检查用户权限
if (!hasPermission(user, 'admin')) {
  throw new Error('权限不足');
}
```

---

## 🔌 API 规范

### RESTful 设计

```
GET    /api/users          # 获取用户列表
GET    /api/users/:id      # 获取单个用户
POST   /api/users          # 创建用户
PUT    /api/users/:id      # 更新用户
DELETE /api/users/:id      # 删除用户
```

### 响应格式

```javascript
// 成功
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 失败
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}

// 分页
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### HTTP 状态码

- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 无权限
- `404` - 资源不存在
- `500` - 服务器错误

---

## 🎨 品牌设计规范

### 色彩系统

```css
/* 主色调 - 枫叶红 */
--fenlin-primary: #C41E3A;
--fenlin-primary-light: #E63950;
--fenlin-primary-dark: #A01830;

/* 辅助色 - 秋金黄 */
--fenlin-secondary: #D4A017;
--fenlin-secondary-light: #F5C842;

/* 点缀色 - 自然绿 */
--fenlin-accent: #228B22;
--fenlin-accent-light: #32CD32;
```

### 设计元素

- **圆角**: 8px (小) / 12px (中) / 16px (大) / 24px (超大)
- **阴影**: 使用品牌色透明度 (rgba(196, 30, 58, 0.08~0.16))
- **动画**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

### 品牌文案

- 主 Slogan: 「枫琳，让智能自然融入生活」
- 副 Slogan: 「人机共生，自然之道」
- 聊天室 → 协作空间
- 私信 → 枫语私语

---

## 🔐 安全规范

1. **密码**: 使用 bcrypt 加密，不存储明文
2. **敏感信息**: 不提交到 Git（用 .gitignore）
3. **输入验证**: 所有用户输入都要验证
4. **SQL 注入**: 使用参数化查询
5. **XSS**: 对输出进行转义
6. **CORS**: 配置允许的域名

---

## 👥 团队协作

### 团队成员

| 角色 | 名字 | 职责 |
|------|------|------|
| 产品负责人 | 鸿枫 (maple) | 需求提供、产品设计、最终决策 |
| 技术经理 | 小琳 | 架构设计、任务分配、代码审核 |
| 全栈工程师 | 小猪 | 功能开发、测试、文档 |

### 协作核心原则

#### 五个"及时"

1. **及时获取反馈** - 主动问进度、问困难、问需求变化
2. **及时同步代码** - 开发前 pull，完成后 push
3. **及时学习资源** - 新 Skills、新文档、新知识要主动学习
4. **及时暴露问题** - 有困难、有阻塞马上说
5. **及时讨论变更** - 需求变了、方案变了，拉大家一起讨论

#### 三个"不要"

1. **不要闷头开发** - 定期冒泡，让队友知道你在干嘛
2. **不要独自解决** - 卡住超过 30 分钟就求助
3. **不要假设对齐** - 不确定就问，别猜

### Git 协作规范

#### 分支策略

```
main          <- 稳定分支，只接受 PR 合并
├── feat/xxx  <- 功能分支
├── fix/xxx   <- 修复分支
└── docs/xxx  <- 文档分支
```

#### Commit 规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 重构
style: 代码格式
test: 测试相关
chore: 其他杂项
```

### 任务状态

- `📝 待分配` - 新需求，未分配给谁
- `🎯 待开发` - 已分配，未开始
- `🔧 开发中` - 正在开发
- `👀 待审核` - 开发完成，等待审核
- `✅ 已完成` - 审核通过

---

## ✅ 代码审核清单

提交代码前检查：

- [ ] 代码能正常运行
- [ ] 添加了必要的注释
- [ ] 变量命名清晰
- [ ] 没有 console.log 调试代码
- [ ] 没有硬编码的密钥
- [ ] 错误处理完善
- [ ] 相关文档已更新

---

## 📚 相关文档

- [快速启动指南](./guides/quick-start.md)
- [测试指南](./guides/testing.md)
- [品牌设计规范](./design/brand.md)
- [架构设计](./design/architecture.md)

---

*最后更新：2026-02-12*
