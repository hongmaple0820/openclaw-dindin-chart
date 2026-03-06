/**
 * Skills & MCP 类型定义
 */

// ==================== Skills 类型 ====================

export interface Skill {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version: string;
  author?: string;
  category: string;
  tags: string[];
  skill_content?: string;
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  enabled: boolean;
  order_index?: number;
  icon?: string;
  created_at?: number;
  updated_at?: number;
}

export interface MarketplaceSkill extends Skill {
  author_id?: string;
  author_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  is_public: boolean;
  is_verified: boolean;
  downloads: number;
  installs: number;
  rating: number;
  rating_count: number;
  reviewed_by?: string;
  reviewed_at?: number;
  review_note?: string;
}

export interface UserSkill {
  id: number;
  user_id: string;
  skill_id: string;
  skill_type: 'builtin' | 'marketplace' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
  installed_at: number;
  skill_name?: string;
}

export interface CustomSkill extends Skill {
  user_id: string;
  marketplace_id?: string;
  publish_status: 'none' | 'pending' | 'published';
}

// ==================== MCP 类型 ====================

export type TransportType = 'stdio' | 'http' | 'sse';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPServer {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  version: string;
  author?: string;
  transport_type: TransportType;
  command?: string;
  endpoint?: string;
  env_config: Record<string, string>;
  args: string[];
  tools: MCPTool[];
  enabled: boolean;
  order_index?: number;
  icon?: string;
  created_at?: number;
  updated_at?: number;
}

export interface MarketplaceMCPServer extends MCPServer {
  author_id?: string;
  author_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  is_public: boolean;
  is_verified: boolean;
  downloads: number;
  installs: number;
  rating: number;
  rating_count: number;
  reviewed_by?: string;
  reviewed_at?: number;
  review_note?: string;
}

export interface UserMCPServer {
  id: number;
  user_id: string;
  mcp_id: string;
  mcp_type: 'builtin' | 'marketplace' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
  installed_at: number;
  mcp_name?: string;
}

export interface CustomMCPServer extends MCPServer {
  user_id: string;
  marketplace_id?: string;
  publish_status: 'none' | 'pending' | 'published';
}

// ==================== 外部市场类型 ====================

export interface ExternalMarket {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  url: string;
  icon?: string;
  market_type: 'skills' | 'mcp' | 'both';
  enabled: boolean;
  order_index: number;
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 数据库包装类型 ====================

export interface DbWrapper {
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  exec(sql: string): void;
}

// ==================== ASR 语音识别类型 ====================

export type ASRProvider = 'openai' | 'baidu' | 'xunfei' | 'aliyun';

export interface ASRConfig {
  provider: ASRProvider;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  appId?: string;
  endpoint?: string;
  model?: string;
  language?: string;
  options?: Record<string, unknown>;
}

export interface ASRTranscribeRequest {
  audio: string | Buffer;  // Base64 编码的音频数据或 Buffer
  format: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'webm' | 'amr' | 'pcm';
  language?: string;       // 语言代码，如 'zh-CN', 'en-US'
  provider?: ASRProvider;  // 指定提供商，不指定则使用默认
  options?: Record<string, unknown>;  // 额外选项
}

export interface ASRTranscribeResult {
  success: boolean;
  text: string;
  provider: ASRProvider;
  language?: string;
  duration?: number;       // 音频时长（秒）
  confidence?: number;     // 置信度 0-1
  segments?: ASRSegment[]; // 分段结果
  error?: string;
}

export interface ASRSegment {
  text: string;
  start: number;  // 开始时间（秒）
  end: number;    // 结束时间（秒）
  confidence?: number;
}

export interface ASRProviderInfo {
  name: ASRProvider;
  displayName: string;
  enabled: boolean;
  language: string[];
  features: string[];
  pricing?: string;
}

// ==================== 工具类型 ====================

/** 将 unknown 转换为 Record<string, unknown> */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** 安全解析 JSON */
export function safeParseJson(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}