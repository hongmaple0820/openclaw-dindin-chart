/**
 * Streaming Handler - 流式输出处理
 * 
 * 功能：
 * - SSE 流式响应
 * - 分块传输
 * - 取消处理
 */

const EventEmitter = require('events');

class StreamingHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.chunkSize = options.chunkSize || 100; // 每块字符数
    this.throttleMs = options.throttleMs || 10; // 块间延迟(ms)
    this.activeStreams = new Map();
  }

  /**
   * 创建 SSE 响应
   */
  createSSE(response) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');

    // 禁用 nginx 缓冲
    response.flush?.();
  }

  /**
   * 发送 SSE 事件
   */
  sendEvent(response, event, data) {
    if (response.writableEnded) return false;

    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      response.write(`event: ${event}\ndata: ${payload}\n\n`);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 流式输出文本
   */
  async streamText(response, streamId, text, options = {}) {
    const {
      chunkSize = this.chunkSize,
      throttleMs = this.throttleMs,
      onChunk = null
    } = options;

    // 创建取消控制器
    const controller = {
      cancelled: false,
      cancel: () => { controller.cancelled = true; }
    };
    this.activeStreams.set(streamId, controller);

    const startTime = Date.now();
    let sentChars = 0;
    let chunkCount = 0;

    try {
      // 分块发送
      for (let i = 0; i < text.length; i += chunkSize) {
        if (controller.cancelled || response.writableEnded) {
          break;
        }

        const chunk = text.slice(i, i + chunkSize);
        chunkCount++;

        // 发送内容块
        const sent = this.sendEvent(response, 'content', {
          stream_id: streamId,
          chunk: chunk,
          index: chunkCount,
          progress: i / text.length
        });

        if (!sent) break;

        sentChars += chunk.length;

        // 回调
        if (onChunk) {
          await onChunk(chunk, chunkCount);
        }

        // 节流
        if (throttleMs > 0) {
          await this.sleep(throttleMs);
        }
      }

      // 发送完成事件
      if (!controller.cancelled && !response.writableEnded) {
        this.sendEvent(response, 'done', {
          stream_id: streamId,
          total_chars: sentChars,
          total_chunks: chunkCount,
          latency_ms: Date.now() - startTime
        });
      }

      this.emit('complete', {
        streamId,
        chars: sentChars,
        chunks: chunkCount,
        cancelled: controller.cancelled,
        latency: Date.now() - startTime
      });

    } finally {
      this.activeStreams.delete(streamId);
    }

    return {
      streamId,
      chars: sentChars,
      chunks: chunkCount,
      cancelled: controller.cancelled
    };
  }

  /**
   * 流式输出迭代器
   */
  async streamIterator(response, streamId, iterator, options = {}) {
    const { throttleMs = this.throttleMs } = options;

    // 创建取消控制器
    const controller = {
      cancelled: false,
      cancel: () => { controller.cancelled = true; }
    };
    this.activeStreams.set(streamId, controller);

    const startTime = Date.now();
    let chunkCount = 0;
    let totalContent = '';

    try {
      for await (const chunk of iterator) {
        if (controller.cancelled || response.writableEnded) {
          break;
        }

        chunkCount++;

        // 提取内容
        const content = this.extractContent(chunk);
        if (content) {
          totalContent += content;
          this.sendEvent(response, 'content', {
            stream_id: streamId,
            chunk: content,
            index: chunkCount,
            raw: chunk
          });
        }

        if (throttleMs > 0) {
          await this.sleep(throttleMs);
        }
      }

      // 发送完成事件
      if (!controller.cancelled && !response.writableEnded) {
        this.sendEvent(response, 'done', {
          stream_id: streamId,
          total_chars: totalContent.length,
          total_chunks: chunkCount,
          latency_ms: Date.now() - startTime
        });
      }

      this.emit('complete', {
        streamId,
        chars: totalContent.length,
        chunks: chunkCount,
        cancelled: controller.cancelled,
        latency: Date.now() - startTime
      });

    } catch (error) {
      this.sendEvent(response, 'error', {
        stream_id: streamId,
        error: error.message
      });
      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }

    return {
      streamId,
      content: totalContent,
      chunks: chunkCount,
      cancelled: controller.cancelled
    };
  }

  /**
   * 从 OpenAI 格式的 chunk 提取内容
   */
  extractContent(chunk) {
    // OpenAI 格式
    if (chunk.choices?.[0]?.delta?.content) {
      return chunk.choices[0].delta.content;
    }

    // Anthropic 格式
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      return chunk.delta.text;
    }

    // 通用格式
    if (chunk.content) {
      return chunk.content;
    }

    return null;
  }

  /**
   * 取消流
   */
  cancelStream(streamId) {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.cancelled = true;
      this.activeStreams.delete(streamId);
      this.emit('cancelled', { streamId });
      return true;
    }
    return false;
  }

  /**
   * 取消所有流
   */
  cancelAll() {
    const count = this.activeStreams.size;
    for (const [streamId, controller] of this.activeStreams) {
      controller.cancelled = true;
      this.emit('cancelled', { streamId });
    }
    this.activeStreams.clear();
    return count;
  }

  /**
   * 获取活跃流数量
   */
  getActiveCount() {
    return this.activeStreams.size;
  }

  /**
   * 发送心跳
   */
  sendHeartbeat(response) {
    if (response.writableEnded) return false;
    try {
      response.write(': heartbeat\n\n');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 启动心跳间隔
   */
  startHeartbeat(response, intervalMs = 30000) {
    const interval = setInterval(() => {
      if (!this.sendHeartbeat(response)) {
        clearInterval(interval);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * 辅助函数：sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 格式化 OpenAI 流式响应
   */
  formatOpenAIStream(chunk, model, streamId) {
    return {
      id: `chatcmpl-${streamId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {
          content: chunk
        },
        finish_reason: null
      }]
    };
  }

  /**
   * 格式化 OpenAI 流结束
   */
  formatOpenAIStreamEnd(model, streamId) {
    return {
      id: `chatcmpl-${streamId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };
  }

  /**
   * 格式化错误响应
   */
  formatError(error, code = 'internal_error') {
    return {
      error: {
        message: error.message || 'Unknown error',
        type: error.type || 'api_error',
        param: null,
        code: error.code || code
      }
    };
  }

  /**
   * 发送 OpenAI 格式流式响应
   */
  async streamOpenAIFormat(response, streamId, iterator, model, options = {}) {
    const { throttleMs = this.throttleMs } = options;

    // 创建取消控制器
    const controller = {
      cancelled: false,
      cancel: () => { controller.cancelled = true; }
    };
    this.activeStreams.set(streamId, controller);

    const startTime = Date.now();
    let chunkCount = 0;
    let totalContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      for await (const chunk of iterator) {
        if (controller.cancelled || response.writableEnded) {
          break;
        }

        const content = this.extractContent(chunk);
        if (content) {
          totalContent += content;
          chunkCount++;
          completionTokens += Math.ceil(content.length / 4); // 估算

          const formatted = this.formatOpenAIStream(content, model, streamId);
          this.sendEvent(response, 'message', formatted);
        }

        if (throttleMs > 0) {
          await this.sleep(throttleMs);
        }
      }

      // 发送结束标记
      if (!controller.cancelled && !response.writableEnded) {
        const endChunk = this.formatOpenAIStreamEnd(model, streamId);
        this.sendEvent(response, 'message', endChunk);

        // 发送最终统计
        response.write('data: [DONE]\n\n');
      }

      this.emit('complete', {
        streamId,
        chars: totalContent.length,
        chunks: chunkCount,
        tokens: { prompt: promptTokens, completion: completionTokens },
        cancelled: controller.cancelled,
        latency: Date.now() - startTime
      });

    } catch (error) {
      this.sendEvent(response, 'error', this.formatError(error));
      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }

    return {
      streamId,
      content: totalContent,
      chunks: chunkCount,
      tokens: { prompt: promptTokens, completion: completionTokens },
      cancelled: controller.cancelled
    };
  }
}

module.exports = StreamingHandler;