# Chat-Web JS → TS 迁移设计

**日期**: 2026-03-11
**作者**: 小琳
**状态**: 待实施

---

## 概述

将 chat-web 项目从 JavaScript 迁移到 TypeScript，与 chat-hub 保持技术栈一致。

---

## 目标

- 仅迁移 `.js` 文件（Vue 组件保持 `<script setup>`）
- 采用宽松类型检查（与 chat-hub 一致）
- 一天内完成迁移
- 创建完整的类型定义

---

## 迁移范围

### 需迁移文件（33个）

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `src/api/` | 14 | API 请求封装 |
| `src/stores/` | 10 | Pinia 状态管理 |
| `src/utils/` | 3 | 工具函数 |
| `src/router/` | 1 | 路由配置 |
| `src/tauri/` | 1 | Tauri 集成 |
| 根目录 | 4 | vite.config.js, main.js 等 |

### 不迁移文件
- `*.vue` 文件（87个）保持 `<script setup>` + JSDoc
- 测试文件（暂不迁移）

---

## 实施阶段

### Phase 1: 基础设施（0.5h）

#### 1.1 安装依赖
```bash
npm install -D typescript vue-tsc
```

#### 1.2 创建 tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.vue"
  ],
  "exclude": ["node_modules", "dist"]
}
```

#### 1.3 更新 package.json
```json
{
  "scripts": {
    "typecheck": "vue-tsc --noEmit"
  }
}
```

#### 1.4 重命名入口文件
- `src/main.js` → `src/main.ts`
- `index.html` 中的引用需要更新

---

### Phase 2: 类型定义（1h）

#### 2.1 目录结构
```
src/types/
├── api.ts      # API 响应类型
├── models.ts   # 数据模型类型
└── store.ts    # Store 状态类型
```

#### 2.2 类型定义

**api.ts** - API 响应类型
```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface LoginResponse extends ApiResponse {
  user?: import('./models').User;
  accessToken?: string;
  refreshToken?: string;
}
```

**models.ts** - 数据模型类型
```typescript
export interface User {
  id: string;
  username: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  senderName?: string;
  groupId?: string;
  timestamp: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  members: string[];
}

export interface Friend {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  status: 'online' | 'offline';
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  model?: string;
  systemPrompt?: string;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  skills: string[];
  createdAt: string;
}

export interface Sandbox {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  port?: number;
  createdAt: string;
}
```

**store.ts** - Store 状态类型
```typescript
import type { User, Group, Friend, Agent, Skill, Workspace, Task, Project, Sandbox } from './models';

export interface UserState {
  user: User | null;
  accessToken: string;
  refreshToken: string;
}

export interface GroupsState {
  groups: Group[];
  currentGroup: Group | null;
  loading: boolean;
}

export interface FriendsState {
  friends: Friend[];
  requests: Friend[];
  loading: boolean;
}

export interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  loading: boolean;
}

export interface SkillsState {
  skills: Skill[];
  loading: boolean;
}

export interface WorkspacesState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
}

export interface TasksState {
  tasks: Task[];
  loading: boolean;
}

export interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
}

export interface SandboxState {
  sandboxes: Sandbox[];
  loading: boolean;
}
```

---

### Phase 3: API 层迁移（1.5h）

#### 3.1 迁移顺序
1. `api/index.ts` - axios 实例（优先）
2. `api/auth.ts` - 认证 API
3. `api/user.ts` - 用户 API
4. `api/groups.ts` - 群组 API
5. `api/friends.ts` - 好友 API
6. `api/dm.ts` - 私信 API
7. `api/agents.ts` - Agent API
8. `api/skills.ts` - 技能 API
9. `api/workspace.ts` - 工作区 API
10. `api/tasks.ts` - 任务 API
11. `api/projects.ts` - 项目 API
12. `api/sandbox.ts` - 沙箱 API
13. `api/scheduler.ts` - 调度 API
14. `api/admin.ts` - 管理员 API
15. `api/observability.ts` - 可观测性 API

#### 3.2 迁移示例

**迁移前 (api/index.js)**
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // ...
  }
);

export default api;
```

**迁移后 (api/index.ts)**
```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types/api';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // ...
  }
);

export default api as {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
};
```

---

### Phase 4: Stores 层迁移（1.5h）

#### 4.1 迁移顺序
1. `stores/user.ts` - 用户状态（优先）
2. `stores/groups.ts` - 群组状态
3. `stores/friends.ts` - 好友状态
4. `stores/agents.ts` - Agent 状态
5. `stores/skills.ts` - 技能状态
6. `stores/workspace.ts` - 工作区状态
7. `stores/tasks.ts` - 任务状态
8. `stores/projects.ts` - 项目状态
9. `stores/sandbox.ts` - 沙箱状态
10. `stores/scheduler.ts` - 调度状态
11. `stores/settings.ts` - 设置状态

#### 4.2 迁移示例

**迁移前 (stores/user.js)**
```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const accessToken = ref(localStorage.getItem('accessToken') || '');

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);

  async function login(credentials) {
    const res = await authApi.login(credentials);
    if (res.success) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  return { user, accessToken, isLoggedIn, login };
});
```

**迁移后 (stores/user.ts)**
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import type { User, LoginResponse } from '@/types';

interface LoginCredentials {
  username: string;
  password: string;
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string>(localStorage.getItem('accessToken') || '');
  const refreshToken = ref<string>(localStorage.getItem('refreshToken') || '');

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const username = computed(() => user.value?.username || '');
  const nickname = computed(() => user.value?.nickname || user.value?.username || '');

  async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = await authApi.login(credentials);
    if (res.success) {
      setAuth(res.user!, res.accessToken!, res.refreshToken!);
    }
    return res;
  }

  function setAuth(userData: User, access: string, refresh: string): void {
    user.value = userData;
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  async function fetchUser(): Promise<User | null> {
    if (!accessToken.value) return null;
    try {
      const res = await authApi.getMe();
      if (res.success) {
        user.value = res.user!;
      }
      return res.user || null;
    } catch {
      logout();
      return null;
    }
  }

  async function logout(logoutAll = false): Promise<void> {
    try {
      if (refreshToken.value) {
        await authApi.logout(refreshToken.value, logoutAll);
      }
    } catch {
      // 忽略错误
    } finally {
      clearAuth();
    }
  }

  function clearAuth(): void {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  function updateUser(data: Partial<User>): void {
    if (user.value) {
      user.value = { ...user.value, ...data };
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoggedIn,
    isAdmin,
    username,
    nickname,
    login,
    setAuth,
    fetchUser,
    logout,
    clearAuth,
    updateUser
  };
});
```

---

### Phase 5: Utils 层迁移（0.5h）

#### 5.1 迁移文件
1. `utils/echarts.ts`
2. `utils/websocket.ts`
3. `utils/notification.ts`

---

### Phase 6: 其他文件迁移（0.5h）

#### 6.1 Router
- `router/index.ts`

#### 6.2 Tauri
- `tauri/index.ts`

#### 6.3 配置文件
- `vite.config.ts`
- `vitest.config.ts`

---

## 验证清单

### 编译验证
- [ ] `npm run typecheck` 无错误
- [ ] `npm run build` 构建成功
- [ ] `npm run dev` 开发服务器正常启动

### 功能验证
- [ ] 登录/注册功能正常
- [ ] 聊天功能正常
- [ ] 群组功能正常
- [ ] 私信功能正常

### 类型验证
- [ ] API 响应类型正确
- [ ] Store 状态类型正确
- [ ] 数据模型类型正确

---

## 交付物

| 文件 | 说明 |
|------|------|
| `tsconfig.json` | TypeScript 配置 |
| `src/types/api.ts` | API 响应类型定义 |
| `src/types/models.ts` | 数据模型类型定义 |
| `src/types/store.ts` | Store 状态类型定义 |
| `src/api/*.ts` | 迁移后的 API 文件（14个） |
| `src/stores/*.ts` | 迁移后的 Store 文件（10个） |
| `src/utils/*.ts` | 迁移后的工具文件（3个） |
| `src/router/index.ts` | 迁移后的路由文件 |
| `src/tauri/index.ts` | 迁移后的 Tauri 文件 |
| `src/main.ts` | 迁移后的入口文件 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 类型错误过多 | 使用宽松模式，逐步完善 |
| API 响应类型不匹配 | 参考后端类型定义 |
| 构建失败 | 分阶段验证，及时修复 |
| 功能回归 | 迁移后手动测试核心功能 |

---

## 后续优化

1. **渐进式严格化** - 逐步开启 `noImplicitAny`, `strictNullChecks`
2. **Vue 组件迁移** - 将 `<script setup>` 迁移到 TypeScript
3. **测试迁移** - 将测试文件迁移到 TypeScript
4. **类型完善** - 补充更多类型定义

---

**批准**: ________________
**日期**: ________________