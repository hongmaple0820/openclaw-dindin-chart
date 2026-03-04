/**
 * Skills Executor - 执行引擎
 * 
 * 功能：
 * - 技能执行
 * - 超时控制
 * - 资源限制
 * - 结果缓存
 */

const { EventEmitter } = require('events');

class SkillExecutor extends EventEmitter {
  constructor(registry, options = {}) {
    super();
    
    this.registry = registry;
    this.options = {
      // 默认超时（毫秒）
      timeout: options.timeout || 30000,
      // 最大并发
      maxConcurrent: options.maxConcurrent || 10,
      // 缓存启用
      cacheEnabled: options.cacheEnabled !== false,
      // 缓存TTL（毫秒）
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      // 沙箱配置
      sandbox: options.sandbox || {
        memory: 256 * 1024 * 1024, // 256MB
        cpu: 50 // 50%
      },
      // 重试配置
      retry: options.retry || {
        max: 2,
        delay: 1000
      },
      ...options
    };

    // 执行缓存
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // 执行状态
    this.running = new Map();
    this.queue = [];
    
    // 统计
    this.stats = {
      total: 0,
      success: 0,
      error: 0,
      timeout: 0,
      cached: 0
    };
  }

  /**
   * 执行技能
   * @param {string} skillId - 技能ID或名称
   * @param {Object} params - 参数
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>}
   */
  async execute(skillId, params = {}, context = {}) {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 检查缓存
    const cacheKey = this._getCacheKey(skillId, params, context);
    if (this.options.cacheEnabled) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        this.stats.cached++;
        this.emit('cache_hit', { skillId, executionId, params });
        return {
          ...cached,
          cached: true,
          executionId
        };
      }
    }

    // 获取技能
    const skill = await this.registry.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (!skill.enabled) {
      throw new Error(`Skill is disabled: ${skillId}`);
    }

    // 检查并发限制
    if (this.running.size >= this.options.maxConcurrent) {
      await this._waitForSlot();
    }

    // 执行上下文
    const execContext = {
      executionId,
      skill,
      params: this._mergeParams(skill, params),
      context,
      startTime,
      timeout: context.timeout || skill.timeout || this.options.timeout
    };

    // 记录执行状态
    this.running.set(executionId, execContext);
    this.stats.total++;

    this.emit('start', { skillId, executionId, params: execContext.params });

    try {
      // 执行技能
      const result = await this._executeWithTimeout(execContext);

      // 记录成功
      const duration = Date.now() - startTime;
      this.stats.success++;
      
      // 缓存结果
      if (this.options.cacheEnabled && result.cacheable !== false) {
        this._setCache(cacheKey, result);
      }

      // 记录日志
      await this._logExecution(skill.id, context.userId, executionId, params, result, 'success', null, duration);

      this.emit('complete', {
        skillId,
        executionId,
        result,
        duration
      });

      return {
        success: true,
        data: result,
        executionId,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 分类错误
      let status = 'error';
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        status = 'timeout';
        this.stats.timeout++;
      } else {
        this.stats.error++;
      }

      // 记录错误日志
      await this._logExecution(skill.id, context.userId, executionId, params, null, status, error.message, duration);

      this.emit('error', {
        skillId,
        executionId,
        error,
        duration
      });

      throw error;
    } finally {
      this.running.delete(executionId);
      this._processQueue();
    }
  }

  /**
   * 带超时的执行
   * @private
   */
  async _executeWithTimeout(execContext) {
    const { skill, params, context, timeout } = execContext;

    return new Promise(async (resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        const error = new Error(`Skill execution timeout after ${timeout}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);

      try {
        // 获取执行器
        const executor = await this._getExecutor(skill);
        
        // 执行
        const result = await executor(params, context, {
          skill,
          executor: this,
          timeout
        });

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 获取技能执行器
   * @private
   */
  async _getExecutor(skill) {
    // 检查是否有缓存
    if (this._executors && this._executors.has(skill.id)) {
      return this._executors.get(skill.id);
    }

    // MCP 兼容的技能
    if (skill.mcp_compatible && skill.mcp_tools && skill.mcp_tools.length > 0) {
      return this._createMCPExecutor(skill);
    }

    // 内置技能
    if (skill.source === 'builtin') {
      return this._createBuiltinExecutor(skill);
    }

    // 自定义技能（加载脚本）
    if (skill.skill_path) {
      return this._createScriptExecutor(skill);
    }

    // 默认执行器
    return this._createDefaultExecutor(skill);
  }

  /**
   * 创建 MCP 执行器
   * @private
   */
  _createMCPExecutor(skill) {
    return async (params, context, meta) => {
      // 通过 MCP 桥接执行
      // 这将由 mcporter-bridge 模块实现
      const bridge = this.options.mcpBridge;
      if (!bridge) {
        throw new Error('MCP bridge not configured');
      }

      const tool = skill.mcp_tools[0]; // 默认使用第一个工具
      return bridge.call(tool, params, context);
    };
  }

  /**
   * 创建内置执行器
   * @private
   */
  _createBuiltinExecutor(skill) {
    return async (params, context, meta) => {
      // 内置技能将由具体实现注册
      const builtinExecutor = this.options.builtinExecutors?.[skill.id];
      if (!builtinExecutor) {
        throw new Error(`No builtin executor for skill: ${skill.id}`);
      }
      return builtinExecutor(params, context, meta);
    };
  }

  /**
   * 创建脚本执行器
   * @private
   */
  _createScriptExecutor(skill) {
    return async (params, context, meta) => {
      const path = require('path');
      const fs = require('fs').promises;

      // 检查脚本路径
      const scriptPath = path.resolve(skill.skill_path);
      
      try {
        await fs.access(scriptPath);
      } catch (e) {
        throw new Error(`Skill script not found: ${scriptPath}`);
      }

      // 加载并执行脚本
      // 注意：这里需要沙箱隔离
      const sandbox = this.options.sandboxExecutor;
      if (sandbox) {
        return sandbox.execute(scriptPath, params, context);
      }

      // 简单执行（无沙箱）
      delete require.cache[require.resolve(scriptPath)];
      const module = require(scriptPath);
      const executor = module.default || module.execute || module;
      
      if (typeof executor !== 'function') {
        throw new Error(`Skill module must export a function: ${skill.id}`);
      }

      return executor(params, context, meta);
    };
  }

  /**
   * 创建默认执行器
   * @private
   */
  _createDefaultExecutor(skill) {
    return async (params, context, meta) => {
      // 返回技能信息和参数，让调用者处理
      return {
        skill: skill.id,
        name: skill.name,
        params,
        message: 'Skill executed (no executor configured)'
      };
    };
  }

  /**
   * 合并参数
   * @private
   */
  _mergeParams(skill, params) {
    const defaultConfig = skill.default_config || {};
    
    if (typeof params === 'object' && params !== null) {
      return { ...defaultConfig, ...params };
    }
    
    return params;
  }

  /**
   * 执行管道
   * @param {Array} skills - 技能列表
   * @param {*} input - 初始输入
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>}
   */
  async executePipeline(skills, input, context = {}) {
    let result = input;
    const pipelineId = `pipeline_${Date.now()}`;
    const steps = [];

    this.emit('pipeline_start', { pipelineId, skills });

    for (let i = 0; i < skills.length; i++) {
      const skillId = typeof skills[i] === 'string' ? skills[i] : skills[i].id;
      const stepParams = typeof skills[i] === 'object' ? skills[i].params : {};

      try {
        const stepResult = await this.execute(skillId, {
          ...stepParams,
          input: result
        }, context);

        steps.push({
          skill: skillId,
          success: true,
          result: stepResult
        });

        result = stepResult.data;

        this.emit('pipeline_step', {
          pipelineId,
          step: i + 1,
          total: skills.length,
          skillId,
          result
        });
      } catch (error) {
        steps.push({
          skill: skillId,
          success: false,
          error: error.message
        });

        this.emit('pipeline_error', {
          pipelineId,
          step: i + 1,
          skillId,
          error
        });

        throw error;
      }
    }

    this.emit('pipeline_complete', { pipelineId, steps, result });

    return {
      success: true,
      result,
      steps,
      pipelineId
    };
  }

  /**
   * 批量执行
   * @param {Array} calls - 调用列表
   * @param {Object} context - 执行上下文
   * @returns {Promise<Array>}
   */
  async executeBatch(calls, context = {}) {
    const results = await Promise.allSettled(
      calls.map(call => 
        this.execute(call.skill, call.params, {
          ...context,
          ...call.context
        })
      )
    );

    return results.map((result, index) => ({
      skill: calls[index].skill,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * 获取执行状态
   * @param {string} executionId - 执行ID
   * @returns {Object|null}
   */
  getStatus(executionId) {
    return this.running.get(executionId) || null;
  }

  /**
   * 取消执行
   * @param {string} executionId - 执行ID
   * @returns {boolean}
   */
  async cancel(executionId) {
    const status = this.running.get(executionId);
    if (!status) return false;

    // 标记为已取消
    status.cancelled = true;
    
    this.emit('cancel', { executionId, skill: status.skill.id });
    
    return true;
  }

  /**
   * 清除缓存
   * @param {string} skillId - 可选，指定技能ID
   */
  clearCache(skillId) {
    if (skillId) {
      // 清除指定技能的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(skillId)) {
          this.cache.delete(key);
          this.cacheTimestamps.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      running: this.running.size,
      queued: this.queue.length,
      cacheSize: this.cache.size
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 生成缓存键
   * @private
   */
  _getCacheKey(skillId, params, context) {
    const data = JSON.stringify({ skillId, params, userId: context.userId });
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 从缓存获取
   * @private
   */
  _getFromCache(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * 设置缓存
   * @private
   */
  _setCache(key, value) {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 等待执行槽位
   * @private
   */
  _waitForSlot() {
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * 处理队列
   * @private
   */
  _processQueue() {
    if (this.queue.length > 0 && this.running.size < this.options.maxConcurrent) {
      const resolve = this.queue.shift();
      resolve();
    }
  }

  /**
   * 记录执行日志
   * @private
   */
  async _logExecution(skillId, userId, sessionId, input, output, status, errorMessage, duration) {
    if (!this.registry.db) return;

    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.registry.db.run(`
        INSERT INTO skill_logs (id, skill_id, user_id, session_id, input, output, status, error_message, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        skillId,
        userId || null,
        sessionId,
        JSON.stringify(input),
        output ? JSON.stringify(output) : null,
        status,
        errorMessage,
        duration,
        Date.now()
      ]);
    } catch (error) {
      // 记录日志失败不应该中断执行
      console.error('Failed to log skill execution:', error);
    }
  }
}

module.exports = { SkillExecutor };