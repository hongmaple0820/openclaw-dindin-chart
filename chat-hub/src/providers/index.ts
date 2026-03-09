/**
 * Providers Module - Provider 模块入口
 * 
 * 统一导出所有 Provider 相关的类型和类
 * @version 1.0.0
 */

// 类型导出
export * from './types';

// 基类导出
export { BaseProvider } from './base';

// Provider 实现导出
export { ZeroTokenProvider } from './zero-token-provider';

// 管理器导出
export { ProviderManager, getProviderManager } from './manager';

// 便捷方法
import { getProviderManager } from './manager';
import type { ChatMessage, ChatOptions, ChatResponse, ChatStreamChunk } from './types';

/**
 * 快速聊天方法
 */
export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  const manager = getProviderManager();
  return manager.chat(messages, options);
}

/**
 * 快速流式聊天方法
 */
export async function* chatStream(
  messages: ChatMessage[],
  options?: ChatOptions
): AsyncGenerator<ChatStreamChunk> {
  const manager = getProviderManager();
  yield* manager.chatStream(messages, options);
}

/**
 * 初始化 Provider 系统
 */
export async function initProviders(config?: any): Promise<void> {
  const manager = getProviderManager(config);
  await manager.init();
}