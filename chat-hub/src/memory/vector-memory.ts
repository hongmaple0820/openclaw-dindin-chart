/**
 * 向量记忆系统
 * 
 * 实现语义检索和混合搜索（向量 + 关键词）
 * 
 * @author 小琳
 * @date 2026-03-05
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ============================================================
// 类型定义
// ============================================================

/** 记忆类型 */
export type MemoryType = 'short-term' | 'long-term' | 'episodic' | 'semantic';

/** 记忆条目 */
export interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance: number;  // 0-1
  accessCount: number;
  lastAccessed: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
}

/** 检索结果 */
export interface RetrievalResult {
  memory: Memory;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

/** 向量记忆配置 */
export interface VectorMemoryConfig {
  embeddingModel: string;
  embeddingDimension: number;
  maxMemories: number;
  shortTermTTL: number;  // 短期记忆过期时间（毫秒）
  importanceThreshold: number;
  retrievalTopK: number;
}

// ============================================================
// 向量记忆存储
// ============================================================

/**
 * 向量记忆存储类
 * 
 * 支持混合检索（语义 + 关键词）
 */
export class VectorMemoryStore extends EventEmitter {
  private memories: Map<string, Memory> = new Map();
  private agentMemories: Map<string, Set<string>> = new Map();
  private config: VectorMemoryConfig;

  constructor(config: Partial<VectorMemoryConfig> = {}) {
    super();
    this.config = {
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      embeddingDimension: config.embeddingDimension || 1536,
      maxMemories: config.maxMemories || 10000,
      shortTermTTL: config.shortTermTTL || 24 * 60 * 60 * 1000,  // 24小时
      importanceThreshold: config.importanceThreshold || 0.5,
      retrievalTopK: config.retrievalTopK || 10
    };
  }

  /**
   * 添加记忆
   */
  async add(
    agentId: string,
    content: string,
    options: {
      type?: MemoryType;
      importance?: number;
      metadata?: Record<string, unknown>;
      expiresAt?: number;
    } = {}
  ): Promise<Memory> {
    const memoryId = this.generateId();
    const now = Date.now();

    // 生成嵌入向量
    const embedding = await this.generateEmbedding(content);

    const memory: Memory = {
      id: memoryId,
      agentId,
      type: options.type || 'short-term',
      content,
      embedding,
      importance: options.importance ?? this.calculateImportance(content),
      accessCount: 0,
      lastAccessed: now,
      metadata: options.metadata,
      createdAt: now,
      expiresAt: options.expiresAt ?? (options.type === 'short-term' ? now + this.config.shortTermTTL : undefined)
    };

    // 存储记忆
    this.memories.set(memoryId, memory);

    // 更新 Agent 记忆索引
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, new Set());
    }
    this.agentMemories.get(agentId)!.add(memoryId);

    // 检查容量
    await this.checkCapacity(agentId);

    this.emit('memory:added', memory);
    console.log(`[VectorMemory] 添加记忆: ${agentId} - ${memoryId}`);

    return memory;
  }

  /**
   * 检索记忆
   */
  async retrieve(
    agentId: string,
    query: string,
    options: {
      type?: MemoryType;
      topK?: number;
      minImportance?: number;
    } = {}
  ): Promise<RetrievalResult[]> {
    const topK = options.topK ?? this.config.retrievalTopK;
    const minImportance = options.minImportance ?? 0;

    // 获取 Agent 的所有记忆
    const agentMemoryIds = this.agentMemories.get(agentId) || new Set();
    const candidateMemories: Memory[] = [];

    for (const memoryId of agentMemoryIds) {
      const memory = this.memories.get(memoryId);
      if (memory && memory.importance >= minImportance) {
        if (!options.type || memory.type === options.type) {
          // 检查是否过期
          if (!memory.expiresAt || memory.expiresAt > Date.now()) {
            candidateMemories.push(memory);
          }
        }
      }
    }

    // 生成查询向量
    const queryEmbedding = await this.generateEmbedding(query);

    // 计算相似度
    const results: RetrievalResult[] = candidateMemories.map(memory => {
      const semanticScore = memory.embedding
        ? this.cosineSimilarity(queryEmbedding, memory.embedding)
        : 0;
      
      const keywordScore = this.keywordMatch(query, memory.content);
      
      // 混合分数（70% 语义 + 30% 关键词）
      const hybridScore = 0.7 * semanticScore + 0.3 * keywordScore;

      return {
        memory,
        score: hybridScore,
        matchType: 'hybrid' as const
      };
    });

    // 排序并返回 TopK
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    // 更新访问计数
    for (const result of topResults) {
      const memory = this.memories.get(result.memory.id);
      if (memory) {
        memory.accessCount++;
        memory.lastAccessed = Date.now();
      }
    }

    return topResults;
  }

  /**
   * 获取记忆
   */
  get(memoryId: string): Memory | undefined {
    return this.memories.get(memoryId);
  }

  /**
   * 删除记忆
   */
  delete(memoryId: string): boolean {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    this.memories.delete(memoryId);
    
    const agentMemoryIds = this.agentMemories.get(memory.agentId);
    if (agentMemoryIds) {
      agentMemoryIds.delete(memoryId);
    }

    this.emit('memory:deleted', memoryId);
    return true;
  }

  /**
   * 清理过期记忆
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && memory.expiresAt < now) {
        this.delete(id);
        cleaned++;
      }
    }

    console.log(`[VectorMemory] 清理过期记忆: ${cleaned} 条`);
    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(agentId?: string): {
    total: number;
    byType: Record<MemoryType, number>;
    avgImportance: number;
  } {
    const memories = agentId
      ? Array.from(this.agentMemories.get(agentId) || []).map(id => this.memories.get(id)!).filter(Boolean)
      : Array.from(this.memories.values());

    const byType: Record<MemoryType, number> = {
      'short-term': 0,
      'long-term': 0,
      'episodic': 0,
      'semantic': 0
    };

    let totalImportance = 0;
    for (const memory of memories) {
      byType[memory.type]++;
      totalImportance += memory.importance;
    }

    return {
      total: memories.length,
      byType,
      avgImportance: memories.length > 0 ? totalImportance / memories.length : 0
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private generateId(): string {
    return `mem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 生成嵌入向量（模拟实现）
   * 实际使用时需要调用 OpenAI 或其他嵌入 API
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // 简单的模拟实现：使用文本哈希生成伪向量
    // 实际项目中应调用 OpenAI text-embedding-3-small 或其他嵌入模型
    const hash = (crypto.createHash as any)('sha256').update(text).digest() as Buffer;
    const embedding: number[] = [];
    
    for (let i = 0; i < this.config.embeddingDimension; i++) {
      const byte = hash[i % hash.length];
      embedding.push((byte - 128) / 128);  // 归一化到 [-1, 1]
    }

    return embedding;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 关键词匹配
   */
  private keywordMatch(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentWords.has(word)) {
        matches++;
      }
    }

    return queryWords.size > 0 ? matches / queryWords.size : 0;
  }

  /**
   * 计算重要性
   */
  private calculateImportance(content: string): number {
    // 简单的重要性计算
    // 实际可以使用更复杂的启发式规则或机器学习模型
    let importance = 0.5;

    // 长度因素
    if (content.length > 500) importance += 0.1;
    if (content.length > 1000) importance += 0.1;

    // 关键词因素
    const importantKeywords = ['重要', '决定', '关键', '核心', '必须', 'remember', 'important'];
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        importance += 0.1;
      }
    }

    return Math.min(importance, 1);
  }

  /**
   * 检查容量
   */
  private async checkCapacity(agentId: string): Promise<void> {
    const agentMemoryIds = this.agentMemories.get(agentId);
    if (!agentMemoryIds) return;

    if (agentMemoryIds.size > this.config.maxMemories) {
      // 删除最不重要且最少访问的记忆
      const memories = Array.from(agentMemoryIds)
        .map(id => this.memories.get(id)!)
        .filter(Boolean)
        .sort((a, b) => {
          const scoreA = a.importance * 0.5 + (a.accessCount / 100) * 0.5;
          const scoreB = b.importance * 0.5 + (b.accessCount / 100) * 0.5;
          return scoreA - scoreB;
        });

      const toDelete = memories.slice(0, memories.length - this.config.maxMemories);
      for (const memory of toDelete) {
        this.delete(memory.id);
      }
    }
  }
}

export default VectorMemoryStore;