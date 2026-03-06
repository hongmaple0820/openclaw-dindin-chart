/**
 * OpenAI Protocol Adapter - OpenAI 协议适配
 * 
 * 功能：
 * - chat/completions 接口
 * - models 接口
 * - 流式响应支持
 * - 错误处理
 */

const EventEmitter = require('events');

class OpenAIAdapter extends EventEmitter {
  constructor(agent) {
    super();
    this.agent = agent;
    this.abortController = null;
  }

  /**
   * 获取 Models 列表
   */
  async listModels() {
    const endpoint = this.agent.apiEndpoint;
    const apiKey = this.agent.apiKey;

    if (!endpoint || !apiKey) {
      return this.getDefaultModels();
    }

    try {
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OpenAIAdapter] 获取模型列表失败:', error.message);
      return this.getDefaultModels();
    }
  }

  /**
   * 默认模型列表
   */
  getDefaultModels() {
    return {
      object: 'list',
      data: [
        { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
        { id: 'gpt-4-turbo', object: 'model', created: 1706037612, owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' },
        { id: 'claude-3-opus', object: 'model', created: 1707864000, owned_by: 'anthropic' },
        { id: 'claude-3-sonnet', object: 'model', created: 1707864000, owned_by: 'anthropic' },
        { id: this.agent.model || 'default', object: 'model', created: Date.now(), owned_by: 'custom' }
      ]
    };
  }

  /**
   * Chat Completions
   */
  async chatCompletion(params, options = {}) {
    const {
      messages,
      model = this.agent.model || 'gpt-3.5-turbo',
      temperature = this.agent.params?.temperature ?? 0.7,
      max_tokens = this.agent.params?.max_tokens,
      top_p = this.agent.params?.top_p,
      stream = false,
      ...restParams
    } = params;

    const endpoint = this.agent.apiEndpoint;
    const apiKey = this.agent.apiKey;

    if (!endpoint || !apiKey) {
      throw new Error('Agent API not configured');
    }

    // 验证消息格式
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    // 构建请求体
    const requestBody = {
      model,
      messages: this.normalizeMessages(messages),
      temperature,
      stream,
      ...restParams
    };

    if (max_tokens) requestBody.max_tokens = max_tokens;
    if (top_p) requestBody.top_p = top_p;

    // 创建 AbortController
    this.abortController = new AbortController();
    const timeout = options.timeout || 120000;
    const timeoutId = setTimeout(() => this.abortController?.abort(), timeout);

    try {
      const startTime = Date.now();

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': stream ? 'text/event-stream' : 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(response.status, errorData);
      }

      // 流式响应
      if (stream) {
        return this.handleStreamResponse(response, model);
      }

      // 非流式响应
      const data = await response.json();
      const latency = Date.now() - startTime;

      this.emit('completion', {
        agentId: this.agent.id,
        model,
        latency,
        tokens: data.usage
      });

      return data;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw this.createError(499, { error: { message: 'Request cancelled' } });
      }

      this.emit('error', { agentId: this.agent.id, error });
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  async *handleStreamResponse(response, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            this.emit('stream-end', { agentId: this.agent.id, model });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      // 处理剩余 buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            yield parsed;
          } catch (e) {
            // 忽略
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.emit('stream-end', { agentId: this.agent.id, model });
    }
  }

  /**
   * 标准化消息格式
   */
  normalizeMessages(messages) {
    return messages.map(msg => {
      // 支持多种格式
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }

      // 确保 content 是字符串
      let content = msg.content;
      if (Array.isArray(content)) {
        // 多模态消息
        content = content.map(c => {
          if (typeof c === 'string') return { type: 'text', text: c };
          return c;
        });
      } else if (typeof content !== 'string') {
        content = String(content || '');
      }

      return {
        role: msg.role || 'user',
        content,
        ...(msg.name && { name: msg.name }),
        ...(msg.function_call && { function_call: msg.function_call }),
        ...(msg.tool_calls && { tool_calls: msg.tool_calls })
      };
    });
  }

  /**
   * 创建错误
   */
  createError(status, data) {
    const message = data.error?.message || data.error?.error?.message || 'Unknown error';
    const type = data.error?.type || 'api_error';
    const code = data.error?.code || status;

    const error = new Error(message);
    error.status = status;
    error.type = type;
    error.code = code;
    error.data = data;

    return error;
  }

  /**
   * 取消请求
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Embedding 向量化
   */
  async createEmbedding(text, model = 'text-embedding-ada-002') {
    const endpoint = this.agent.apiEndpoint;
    const apiKey = this.agent.apiKey;

    if (!endpoint || !apiKey) {
      // 返回简单的 hash embedding 作为后备
      return this.fallbackEmbedding(text);
    }

    try {
      const response = await fetch(`${endpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('[OpenAIAdapter] Embedding 失败:', error.message);
      return this.fallbackEmbedding(text);
    }
  }

  /**
   * 后备 embedding（简单实现）
   */
  fallbackEmbedding(text) {
    // 使用简单的词频向量作为后备
    // 注意：这不是真正的语义向量，仅用于演示
    const words = text.toLowerCase().split(/\s+/);
    const dimension = 384;
    const embedding = new Array(dimension).fill(0);

    for (const word of words) {
      // 使用简单的 hash 分布
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % dimension;
      embedding[index] += 1;
    }

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    return embedding.map(v => v / norm);
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const endpoint = this.agent.apiEndpoint;
    const apiKey = this.agent.apiKey;

    if (!endpoint || !apiKey) {
      return { healthy: false, error: 'API not configured' };
    }

    try {
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 5000
      });

      if (response.ok) {
        return { healthy: true };
      }

      return { healthy: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = OpenAIAdapter;