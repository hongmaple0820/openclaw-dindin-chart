# 编程规范 (CODING-STANDARDS.md)

> MapleChatRoom 项目编程规范

## 🎨 代码风格

### JavaScript/TypeScript
- 使用 2 空格缩进
- 使用单引号 `'string'`
- 语句末尾加分号 `;`
- 使用 `const` 优先，其次 `let`，禁用 `var`
- 使用箭头函数 `() => {}`
- 使用模板字符串 `` `${var}` ``

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

## 📁 项目结构

### 后端 (chat-admin-api)
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

## 🔐 安全规范

1. **密码**：使用 bcrypt 加密，不存储明文
2. **敏感信息**：不提交到 Git（用 .gitignore）
3. **输入验证**：所有用户输入都要验证
4. **SQL 注入**：使用参数化查询
5. **XSS**：对输出进行转义
6. **CORS**：配置允许的域名

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

*最后更新：2026-02-06 by 小琳*
