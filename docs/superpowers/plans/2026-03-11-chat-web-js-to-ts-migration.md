# Chat-Web JS → TS 迁移实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 chat-web 项目从 JavaScript 迁移到 TypeScript，与 chat-hub 保持技术栈一致

**Architecture:** 增量迁移策略，按 api/ → types/ → stores/ → utils/ → router/ 顺序迁移，每阶段验证类型检查通过

**Tech Stack:** TypeScript 5.8, vue-tsc 2.2, Vite 7, Vue 3

---

## 文件结构

### 新建文件
```
chat-web/
├── tsconfig.json                    # TypeScript 配置
├── src/
│   ├── main.ts                      # 入口文件（从 main.js 迁移）
│   └── types/
│       ├── api.ts                   # API 响应类型
│       ├── models.ts                # 数据模型类型
│       └── store.ts                 # Store 状态类型
```

### 迁移文件
```
src/api/         # 14 个 .js → .ts
src/stores/      # 10 个 .js → .ts
src/utils/       # 3 个 .js → .ts
src/router/      # 1 个 .js → .ts
src/tauri/       # 1 个 .js → .ts
```

---

## Chunk 1: 基础设施配置

### Task 1: 安装 TypeScript 依赖

**Files:**
- Modify: `chat-web/package.json`

- [ ] **Step 1: 安装 TypeScript 和 vue-tsc**

```bash
cd chat-web && npm install -D typescript vue-tsc
```

Expected: 依赖安装成功

- [ ] **Step 2: 验证安装**

```bash
cd chat-web && npx tsc --version
```

Expected: `Version 5.8.3` 或更高

---

### Task 2: 创建 tsconfig.json

**Files:**
- Create: `chat-web/tsconfig.json`

- [ ] **Step 1: 创建 TypeScript 配置文件**

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

- [ ] **Step 2: 验证配置**

```bash
cd chat-web && npx tsc --noEmit
```

Expected: 无错误（或仅有预期的 JS 文件警告）

---

### Task 3: 更新 package.json 脚本

**Files:**
- Modify: `chat-web/package.json`

- [ ] **Step 1: 添加 typecheck 脚本**

在 `scripts` 中添加：
```json
{
  "scripts": {
    "typecheck": "vue-tsc --noEmit"
  }
}
```

- [ ] **Step 2: 验证脚本**

```bash
cd chat-web && npm run typecheck
```

Expected: 脚本可执行

---

### Task 4: 迁移入口文件 main.js

**Files:**
- Create: `chat-web/src/main.ts`
- Delete: `chat-web/src/main.js`
- Modify: `chat-web/index.html`

- [ ] **Step 1: 重命名 main.js 为 main.ts**

```bash
cd chat-web && mv src/main.js src/main.ts
```

- [ ] **Step 2: 更新 index.html 引用**

将 `<script type="module" src="/src/main.js"></script>` 改为：
```html
<script type="module" src="/src/main.ts"></script>
```

- [ ] **Step 3: 验证开发服务器**

```bash
cd chat-web && npm run dev
```

Expected: 开发服务器正常启动

- [ ] **Step 4: 提交**

```bash
cd chat-web && git add -A && git commit -m "feat(chat-web): setup TypeScript configuration"
```

---

## Chunk 2: 类型定义

### Task 5: 创建 API 响应类型

**Files:**
- Create: `chat-web/src/types/api.ts`

- [ ] **Step 1: 创建 types 目录**

```bash
mkdir -p chat-web/src/types
```

- [ ] **Step 2: 创建 api.ts**

```typescript
/**
 * API 响应类型定义
 * @author 小琳
 * @date 2026-03-11
 */

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

export interface RegisterResponse extends ApiResponse {
  user?: import('./models').User;
  accessToken?: string;
  refreshToken?: string;
}
```

---

### Task 6: 创建数据模型类型

**Files:**
- Create: `chat-web/src/types/models.ts`

- [ ] **Step 1: 创建 models.ts**

```typescript
/**
 * 数据模型类型定义
 * @author 小琳
 * @date 2026-03-11
 */

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
  senderAvatar?: string;
  groupId?: string;
  recipientId?: string;
  timestamp: string;
  type?: 'text' | 'image' | 'file';
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  members: GroupMember[];
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  nickname?: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Friend {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy';
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  files: WorkspaceFile[];
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  assigneeName?: string;
  dueDate?: string;
  projectId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: ProjectMember[];
  skills: string[];
  tasks: string[];
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Sandbox {
  id: string;
  name: string;
  image?: string;
  status: 'running' | 'stopped' | 'error' | 'creating';
  port?: number;
  containerId?: string;
  createdAt: string;
}

export interface SchedulerJob {
  id: string;
  name: string;
  cron: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'mention' | 'system' | 'friend_request';
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface ObservabilityMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
  uptime: number;
  connections: number;
}
```

---

### Task 7: 创建 Store 状态类型

**Files:**
- Create: `chat-web/src/types/store.ts`

- [ ] **Step 1: 创建 store.ts**

```typescript
/**
 * Store 状态类型定义
 * @author 小琳
 * @date 2026-03-11
 */

import type {
  User,
  Group,
  Friend,
  FriendRequest,
  Agent,
  Skill,
  Workspace,
  Task,
  Project,
  Sandbox,
  SchedulerJob,
  Notification
} from './models';

export interface UserState {
  user: User | null;
  accessToken: string;
  refreshToken: string;
}

export interface GroupsState {
  groups: Group[];
  currentGroup: Group | null;
  loading: boolean;
  error: string | null;
}

export interface FriendsState {
  friends: Friend[];
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;
}

export interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  loading: boolean;
  error: string | null;
}

export interface SkillsState {
  skills: Skill[];
  currentSkill: Skill | null;
  loading: boolean;
  error: string | null;
}

export interface WorkspacesState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
}

export interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  loading: boolean;
  error: string | null;
}

export interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
}

export interface SandboxState {
  sandboxes: Sandbox[];
  currentSandbox: Sandbox | null;
  loading: boolean;
  error: string | null;
}

export interface SchedulerState {
  jobs: SchedulerJob[];
  loading: boolean;
  error: string | null;
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  soundEnabled: boolean;
}

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}
```

- [ ] **Step 2: 创建类型索引文件**

```typescript
// chat-web/src/types/index.ts
export * from './api';
export * from './models';
export * from './store';
```

- [ ] **Step 3: 验证类型检查**

```bash
cd chat-web && npm run typecheck
```

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd chat-web && git add -A && git commit -m "feat(chat-web): add TypeScript type definitions"
```

---

## Chunk 3: API 层迁移

### Task 8: 迁移 api/index.js

**Files:**
- Create: `chat-web/src/api/index.ts`
- Delete: `chat-web/src/api/index.js`

- [ ] **Step 1: 创建 api/index.ts**

```typescript
/**
 * API 配置和 axios 实例
 * @author 小琳
 * @date 2026-02-06
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.code === 'TOKEN_EXPIRED' && 
        !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          
          if (res.data.success) {
            localStorage.setItem('accessToken', res.data.accessToken);
            localStorage.setItem('refreshToken', res.data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

export const configApi = {
  getStatus: () => api.get<ApiResponse>('/config/status')
};

export default api as {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<ApiResponse<T>>;
};
```

- [ ] **Step 2: 删除旧文件**

```bash
rm chat-web/src/api/index.js
```

---

### Task 9: 迁移 api/auth.js

**Files:**
- Create: `chat-web/src/api/auth.ts`
- Delete: `chat-web/src/api/auth.js`

- [ ] **Step 1: 读取原文件内容**

```bash
cat chat-web/src/api/auth.js
```

- [ ] **Step 2: 创建 auth.ts（根据原文件内容添加类型）**

参考原文件，添加类型注解后创建 `.ts` 文件。

- [ ] **Step 3: 删除旧文件**

```bash
rm chat-web/src/api/auth.js
```

---

### Task 10-21: 迁移其他 API 文件

**Files:**
- `api/user.ts` (从 user.js)
- `api/dm.ts` (从 dm.js)
- `api/groups.ts` (从 groups.js)
- `api/friends.ts` (从 friends.js)
- `api/agents.ts` (从 agents.js)
- `api/skills.ts` (从 skills.js)
- `api/workspace.ts` (从 workspace.js)
- `api/tasks.ts` (从 tasks.js)
- `api/projects.ts` (从 projects.js)
- `api/sandbox.ts` (从 sandbox.js)
- `api/scheduler.ts` (从 scheduler.js)
- `api/admin.ts` (从 admin.js)
- `api/observability.ts` (从 observability.js)

每个文件迁移步骤：
1. 读取原 `.js` 文件
2. 创建 `.ts` 文件，添加类型注解
3. 删除原 `.js` 文件
4. 验证 `npm run typecheck`

---

### Task 22: 验证 API 层迁移

- [ ] **Step 1: 运行类型检查**

```bash
cd chat-web && npm run typecheck
```

Expected: 无错误

- [ ] **Step 2: 提交**

```bash
cd chat-web && git add -A && git commit -m "feat(chat-web): migrate API layer to TypeScript"
```

---

## Chunk 4: Stores 层迁移

### Task 23: 迁移 stores/user.js

**Files:**
- Create: `chat-web/src/stores/user.ts`
- Delete: `chat-web/src/stores/user.js`

- [ ] **Step 1: 创建 stores/user.ts**

```typescript
/**
 * 用户状态管理
 * @author 小琳
 * @date 2026-02-06
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import type { User, LoginResponse, ApiResponse } from '@/types';

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
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
    if (res.success && res.user && res.accessToken && res.refreshToken) {
      setAuth(res.user, res.accessToken, res.refreshToken);
    }
    return res;
  }

  async function register(data: RegisterData): Promise<LoginResponse> {
    const res = await authApi.register(data);
    if (res.success && res.user && res.accessToken && res.refreshToken) {
      setAuth(res.user, res.accessToken, res.refreshToken);
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
      if (res.success && res.user) {
        user.value = res.user;
        return res.user;
      }
      return null;
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
    register,
    setAuth,
    fetchUser,
    logout,
    clearAuth,
    updateUser
  };
});
```

- [ ] **Step 2: 删除旧文件**

```bash
rm chat-web/src/stores/user.js
```

---

### Task 24-32: 迁移其他 Store 文件

**Files:**
- `stores/groups.ts` (从 groups.js)
- `stores/friends.ts` (从 friends.js)
- `stores/agents.ts` (从 agents.js)
- `stores/skills.ts` (从 skills.js)
- `stores/workspace.ts` (从 workspace.js)
- `stores/tasks.ts` (从 tasks.js)
- `stores/projects.ts` (从 projects.js)
- `stores/sandbox.ts` (从 sandbox.js)
- `stores/scheduler.ts` (从 scheduler.js)
- `stores/settings.ts` (从 settings.js)

每个文件迁移步骤：
1. 读取原 `.js` 文件
2. 创建 `.ts` 文件，添加类型注解
3. 删除原 `.js` 文件
4. 验证 `npm run typecheck`

---

### Task 33: 验证 Stores 层迁移

- [ ] **Step 1: 运行类型检查**

```bash
cd chat-web && npm run typecheck
```

Expected: 无错误

- [ ] **Step 2: 提交**

```bash
cd chat-web && git add -A && git commit -m "feat(chat-web): migrate Stores layer to TypeScript"
```

---

## Chunk 5: Utils 和 Router 迁移

### Task 34: 迁移 utils/echarts.js

**Files:**
- Create: `chat-web/src/utils/echarts.ts`
- Delete: `chat-web/src/utils/echarts.js`

---

### Task 35: 迁移 utils/websocket.js

**Files:**
- Create: `chat-web/src/utils/websocket.ts`
- Delete: `chat-web/src/utils/websocket.js`

---

### Task 36: 迁移 utils/notification.js

**Files:**
- Create: `chat-web/src/utils/notification.ts`
- Delete: `chat-web/src/utils/notification.js`

---

### Task 37: 迁移 router/index.js

**Files:**
- Create: `chat-web/src/router/index.ts`
- Delete: `chat-web/src/router/index.js`

---

### Task 38: 迁移 tauri/index.js

**Files:**
- Create: `chat-web/src/tauri/index.ts`
- Delete: `chat-web/src/tauri/index.js`

---

### Task 39: 验证 Utils 和 Router 迁移

- [ ] **Step 1: 运行类型检查**

```bash
cd chat-web && npm run typecheck
```

Expected: 无错误

- [ ] **Step 2: 提交**

```bash
cd chat-web && git add -A && git commit -m "feat(chat-web): migrate Utils and Router to TypeScript"
```

---

## Chunk 6: 最终验证

### Task 40: 完整构建验证

- [ ] **Step 1: 运行类型检查**

```bash
cd chat-web && npm run typecheck
```

Expected: 无错误

- [ ] **Step 2: 运行构建**

```bash
cd chat-web && npm run build
```

Expected: 构建成功

- [ ] **Step 3: 运行开发服务器**

```bash
cd chat-web && npm run dev
```

Expected: 开发服务器正常启动

- [ ] **Step 4: 手动功能测试**

测试以下功能：
- [ ] 登录/注册
- [ ] 聊天功能
- [ ] 群组功能
- [ ] 私信功能

---

### Task 41: 更新文档

**Files:**
- Modify: `chat-web/AGENTS.md`

- [ ] **Step 1: 更新技术栈说明**

将 JavaScript 改为 TypeScript

- [ ] **Step 2: 添加 typecheck 命令说明**

```markdown
## 常用命令

```bash
npm run typecheck    # TypeScript 类型检查
```
```

- [ ] **Step 3: 提交**

```bash
cd chat-web && git add -A && git commit -m "docs(chat-web): update documentation for TypeScript migration"
```

---

### Task 42: 最终提交

- [ ] **Step 1: 检查所有更改**

```bash
cd chat-web && git status
```

Expected: 无未提交的更改

- [ ] **Step 2: 推送到远程**

```bash
cd chat-web && git push origin dev
```

---

## 验收清单

- [ ] `npm run typecheck` 无错误
- [ ] `npm run build` 构建成功
- [ ] `npm run dev` 开发服务器正常
- [ ] 登录/注册功能正常
- [ ] 聊天功能正常
- [ ] 群组功能正常
- [ ] 私信功能正常
- [ ] 文档已更新

---

## 回滚方案

如果迁移失败，执行以下步骤回滚：

```bash
cd chat-web
git checkout dev -- .
git clean -fd
npm install
```

---

**预计时间**: 6 小时（一天内完成）