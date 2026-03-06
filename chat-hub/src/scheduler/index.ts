/**
 * 定时任务调度器
 * 支持内置调度和外部调度器
 */

import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { Database } from 'better-sqlite3';

interface SchedulerConfig {
  maxConcurrent?: number;
  defaultTimezone?: string;
}

interface TaskOptions {
  name?: string;
  description?: string;
  userId?: string;
  scheduleType: 'cron' | 'interval' | 'once';
  cronExpr?: string;
  timezone?: string;
  intervalSeconds?: number;
  runOnceAt?: number;
  taskType: 'skill' | 'agent' | 'message' | 'webhook' | 'custom';
  taskConfig?: Record<string, unknown>;
  useExternal?: boolean;
  externalType?: string;
  externalConfig?: Record<string, unknown>;
  inputParams?: Record<string, unknown>;
  enabled?: boolean;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelaySeconds?: number;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  notificationChannels?: string[];
}

interface Task {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  scheduleType: 'cron' | 'interval' | 'once';
  cronExpr?: string;
  timezone: string;
  intervalSeconds?: number;
  runOnceAt?: number;
  nextRunAt?: number | null;
  taskType: 'skill' | 'agent' | 'message' | 'webhook' | 'custom';
  taskConfig: Record<string, unknown>;
  useExternal: boolean;
  externalType?: string;
  externalConfig?: Record<string, unknown>;
  inputParams?: Record<string, unknown>;
  enabled: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelaySeconds: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notificationChannels: string[];
  createdAt: number;
}

interface ScheduledJob {
  stop: () => void;
  intervalId?: NodeJS.Timeout;
  timeoutId?: NodeJS.Timeout;
}

class Scheduler {
  private db: Database;
  private config: {
    maxConcurrent: number;
    defaultTimezone: string;
  };
  private jobs: Map<string, ScheduledJob>;
  private running: boolean;

  constructor(db: Database, config: SchedulerConfig = {}) {
    this.db = db;
    this.config = {
      maxConcurrent: config.maxConcurrent || 10,
      defaultTimezone: config.defaultTimezone || 'Asia/Shanghai',
      ...config
    };
    this.jobs = new Map();
    this.running = false;
  }

  async init(): Promise<void> {
    // 加载已启用的任务
    await this._loadEnabledTasks();
    console.log('[Scheduler] 初始化完成');
  }

  /**
   * 加载已启用的任务
   */
  private async _loadEnabledTasks(): Promise<void> {
    const tasks = this.db.prepare(`
      SELECT * FROM scheduled_tasks WHERE enabled = 1
    `).all() as Task[];

    for (const task of tasks) {
      try {
        await this._scheduleTask(task);
      } catch (error) {
        console.error(`[Scheduler] 加载任务 ${task.id} 失败:`, (error as Error).message);
      }
    }
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    this.running = true;
    console.log('[Scheduler] 调度器已启动');
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    this.running = false;
    
    // 停止所有任务
    for (const [taskId, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    
    console.log('[Scheduler] 调度器已停止');
  }

  /**
   * 创建定时任务
   */
  async create(options: TaskOptions): Promise<Task> {
    const id = uuidv4();
    
    const task: Task = {
      id,
      name: options.name || `任务-${id.slice(0, 8)}`,
      description: options.description,
      userId: options.userId,
      scheduleType: options.scheduleType,
      cronExpr: options.cronExpr,
      timezone: options.timezone || this.config.defaultTimezone,
      intervalSeconds: options.intervalSeconds,
      runOnceAt: options.runOnceAt,
      taskType: options.taskType,
      taskConfig: options.taskConfig || {},
      useExternal: options.useExternal || false,
      externalType: options.externalType,
      externalConfig: options.externalConfig,
      inputParams: options.inputParams,
      enabled: options.enabled !== false,
      retryOnFailure: options.retryOnFailure !== false,
      maxRetries: options.maxRetries || 3,
      retryDelaySeconds: options.retryDelaySeconds || 60,
      notifyOnSuccess: options.notifyOnSuccess || false,
      notifyOnFailure: options.notifyOnFailure !== false,
      notificationChannels: options.notificationChannels || [],
      createdAt: Date.now()
    };

    // 计算下次执行时间
    task.nextRunAt = this._calculateNextRun(task);

    this.db.prepare(`
      INSERT INTO scheduled_tasks (
        id, name, description, user_id, schedule_type, cron_expr, timezone,
        interval_seconds, run_once_at, next_run_at, task_type, task_config,
        use_external, external_type, external_config, input_params,
        enabled, retry_on_failure, max_retries, retry_delay_seconds,
        notify_on_success, notify_on_failure, notification_channels, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.name, task.description, task.userId, task.scheduleType,
      task.cronExpr, task.timezone, task.intervalSeconds, task.runOnceAt,
      task.nextRunAt, task.taskType, JSON.stringify(task.taskConfig),
      task.useExternal ? 1 : 0, task.externalType, 
      JSON.stringify(task.externalConfig || {}),
      JSON.stringify(task.inputParams || {}),
      task.enabled ? 1 : 0, task.retryOnFailure ? 1 : 0,
      task.maxRetries, task.retryDelaySeconds,
      task.notifyOnSuccess ? 1 : 0, task.notifyOnFailure ? 1 : 0,
      JSON.stringify(task.notificationChannels), task.createdAt
    );

    // 如果启用且不是外部调度，注册任务
    if (task.enabled && !task.useExternal) {
      await this._scheduleTask(task);
    }

    return task;
  }

  /**
   * 计算下次执行时间
   */
  private _calculateNextRun(task: Task): number | null {
    const now = Date.now();
    
    switch (task.scheduleType) {
      case 'once':
        return task.runOnceAt || null;
      
      case 'interval':
        return now + ((task.intervalSeconds || 60) * 1000);
      
      case 'cron':
        // 简单实现，实际应使用 cron 解析器
        return now + 60000; // 默认 1 分钟后
      
      default:
        return null;
    }
  }

  /**
   * 调度任务
   */
  private async _scheduleTask(task: Task): Promise<void> {
    if (this.jobs.has(task.id)) {
      this.jobs.get(task.id)!.stop();
    }

    let job: ScheduledJob;
    
    switch (task.scheduleType) {
      case 'cron':
        job = cron.schedule(task.cronExpr || '* * * * *', () => this._executeTask(task), {
          timezone: task.timezone
        });
        break;
      
      case 'interval':
        job = {
          intervalId: setInterval(() => this._executeTask(task), (task.intervalSeconds || 60) * 1000),
          stop: function() { clearInterval(this.intervalId!); }
        };
        break;
      
      case 'once':
        const delay = (task.runOnceAt || 0) - Date.now();
        if (delay > 0) {
          job = {
            timeoutId: setTimeout(() => this._executeTask(task), delay),
            stop: function() { clearTimeout(this.timeoutId!); }
          };
        } else {
          return; // 已过期
        }
        break;
      
      default:
        return;
    }

    if (job) {
      this.jobs.set(task.id, job);
    }
  }

  /**
   * 执行任务
   */
  private async _executeTask(task: Task): Promise<void> {
    if (!this.running) return;

    const runId = uuidv4();
    const startTime = Date.now();

    // 创建运行记录
    this.db.prepare(`
      INSERT INTO scheduled_task_runs (
        id, task_id, scheduled_at, started_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(runId, task.id, task.nextRunAt, startTime, 'running', startTime);

    // 获取锁
    const locked = this._acquireLock(task.id);
    if (!locked) {
      this.db.prepare(`
        UPDATE scheduled_task_runs SET status = 'skipped', completed_at = ?
        WHERE id = ?
      `).run(Date.now(), runId);
      return;
    }

    try {
      let result;

      switch (task.taskType) {
        case 'skill':
          result = await this._executeSkill(task);
          break;
        case 'agent':
          result = await this._executeAgent(task);
          break;
        case 'message':
          result = await this._sendMessage(task);
          break;
        case 'webhook':
          result = await this._callWebhook(task);
          break;
        default:
          result = await this._executeCustom(task);
      }

      const duration = Date.now() - startTime;

      // 更新运行记录
      this.db.prepare(`
        UPDATE scheduled_task_runs SET 
          status = 'success', completed_at = ?, duration_ms = ?, result = ?
        WHERE id = ?
      `).run(Date.now(), duration, JSON.stringify(result), runId);

      // 更新任务统计
      this.db.prepare(`
        UPDATE scheduled_tasks SET 
          last_run_at = ?, next_run_at = ?, run_count = run_count + 1
        WHERE id = ?
      `).run(startTime, this._calculateNextRun(task), task.id);

      // 成功通知
      if (task.notifyOnSuccess) {
        await this._sendNotification(task, 'success', result);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      // 更新运行记录
      this.db.prepare(`
        UPDATE scheduled_task_runs SET 
          status = 'failed', completed_at = ?, duration_ms = ?, error_message = ?
        WHERE id = ?
      `).run(Date.now(), duration, err.message, runId);

      // 更新任务错误计数
      this.db.prepare(`
        UPDATE scheduled_tasks SET 
          error_count = error_count + 1, last_error = ?
        WHERE id = ?
      `).run(err.message, task.id);

      // 重试
      if (task.retryOnFailure) {
        await this._retryTask(task, runId);
      }

      // 失败通知
      if (task.notifyOnFailure) {
        await this._sendNotification(task, 'failed', { error: err.message });
      }

    } finally {
      this._releaseLock(task.id);
    }
  }

  /**
   * 获取锁
   */
  private _acquireLock(taskId: string): boolean {
    try {
      this.db.prepare(`
        INSERT INTO scheduled_task_locks (id, task_id, locked_at, locked_by, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), taskId, Date.now(), 'instance-1', Date.now() + 300000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 释放锁
   */
  private _releaseLock(taskId: string): void {
    this.db.prepare('DELETE FROM scheduled_task_locks WHERE task_id = ?').run(taskId);
  }

  /**
   * 执行技能
   */
  private async _executeSkill(task: Task): Promise<{ skillId: string; executed: boolean }> {
    // 实际实现需要调用 SkillsManager
    console.log(`[Scheduler] 执行技能: ${(task.taskConfig as { skillId?: string }).skillId}`);
    return { skillId: (task.taskConfig as { skillId?: string }).skillId || '', executed: true };
  }

  /**
   * 执行 Agent
   */
  private async _executeAgent(task: Task): Promise<{ agentId: string; executed: boolean }> {
    console.log(`[Scheduler] 执行 Agent: ${(task.taskConfig as { agentId?: string }).agentId}`);
    return { agentId: (task.taskConfig as { agentId?: string }).agentId || '', executed: true };
  }

  /**
   * 发送消息
   */
  private async _sendMessage(task: Task): Promise<{ channel: string; sent: boolean }> {
    console.log(`[Scheduler] 发送消息到: ${(task.taskConfig as { channel?: string }).channel}`);
    return { channel: (task.taskConfig as { channel?: string }).channel || '', sent: true };
  }

  /**
   * 调用 Webhook
   */
  private async _callWebhook(task: Task): Promise<{ status: number }> {
    const config = task.taskConfig as { url?: string; method?: string; headers?: Record<string, string>; body?: unknown };
    const response = await fetch(config.url || '', {
      method: config.method || 'POST',
      headers: config.headers || {},
      body: JSON.stringify(config.body || {})
    });
    return { status: response.status };
  }

  /**
   * 执行自定义任务
   */
  private async _executeCustom(task: Task): Promise<{ custom: boolean }> {
    console.log(`[Scheduler] 执行自定义任务: ${task.name}`);
    return { custom: true };
  }

  /**
   * 重试任务
   */
  private async _retryTask(task: Task, originalRunId: string): Promise<void> {
    const run = this.db.prepare('SELECT * FROM scheduled_task_runs WHERE id = ?').get(originalRunId) as { retry_count: number };
    
    if (run.retry_count >= task.maxRetries) {
      return;
    }

    // 延迟后重试
    setTimeout(() => {
      this.db.prepare(`
        INSERT INTO scheduled_task_runs (
          id, task_id, scheduled_at, started_at, status, is_retry, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), task.id, Date.now(), Date.now(), 'running', 1, run.retry_count + 1, Date.now());
      
      this._executeTask(task);
    }, task.retryDelaySeconds * 1000);
  }

  /**
   * 发送通知
   */
  private async _sendNotification(task: Task, status: string, result: unknown): Promise<void> {
    console.log(`[Scheduler] 发送通知: ${task.name} - ${status}`);
    // 实际实现需要调用通知服务
  }

  /**
   * 启用任务
   */
  async enable(taskId: string): Promise<void> {
    const task = this.db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(taskId) as Task | undefined;
    if (!task) throw new Error('任务不存在');

    this.db.prepare('UPDATE scheduled_tasks SET enabled = 1 WHERE id = ?').run(taskId);
    
    if (!task.useExternal) {
      await this._scheduleTask(task);
    }
  }

  /**
   * 禁用任务
   */
  async disable(taskId: string): Promise<void> {
    this.db.prepare('UPDATE scheduled_tasks SET enabled = 0 WHERE id = ?').run(taskId);
    
    if (this.jobs.has(taskId)) {
      this.jobs.get(taskId)!.stop();
      this.jobs.delete(taskId);
    }
  }

  /**
   * 删除任务
   */
  async delete(taskId: string): Promise<void> {
    await this.disable(taskId);
    this.db.prepare('DELETE FROM scheduled_task_runs WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(taskId);
  }

  /**
   * 获取用户的定时任务
   */
  async listByUser(userId: string): Promise<Task[]> {
    return this.db.prepare('SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Task[];
  }

  /**
   * 获取运行历史
   */
  async getRunHistory(taskId: string, limit: number = 50): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM scheduled_task_runs 
      WHERE task_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(taskId, limit);
  }
}

export { Scheduler };