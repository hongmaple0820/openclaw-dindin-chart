/**
 * Provider Manager - Provider 管理器
 * 
 * 管理所有 Provider 实例，提供统一的注册、配置、路由功能
 * @version 1.0.0
 */

import EventEmitter from 'events';
import { BaseProvider } from './base';
import { ZeroTokenProvider } from './zero-token-provider';
import {
  ProviderInfo,
  ProviderConfig,
  ModelInfo,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatStreamChunk,
  RouteOptions,
  RouteResult,
  ProviderError,
  ProviderErrorType,
  ProviderEventListener,
  ProviderEvent
} from './types';

/**
 * Provider Manager 配置
 */
interface ProviderManagerConfig {
  defaultProvider?: string;
  preferFree?: boolean;
  failoverEnabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
}

/**
 * Provider 管理器
 */
export class ProviderManager extends EventEmitter {
  private providers: Map<string, BaseProvider> = new Map();
  private config: ProviderManagerConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: ProviderManagerConfig = {}) {
    super();
    this.config = {
      defaultProvider: 'zero-token',
      preferFree: true,
      failoverEnabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 60000,
      ...config
    };
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    // 注册内置 Provider
    await this.registerBuiltInProviders();
    
    // 启动健康检查
    this.startHealthCheck();
    
    console.log('[ProviderManager] 初始化完成');
  }

  /**
   * 注册内置 Provider
   */
  private async registerBuiltInProviders(): Promise<void> {
    // 注册 Zero Token Provider（免费）
    const zeroTokenProvider = new ZeroTokenProvider();
    this.register(zeroTokenProvider);

    // TODO: 注册其他 Provider
    // this.register(new OpenAIProvider());
    // this.register(new AnthropicProvider());
    // this.register(new LocalProvider());
  }

  /**
   * 注册 Provider
   */
  register(provider: BaseProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ProviderManager] Provider ${provider.id} 已存在，将被覆盖`);
    }

    this.providers.set(provider.id, provider);

    // 监听 Provider 事件
    provider.on('event', (event: ProviderEvent) => {
      this.emit('provider-event', event);
    });

    provider.on('status-change', (data: any) => {
      this.emit('provider-status-change', {
        providerId: provider.id,
        ...data
      });
    });

    console.log(`[ProviderManager] 注册 Provider: ${provider.name} (${provider.id})`);
  }

  /**
   * 注销 Provider
   */
  async unregister(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    await provider.destroy();
    this.providers.delete(providerId);
    
    console.log(`[ProviderManager] 注销 Provider: ${providerId}`);
  }

  /**
   * 获取 Provider
   */
  getProvider(providerId: string): BaseProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * 获取所有 Provider
   */
  getAllProviders(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取 Provider 信息列表
   */
  getProviderInfos(): ProviderInfo[] {
    return this.getAllProviders().map(p => p.info);
  }

  /**
   * 配置 Provider
   */
  async configureProvider(providerId: string, config: ProviderConfig): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(
        ProviderErrorType.NOT_CONFIGURED,
        `Provider ${providerId} not found`
      );
    }

    await provider.configure(config);
  }

  /**
   * 选择最优 Provider
   */
  async selectProvider(options: RouteOptions): Promise<RouteResult> {
    const {
      modelId,
      preferFree = this.config.preferFree,
      excludeProviders = [],
      requireCapabilities = []
    } = options;

    // 获取支持该模型的 Provider
    const candidates: Array<{
      provider: BaseProvider;
      model: ModelInfo;
    }> = [];

    for (const provider of this.getAllProviders()) {
      if (excludeProviders.includes(provider.id)) continue;
      
      const model = await provider.getModel(modelId);
      if (!model) continue;

      // 检查能力
      const hasAllCapabilities = requireCapabilities.every(cap => 
        model.capabilities[cap as keyof typeof model.capabilities]
      );
      if (!hasAllCapabilities) continue;

      // 检查状态
      const currentStatus = provider.status;
      if (currentStatus !== 'online') {
        // 尝试健康检查
        await provider.healthCheck();
        if (provider.status !== 'online') continue;
      }

      candidates.push({ provider, model });
    }

    if (candidates.length === 0) {
      return {
        success: false,
        error: 'no_available_provider',
        message: `No available provider for model: ${modelId}`
      };
    }

    // 排序：优先免费，然后按优先级
    candidates.sort((a, b) => {
      // 免费优先
      if (preferFree) {
        if (a.provider.type === 'free' && b.provider.type !== 'free') return -1;
        if (a.provider.type !== 'free' && b.provider.type === 'free') return 1;
      }
      // 按优先级排序
      return a.provider.priority - b.provider.priority;
    });

    const selected = candidates[0];
    return {
      success: true,
      provider: selected.provider.info,
      model: selected.model
    };
  }

  /**
   * 发送对话请求（自动路由）
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const modelId = options.model || 'gpt-4o';
    
    // 选择 Provider
    const routeResult = await this.selectProvider({
      modelId,
      preferFree: options.preferFree ?? this.config.preferFree,
      excludeProviders: options.excludeProviders,
      requireCapabilities: options.requireCapabilities
    });

    if (!routeResult.success) {
      throw new ProviderError(
        ProviderErrorType.ALL_PROVIDERS_FAILED,
        routeResult.message || 'No available provider'
      );
    }

    const provider = this.getProvider(routeResult.provider!.id)!;
    const providerId = provider.id;

    try {
      const response = await provider.chat(messages, options);
      
      // 记录使用的 provider
      response.provider = providerId;
      
      return response;
    } catch (error) {
      // 故障转移
      if (this.config.failoverEnabled && error instanceof ProviderError && error.retryable) {
        return this.failover(messages, { ...options, model: modelId }, providerId);
      }
      throw error;
    }
  }

  /**
   * 发送流式对话请求（自动路由）
   */
  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<ChatStreamChunk> {
    const modelId = options.model || 'gpt-4o';
    
    const routeResult = await this.selectProvider({
      modelId,
      preferFree: options.preferFree ?? this.config.preferFree,
      excludeProviders: options.excludeProviders
    });

    if (!routeResult.success) {
      throw new ProviderError(
        ProviderErrorType.ALL_PROVIDERS_FAILED,
        routeResult.message || 'No available provider'
      );
    }

    const provider = this.getProvider(routeResult.provider!.id)!;
    yield* provider.chatStream(messages, options);
  }

  /**
   * 故障转移
   */
  private async failover(
    messages: ChatMessage[],
    options: ChatOptions,
    failedProviderId: string
  ): Promise<ChatResponse> {
    console.log(`[ProviderManager] 故障转移: ${failedProviderId}`);

    const modelId = options.model || 'gpt-4o';
    const excludeProviders = [
      ...(options.excludeProviders || []),
      failedProviderId
    ];

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      const routeResult = await this.selectProvider({
        modelId,
        preferFree: options.preferFree,
        excludeProviders
      });

      if (!routeResult.success) {
        continue;
      }

      try {
        const provider = this.getProvider(routeResult.provider!.id)!;
        const response = await provider.chat(messages, options);
        response.provider = provider.id;
        
        console.log(`[ProviderManager] 故障转移成功: ${provider.id}`);
        return response;
      } catch (error) {
        excludeProviders.push(routeResult.provider!.id);
      }

      // 等待后重试
      await new Promise(resolve => 
        setTimeout(resolve, this.config.retryDelay! * (attempt + 1))
      );
    }

    throw new ProviderError(
      ProviderErrorType.ALL_PROVIDERS_FAILED,
      'All providers failed after retries'
    );
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      for (const provider of this.getAllProviders()) {
        try {
          await provider.healthCheck();
        } catch (error) {
          console.error(`[ProviderManager] 健康检查失败: ${provider.id}`, error);
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalProviders: number;
    providersByStatus: Record<string, number>;
    providersByType: Record<string, number>;
    onlineModels: number;
  } {
    const providers = this.getAllProviders();
    
    const stats = {
      totalProviders: providers.length,
      providersByStatus: {} as Record<string, number>,
      providersByType: {} as Record<string, number>,
      onlineModels: 0
    };

    for (const provider of providers) {
      // 按状态统计
      const status = provider.status;
      stats.providersByStatus[status] = (stats.providersByStatus[status] || 0) + 1;

      // 按类型统计
      const type = provider.type;
      stats.providersByType[type] = (stats.providersByType[type] || 0) + 1;

      // 在线模型数
      if (status === 'online') {
        stats.onlineModels += provider.models.length;
      }
    }

    return stats;
  }

  /**
   * 销毁
   */
  async destroy(): Promise<void> {
    this.stopHealthCheck();

    for (const provider of this.getAllProviders()) {
      await provider.destroy();
    }

    this.providers.clear();
    this.removeAllListeners();
    
    console.log('[ProviderManager] 已销毁');
  }
}

// 导出单例
let managerInstance: ProviderManager | null = null;

export function getProviderManager(config?: ProviderManagerConfig): ProviderManager {
  if (!managerInstance) {
    managerInstance = new ProviderManager(config);
  }
  return managerInstance;
}

export default ProviderManager;