/**
 * Memory Retrieval - 记忆检索
 * 
 * 功能：
 * - 上下文相关性检索
 * - 时间衰减
 * - 重要性排序
 */

import type { MemoryStore, Memory, RetrieveOptions, MemoryStoreStats } from './store';
import type { MemoryVectors, SearchResult, MemoryVectorsStats } from './vectors';

// ============ Types & Interfaces ============

export interface TimeDecayConfig {
  enabled: boolean;
  halfLife: number;
  maxAge: number;
}

export interface RelevanceConfig {
  vectorWeight: number;
  importanceWeight: number;
  recencyWeight: number;
  threshold: number;
}

export interface RetrievalConfig {
  maxResults: number;
  contextWindow: number;
  diverseThreshold: number;
}

export interface MemoryRetrievalOptions {
  timeDecayEnabled?: boolean;
  timeDecayHalfLife?: number;
  maxAge?: number;
  vectorWeight?: number;
  importanceWeight?: number;
  recencyWeight?: number;
  relevanceThreshold?: number;
  maxResults?: number;
  contextWindow?: number;
  diverseThreshold?: number;
}

export interface MemoryRetrievalConfig {
  timeDecay: TimeDecayConfig;
  relevance: RelevanceConfig;
  retrieval: RetrievalConfig;
}

export interface RetrieveMemoryOptions {
  maxResults?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
  context?: RetrievalContext | null;
}

export interface RetrievalContext {
  sessionId?: string;
  topic?: string;
  userId?: string;
}

export interface ScoredMemory extends Memory {
  vectorSimilarity?: number;
  score: number;
}

export interface KeywordSearchResult extends Memory {
  keywordMatches: number;
  score: number;
}

export interface ContextWindowResult {
  memories: Memory[];
  totalTokens: number;
  windowSize: number;
}

export interface CachedResult {
  results: ScoredMemory[];
  timestamp: number;
}

export interface MemoryRetrievalStats {
  cacheSize: number;
  config: MemoryRetrievalConfig;
  vectorStats: MemoryVectorsStats;
  storeStats: MemoryStoreStats;
}

/**
 * MemoryRetrieval - 记忆检索类
 */
export class MemoryRetrieval {
  private store: MemoryStore;
  private vectors: MemoryVectors;
  
  // 配置
  private config: MemoryRetrievalConfig;

  // 缓存
  private queryCache: Map<string, CachedResult>;
  private cacheMaxSize: number;

  constructor(memoryStore: MemoryStore, vectors: MemoryVectors, options: MemoryRetrievalOptions = {}) {
    this.store = memoryStore;
    this.vectors = vectors;
    
    // 配置
    this.config = {
      // 时间衰减配置
      timeDecay: {
        enabled: options.timeDecayEnabled ?? true,
        halfLife: options.timeDecayHalfLife ?? 86400000, // 半衰期（默认 24 小时）
        maxAge: options.maxAge ?? 604800000 // 最大年龄（默认 7 天）
      },
      
      // 相关性配置
      relevance: {
        vectorWeight: options.vectorWeight ?? 0.6,     // 向量相似度权重
        importanceWeight: options.importanceWeight ?? 0.2, // 重要性权重
        recencyWeight: options.recencyWeight ?? 0.2,   // 最近访问权重
        threshold: options.relevanceThreshold ?? 0.3   // 相关性阈值
      },
      
      // 检索配置
      retrieval: {
        maxResults: options.maxResults ?? 10,
        contextWindow: options.contextWindow ?? 5,     // 上下文窗口大小
        diverseThreshold: options.diverseThreshold ?? 0.8 // 多样性阈值
      }
    };

    // 缓存
    this.queryCache = new Map();
    this.cacheMaxSize = 100;
  }

  /**
   * 检索相关记忆
   */
  async retrieve(query: string, options: RetrieveMemoryOptions = {}): Promise<ScoredMemory[]> {
    const {
      maxResults = this.config.retrieval.maxResults,
      threshold = this.config.relevance.threshold,
      filters = {},
      context = null
    } = options;

    // 检查缓存
    const cacheKey = this.getCacheKey(query, filters);
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 60000) { // 缓存 1 分钟
        return cached.results.slice(0, maxResults);
      }
    }

    // 向量搜索
    const vectorResults = await this.vectors.search(query, {
      topK: maxResults * 2,
      threshold: 0.1, // 向量搜索用较低的阈值，后面会综合排序
      metadata: filters
    });

    // 获取记忆详情
    const memories: Array<Memory & { vectorSimilarity?: number }> = [];
    for (const result of vectorResults) {
      const memory = this.store.get(result.memoryId);
      if (memory) {
        memories.push({
          ...memory,
          vectorSimilarity: result.similarity
        });
      }
    }

    // 计算综合相关性分数
    const scored: ScoredMemory[] = memories.map(m => {
      const score = this.calculateRelevanceScore(m, query, context);
      return {
        ...m,
        score
      };
    });

    // 过滤低分结果
    const filtered = scored.filter(m => m.score >= threshold);

    // 排序
    filtered.sort((a, b) => b.score - a.score);

    // 多样性重排
    const diversified = this.diverseRerank(filtered);

    // 缓存结果
    this.cacheResult(cacheKey, diversified);

    return diversified.slice(0, maxResults);
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevanceScore(memory: Memory & { vectorSimilarity?: number }, query: string, context: RetrievalContext | null = null): number {
    const { vectorWeight, importanceWeight, recencyWeight } = this.config.relevance;

    // 向量相似度
    const vectorScore = memory.vectorSimilarity ?? 0;

    // 重要性分数
    const importanceScore = memory.importance ?? 0;

    // 时间衰减后的最近访问分数
    const recencyScore = this.calculateRecencyScore(memory);

    // 上下文相关性（如果有）
    let contextScore = 0.5; // 默认中等
    if (context) {
      contextScore = this.calculateContextScore(memory, context);
    }

    // 综合分数
    let totalScore = 
      vectorScore * vectorWeight +
      importanceScore * importanceWeight +
      recencyScore * recencyWeight;

    // 如果有上下文，增加上下文权重
    if (context) {
      totalScore = totalScore * 0.8 + contextScore * 0.2;
    }

    return Math.min(1, Math.max(0, totalScore));
  }

  /**
   * 计算时间衰减分数
   */
  private calculateRecencyScore(memory: Memory): number {
    if (!this.config.timeDecay.enabled) {
      return 1;
    }

    const now = Date.now();
    const lastAccessed = memory.lastAccessed ?? memory.createdAt;
    const age = now - lastAccessed;

    // 指数衰减
    const decayFactor = Math.pow(0.5, age / this.config.timeDecay.halfLife);
    
    // 访问次数加成
    const accessBoost = Math.min(0.2, (memory.accessCount ?? 0) * 0.01);

    return Math.min(1, decayFactor + accessBoost);
  }

  /**
   * 计算上下文相关性
   */
  private calculateContextScore(memory: Memory, context: RetrievalContext): number {
    let score = 0;
    let factors = 0;

    // 检查会话 ID 匹配
    if (context.sessionId && memory.metadata?.sessionId === context.sessionId) {
      score += 0.3;
      factors++;
    }

    // 检查主题匹配
    if (context.topic && memory.metadata?.topic === context.topic) {
      score += 0.2;
      factors++;
    }

    // 检查用户 ID 匹配
    if (context.userId && memory.metadata?.userId === context.userId) {
      score += 0.2;
      factors++;
    }

    // 检查时间接近性（最近 1 小时内的记忆更相关）
    const now = Date.now();
    const memoryTime = memory.createdAt;
    if (now - memoryTime < 3600000) {
      score += 0.3;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5;
  }

  /**
   * 多样性重排
   */
  private diverseRerank(memories: ScoredMemory[]): ScoredMemory[] {
    if (memories.length <= 1) return memories;

    const { diverseThreshold } = this.config.retrieval;
    const result: ScoredMemory[] = [];
    const selectedVectors: number[][] = [];

    for (const memory of memories) {
      // 检查与已选记忆的相似度
      let tooSimilar = false;
      
      for (const vec of selectedVectors) {
        const similarity = this.vectors.cosineSimilarity(
          memory.vector ?? [],
          vec
        );
        
        if (similarity > diverseThreshold) {
          tooSimilar = true;
          break;
        }
      }

      if (!tooSimilar) {
        result.push(memory);
        if (memory.vector) {
          selectedVectors.push(memory.vector);
        }
      }
    }

    return result;
  }

  /**
   * 基于关键词检索
   */
  retrieveByKeywords(keywords: string | string[], options: { maxResults?: number; requireAll?: boolean } = {}): KeywordSearchResult[] {
    const { maxResults = 10, requireAll = false } = options;

    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    const results: KeywordSearchResult[] = [];

    // 从 store 检索
    const memories = this.store.retrieve({
      limit: maxResults * 2
    });

    for (const memory of memories) {
      const content = (memory.content ?? '').toLowerCase();
      let matchCount = 0;

      for (const keyword of keywordList) {
        if (content.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      // 根据匹配数计算分数
      if (requireAll ? matchCount === keywordList.length : matchCount > 0) {
        results.push({
          ...memory,
          keywordMatches: matchCount,
          score: matchCount / keywordList.length
        });
      }
    }

    // 排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  }

  /**
   * 基于时间范围检索
   */
  retrieveByTimeRange(startTime: number, endTime: number, options: { maxResults?: number; type?: 'short-term' | 'long-term' | 'episodic' | null } = {}): Memory[] {
    const { maxResults = 10, type = null } = options;

    const memories = this.store.retrieve({
      type: type ?? undefined,
      limit: maxResults * 2,
      maxAge: Date.now() - startTime
    });

    // 过滤时间范围
    const filtered = memories.filter(m => {
      const time = m.createdAt;
      return time >= startTime && time <= endTime;
    });

    // 按时间排序（最新的在前）
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return filtered.slice(0, maxResults);
  }

  /**
   * 获取上下文窗口记忆
   * 用于构建对话上下文
   */
  async getContextWindow(sessionId: string, options: { windowSize?: number; maxTokens?: number } = {}): Promise<ContextWindowResult> {
    const {
      windowSize = this.config.retrieval.contextWindow,
      maxTokens = 2000
    } = options;

    // 获取该会话的最近记忆
    const memories = this.store.retrieve({
      metadata: { sessionId },
      limit: windowSize * 2,
      maxAge: 3600000 // 最近 1 小时
    });

    // 按时间排序
    memories.sort((a, b) => a.createdAt - b.createdAt);

    // 构建 token 预算内的上下文
    const context: Memory[] = [];
    let totalTokens = 0;

    for (const memory of memories) {
      const tokens = this.estimateTokens(memory.content);
      
      if (totalTokens + tokens <= maxTokens) {
        context.push(memory);
        totalTokens += tokens;
      }
    }

    return {
      memories: context,
      totalTokens,
      windowSize: context.length
    };
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    // 简单估算：英文约 4 字符 = 1 token，中文约 2 字符 = 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(query: string, filters: Record<string, unknown>): string {
    const filterStr = JSON.stringify(filters);
    return `${query}:${filterStr}`;
  }

  /**
   * 缓存结果
   */
  private cacheResult(key: string, results: ScoredMemory[]): void {
    // 限制缓存大小
    if (this.queryCache.size >= this.cacheMaxSize) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * 获取检索统计
   */
  getStats(): MemoryRetrievalStats {
    return {
      cacheSize: this.queryCache.size,
      config: this.config,
      vectorStats: this.vectors.getStats(),
      storeStats: this.store.getStats()
    };
  }
}

export default MemoryRetrieval;