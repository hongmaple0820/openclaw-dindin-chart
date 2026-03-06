/**
 * Skills Executor - 执行引擎
 * 
 * 功能：
 * - 技能执行
 * - 超时控制
 * - 资源限制
 * - 结果缓存
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * 沙箱配置接口
 */
interface SandboxConfig {
  memory: number;
  cpu: number;
}

/**
 * 重试配置接口
 */
interface RetryConfig {
  max: number;
  delay: number;
}

/**
 * 执行器选项接口
 */
export interface ExecutorOptions {
  timeout?: number;
  maxConcurrent?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  sandbox?: SandboxConfig;
  retry?: RetryConfig;
  mcpBridge?: unknown;
  builtinExecutors?: Record<string, Function>;
  sandboxExecutor?: {
    execute: (scriptPath: string, params: unknown, context: unknown) => Promise<unknown>;
  };
}

/**
 * 执行上下文接口
 */
interface ExecutionContext {
  executionId: string;
  skill: SkillInfo;
  params: Record<string, unknown>;
  context: Record<string, unknown>;
  startTime: number;
  timeout: number;
  cancelled?: boolean;
}

/**
 * 技能信息接口
 */
export interface SkillInfo {
  id: string;
  name: string;
  enabled: boolean;
  timeout?: number;
  mcp_compatible?: boolean;
  mcp_tools?: string[];
  source?: string;
  skill_path?: string;
  default_config?: Record<string, unknown>;
}

/**
 * 执行统计接口
 */
interface ExecutionStats {
  total: number;
  success: number;
  error: number;
  timeout: number;
  cached: number;
}

/**
 * 技能执行结果接口
 */
interface ExecutionResult {
  success: boolean;
  data?: unknown;
  executionId: string;
  duration: number;
  cached?: boolean;
  error?: string;
}

/**
 * 管道执行结果接口
 */
interface PipelineResult {
  success: boolean;
  result: unknown;
  steps: Array<{
    skill: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  pipelineId: string;
}

/**
 * 批量执行项接口
 */
interface BatchCall {
  skill: string;
  params?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * 数据库接口
 */
interface Database {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

export class SkillExecutor extends EventEmitter {
  registry: { db: Database; get: (id: string) => Promise<SkillInfo | null> };
  options: Required<ExecutorOptions> & { sandbox: SandboxConfig; retry: RetryConfig };

  // 执行缓存
  private cache: Map<string, unknown> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  
  // 执行状态
  private running: Map<string, ExecutionContext> = new Map();
  private queue: Array<() => void> = [];
  
  // 统计
  private stats: ExecutionStats = {
    total: 0,
    success: 0,
    error: 0,
    timeout: 0,
    cached: 0
  };

  // 执行器缓存
  private _executors?: Map<string, Function>;

  constructor(registry: SkillExecutor['registry'], options: ExecutorOptions = {}) {
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
      mcpBridge: options.mcpBridge,
      builtinExecutors: options.builtinExecutors,
      sandboxExecutor: options.sandboxExecutor
    };
  }

  /**
   * 执行技能
   */
  async execute(
    skillId: string, 
    params: Record<string, unknown> = {}, 
    context: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 检查缓存
    const cacheKey = this._getCacheKey(skillId, params, context);
    if (this.options.cacheEnabled) {
      const cached = this._getFromCache(cacheKey) as ExecutionResult | undefined;
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
    const execContext: ExecutionContext = {
      executionId,
      skill,
      params: this._mergeParams(skill, params),
      context,
      startTime,
      timeout: (context.timeout as number) || skill.timeout || this.options.timeout
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
      if (this.options.cacheEnabled && (result as Record<string, unknown>)?.cacheable !== false) {
        this._setCache(cacheKey, result);
      }

      // 记录日志
      await this._logExecution(skill.id, context.userId as string, executionId, params, result, 'success', null, duration);

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
      const err = error as Error;
      
      // 分类错误
      let status = 'error';
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        status = 'timeout';
        this.stats.timeout++;
      } else {
        this.stats.error++;
      }

      // 记录错误日志
      await this._logExecution(skill.id, context.userId as string, executionId, params, null, status, err.message, duration);

      this.emit('error', {
        skillId,
        executionId,
        error: err,
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
   */
  private async _executeWithTimeout(execContext: ExecutionContext): Promise<unknown> {
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
   */
  private async _getExecutor(skill: SkillInfo): Promise<Function> {
    // 检查是否有缓存
    if (this._executors && this._executors.has(skill.id)) {
      return this._executors.get(skill.id)!;
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
   */
  private _createMCPExecutor(skill: SkillInfo): Function {
    return async (params: unknown, context: unknown, meta: unknown): Promise<unknown> => {
      // 通过 MCP 桥接执行
      // 这将由 mcporter-bridge 模块实现
      const bridge = this.options.mcpBridge as {
        call: (tool: string, params: unknown, context: unknown) => Promise<unknown>;
      } | undefined;
      
      if (!bridge) {
        throw new Error('MCP bridge not configured');
      }

      const tool = skill.mcp_tools![0]; // 默认使用第一个工具
      return bridge.call(tool, params, context);
    };
  }

  /**
   * 创建内置执行器
   */
  private _createBuiltinExecutor(skill: SkillInfo): Function {
    return async (params: unknown, context: unknown, meta: unknown): Promise<unknown> => {
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
   */
  private _createScriptExecutor(skill: SkillInfo): Function {
    return async (params: unknown, context: unknown, meta: unknown): Promise<unknown> => {
      // 检查脚本路径
      const scriptPath = path.resolve(skill.skill_path!);
      
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
   */
  private _createDefaultExecutor(skill: SkillInfo): Function {
    return async (params: unknown, context: unknown, meta: unknown): Promise<unknown> => {
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
   */
  private _mergeParams(skill: SkillInfo, params: Record<string, unknown>): Record<string, unknown> {
    const defaultConfig = skill.default_config || {};
    
    if (typeof params === 'object' && params !== null) {
      return { ...defaultConfig, ...params };
    }
    
    return params;
  }

  /**
   * 执行管道
   */
  async executePipeline(
    skills: Array<string | { id: string; params?: Record<string, unknown> }>, 
    input: unknown, 
    context: Record<string, unknown> = {}
  ): Promise<PipelineResult> {
    let result = input;
    const pipelineId = `pipeline_${Date.now()}`;
    const steps: PipelineResult['steps'] = [];

    this.emit('pipeline_start', { pipelineId, skills });

    for (let i = 0; i < skills.length; i++) {
      const skillItem = skills[i];
      const skillId = typeof skillItem === 'string' ? skillItem : skillItem.id;
      const stepParams = typeof skillItem === 'object' ? skillItem.params : {};

      try {
        const stepResult = await this.execute(skillId, {
          ...stepParams,
          input: result
        }, context);

        steps.push({
          skill: skillId,
          success: true,
          result: stepResult.data
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
        const err = error as Error;
        steps.push({
          skill: skillId,
          success: false,
          error: err.message
        });

        this.emit('pipeline_error', {
          pipelineId,
          step: i + 1,
          skillId,
          error: err
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
   */
  async executeBatch(calls: BatchCall[], context: Record<string, unknown> = {}): Promise<Array<{
    skill: string;
    success: boolean;
    data: unknown;
    error: string | null;
  }>> {
    const results = await Promise.allSettled(
      calls.map(call => 
        this.execute(call.skill, call.params || {}, {
          ...context,
          ...call.context
        })
      )
    );

    return results.map((result, index) => ({
      skill: calls[index].skill,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? (result.reason as Error).message : null
    }));
  }

  /**
   * 获取执行状态
   */
  getStatus(executionId: string): ExecutionContext | null {
    return this.running.get(executionId) || null;
  }

  /**
   * 取消执行
   */
  async cancel(executionId: string): Promise<boolean> {
    const status = this.running.get(executionId);
    if (!status) return false;

    // 标记为已取消
    status.cancelled = true;
    
    this.emit('cancel', { executionId, skill: status.skill.id });
    
    return true;
  }

  /**
   * 清除缓存
   */
  clearCache(skillId?: string): void {
    if (skillId) {
      // 清除指定技能的缓存
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(skillId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      });
    } else {
      // 清除所有缓存
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): ExecutionStats & { running: number; queued: number; cacheSize: number } {
    return {
      ...this.stats,
      running: this.running.size,
      queued: this.queue.length,
      cacheSize: this.cache.size
    };
  }

  /**
   * 生成缓存键
   */
  private _getCacheKey(skillId: string, params: unknown, context: Record<string, unknown>): string {
    const data = JSON.stringify({ skillId, params, userId: context.userId });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 从缓存获取
   */
  private _getFromCache(key: string): unknown | undefined {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return undefined;

    if (Date.now() - timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return undefined;
    }

    return this.cache.get(key);
  }

  /**
   * 设置缓存
   */
  private _setCache(key: string, value: unknown): void {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 等待执行槽位
   */
  private _waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * 处理队列
   */
  private _processQueue(): void {
    if (this.queue.length > 0 && this.running.size < this.options.maxConcurrent) {
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }

  /**
   * 记录执行日志
   */
  private async _logExecution(
    skillId: string, 
    userId: string | undefined, 
    sessionId: string, 
    input: unknown, 
    output: unknown, 
    status: string, 
    errorMessage: string | null, 
    duration: number
  ): Promise<void> {
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