/**
 * Agent Manager - Agent管理入口
 */

import AgentRegistry from './registry';
import OpenAIAdapter from './openai-adapter';
import StreamingHandler from './streaming-handler';
import CapabilityRouter from './capability-router';
import { MemoryStore } from './memory/store';
import { MemoryVectors } from './memory/vectors';
import { MemoryRetrieval } from './memory/retrieval';

interface AgentConfig {
  nickname: string;
  avatar?: string;
  description?: string;
  type?: string;
  isPublic?: boolean;
  ownerId?: string | null;
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  params?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  memoryEnabled?: boolean;
  memoryConfig?: Record<string, unknown>;
  skills?: string[];
}

interface ChatOptions {
  memories?: any[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatMessage {
  role: string;
  content: string | any[];
  name?: string;
  function_call?: any;
  tool_calls?: any[];
}

class AgentManager {
  private db: any;
  private config: Record<string, any>;
  private registry: AgentRegistry;
  private streamingHandler: StreamingHandler;
  private capabilityRouter: CapabilityRouter;
  
  // Per-agent memory components (lazy initialized)
  private memoryStores: Map<string, MemoryStore> = new Map();
  private memoryVectors: Map<string, MemoryVectors> = new Map();
  private memoryRetrievals: Map<string, MemoryRetrieval> = new Map();

  constructor(db: any, config: Record<string, any> = {}) {
    this.db = db;
    this.config = config;
    
    this.registry = new AgentRegistry(config.dbPath);
    this.streamingHandler = new StreamingHandler(config);
    this.capabilityRouter = new CapabilityRouter(this.registry);
  }

  /**
   * 获取或创建 Agent 的记忆组件
   */
  private getMemoryComponents(agentId: string): {
    store: MemoryStore;
    vectors: MemoryVectors;
    retrieval: MemoryRetrieval;
  } {
    if (!this.memoryStores.has(agentId)) {
      const store = new MemoryStore(this.db, { agentId });
      const vectors = new MemoryVectors(this.db, { agentId });
      const retrieval = new MemoryRetrieval(store, vectors);
      
      this.memoryStores.set(agentId, store);
      this.memoryVectors.set(agentId, vectors);
      this.memoryRetrievals.set(agentId, retrieval);
    }

    return {
      store: this.memoryStores.get(agentId)!,
      vectors: this.memoryVectors.get(agentId)!,
      retrieval: this.memoryRetrievals.get(agentId)!
    };
  }

  async init(): Promise<void> {
    this.registry.init();
    console.log('[AgentManager] 初始化完成');
  }

  /**
   * 注册 Agent
   */
  async register(agentConfig: AgentConfig): Promise<any> {
    return this.registry.register(agentConfig);
  }

  /**
   * 获取 Agent
   */
  async get(agentId: string): Promise<any> {
    return this.registry.getAgent(agentId);
  }

  /**
   * 列出公开 Agent
   */
  async listPublic(): Promise<any[]> {
    return this.registry.listAgents({ isPublic: true });
  }

  /**
   * 与 Agent 对话 (OpenAI 协议)
   */
  async chat(agentId: string, messages: ChatMessage[], options: ChatOptions = {}): Promise<any> {
    const agent = await this.get(agentId);
    if (!agent) throw new Error('Agent 不存在');

    // 获取记忆组件
    const { store, retrieval } = this.getMemoryComponents(agentId);

    // 记忆检索
    const lastMessage = messages[messages.length - 1];
    const query = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
    const relevantMemories = await retrieval.retrieve(query);

    // 创建 OpenAI 适配器
    const agentWithCreds = this.registry.getAgentWithCredentials(agentId);
    const adapter = new OpenAIAdapter(agentWithCreds || agent);

    // 调用 API
    const response = await adapter.chatCompletion({
      messages,
      ...options
    });

    // 存储记忆
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      store.add(content, {
        type: 'short-term',
        metadata: { role: msg.role }
      });
    }

    return response;
  }

  /**
   * 流式对话
   */
  async *chatStream(agentId: string, messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<any> {
    const agent = await this.get(agentId);
    if (!agent) throw new Error('Agent 不存在');

    // 获取记忆组件
    const { retrieval } = this.getMemoryComponents(agentId);

    // 记忆检索
    const lastMessage = messages[messages.length - 1];
    const query = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
    await retrieval.retrieve(query);

    // 创建 OpenAI 适配器
    const agentWithCreds = this.registry.getAgentWithCredentials(agentId);
    const adapter = new OpenAIAdapter(agentWithCreds || agent);

    // 流式调用
    for await (const chunk of adapter.chatCompletionStream({
      messages,
      ...options
    })) {
      yield chunk;
    }
  }

  /**
   * 根据能力选择 Agent
   */
  async selectByCapability(capability: string): Promise<any[]> {
    return this.registry.findByCapability(capability);
  }
}

export { 
  AgentManager, 
  AgentRegistry, 
  OpenAIAdapter, 
  StreamingHandler,
  CapabilityRouter,
  MemoryStore,
  MemoryVectors,
  MemoryRetrieval
};