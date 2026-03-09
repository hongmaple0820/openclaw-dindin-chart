/**
 * Base Provider - Provider 基类
 * 
 * 所有 Provider 实现的基类，定义了统一的接口
 * @version 1.0.0
 */

import EventEmitter from 'events';
import {
  ProviderInfo,
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
  ProviderEventListener,
  ProviderEvent
} from './types';

/**
 * Provider 抽象基类
 */
export abstract class BaseProvider extends EventEmitter {
  abstract id: string;
  abstract name: string;
  abstract displayName: string;
  abstract type: ProviderType;
  
  protected _status: ProviderStatus = 'offline';
  protected _models: ModelInfo[] = [];
  protected _config: ProviderConfig | null = null;
  protected _priority: number = 10;
  protected _lastHealthCheck: number = 0;
  protected _healthCheckInterval: number = 60000; // 1 分钟

  /**
   * 获取 Provider 信息
   */
  get info(): ProviderInfo {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      type: this.type,
      priority: this.priority,
      status: this._status,
      models: this._models,
      config: this._config || undefined,
      health: {
        lastCheck: this._lastHealthCheck
      }
    };
  }

  /**
   * 获取优先级
   */
  get priority(): number {
    return this._priority;
  }

  /**
   * 设置优先级
   */
  set priority(value: number) {
    this._priority = value;
  }

  /**
   * 获取状态
   */
  get status(): ProviderStatus {
    return this._status;
  }

  /**
   * 设置状态
   */
  protected setStatus(status: ProviderStatus): void {
    if (this._status !== status) {
      const oldStatus = this._status;
      this._status = status;
      this.emit('status-change', { from: oldStatus, to: status });
    }
  }

  /**
   * 获取模型列表
   */
  get models(): ModelInfo[] {
    return this._models;
  }

  /**
   * 获取配置
   */
  get config(): ProviderConfig | null {
    return this._config;
  }

  // ============================================
  // 抽象方法 - 子类必须实现
  // ============================================

  /**
   * 配置 Provider
   */
  abstract configure(config: ProviderConfig): Promise<void>;

  /**
   * 验证配置
   */
  abstract validateConfig(): Promise<CredentialValidation>;

  /**
   * 健康检查
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * 发送对话请求
   */
  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * 发送流式对话请求
   */
  abstract chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk>;

  // ============================================
  // 可选方法 - 子类可以覆盖
  // ============================================

  /**
   * 获取模型信息
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    return this._models.find(m => m.id === modelId) || null;
  }

  /**
   * 刷新模型列表
   */
  async refreshModels(): Promise<void> {
    // 默认实现：子类可以覆盖
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    // 检查健康状态
    if (this._status !== 'online') {
      await this.healthCheck();
    }
    
    if (this._status !== 'online') {
      return [];
    }
    
    return this._models;
  }

  /**
   * 检查模型是否支持指定能力
   */
  supportsCapability(modelId: string, capability: keyof ModelInfo['capabilities']): boolean {
    const model = this._models.find(m => m.id === modelId);
    return model?.capabilities[capability] ?? false;
  }

  /**
   * 验证请求参数
   */
  protected validateRequest(
    messages: ChatMessage[],
    options?: ChatOptions
  ): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ProviderError(
        ProviderErrorType.INVALID_REQUEST,
        'Messages must be a non-empty array',
        { providerId: this.id }
      );
    }

    // 验证消息格式
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new ProviderError(
          ProviderErrorType.INVALID_REQUEST,
          'Each message must have role and content',
          { providerId: this.id }
        );
      }
    }

    // 验证模型是否存在
    if (options?.model) {
      const model = this._models.find(m => m.id === options.model);
      if (!model) {
        throw new ProviderError(
          ProviderErrorType.MODEL_NOT_FOUND,
          `Model ${options.model} not found`,
          { providerId: this.id, modelId: options.model }
        );
      }
    }
  }

  /**
   * 标准化消息格式
   */
  protected normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => {
      // 确保 content 格式正确
      let content = msg.content;
      
      if (typeof content === 'string') {
        content = content.trim();
      } else if (Array.isArray(content)) {
        // 多模态消息
        content = content.map(part => {
          if (typeof part === 'string') {
            return { type: 'text' as const, text: part };
          }
          return part;
        });
      }

      return {
        role: msg.role,
        content,
        ...(msg.name && { name: msg.name }),
        ...(msg.toolCalls && { toolCalls: msg.toolCalls }),
        ...(msg.toolCallId && { toolCallId: msg.toolCallId })
      };
    });
  }

  /**
   * 构建请求参数
   */
  protected buildRequestParams(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Record<string, any> {
    const model = options?.model || this._config?.defaultModel || this._models[0]?.id;
    
    if (!model) {
      throw new ProviderError(
        ProviderErrorType.MODEL_NOT_FOUND,
        'No model available',
        { providerId: this.id }
      );
    }

    const params: Record<string, any> = {
      model,
      messages: this.normalizeMessages(messages),
      stream: options?.stream ?? false
    };

    // 添加可选参数
    if (options?.temperature !== undefined) {
      params.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      params.max_tokens = options.maxTokens;
    }
    if (options?.topP !== undefined) {
      params.top_p = options.topP;
    }
    if (options?.stopSequences) {
      params.stop = options.stopSequences;
    }
    if (options?.tools) {
      params.tools = options.tools;
    }
    if (options?.toolChoice) {
      params.tool_choice = options.toolChoice;
    }
    if (options?.user) {
      params.user = options.user;
    }

    return params;
  }

  /**
   * 创建错误
   */
  protected createError(
    type: ProviderErrorType,
    message: string,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      details?: Record<string, any>;
    }
  ): ProviderError {
    return new ProviderError(type, message, {
      providerId: this.id,
      statusCode: options?.statusCode,
      retryable: options?.retryable,
      details: options?.details
    });
  }

  /**
   * 发送事件
   */
  protected emitEvent(type: ProviderEvent['type'], data: any): void {
    const event: ProviderEvent = {
      type,
      providerId: this.id,
      data,
      timestamp: Date.now()
    };
    this.emit('event', event);
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    this.removeAllListeners();
  }
}

export default BaseProvider;