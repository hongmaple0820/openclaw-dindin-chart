# Chat-Web Frontend

**Generated:** 2026-03-08
**Score:** 12 (Distinct Domain)

---

## OVERVIEW

Vue 3 + Vite 前端，支持 Tauri 桌面端。116 个源文件。

---

## STRUCTURE

```
src/
├── api/            # API 请求封装
├── components/     # 公共组件
├── layouts/        # 布局组件
├── router/         # Vue Router 配置
├── stores/         # Pinia 状态管理
├── styles/         # 全局样式
├── tauri/          # Tauri 桌面端集成
├── utils/          # 工具函数
├── views/          # 页面组件
├── App.vue         # 根组件
└── main.js         # 入口
```

---

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 新增页面 | `views/` | Vue SFC |
| 公共组件 | `components/` | 可复用组件 |
| API 调用 | `api/` | fetch 封装 |
| 状态管理 | `stores/` | Pinia stores |
| 路由配置 | `router/` | Vue Router |
| 桌面端功能 | `tauri/` | Tauri API 调用 |

---

## CONVENTIONS (chat-web specific)

### Vue 组件
```vue
<template>
  <!-- 模板 -->
</template>

<script setup>
// Composition API
import { ref, onMounted } from 'vue';

const props = defineProps({ ... });
const emit = defineEmits(['update']);
</script>

<style scoped>
/* 样式 */
</style>
```

### API 调用
```javascript
// api/chat.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8273';

export async function getMessages() {
  const res = await fetch(`${API_BASE}/api/v1/messages`);
  return res.json();
}
```

### Tauri 集成
```javascript
// 检测桌面环境
const isTauri = window.__TAURI__ !== undefined;

// 调用 Tauri API
if (isTauri) {
  const { invoke } = window.__TAURI__;
  await invoke('some_command');
}
```

---

## ANTI-PATTERNS

- **禁用 Options API** - 使用 `<script setup>`
- **禁用 `var`** - 使用 `const`/`let`
- **禁用内联样式** - 使用 `<style scoped>`
- **禁用硬编码 API URL** - 使用环境变量

---

## COMMANDS

```bash
# 开发
npm run dev           # Vite 开发服务器 (端口 5173)

# 构建
npm run build         # Vite 构建 → dist/
npm run preview       # 预览构建结果

# 桌面端
npm run tauri:build   # Tauri 桌面应用构建
```

---

## NOTES

- 支持浏览器和 Tauri 桌面端双模式
- 使用 `auto-imports.d.ts` 自动导入
- 品牌色彩: `--fenlin-primary: #C41E3A`