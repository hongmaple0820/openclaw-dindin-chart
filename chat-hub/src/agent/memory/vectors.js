/**
 * Memory Vectors - 向量嵌入
 * 
 * 功能：
 * - 文本向量化
 * - 相似度搜索
 * - 向量存储（使用 sqlite-vss 或内存实现）
 */

class MemoryVectors {
  constructor(db, options = {}) {
    this.db = db;
    this.agentId = options.agentId;
    this.dimension = options.dimension || 384; // 默认向量维度
    this.embeddingModel = options.embeddingModel || 'text-embedding-ada-002';
    
    // 内存向量存储
    this.vectors = new Map(); // memoryId -> { vector, metadata }
    
    // 是否使用 sqlite-vss（如果可用）
    this.useVSS = false;
    this.vssEnabled = false;
    
    // 尝试加载 sqlite-vss
    this.tryLoadVSS();
  }

  /**
   * 尝试加载 sqlite-vss 扩展
   */
  tryLoadVSS() {
    try {
      // 尝试加载 sqlite-vss
      this.db.loadExtension('vector0');
      this.db.loadExtension('vss0');
      this.vssEnabled = true;
      this.useVSS = true;
      console.log('[MemoryVectors] sqlite-vss 已启用');
      
      // 创建虚拟表
      this.createVSSTable();
    } catch (e) {
      console.log('[MemoryVectors] sqlite-vss 不可用，使用内存模式');
      this.vssEnabled = false;
      this.useVSS = false;
    }
  }

  /**
   * 创建 VSS 虚拟表
   */
  createVSSTable() {
    if (!this.vssEnabled) return;

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors_vss USING vss0(
          vector(${this.dimension})
        );
      `);
    } catch (e) {
      console.error('[MemoryVectors] 创建 VSS 表失败:', e.message);
      this.useVSS = false;
    }
  }

  /**
   * 创建向量嵌入
   */
  async createEmbedding(text, adapter = null) {
    // 如果提供了 OpenAI 适配器，使用真实的 embedding API
    if (adapter && typeof adapter.createEmbedding === 'function') {
      try {
        const embedding = await adapter.createEmbedding(text, this.embeddingModel);
        return embedding;
      } catch (e) {
        console.error('[MemoryVectors] API embedding 失败:', e.message);
      }
    }

    // 后备：使用本地简单实现
    return this.localEmbedding(text);
  }

  /**
   * 本地向量嵌入（基于 TF-IDF 思想的简单实现）
   */
  localEmbedding(text) {
    const words = this.tokenize(text);
    const dimension = this.dimension;
    const vector = new Float32Array(dimension);

    // 词频统计
    const wordFreq = new Map();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // 生成向量
    for (const [word, freq] of wordFreq) {
      // 使用 hash 函数确定位置
      const positions = this.hashWord(word, dimension, 3);
      for (const pos of positions) {
        vector[pos] += freq / words.length;
      }
    }

    // 归一化
    this.normalizeVector(vector);

    return Array.from(vector);
  }

  /**
   * 分词
   */
  tokenize(text) {
    if (!text) return [];
    
    // 简单分词：支持中英文
    const words = [];
    
    // 英文单词
    const englishWords = text.toLowerCase().match(/[a-z]+/g) || [];
    words.push(...englishWords);
    
    // 中文字符（按字符分割）
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    words.push(...chineseChars);
    
    // 数字
    const numbers = text.match(/\d+/g) || [];
    words.push(...numbers);
    
    return words;
  }

  /**
   * 词哈希函数（用于稀疏向量）
   */
  hashWord(word, dimension, numPositions = 3) {
    const positions = [];
    
    // 使用多个哈希函数减少冲突
    for (let i = 0; i < numPositions; i++) {
      let hash = 0;
      const seed = i * 31;
      
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j) + seed) | 0;
      }
      
      positions.push(Math.abs(hash) % dimension);
    }
    
    return positions;
  }

  /**
   * 归一化向量
   */
  normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
  }

  /**
   * 存储向量
   */
  async store(memoryId, text, metadata = {}, adapter = null) {
    // 创建向量
    const vector = await this.createEmbedding(text, adapter);

    // 存储到内存
    this.vectors.set(memoryId, {
      vector,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        text: text.slice(0, 200) // 存储部分文本用于调试
      }
    });

    // 存储到数据库
    this.storeVectorDB(memoryId, vector, metadata);

    // 如果启用 VSS，也存储到 VSS 表
    if (this.useVSS) {
      this.storeVectorVSS(memoryId, vector);
    }

    return {
      memoryId,
      dimension: this.dimension,
      model: this.embeddingModel
    };
  }

  /**
   * 存储向量到数据库
   */
  storeVectorDB(memoryId, vector, metadata) {
    // 将向量转换为 BLOB
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }

    // 更新 agent_memories 表
    this.db.prepare(`
      UPDATE agent_memories 
      SET embedding = ?, embedding_model = ? 
      WHERE id = ?
    `).run(buffer, this.embeddingModel, memoryId);
  }

  /**
   * 存储向量到 VSS 表
   */
  storeVectorVSS(memoryId, vector) {
    if (!this.useVSS) return;

    try {
      const vectorJSON = JSON.stringify(vector);
      this.db.prepare(`
        INSERT INTO memory_vectors_vss (rowid, vector)
        VALUES (?, ?)
        ON CONFLICT(rowid) DO UPDATE SET vector = excluded.vector
      `).run(memoryId, vectorJSON);
    } catch (e) {
      console.error('[MemoryVectors] VSS 存储失败:', e.message);
    }
  }

  /**
   * 相似度搜索
   */
  async search(query, options = {}) {
    const {
      topK = 10,
      threshold = 0.5,
      metadata = null,
      adapter = null
    } = options;

    // 创建查询向量
    const queryVector = await this.createEmbedding(query, adapter);

    // 结果数组
    const results = [];

    // 如果使用 VSS，用 VSS 搜索
    if (this.useVSS) {
      return this.searchVSS(queryVector, topK, threshold);
    }

    // 否则使用内存搜索
    for (const [memoryId, data] of this.vectors) {
      // 元数据过滤
      if (metadata) {
        let match = true;
        for (const [key, value] of Object.entries(metadata)) {
          if (data.metadata[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      // 计算相似度
      const similarity = this.cosineSimilarity(queryVector, data.vector);

      if (similarity >= threshold) {
        results.push({
          memoryId,
          similarity,
          metadata: data.metadata
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * VSS 相似度搜索
   */
  searchVSS(queryVector, topK, threshold) {
    if (!this.useVSS) return [];

    try {
      const vectorJSON = JSON.stringify(queryVector);
      const rows = this.db.prepare(`
        SELECT rowid as memoryId, distance
        FROM memory_vectors_vss
        WHERE vss_search(vector, ?)
        ORDER BY distance
        LIMIT ?
      `).all(vectorJSON, topK * 2);

      // VSS 的 distance 是距离，需要转换为相似度
      return rows
        .map(row => ({
          memoryId: row.memoryId,
          similarity: 1 / (1 + row.distance), // 距离转相似度
          metadata: this.vectors.get(row.memoryId)?.metadata || {}
        }))
        .filter(r => r.similarity >= threshold)
        .slice(0, topK);
    } catch (e) {
      console.error('[MemoryVectors] VSS 搜索失败:', e.message);
      return [];
    }
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions do not match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * 批量计算相似度
   */
  batchSimilarity(queryVector, vectors) {
    return vectors.map(v => ({
      id: v.id,
      similarity: this.cosineSimilarity(queryVector, v.vector)
    }));
  }

  /**
   * 删除向量
   */
  delete(memoryId) {
    // 从内存删除
    this.vectors.delete(memoryId);

    // 从 VSS 表删除
    if (this.useVSS) {
      try {
        this.db.prepare('DELETE FROM memory_vectors_vss WHERE rowid = ?').run(memoryId);
      } catch (e) {
        // 忽略错误
      }
    }

    // 数据库中的向量会在删除 memory 时级联删除
  }

  /**
   * 加载所有向量到内存
   */
  loadAll() {
    const rows = this.db.prepare(`
      SELECT id, embedding, embedding_model 
      FROM agent_memories 
      WHERE agent_id = ? AND embedding IS NOT NULL
    `).all(this.agentId);

    for (const row of rows) {
      if (row.embedding) {
        const vector = this.parseVectorBlob(row.embedding);
        if (vector) {
          this.vectors.set(row.id, {
            vector,
            metadata: { model: row.embedding_model }
          });
        }
      }
    }

    console.log(`[MemoryVectors] 加载了 ${this.vectors.size} 个向量`);
    return this.vectors.size;
  }

  /**
   * 解析向量 BLOB
   */
  parseVectorBlob(blob) {
    try {
      if (!blob || blob.length === 0) return null;

      const dimension = blob.length / 4;
      const vector = new Float32Array(dimension);

      for (let i = 0; i < dimension; i++) {
        vector[i] = blob.readFloatLE(i * 4);
      }

      return Array.from(vector);
    } catch (e) {
      return null;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalVectors: this.vectors.size,
      dimension: this.dimension,
      model: this.embeddingModel,
      vssEnabled: this.useVSS
    };
  }

  /**
   * 清空所有向量
   */
  clear() {
    this.vectors.clear();
    
    if (this.useVSS) {
      try {
        this.db.exec('DELETE FROM memory_vectors_vss');
      } catch (e) {
        // 忽略
      }
    }
  }
}

module.exports = MemoryVectors;