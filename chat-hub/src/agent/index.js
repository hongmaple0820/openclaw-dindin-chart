/**
 * Agent Manager - Agent管理入口
 */

const { AgentRegistry } = require('./registry');
const { OpenAIAdapter } = require('./openai-adapter');
const { StreamingHandler } = require('./streaming-handler');
const { CapabilityRouter } = require('./capability-router');
const { MemoryStore } = require('./memory/store');
const { MemoryVectors } = require('./memory/vectors');
const { MemoryRetrieval } = require('./memory/retrieval');

class AgentManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = config;
    
    this.registry = new AgentRegistry(db, config);
    this.openaiAdapter = new OpenAIAdapter(db, config);
    this.streamingHandler = new StreamingHandler(db, config);
    this.capabilityRouter = new CapabilityRouter(db, config);
    
    // 记忆系统
    this.memoryStore = new MemoryStore(db, config);
    this.memoryVectors = new MemoryVectors(db, config);
    this.memoryRetrieval = new MemoryRetrieval(db, config);
  }

  async init() {
    await this.registry.init();
    await this.memoryStore.init();
    console.log('[AgentManager] 初始化完成');
  }

  /**
   * 注册 Agent
   */
  async register(agentConfig) {
    return this.registry.register(agentConfig);
  }

  /**
   * 获取 Agent
   */
  async get(agentId) {
    return this.registry.get(agentId);
  }

  /**
   * 列出公开 Agent
   */
  async listPublic() {
    return this.registry.listPublic();
  }

  /**
   * 与 Agent 对话 (OpenAI 协议)
   */
  async chat(agentId, messages, options = {}) {
    const agent = await this.get(agentId);
    if (!agent) throw new Error('Agent 不存在');

    // 记忆检索
    const relevantMemories = await this.memoryRetrieval.retrieve(
      agentId, 
      messages[messages.length - 1]?.content
    );

    // 调用 API
    const response = await this.openaiAdapter.chat(agent, messages, {
      ...options,
      memories: relevantMemories
    });

    // 存储记忆
    await this.memoryStore.store(agentId, messages, response);

    return response;
  }

  /**
   * 流式对话
   */
  async *chatStream(agentId, messages, options = {}) {
    const agent = await this.get(agentId);
    if (!agent) throw new Error('Agent 不存在');

    // 记忆检索
    const relevantMemories = await this.memoryRetrieval.retrieve(
      agentId,
      messages[messages.length - 1]?.content
    );

    // 流式调用
    for await (const chunk of this.openaiAdapter.chatStream(agent, messages, {
      ...options,
      memories: relevantMemories
    })) {
      yield chunk;
    }
  }

  /**
   * 根据能力选择 Agent
   */
  async selectByCapability(capability) {
    return this.capabilityRouter.select(capability);
  }
}

module.exports = { 
  AgentManager, 
  AgentRegistry, 
  OpenAIAdapter, 
  StreamingHandler,
  CapabilityRouter,
  MemoryStore,
  MemoryVectors,
  MemoryRetrieval
};