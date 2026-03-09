# Zero Token 与 chat-hub 混合集成方案

## 概述

Zero Token 是一个免费获取 AI 模型访问凭证的服务，通过浏览器登录各大 AI 平台后自动捕获凭证，让用户无需付费即可使用各种 AI 模型。本文档描述 Zero Token 与 chat-hub 的混合集成方案。

## 核心需求

1. **用户安装系统时自动部署 Zero Token** - 一键安装，自动配置
2. **指导用户配置 Zero Token** - 浏览器登录捕获凭证
3. **chat-hub 支持多种模型提供商** - 统一的 Provider 抽象层
4. **Zero Token 作为默认免费选项** - 优先使用免费资源
5. **用户可选择免费或付费** - 灵活的 Provider 切换机制

---

## 1. 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           chat-web (前端)                            │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
│  │  模型选择界面  │  │ Zero Token   │  │  Provider 状态显示      │ │
│  │               │  │ 配置向导      │  │                         │ │
│  └───────────────┘  └───────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓ HTTP API
┌─────────────────────────────────────────────────────────────────────┐
│                        chat-hub (后端)                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Provider Manager                             │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │ │
│  │  │ Zero Token  │ │  OpenAI     │ │   Local    │ │  Custom   │ │ │
│  │  │  Provider   │ │  Provider   │ │  Provider  │ │ Provider  │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Credential   │  │ Session      │  │  Provider Router         │  │
│  │ Manager      │  │ Manager      │  │  (优先级/故障转移)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        Zero Token Service                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ 浏览器自动化  │  │ 凭证捕获     │  │  Token 池管理            │  │
│  │ (Puppeteer)  │  │              │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Provider 抽象层

```typescript
// Provider 接口定义
interface ModelProvider {
  // 基础信息
  id: string;                    // Provider 唯一标识
  name: string;                  // 显示名称
  type: 'free' | 'paid' | 'local';  // 类型：免费/付费/本地
  priority: number;              // 优先级（数字越小越优先）
  
  // 模型列表
  models: ModelInfo[];
  
  // 状态
  status: 'online' | 'offline' | 'error' | 'configuring';
  healthCheck(): Promise<boolean>;
  
  // 对话接口
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk>;
  
  // 配置
  configure(config: ProviderConfig): Promise<void>;
  validateConfig(): Promise<ValidationResult>;
}

// 模型信息
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];  // ['chat', 'stream', 'vision', 'tools']
  contextWindow: number;
  maxOutput: number;
  pricing?: {
    input: number;   // 每千token价格
    output: number;
  };
}

// Provider 配置
interface ProviderConfig {
  apiKey?: string;
  apiEndpoint?: string;
  defaultModel?: string;
  params?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

// 凭证信息
interface Credential {
  id: string;
  provider: string;
  type: 'api_key' | 'session_token' | 'cookie';
  value: string;           // 加密存储
  expiresAt?: number;
  lastUsed?: number;
  status: 'valid' | 'expired' | 'invalid';
  source: 'zero_token' | 'manual' | 'env';
}
```

---

## 2. Provider 实现

### 2.1 Zero Token Provider

```typescript
/**
 * Zero Token Provider
 * 通过 Zero Token 服务获取免费模型访问
 */
class ZeroTokenProvider implements ModelProvider {
  id = 'zero-token';
  name = 'Zero Token (免费)';
  type: 'free' = 'free';
  priority = 1;  // 最高优先级
  
  models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o (via Zero Token)',
      provider: 'openai',
      capabilities: ['chat', 'stream', 'vision', 'tools'],
      contextWindow: 128000,
      maxOutput: 4096
    },
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet (via Zero Token)',
      provider: 'anthropic',
      capabilities: ['chat', 'stream', 'vision', 'tools'],
      contextWindow: 200000,
      maxOutput: 8192
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash (via Zero Token)',
      provider: 'google',
      capabilities: ['chat', 'stream', 'vision', 'tools'],
      contextWindow: 1000000,
      maxOutput: 8192
    }
  ];

  private credentialManager: CredentialManager;
  private zeroTokenService: ZeroTokenService;

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const credential = await this.credentialManager.getValidCredential('openai');
    if (!credential) {
      throw new Error('No valid Zero Token credential. Please configure Zero Token.');
    }

    // 使用捕获的凭证调用 API
    const response = await this.makeRequest(credential, messages, options);
    return response;
  }

  async chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    const credential = await this.credentialManager.getValidCredential('openai');
    if (!credential) {
      throw new Error('No valid Zero Token credential.');
    }

    yield* this.streamRequest(credential, messages, options);
  }

  async healthCheck(): Promise<boolean> {
    const credentials = await this.credentialManager.getAllCredentials();
    return credentials.some(c => c.status === 'valid');
  }
}
```

### 2.2 OpenAI Provider (付费)

```typescript
/**
 * OpenAI Provider
 * 使用官方 API Key 的付费选项
 */
class OpenAIProvider implements ModelProvider {
  id = 'openai';
  name = 'OpenAI (官方 API)';
  type: 'paid' = 'paid';
  priority = 10;  // 较低优先级

  models: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', ... },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', ... },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', ... }
  ];

  private apiKey: string;
  private endpoint = 'https://api.openai.com/v1';

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options?.model || 'gpt-4o',
        messages,
        ...options
      })
    });

    return response.json();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 2.3 Local Provider (Ollama/vLLM)

```typescript
/**
 * Local Provider
 * 本地部署的模型 (Ollama, vLLM, LM Studio 等)
 */
class LocalProvider implements ModelProvider {
  id = 'local';
  name = '本地模型';
  type: 'local' = 'local';
  priority = 5;  // 中等优先级

  models: ModelInfo[] = [];  // 动态获取

  private endpoint: string;  // 如 http://localhost:11434

  async refreshModels(): Promise<void> {
    // 从 Ollama 获取模型列表
    const response = await fetch(`${this.endpoint}/api/tags`);
    const data = await response.json();
    
    this.models = data.models.map(m => ({
      id: m.name,
      name: m.name,
      provider: 'local',
      capabilities: ['chat', 'stream'],
      contextWindow: 4096,  // 根据模型调整
      maxOutput: 2048
    }));
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: options?.model,
        messages,
        stream: false
      })
    });

    return response.json();
  }
}
```

---

## 3. Provider 路由机制

### 3.1 Provider Router

```typescript
/**
 * Provider Router
 * 根据优先级和可用性选择 Provider
 */
class ProviderRouter {
  private providers: Map<string, ModelProvider> = new Map();
  private credentials: CredentialManager;

  constructor() {
    // 注册 Provider（按优先级）
    this.register(new ZeroTokenProvider());  // priority: 1 (免费，最优先)
    this.register(new LocalProvider());       // priority: 5 (本地)
    this.register(new OpenAIProvider());      // priority: 10 (付费)
    this.register(new AnthropicProvider());   // priority: 10 (付费)
    // ... 其他 Provider
  }

  /**
   * 选择最优 Provider
   */
  async selectProvider(
    modelId: string,
    options: {
      preferFree?: boolean;
      excludeProviders?: string[];
      requireCapabilities?: string[];
    } = {}
  ): Promise<ModelProvider | null> {
    const { preferFree = true, excludeProviders = [], requireCapabilities = [] } = options;

    // 获取支持该模型的所有 Provider
    const candidates = Array.from(this.providers.values())
      .filter(p => !excludeProviders.includes(p.id))
      .filter(p => p.models.some(m => m.id === modelId))
      .filter(p => requireCapabilities.every(cap => 
        p.models.find(m => m.id === modelId)?.capabilities.includes(cap)
      ))
      .filter(p => p.status === 'online');

    // 如果偏好免费，优先选择免费 Provider
    if (preferFree) {
      const freeProvider = candidates.find(p => p.type === 'free');
      if (freeProvider && await freeProvider.healthCheck()) {
        return freeProvider;
      }
    }

    // 按优先级排序
    candidates.sort((a, b) => a.priority - b.priority);

    // 找到第一个可用的
    for (const provider of candidates) {
      if (await provider.healthCheck()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * 路由对话请求
   */
  async routeChat(
    messages: ChatMessage[],
    options: ChatOptions & { modelId: string }
  ): Promise<ChatResponse> {
    const provider = await this.selectProvider(options.modelId, {
      preferFree: options.preferFree ?? true
    });

    if (!provider) {
      throw new Error(`No available provider for model: ${options.modelId}`);
    }

    try {
      return await provider.chat(messages, options);
    } catch (error) {
      // 故障转移
      return this.failover(messages, options, provider.id);
    }
  }

  /**
   * 故障转移
   */
  private async failover(
    messages: ChatMessage[],
    options: ChatOptions,
    failedProviderId: string
  ): Promise<ChatResponse> {
    const provider = await this.selectProvider(options.modelId, {
      preferFree: options.preferFree,
      excludeProviders: [failedProviderId]
    });

    if (!provider) {
      throw new Error('All providers failed');
    }

    console.log(`[ProviderRouter] Failover from ${failedProviderId} to ${provider.id}`);
    return provider.chat(messages, options);
  }
}
```

---

## 4. Zero Token 服务设计

### 4.1 服务架构

```typescript
/**
 * Zero Token Service
 * 管理浏览器登录和凭证捕获
 */
class ZeroTokenService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private credentials: Map<string, Credential> = new Map();

  /**
   * 启动浏览器会话
   */
  async startSession(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,  // 显示浏览器供用户登录
      defaultViewport: null,
      args: ['--start-maximized']
    });
    this.context = await this.browser.createIncognitoBrowserContext();
  }

  /**
   * 引导用户登录平台
   */
  async guideLogin(platform: 'openai' | 'anthropic' | 'google'): Promise<Credential> {
    const urls = {
      openai: 'https://chat.openai.com',
      anthropic: 'https://claude.ai',
      google: 'https://aistudio.google.com'
    };

    const page = await this.context!.newPage();
    await page.goto(urls[platform]);

    // 监听网络请求，捕获凭证
    const credential = await this.captureCredential(page, platform);

    return credential;
  }

  /**
   * 捕获凭证
   */
  private async captureCredential(
    page: Page,
    platform: string
  ): Promise<Credential> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);  // 5 分钟超时

      // 监听请求，捕获 access token
      page.on('request', async (request) => {
        const headers = request.headers();
        
        // 检查 Authorization header
        if (headers.authorization?.startsWith('Bearer ')) {
          const token = headers.authorization.slice(7);
          
          // 验证 token 有效性
          if (await this.validateToken(token, platform)) {
            clearTimeout(timeout);
            
            const credential: Credential = {
              id: uuidv4(),
              provider: platform,
              type: 'session_token',
              value: this.encrypt(token),
              status: 'valid',
              source: 'zero_token'
            };
            
            this.credentials.set(platform, credential);
            resolve(credential);
          }
        }
      });

      // 监听 cookies 变化
      page.on('response', async () => {
        const cookies = await page.cookies();
        const sessionCookie = cookies.find(c => 
          c.name.includes('session') || c.name.includes('token')
        );
        
        if (sessionCookie) {
          // 保存 cookie 凭证
          const credential: Credential = {
            id: uuidv4(),
            provider: platform,
            type: 'cookie',
            value: this.encrypt(JSON.stringify(cookies)),
            status: 'valid',
            source: 'zero_token'
          };
          
          this.credentials.set(platform, credential);
        }
      });
    });
  }

  /**
   * 验证 token 有效性
   */
  private async validateToken(token: string, platform: string): Promise<boolean> {
    const endpoints = {
      openai: 'https://chat.openai.com/backend-api/me',
      anthropic: 'https://claude.ai/api/organizations',
      google: 'https://generativelanguage.googleapis.com/v1beta/models'
    };

    try {
      const response = await fetch(endpoints[platform], {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 加密凭证
   */
  private encrypt(value: string): string {
    const key = crypto.scryptSync(process.env.CREDENTIAL_SECRET || 'default', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }
}
```

### 4.2 凭证管理

```typescript
/**
 * Credential Manager
 * 管理所有 Provider 的凭证
 */
class CredentialManager {
  private db: Database;
  private encryptionKey: Buffer;

  async getValidCredential(provider: string): Promise<Credential | null> {
    const row = this.db.prepare(`
      SELECT * FROM credentials 
      WHERE provider = ? 
      AND status = 'valid'
      AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY last_used ASC
      LIMIT 1
    `).get(provider, Date.now());

    if (!row) return null;

    // 解密凭证
    const decrypted = this.decrypt(row.value);
    
    // 更新最后使用时间
    this.db.prepare(`
      UPDATE credentials SET last_used = ? WHERE id = ?
    `).run(Date.now(), row.id);

    return {
      ...row,
      value: decrypted
    };
  }

  async addCredential(credential: Omit<Credential, 'id'>): Promise<Credential> {
    const id = uuidv4();
    const encrypted = this.encrypt(credential.value);

    this.db.prepare(`
      INSERT INTO credentials (id, provider, type, value, status, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, credential.provider, credential.type, encrypted, 
           credential.status, credential.source, Date.now());

    return { ...credential, id, value: credential.value };
  }

  async removeCredential(id: string): Promise<void> {
    this.db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
  }

  async checkExpired(): Promise<void> {
    // 检查并标记过期凭证
    this.db.prepare(`
      UPDATE credentials 
      SET status = 'expired' 
      WHERE expires_at IS NOT NULL 
      AND expires_at < ?
    `).run(Date.now());
  }
}
```

---

## 5. 前端集成

### 5.1 模型选择组件

```vue
<template>
  <div class="model-selector">
    <!-- Provider 分组显示 -->
    <div class="provider-group" v-for="group in groupedProviders" :key="group.type">
      <div class="group-header">
        <span class="group-label">{{ group.label }}</span>
        <el-tag :type="group.type === 'free' ? 'success' : 'info'" size="small">
          {{ group.type === 'free' ? '免费' : group.type === 'local' ? '本地' : '付费' }}
        </el-tag>
      </div>

      <div class="models-list">
        <div 
          v-for="model in group.models" 
          :key="model.id"
          class="model-item"
          :class="{ active: selectedModel === model.id, disabled: !model.available }"
          @click="selectModel(model)"
        >
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-provider">{{ model.providerName }}</span>
          </div>
          <div class="model-meta">
            <el-tag v-if="model.tag" :type="model.tagType" size="small">{{ model.tag }}</el-tag>
            <el-icon v-if="selectedModel === model.id" color="#409eff"><Check /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- Zero Token 配置引导 -->
    <div v-if="showZeroTokenGuide" class="zero-token-guide">
      <el-alert type="info" :closable="false">
        <template #title>
          <el-icon><InfoFilled /></el-icon>
          使用 Zero Token 免费访问 AI 模型
        </template>
        <p>Zero Token 让您通过浏览器登录获取免费凭证，无需付费即可使用各种 AI 模型。</p>
        <el-button type="primary" size="small" @click="startZeroTokenSetup">
          配置 Zero Token
        </el-button>
      </el-alert>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Check, InfoFilled } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: String
});

const emit = defineEmits(['update:modelValue']);

const providers = ref([]);
const selectedModel = ref(props.modelValue);
const showZeroTokenGuide = ref(false);

// 按类型分组
const groupedProviders = computed(() => {
  const groups = {
    free: { type: 'free', label: '免费模型 (Zero Token)', models: [] },
    local: { type: 'local', label: '本地模型', models: [] },
    paid: { type: 'paid', label: '付费模型 (官方 API)', models: [] }
  };

  for (const provider of providers.value) {
    for (const model of provider.models) {
      groups[provider.type].models.push({
        ...model,
        providerName: provider.name,
        available: provider.status === 'online'
      });
    }
  }

  return Object.values(groups).filter(g => g.models.length > 0);
});

function selectModel(model) {
  if (!model.available) return;
  selectedModel.value = model.id;
  emit('update:modelValue', model.id);
}

async function loadProviders() {
  const response = await fetch('/api/providers');
  providers.value = await response.json();

  // 检查 Zero Token 是否配置
  const zeroToken = providers.value.find(p => p.id === 'zero-token');
  showZeroTokenGuide.value = zeroToken?.status === 'configuring';
}

async function startZeroTokenSetup() {
  // 打开 Zero Token 配置向导
  window.open('/settings/zero-token', '_blank');
}

onMounted(loadProviders);
</script>
```

### 5.2 Zero Token 配置向导

```vue
<template>
  <div class="zero-token-setup">
    <el-steps :active="currentStep" finish-status="success">
      <el-step title="安装依赖" />
      <el-step title="选择平台" />
      <el-step title="浏览器登录" />
      <el-step title="验证完成" />
    </el-steps>

    <!-- Step 1: 安装依赖 -->
    <div v-if="currentStep === 0" class="step-content">
      <h3>安装依赖</h3>
      <p>Zero Token 需要以下依赖：</p>
      
      <div class="dependency-list">
        <div class="dependency-item" :class="{ installed: deps.node }">
          <el-icon><SuccessFilled v-if="deps.node" /><WarningFilled v-else /></el-icon>
          <span>Node.js >= 18.0</span>
          <el-tag v-if="deps.node" type="success">已安装</el-tag>
          <el-tag v-else type="danger">未安装</el-tag>
        </div>
        
        <div class="dependency-item" :class="{ installed: deps.chrome }">
          <el-icon><SuccessFilled v-if="deps.chrome" /><WarningFilled v-else /></el-icon>
          <span>Chrome / Chromium</span>
          <el-tag v-if="deps.chrome" type="success">已安装</el-tag>
          <el-tag v-else type="warning">点击安装</el-tag>
        </div>
      </div>

      <el-button 
        type="primary" 
        :disabled="!deps.node"
        @click="currentStep = 1"
      >
        下一步
      </el-button>
    </div>

    <!-- Step 2: 选择平台 -->
    <div v-if="currentStep === 1" class="step-content">
      <h3>选择要登录的平台</h3>
      <p>选择您要配置的 AI 平台，我们将打开浏览器引导您登录。</p>

      <div class="platform-list">
        <div 
          v-for="platform in platforms" 
          :key="platform.id"
          class="platform-item"
          :class="{ selected: selectedPlatforms.includes(platform.id), configured: platform.configured }"
          @click="togglePlatform(platform.id)"
        >
          <img :src="platform.icon" :alt="platform.name" class="platform-icon" />
          <span class="platform-name">{{ platform.name }}</span>
          <el-tag v-if="platform.configured" type="success" size="small">已配置</el-tag>
        </div>
      </div>

      <div class="actions">
        <el-button @click="currentStep = 0">上一步</el-button>
        <el-button 
          type="primary" 
          :disabled="selectedPlatforms.length === 0"
          @click="startLoginProcess"
        >
          开始登录
        </el-button>
      </div>
    </div>

    <!-- Step 3: 浏览器登录 -->
    <div v-if="currentStep === 2" class="step-content">
      <h3>正在登录 {{ currentPlatform?.name }}</h3>
      
      <div class="login-progress">
        <el-progress 
          :percentage="loginProgress" 
          :status="loginStatus"
        />
        
        <div class="login-instructions">
          <p v-if="loginStatus === ''">
            <el-icon class="loading"><Loading /></el-icon>
            正在打开浏览器...
          </p>
          <p v-else-if="loginStatus === 'warning'">
            请在打开的浏览器窗口中登录您的 {{ currentPlatform?.name }} 账号
          </p>
          <p v-else-if="loginStatus === 'success'">
            <el-icon><SuccessFilled /></el-icon>
            登录成功！凭证已获取
          </p>
        </div>
      </div>

      <div class="actions">
        <el-button 
          v-if="currentPlatformIndex < selectedPlatforms.length - 1"
          type="primary"
          :disabled="loginStatus !== 'success'"
          @click="loginNextPlatform"
        >
          登录下一个平台
        </el-button>
        <el-button 
          v-else
          type="primary"
          :disabled="loginStatus !== 'success'"
          @click="currentStep = 3"
        >
          完成
        </el-button>
      </div>
    </div>

    <!-- Step 4: 验证完成 -->
    <div v-if="currentStep === 3" class="step-content">
      <div class="success-result">
        <el-icon :size="64" color="#67c23a"><SuccessFilled /></el-icon>
        <h3>配置完成！</h3>
        <p>您已成功配置以下平台的 Zero Token 凭证：</p>
        
        <div class="configured-platforms">
          <el-tag 
            v-for="platform in configuredPlatforms" 
            :key="platform"
            type="success"
            size="large"
          >
            {{ getPlatformName(platform) }}
          </el-tag>
        </div>

        <p class="tips">
          现在您可以在聊天时选择 Zero Token 提供的免费模型了！
        </p>

        <el-button type="primary" @click="goToChat">
          开始聊天
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { SuccessFilled, WarningFilled, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const currentStep = ref(0);
const deps = ref({ node: false, chrome: false });
const platforms = ref([
  { id: 'openai', name: 'OpenAI (ChatGPT)', icon: '/icons/openai.svg', configured: false },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '/icons/anthropic.svg', configured: false },
  { id: 'google', name: 'Google (Gemini)', icon: '/icons/google.svg', configured: false }
]);
const selectedPlatforms = ref([]);
const currentPlatformIndex = ref(0);
const loginProgress = ref(0);
const loginStatus = ref('');

const currentPlatform = computed(() => 
  platforms.value.find(p => p.id === selectedPlatforms.value[currentPlatformIndex.value])
);

const configuredPlatforms = computed(() =>
  platforms.value.filter(p => p.configured).map(p => p.id)
);

async function checkDependencies() {
  const response = await fetch('/api/zero-token/dependencies');
  deps.value = await response.json();
}

function togglePlatform(id) {
  const index = selectedPlatforms.value.indexOf(id);
  if (index > -1) {
    selectedPlatforms.value.splice(index, 1);
  } else {
    selectedPlatforms.value.push(id);
  }
}

async function startLoginProcess() {
  currentStep.value = 2;
  currentPlatformIndex.value = 0;
  await loginPlatform(selectedPlatforms.value[0]);
}

async function loginPlatform(platformId) {
  loginProgress.value = 0;
  loginStatus.value = '';

  // 调用后端启动浏览器登录
  const response = await fetch('/api/zero-token/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: platformId })
  });

  // 使用 SSE 接收进度
  const eventSource = new EventSource('/api/zero-token/login-progress');
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    loginProgress.value = data.progress;
    
    if (data.status === 'waiting_login') {
      loginStatus.value = 'warning';
    } else if (data.status === 'success') {
      loginStatus.value = 'success';
      const platform = platforms.value.find(p => p.id === platformId);
      if (platform) platform.configured = true;
      eventSource.close();
    } else if (data.status === 'error') {
      loginStatus.value = 'exception';
      ElMessage.error(data.message);
      eventSource.close();
    }
  };
}

function loginNextPlatform() {
  currentPlatformIndex.value++;
  loginPlatform(selectedPlatforms.value[currentPlatformIndex.value]);
}

function getPlatformName(id) {
  return platforms.value.find(p => p.id === id)?.name || id;
}

function goToChat() {
  window.location.href = '/chat';
}

onMounted(checkDependencies);
</script>
```

---

## 6. 安装脚本

### 6.1 一键安装脚本

```bash
#!/bin/bash
# Zero Token + chat-hub 一键安装脚本
# @version 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$HOME/.openclaw/chat-data"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Zero Token + chat-hub 一键安装脚本 v1.0.0               ║"
echo "║                                                              ║"
echo "║  免费使用 GPT-4、Claude、Gemini 等 AI 模型                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. 检查操作系统
check_os() {
    log_info "检查操作系统..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if command -v apt-get &> /dev/null; then
            PKG_MANAGER="apt"
        elif command -v yum &> /dev/null; then
            PKG_MANAGER="yum"
        elif command -v pacman &> /dev/null; then
            PKG_MANAGER="pacman"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        PKG_MANAGER="choco"
    else
        log_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    log_success "检测到操作系统: $OS"
}

# 2. 检查并安装 Node.js
check_nodejs() {
    log_info "检查 Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2)
        MIN_VERSION="18.0.0"
        
        if [ "$(printf '%s\n' "$MIN_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$MIN_VERSION" ]; then
            log_success "Node.js 版本: $NODE_VERSION"
            return 0
        else
            log_warn "Node.js 版本过低 ($NODE_VERSION)，需要 >= 18.0.0"
        fi
    fi
    
    # 安装 Node.js
    log_info "正在安装 Node.js..."
    
    if [[ "$OS" == "linux" ]]; then
        if [[ "$PKG_MANAGER" == "apt" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [[ "$PKG_MANAGER" == "yum" ]]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        fi
    elif [[ "$OS" == "macos" ]]; then
        brew install node
    fi
    
    log_success "Node.js 安装完成: $(node -v)"
}

# 3. 检查并安装 pnpm
check_pnpm() {
    log_info "检查 pnpm..."
    
    if ! command -v pnpm &> /dev/null; then
        log_info "正在安装 pnpm..."
        npm install -g pnpm
    fi
    
    log_success "pnpm 版本: $(pnpm -v)"
}

# 4. 检查并安装 Chrome
check_chrome() {
    log_info "检查 Chrome/Chromium..."
    
    local chrome_found=false
    
    if [[ "$OS" == "linux" ]]; then
        if command -v google-chrome &> /dev/null || command -v chromium-browser &> /dev/null; then
            chrome_found=true
        fi
    elif [[ "$OS" == "macos" ]]; then
        if [ -d "/Applications/Google Chrome.app" ]; then
            chrome_found=true
        fi
    fi
    
    if $chrome_found; then
        log_success "Chrome/Chromium 已安装"
        return 0
    fi
    
    log_info "正在安装 Chrome..."
    
    if [[ "$OS" == "linux" ]]; then
        if [[ "$PKG_MANAGER" == "apt" ]]; then
            wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
            echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
            sudo apt-get update
            sudo apt-get install -y google-chrome-stable
        elif [[ "$PKG_MANAGER" == "yum" ]]; then
            sudo yum install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        fi
    elif [[ "$OS" == "macos" ]]; then
        brew install --cask google-chrome
    fi
    
    log_success "Chrome 安装完成"
}

# 5. 安装 chat-hub
install_chat_hub() {
    log_info "安装 chat-hub..."
    
    cd "$PROJECT_DIR/chat-hub"
    
    if [ ! -d "node_modules" ]; then
        pnpm install
    fi
    
    # 创建数据目录
    mkdir -p "$DATA_DIR"
    
    # 创建默认配置
    if [ ! -f "config/local.json" ]; then
        cat > config/local.json << EOF
{
  "port": 8273,
  "bot": {
    "name": "AI助手",
    "local": true
  },
  "providers": {
    "default": "zero-token",
    "zeroToken": {
      "enabled": true,
      "priority": 1
    },
    "openai": {
      "enabled": false,
      "priority": 10
    },
    "local": {
      "enabled": true,
      "endpoint": "http://localhost:11434",
      "priority": 5
    }
  }
}
EOF
    fi
    
    log_success "chat-hub 安装完成"
}

# 6. 安装 Zero Token 服务
install_zero_token() {
    log_info "安装 Zero Token 服务..."
    
    cd "$PROJECT_DIR/chat-hub"
    
    # 安装 Puppeteer
    pnpm add puppeteer
    
    # 创建 Zero Token 服务目录
    mkdir -p src/zero-token
    
    # 复制服务文件
    cp -r "$PROJECT_DIR/scripts/zero-token"/* src/zero-token/
    
    # 初始化数据库表
    node scripts/init-zero-token-db.js
    
    log_success "Zero Token 服务安装完成"
}

# 7. 安装前端
install_frontend() {
    log_info "安装前端..."
    
    cd "$PROJECT_DIR/chat-web"
    pnpm install
    pnpm build
    
    log_success "前端安装完成"
}

# 8. 配置 systemd 服务 (Linux)
setup_systemd() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    
    log_info "配置 systemd 服务..."
    
    cat > /tmp/chat-hub.service << EOF
[Unit]
Description=Chat Hub - AI Chat Message Hub
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/chat-hub
ExecStart=$(which node) src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/chat-hub.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable chat-hub
    
    log_success "systemd 服务配置完成"
}

# 9. 启动服务
start_services() {
    log_info "启动服务..."
    
    if [[ "$OS" == "linux" ]]; then
        sudo systemctl start chat-hub
    else
        cd "$PROJECT_DIR/chat-hub"
        nohup node src/index.js > /tmp/chat-hub.log 2>&1 &
    fi
    
    sleep 3
    
    # 检查服务状态
    if curl -s http://localhost:8273/health > /dev/null; then
        log_success "服务启动成功"
    else
        log_warn "服务可能未正常启动，请检查日志"
    fi
}

# 10. 显示完成信息
show_completion() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 🎉 安装完成！                                ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║                                                              ║"
    echo "║  🌐 访问地址: http://localhost:8273                         ║"
    echo "║                                                              ║"
    echo "║  📋 下一步:                                                  ║"
    echo "║     1. 打开浏览器访问上述地址                                ║"
    echo "║     2. 进入「设置」→「Zero Token 配置」                      ║"
    echo "║     3. 按照向导登录各 AI 平台                                ║"
    echo "║     4. 开始使用免费 AI 模型！                                ║"
    echo "║                                                              ║"
    echo "║  💡 常用命令:                                                ║"
    echo "║     查看状态: systemctl status chat-hub                      ║"
    echo "║     查看日志: journalctl -u chat-hub -f                      ║"
    echo "║     重启服务: sudo systemctl restart chat-hub                ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# 主安装流程
main() {
    check_os
    check_nodejs
    check_pnpm
    check_chrome
    install_chat_hub
    install_zero_token
    install_frontend
    setup_systemd
    start_services
    show_completion
}

# 执行安装
main "$@"
```

---

## 7. API 设计

### 7.1 Provider API

```yaml
# OpenAPI 3.0 规范
openapi: 3.0.0
info:
  title: chat-hub Provider API
  version: 1.0.0

paths:
  /api/providers:
    get:
      summary: 获取所有 Provider
      responses:
        200:
          description: Provider 列表
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Provider'

  /api/providers/{providerId}/models:
    get:
      summary: 获取 Provider 的模型列表
      parameters:
        - name: providerId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: 模型列表
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ModelInfo'

  /api/providers/{providerId}/configure:
    post:
      summary: 配置 Provider
      parameters:
        - name: providerId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProviderConfig'
      responses:
        200:
          description: 配置成功

  /api/chat:
    post:
      summary: 发送聊天消息
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChatRequest'
      responses:
        200:
          description: 聊天响应
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChatResponse'

  /api/zero-token/dependencies:
    get:
      summary: 检查 Zero Token 依赖
      responses:
        200:
          description: 依赖状态

  /api/zero-token/login:
    post:
      summary: 启动 Zero Token 登录流程
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                platform:
                  type: string
                  enum: [openai, anthropic, google]
      responses:
        200:
          description: 登录流程已启动

  /api/zero-token/credentials:
    get:
      summary: 获取 Zero Token 凭证列表
      responses:
        200:
          description: 凭证列表

components:
  schemas:
    Provider:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        type:
          type: string
          enum: [free, paid, local]
        priority:
          type: integer
        status:
          type: string
          enum: [online, offline, error, configuring]
        models:
          type: array
          items:
            $ref: '#/components/schemas/ModelInfo'

    ModelInfo:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        provider:
          type: string
        capabilities:
          type: array
          items:
            type: string
        contextWindow:
          type: integer
        maxOutput:
          type: integer

    ProviderConfig:
      type: object
      properties:
        apiKey:
          type: string
        apiEndpoint:
          type: string
        defaultModel:
          type: string
        params:
          type: object

    ChatRequest:
      type: object
      required:
        - messages
      properties:
        messages:
          type: array
          items:
            $ref: '#/components/schemas/ChatMessage'
        model:
          type: string
        provider:
          type: string
        stream:
          type: boolean
        preferFree:
          type: boolean
          default: true

    ChatMessage:
      type: object
      required:
        - role
        - content
      properties:
        role:
          type: string
          enum: [system, user, assistant]
        content:
          type: string

    ChatResponse:
      type: object
      properties:
        id:
          type: string
        choices:
          type: array
          items:
            type: object
            properties:
              message:
                $ref: '#/components/schemas/ChatMessage'
              finish_reason:
                type: string
        usage:
          type: object
          properties:
            prompt_tokens:
              type: integer
            completion_tokens:
              type: integer
            total_tokens:
              type: integer
        provider:
          type: string
```

---

## 8. 数据库设计

### 8.1 表结构

```sql
-- providers 表
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('free', 'paid', 'local')),
  priority INTEGER DEFAULT 10,
  status TEXT DEFAULT 'offline',
  config TEXT,  -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- models 表
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capabilities TEXT,  -- JSON array
  context_window INTEGER DEFAULT 4096,
  max_output INTEGER DEFAULT 2048,
  pricing TEXT,  -- JSON
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- credentials 表
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('api_key', 'session_token', 'cookie')),
  value TEXT NOT NULL,  -- 加密存储
  expires_at INTEGER,
  last_used INTEGER,
  status TEXT DEFAULT 'valid' CHECK(status IN ('valid', 'expired', 'invalid')),
  source TEXT DEFAULT 'manual' CHECK(source IN ('zero_token', 'manual', 'env')),
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- zero_token_sessions 表
CREATE TABLE IF NOT EXISTS zero_token_sessions (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  credential_id TEXT,
  error_message TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  completed_at INTEGER,
  FOREIGN KEY (credential_id) REFERENCES credentials(id)
);

-- provider_usage 表（用量统计）
CREATE TABLE IF NOT EXISTS provider_usage (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  user_id TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  latency_ms INTEGER,
  success INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON provider_usage(provider_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON provider_usage(created_at);
```

---

## 9. 错误处理

### 9.1 错误类型

```typescript
enum ProviderErrorType {
  // 配置错误
  NOT_CONFIGURED = 'not_configured',
  INVALID_CONFIG = 'invalid_config',
  
  // 凭证错误
  CREDENTIAL_EXPIRED = 'credential_expired',
  CREDENTIAL_INVALID = 'credential_invalid',
  NO_CREDENTIAL = 'no_credential',
  
  // 请求错误
  RATE_LIMITED = 'rate_limited',
  MODEL_NOT_FOUND = 'model_not_found',
  CONTEXT_TOO_LONG = 'context_too_long',
  
  // 网络错误
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  
  // 服务错误
  PROVIDER_OFFLINE = 'provider_offline',
  ALL_PROVIDERS_FAILED = 'all_providers_failed'
}

class ProviderError extends Error {
  type: ProviderErrorType;
  providerId?: string;
  retryable: boolean;
  fallbackProvider?: string;

  constructor(
    type: ProviderErrorType,
    message: string,
    options?: {
      providerId?: string;
      retryable?: boolean;
      fallbackProvider?: string;
    }
  ) {
    super(message);
    this.type = type;
    this.providerId = options?.providerId;
    this.retryable = options?.retryable ?? false;
    this.fallbackProvider = options?.fallbackProvider;
  }
}
```

### 9.2 错误处理策略

```typescript
class ErrorHandler {
  /**
   * 处理 Provider 错误
   */
  async handleError(
    error: ProviderError,
    request: ChatRequest
  ): Promise<ChatResponse | null> {
    switch (error.type) {
      case ProviderErrorType.CREDENTIAL_EXPIRED:
        // 尝试刷新凭证
        await this.refreshCredential(error.providerId!);
        return null; // 需要重试

      case ProviderErrorType.RATE_LIMITED:
        // 等待后重试或切换 Provider
        if (error.fallbackProvider) {
          return this.routeToProvider(error.fallbackProvider, request);
        }
        await this.waitForRateLimit(error.providerId!);
        return null;

      case ProviderErrorType.PROVIDER_OFFLINE:
        // 自动故障转移
        return this.failover(error.providerId!, request);

      case ProviderErrorType.ALL_PROVIDERS_FAILED:
        // 所有 Provider 都失败了
        throw new Error('暂时无法提供服务，请稍后再试');

      default:
        throw error;
    }
  }

  /**
   * 故障转移
   */
  private async failover(
    failedProviderId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const router = new ProviderRouter();
    const provider = await router.selectProvider(request.model, {
      preferFree: request.preferFree,
      excludeProviders: [failedProviderId]
    });

    if (!provider) {
      throw new ProviderError(
        ProviderErrorType.ALL_PROVIDERS_FAILED,
        'No available provider'
      );
    }

    return provider.chat(request.messages, request);
  }
}
```

---

## 10. 配置示例

### 10.1 完整配置文件

```json
{
  "port": 8273,
  "bot": {
    "name": "AI助手",
    "local": true
  },
  "providers": {
    "default": "zero-token",
    "zeroToken": {
      "enabled": true,
      "priority": 1,
      "models": [
        "gpt-4o",
        "claude-3-5-sonnet",
        "gemini-2.0-flash"
      ],
      "credentialsPath": "~/.openclaw/zero-token-credentials.json"
    },
    "openai": {
      "enabled": true,
      "priority": 10,
      "apiKey": "${OPENAI_API_KEY}",
      "endpoint": "https://api.openai.com/v1",
      "models": [
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-3.5-turbo"
      ]
    },
    "anthropic": {
      "enabled": true,
      "priority": 10,
      "apiKey": "${ANTHROPIC_API_KEY}",
      "endpoint": "https://api.anthropic.com/v1",
      "models": [
        "claude-3-5-sonnet",
        "claude-3-opus",
        "claude-3-haiku"
      ]
    },
    "local": {
      "enabled": true,
      "priority": 5,
      "type": "ollama",
      "endpoint": "http://localhost:11434",
      "models": []
    }
  },
  "routing": {
    "preferFree": true,
    "failoverEnabled": true,
    "maxRetries": 3,
    "retryDelay": 1000
  },
  "zeroToken": {
    "browserPath": "/usr/bin/google-chrome",
    "headless": false,
    "loginTimeout": 300000,
    "platforms": {
      "openai": {
        "loginUrl": "https://chat.openai.com",
        "tokenPattern": "Bearer (.+)"
      },
      "anthropic": {
        "loginUrl": "https://claude.ai",
        "tokenPattern": "Bearer (.+)"
      },
      "google": {
        "loginUrl": "https://aistudio.google.com",
        "tokenPattern": "Bearer (.+)"
      }
    }
  }
}
```

---

## 11. 总结

本方案实现了 Zero Token 与 chat-hub 的完整集成：

1. **一键安装** - 自动检测和安装所有依赖，无需手动配置
2. **Provider 抽象层** - 统一的接口，支持免费/付费/本地三种类型
3. **智能路由** - 按优先级自动选择 Provider，支持故障转移
4. **配置向导** - 可视化引导用户登录各平台获取凭证
5. **安全存储** - 凭证加密存储，支持过期检测
6. **灵活切换** - 用户可自由选择免费或付费选项

### 下一步工作

1. 实现具体的 Provider 代码
2. 完善前端配置界面
3. 添加更多 AI 平台支持
4. 编写单元测试和集成测试
5. 编写用户文档