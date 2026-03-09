/**
 * Provider Types - Provider 类型定义
 * 
 * 定义了所有 Provider 相关的接口和类型
 * @version 1.0.0
 */

// ============================================
// 基础类型
// ============================================

/**
 * Provider 类型
 */
export type ProviderType = 'free' | 'paid' | 'local';

/**
 * Provider 状态
 */
export type ProviderStatus = 'online' | 'offline' | 'error' | 'configuring';

/**
 * 凭证类型
 */
export type CredentialType = 'api_key' | 'session_token' | 'cookie';

/**
 * 凭证状态
 */
export type CredentialStatus = 'valid' | 'expired' | 'invalid';

/**
 * 凭证来源
 */
export type CredentialSource = 'zero_token' | 'manual' | 'env';

// ============================================
// 模型相关
// ============================================

/**
 * 模型能力
 */
export interface ModelCapabilities {
  chat: boolean;
  stream: boolean;
  vision: boolean;
  tools: boolean;
  embeddings: boolean;
}

/**
 * 模型定价
 */
export interface ModelPricing {
  input: number;    // 每千 token 输入价格 (USD)
  output: number;   // 每千 token 输出价格 (USD)
  currency: string; // 货币单位，默认 USD
}

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  displayName?: string;
  description?: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutput: number;
  pricing?: ModelPricing;
  tags?: string[];
  deprecated?: boolean;
  defaultParams?: ModelParams;
}

/**
 * 模型参数
 */
export interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

// ============================================
// 对话相关
// ============================================

/**
 * 对话消息内容
 */
export type ChatContent = string | ChatContentPart[];

/**
 * 对话消息内容部分（多模态）
 */
export interface ChatContentPart {
  type: 'text' | 'image' | 'image_url';
  text?: string;
  image?: string;      // base64 编码的图片
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * 对话消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ChatContent;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * 对话选项
 */
export interface ChatOptions {
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  systemPrompt?: string;
  stopSequences?: string[];
  user?: string;
  metadata?: Record<string, any>;
  
  // Provider 路由选项
  preferFree?: boolean;
  excludeProviders?: string[];
  requireCapabilities?: string[];
  
  // 超时设置
  timeout?: number;
}

/**
 * 对话响应
 */
export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  provider: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
  systemFingerprint?: string;
}

/**
 * 对话选项结果
 */
export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
  logprobs?: any;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 流式响应块
 */
export interface ChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  provider: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finishReason?: string;
  }[];
}

// ============================================
// Provider 相关
// ============================================

/**
 * Provider 配置
 */
export interface ProviderConfig {
  enabled: boolean;
  priority: number;
  apiKey?: string;
  apiEndpoint?: string;
  defaultModel?: string;
  models?: string[];
  params?: ModelParams;
  metadata?: Record<string, any>;
}

/**
 * Provider 信息
 */
export interface ProviderInfo {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: ProviderType;
  priority: number;
  status: ProviderStatus;
  models: ModelInfo[];
  config?: ProviderConfig;
  health?: {
    lastCheck: number;
    latency?: number;
    error?: string;
  };
}

// ============================================
// 凭证相关
// ============================================

/**
 * 凭证信息
 */
export interface Credential {
  id: string;
  provider: string;
  type: CredentialType;
  value: string;           // 加密存储
  expiresAt?: number;
  lastUsed?: number;
  status: CredentialStatus;
  source: CredentialSource;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

/**
 * 凭证验证结果
 */
export interface CredentialValidation {
  valid: boolean;
  error?: string;
  expiresAt?: number;
  permissions?: string[];
}

// ============================================
// 路由相关
// ============================================

/**
 * 路由选项
 */
export interface RouteOptions {
  modelId: string;
  preferFree?: boolean;
  excludeProviders?: string[];
  requireCapabilities?: string[];
  userId?: string;
}

/**
 * 路由结果
 */
export interface RouteResult {
  success: boolean;
  provider?: ProviderInfo;
  model?: ModelInfo;
  error?: string;
  message?: string;
}

// ============================================
// 错误相关
// ============================================

/**
 * Provider 错误类型
 */
export enum ProviderErrorType {
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
  CONTENT_FILTERED = 'content_filtered',
  INVALID_REQUEST = 'invalid_request',
  
  // 网络错误
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  
  // 服务错误
  PROVIDER_OFFLINE = 'provider_offline',
  ALL_PROVIDERS_FAILED = 'all_providers_failed',
  INTERNAL_ERROR = 'internal_error'
}

/**
 * Provider 错误
 */
export class ProviderError extends Error {
  type: ProviderErrorType;
  providerId?: string;
  modelId?: string;
  retryable: boolean;
  fallbackProvider?: string;
  statusCode?: number;
  details?: Record<string, any>;

  constructor(
    type: ProviderErrorType,
    message: string,
    options?: {
      providerId?: string;
      modelId?: string;
      retryable?: boolean;
      fallbackProvider?: string;
      statusCode?: number;
      details?: Record<string, any>;
    }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.type = type;
    this.providerId = options?.providerId;
    this.modelId = options?.modelId;
    this.retryable = options?.retryable ?? false;
    this.fallbackProvider = options?.fallbackProvider;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      providerId: this.providerId,
      modelId: this.modelId,
      retryable: this.retryable,
      fallbackProvider: this.fallbackProvider,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

// ============================================
// 事件相关
// ============================================

/**
 * Provider 事件
 */
export interface ProviderEvent {
  type: 'status_change' | 'credential_change' | 'model_change' | 'error';
  providerId: string;
  data: any;
  timestamp: number;
}

/**
 * Provider 事件监听器
 */
export type ProviderEventListener = (event: ProviderEvent) => void;