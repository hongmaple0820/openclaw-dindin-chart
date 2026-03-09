/**
 * Zero Token Provider - 零成本 AI 模型访问
 * 
 * 通过 Zero Token 服务获取免费模型访问凭证
 * 支持通过浏览器登录捕获各平台的 session token
 * 
 * @version 1.0.0
 */

import { BaseProvider } from './base';
import {
  ProviderConfig,
  ProviderStatus,
  ProviderType,
  ModelInfo,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatStreamChunk,
  CredentialValidation,
  ProviderError,
  ProviderErrorType,
  Credential,
  TokenUsage
} from './types';
import crypto from 'crypto';

/**
 * Zero Token Provider 配置
 */
interface ZeroTokenConfig extends ProviderConfig {
  credentialsPath?: string;
  platforms?: {
    openai?: { enabled: boolean };
    anthropic?: { enabled: boolean };
    google?: { enabled: boolean };
  };
}

/**
 * 平台配置
 */
interface PlatformConfig {
  id: string;
  name: string;
  endpoint: string;
  modelsEndpoint?: string;
  headers?: Record<string, string>;
}

/**
 * Zero Token Provider
 * 
 * 免费访问 GPT-4、Claude、Gemini 等 AI 模型
 */
export class ZeroTokenProvider extends BaseProvider {
  id = 'zero-token';
  name = 'zero-token';
  displayName = 'Zero Token (免费)';
  type: ProviderType = 'free';
  
  protected _priority = 1; // 最高优先级
  protected _status: ProviderStatus = 'configuring';

  private credentials: Map<string, Credential> = new Map();
  private platforms: Map<string, PlatformConfig> = new Map([
    ['openai', {
      id: 'openai',
      name: 'OpenAI',
      endpoint: 'https://chat.openai.com/backend-api',
      modelsEndpoint: 'https://chat.openai.com/backend-api/models'
    }],
    ['anthropic', {
      id: 'anthropic',
      name: 'Anthropic',
      endpoint: 'https://claude.ai/api',
      headers: {
        'Accept': 'application/json'
      }
    }],
    ['google', {
      id: 'google',
      name: 'Google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta'
    }]
  ]);

  private encryptionKey: Buffer;

  constructor() {
    super();
    
    // 初始化加密密钥
    this.encryptionKey = crypto.scryptSync(
      process.env.ZERO_TOKEN_SECRET || 'zero-token-default-key',
      'salt',
      32
    );

    // 初始化模型列表
    this.initModels();
  }

  /**
   * 初始化模型列表
   */
  private initModels(): void {
    this._models = [
      // OpenAI 模型
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        displayName: 'GPT-4o (via Zero Token)',
        description: '最新的 GPT-4 优化版本',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 128000,
        maxOutput: 4096,
        tags: ['推荐', '多模态']
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        displayName: 'GPT-4 Turbo (via Zero Token)',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 128000,
        maxOutput: 4096,
        tags: ['多模态']
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        displayName: 'GPT-3.5 Turbo (via Zero Token)',
        capabilities: {
          chat: true,
          stream: true,
          vision: false,
          tools: true,
          embeddings: false
        },
        contextWindow: 16385,
        maxOutput: 4096,
        tags: ['快速', '经济']
      },

      // Anthropic 模型
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        displayName: 'Claude 3.5 Sonnet (via Zero Token)',
        description: '最新的 Claude 3.5 版本',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 200000,
        maxOutput: 8192,
        tags: ['推荐', '多模态']
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        displayName: 'Claude 3 Opus (via Zero Token)',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 200000,
        maxOutput: 4096,
        tags: ['最强']
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        displayName: 'Claude 3 Haiku (via Zero Token)',
        capabilities: {
          chat: true,
          stream: true,
          vision: false,
          tools: true,
          embeddings: false
        },
        contextWindow: 200000,
        maxOutput: 4096,
        tags: ['快速', '经济']
      },

      // Google 模型
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        displayName: 'Gemini 2.0 Flash (via Zero Token)',
        description: '最新的 Gemini 2.0 实验版',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 1000000,
        maxOutput: 8192,
        tags: ['推荐', '超长上下文']
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        displayName: 'Gemini 1.5 Pro (via Zero Token)',
        capabilities: {
          chat: true,
          stream: true,
          vision: true,
          tools: true,
          embeddings: false
        },
        contextWindow: 1000000,
        maxOutput: 8192,
        tags: ['超长上下文']
      }
    ];
  }

  /**
   * 配置 Provider
   */
  async configure(config: ZeroTokenConfig): Promise<void> {
    this._config = config;
    
    // 加载已保存的凭证
    if (config.credentialsPath) {
      await this.loadCredentials(config.credentialsPath);
    }

    // 更新状态
    if (this.credentials.size > 0) {
      await this.healthCheck();
    } else {
      this._status = 'configuring';
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<CredentialValidation> {
    if (this.credentials.size === 0) {
      return {
        valid: false,
        error: 'No credentials configured. Please login via Zero Token.'
      };
    }

    // 检查凭证有效性
    let validCount = 0;
    for (const [platform, credential] of this.credentials) {
      const validation = await this.validateCredential(credential);
      if (validation.valid) {
        validCount++;
      } else {
        // 标记凭证为无效
        credential.status = 'invalid';
      }
    }

    if (validCount === 0) {
      return {
        valid: false,
        error: 'All credentials are invalid. Please re-login.'
      };
    }

    return { valid: true };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (this.credentials.size === 0) {
      this._status = 'configuring';
      return false;
    }

    // 检查每个平台的凭证
    let hasValid = false;
    for (const [platform, credential] of this.credentials) {
      const validation = await this.validateCredential(credential);
      if (validation.valid) {
        hasValid = true;
        break;
      }
    }

    this._status = hasValid ? 'online' : 'error';
    this._lastHealthCheck = Date.now();
    
    return hasValid;
  }

  /**
   * 发送对话请求
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    this.validateRequest(messages, options);

    const modelId = options?.model || this._config?.defaultModel || 'gpt-4o';
    const model = this._models.find(m => m.id === modelId);
    
    if (!model) {
      throw this.createError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `Model ${modelId} not found`,
        { retryable: false }
      );
    }

    // 获取对应平台的凭证
    const credential = this.getCredential(model.provider);
    if (!credential) {
      throw this.createError(
        ProviderErrorType.NO_CREDENTIAL,
        `No credential for ${model.provider}. Please configure Zero Token.`,
        { retryable: false }
      );
    }

    try {
      const response = await this.makeRequest(credential, model, messages, options);
      return response;
    } catch (error: any) {
      return this.handleRequestError(error, model.provider);
    }
  }

  /**
   * 发送流式对话请求
   */
  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk> {
    this.validateRequest(messages, options);

    const modelId = options?.model || this._config?.defaultModel || 'gpt-4o';
    const model = this._models.find(m => m.id === modelId);
    
    if (!model) {
      throw this.createError(
        ProviderErrorType.MODEL_NOT_FOUND,
        `Model ${modelId} not found`
      );
    }

    const credential = this.getCredential(model.provider);
    if (!credential) {
      throw this.createError(
        ProviderErrorType.NO_CREDENTIAL,
        `No credential for ${model.provider}`
      );
    }

    yield* this.streamRequest(credential, model, messages, options);
  }

  /**
   * 添加凭证
   */
  async addCredential(credential: Omit<Credential, 'id' | 'createdAt'>): Promise<Credential> {
    const id = `cred_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const newCredential: Credential = {
      ...credential,
      id,
      createdAt: Date.now()
    };

    // 加密存储
    const encrypted = this.encrypt(credential.value);
    newCredential.value = encrypted;

    this.credentials.set(credential.provider, newCredential);
    
    // 更新状态
    if (this._status === 'configuring') {
      this._status = 'online';
    }

    return newCredential;
  }

  /**
   * 移除凭证
   */
  async removeCredential(provider: string): Promise<void> {
    this.credentials.delete(provider);
    
    if (this.credentials.size === 0) {
      this._status = 'configuring';
    }
  }

  /**
   * 获取凭证
   */
  private getCredential(provider: string): Credential | null {
    const credential = this.credentials.get(provider);
    
    if (!credential) {
      return null;
    }

    // 检查过期
    if (credential.expiresAt && credential.expiresAt < Date.now()) {
      credential.status = 'expired';
      return null;
    }

    return credential;
  }

  /**
   * 验证凭证
   */
  private async validateCredential(credential: Credential): Promise<CredentialValidation> {
    const platform = this.platforms.get(credential.provider);
    if (!platform) {
      return { valid: false, error: 'Unknown platform' };
    }

    try {
      const token = this.decrypt(credential.value);
      
      // 根据平台验证
      let endpoint: string;
      let headers: Record<string, string> = {};

      switch (credential.provider) {
        case 'openai':
          endpoint = `${platform.endpoint}/me`;
          headers = {
            'Authorization': `Bearer ${token}`
          };
          break;
        case 'anthropic':
          endpoint = `${platform.endpoint}/organizations`;
          headers = {
            'Cookie': token,
            ...platform.headers
          };
          break;
        case 'google':
          endpoint = `${platform.endpoint}/models?key=${token}`;
          break;
        default:
          return { valid: false, error: 'Unknown platform' };
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        credential.status = 'valid';
        credential.lastUsed = Date.now();
        return { valid: true };
      } else if (response.status === 401) {
        credential.status = 'expired';
        return { valid: false, error: 'Token expired' };
      } else {
        credential.status = 'invalid';
        return { valid: false, error: `HTTP ${response.status}` };
      }
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 发送请求
   */
  private async makeRequest(
    credential: Credential,
    model: ModelInfo,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const platform = this.platforms.get(model.provider);
    if (!platform) {
      throw this.createError(
        ProviderErrorType.INTERNAL_ERROR,
        'Unknown platform'
      );
    }

    const token = this.decrypt(credential.value);
    let endpoint: string;
    let headers: Record<string, string> = {};
    let body: any;

    switch (model.provider) {
      case 'openai':
        endpoint = `${platform.endpoint}/chat/completions`;
        headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
        body = this.buildOpenAIBody(model.id, messages, options);
        break;

      case 'anthropic':
        endpoint = `${platform.endpoint}/chat`;
        headers = {
          'Cookie': token,
          'Content-Type': 'application/json',
          ...platform.headers
        };
        body = this.buildAnthropicBody(model.id, messages, options);
        break;

      case 'google':
        endpoint = `${platform.endpoint}/models/${model.id}:generateContent?key=${token}`;
        headers = {
          'Content-Type': 'application/json'
        };
        body = this.buildGoogleBody(messages, options);
        break;

      default:
        throw this.createError(
          ProviderErrorType.INTERNAL_ERROR,
          'Unknown platform'
        );
    }

    const timeout = options?.timeout || 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createErrorFromResponse(response.status, errorData, model.provider);
      }

      const data = await response.json();
      return this.normalizeResponse(data, model.id, model.provider);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw this.createError(
          ProviderErrorType.TIMEOUT,
          'Request timeout',
          { statusCode: 408, retryable: true }
        );
      }
      throw error;
    }
  }

  /**
   * 流式请求
   */
  private async *streamRequest(
    credential: Credential,
    model: ModelInfo,
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<ChatStreamChunk> {
    const platform = this.platforms.get(model.provider);
    if (!platform) {
      throw this.createError(ProviderErrorType.INTERNAL_ERROR, 'Unknown platform');
    }

    const token = this.decrypt(credential.value);
    let endpoint: string;
    let headers: Record<string, string> = {};
    let body: any;

    switch (model.provider) {
      case 'openai':
        endpoint = `${platform.endpoint}/chat/completions`;
        headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        };
        body = { ...this.buildOpenAIBody(model.id, messages, options), stream: true };
        break;

      case 'anthropic':
        endpoint = `${platform.endpoint}/chat`;
        headers = {
          'Cookie': token,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...platform.headers
        };
        body = { ...this.buildAnthropicBody(model.id, messages, options), stream: true };
        break;

      default:
        throw this.createError(ProviderErrorType.INTERNAL_ERROR, 'Streaming not supported');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.createErrorFromResponse(response.status, errorData, model.provider);
    }

    // 处理 SSE 流
    const reader = response.body?.getReader();
    if (!reader) {
      throw this.createError(ProviderErrorType.NETWORK_ERROR, 'No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const streamId = `chatcmpl-${Date.now()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            yield this.normalizeStreamChunk(parsed, streamId, model.id, model.provider);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 构建 OpenAI 请求体
   */
  private buildOpenAIBody(model: string, messages: ChatMessage[], options?: ChatOptions): any {
    return {
      model,
      messages: this.normalizeMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false
    };
  }

  /**
   * 构建 Anthropic 请求体
   */
  private buildAnthropicBody(model: string, messages: ChatMessage[], options?: ChatOptions): any {
    const normalized = this.normalizeMessages(messages);
    const systemPrompt = normalized.find(m => m.role === 'system');
    const chatMessages = normalized.filter(m => m.role !== 'system');

    return {
      model,
      messages: chatMessages,
      system: systemPrompt?.content,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: false
    };
  }

  /**
   * 构建 Google 请求体
   */
  private buildGoogleBody(messages: ChatMessage[], options?: ChatOptions): any {
    return {
      contents: this.normalizeMessages(messages).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096
      }
    };
  }

  /**
   * 标准化响应
   */
  private normalizeResponse(data: any, modelId: string, provider: string): ChatResponse {
    return {
      id: data.id || `resp_${Date.now()}`,
      object: 'chat.completion',
      created: data.created || Date.now(),
      model: modelId,
      provider,
      choices: (data.choices || []).map((choice: any, index: number) => ({
        index,
        message: {
          role: 'assistant',
          content: choice.message?.content || ''
        },
        finishReason: choice.finish_reason || 'stop'
      })),
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  /**
   * 标准化流式块
   */
  private normalizeStreamChunk(
    data: any,
    streamId: string,
    modelId: string,
    provider: string
  ): ChatStreamChunk {
    return {
      id: streamId,
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: modelId,
      provider,
      choices: (data.choices || []).map((choice: any, index: number) => ({
        index,
        delta: {
          role: choice.delta?.role,
          content: choice.delta?.content
        },
        finishReason: choice.finish_reason
      }))
    };
  }

  /**
   * 从响应创建错误
   */
  private createErrorFromResponse(
    statusCode: number,
    data: any,
    provider: string
  ): ProviderError {
    const message = data.error?.message || data.message || 'Unknown error';

    switch (statusCode) {
      case 401:
      case 403:
        return this.createError(
          ProviderErrorType.CREDENTIAL_INVALID,
          'Invalid or expired credential',
          { statusCode, retryable: false }
        );
      case 429:
        return this.createError(
          ProviderErrorType.RATE_LIMITED,
          'Rate limit exceeded',
          { statusCode, retryable: true }
        );
      case 400:
        return this.createError(
          ProviderErrorType.INVALID_REQUEST,
          message,
          { statusCode, retryable: false }
        );
      default:
        return this.createError(
          ProviderErrorType.INTERNAL_ERROR,
          message,
          { statusCode, retryable: statusCode >= 500 }
        );
    }
  }

  /**
   * 处理请求错误
   */
  private handleRequestError(error: any, provider: string): never {
    if (error instanceof ProviderError) {
      throw error;
    }

    throw this.createError(
      ProviderErrorType.NETWORK_ERROR,
      error.message || 'Network error',
      { retryable: true }
    );
  }

  /**
   * 加密
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密
   */
  private decrypt(encrypted: string): string {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex!, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(data!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 加载凭证
   */
  private async loadCredentials(path: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(path, 'utf8');
      const creds = JSON.parse(data);
      
      for (const cred of creds) {
        this.credentials.set(cred.provider, cred);
      }
    } catch {
      // 文件不存在或解析失败，忽略
    }
  }
}

export default ZeroTokenProvider;