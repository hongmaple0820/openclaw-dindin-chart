/**
 * 定时任务调度器
 * 支持内置调度和外部调度器
 */

const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

class Scheduler {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      maxConcurrent: config.maxConcurrent || 10,
      defaultTimezone: config.defaultTimezone || 'Asia/Shanghai',
      ...config
    };
    this.jobs = new Map();
    this.running = false;
  }

  async init() {
    // 加载已启用的任务
    await this._loadEnabledTasks();
    console.log('[Scheduler] 初始化完成');
  }

  /**
   * 加载已启用的任务
   */
  async _loadEnabledTasks() {
    const tasks = this.db.prepare(`
      SELECT * FROM scheduled_tasks WHERE enabled = 1
    `).all();

    for (const task of tasks) {
      try {
        await this._scheduleTask(task);
      } catch (error) {
        console.error(`[Scheduler] 加载任务 ${task.id} 失败:`, error.message);
      }
    }
  }

  /**
   * 启动调度器
   */
  async start() {
    this.running = true;
    console.log('[Scheduler] 调度器已启动');
  }

  /**
   * 停止调度器
   */
  async stop() {
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
  async create(options = {}) {
    const id = uuidv4();
    
    const task = {
      id,
      name: options.name || `任务-${id.slice(0, 8)}`,
      description: options.description,
      userId: options.userId,
      scheduleType: options.scheduleType, // cron/interval/once
      cronExpr: options.cronExpr,
      timezone: options.timezone || this.config.defaultTimezone,
      intervalSeconds: options.intervalSeconds,
      runOnceAt: options.runOnceAt,
      taskType: options.taskType, // skill/agent/message/webhook/custom
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
  _calculateNextRun(task) {
    const now = Date.now();
    
    switch (task.scheduleType) {
      case 'once':
        return task.runOnceAt;
      
      case 'interval':
        return now + (task.intervalSeconds * 1000);
      
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
  async _scheduleTask(task) {
    if (this.jobs.has(task.id)) {
      this.jobs.get(task.id).stop();
    }

    let job;
    
    switch (task.scheduleType) {
      case 'cron':
        job = cron.schedule(task.cronExpr, () => this._executeTask(task), {
          timezone: task.timezone
        });
        break;
      
      case 'interval':
        job = {
          intervalId: setInterval(() => this._executeTask(task), task.intervalSeconds * 1000),
          stop: () => clearInterval(this.intervalId)
        };
        break;
      
      case 'once':
        const delay = task.runOnceAt - Date.now();
        if (delay > 0) {
          job = {
            timeoutId: setTimeout(() => this._executeTask(task), delay),
            stop: () => clearTimeout(this.timeoutId)
          };
        }
        break;
    }

    if (job) {
      this.jobs.set(task.id, job);
    }
  }

  /**
   * 执行任务
   */
  async _executeTask(task) {
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

      // 更新运行记录
      this.db.prepare(`
        UPDATE scheduled_task_runs SET 
          status = 'failed', completed_at = ?, duration_ms = ?, error_message = ?
        WHERE id = ?
      `).run(Date.now(), duration, error.message, runId);

      // 更新任务错误计数
      this.db.prepare(`
        UPDATE scheduled_tasks SET 
          error_count = error_count + 1, last_error = ?
        WHERE id = ?
      `).run(error.message, task.id);

      // 重试
      if (task.retryOnFailure) {
        await this._retryTask(task, runId);
      }

      // 失败通知
      if (task.notifyOnFailure) {
        await this._sendNotification(task, 'failed', { error: error.message });
      }

    } finally {
      this._releaseLock(task.id);
    }
  }

  /**
   * 获取锁
   */
  _acquireLock(taskId) {
    try {
      this.db.prepare(`
        INSERT INTO scheduled_task_locks (id, task_id, locked_at, locked_by, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), taskId, Date.now(), 'instance-1', Date.now() + 300000);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 释放锁
   */
  _releaseLock(taskId) {
    this.db.prepare('DELETE FROM scheduled_task_locks WHERE task_id = ?').run(taskId);
  }

  /**
   * 执行技能
   */
  async _executeSkill(task) {
    // 实际实现需要调用 SkillsManager
    console.log(`[Scheduler] 执行技能: ${task.taskConfig.skillId}`);
    return { skillId: task.taskConfig.skillId, executed: true };
  }

  /**
   * 执行 Agent
   */
  async _executeAgent(task) {
    console.log(`[Scheduler] 执行 Agent: ${task.taskConfig.agentId}`);
    return { agentId: task.taskConfig.agentId, executed: true };
  }

  /**
   * 发送消息
   */
  async _sendMessage(task) {
    console.log(`[Scheduler] 发送消息到: ${task.taskConfig.channel}`);
    return { channel: task.taskConfig.channel, sent: true };
  }

  /**
   * 调用 Webhook
   */
  async _callWebhook(task) {
    const response = await fetch(task.taskConfig.url, {
      method: task.taskConfig.method || 'POST',
      headers: task.taskConfig.headers || {},
      body: JSON.stringify(task.taskConfig.body || {})
    });
    return { status: response.status };
  }

  /**
   * 执行自定义任务
   */
  async _executeCustom(task) {
    console.log(`[Scheduler] 执行自定义任务: ${task.name}`);
    return { custom: true };
  }

  /**
   * 重试任务
   */
  async _retryTask(task, originalRunId) {
    const run = this.db.prepare('SELECT * FROM scheduled_task_runs WHERE id = ?').get(originalRunId);
    
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
  async _sendNotification(task, status, result) {
    console.log(`[Scheduler] 发送通知: ${task.name} - ${status}`);
    // 实际实现需要调用通知服务
  }

  /**
   * 启用任务
   */
  async enable(taskId) {
    const task = this.db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(taskId);
    if (!task) throw new Error('任务不存在');

    this.db.prepare('UPDATE scheduled_tasks SET enabled = 1 WHERE id = ?').run(taskId);
    
    if (!task.use_external) {
      await this._scheduleTask(task);
    }
  }

  /**
   * 禁用任务
   */
  async disable(taskId) {
    this.db.prepare('UPDATE scheduled_tasks SET enabled = 0 WHERE id = ?').run(taskId);
    
    if (this.jobs.has(taskId)) {
      this.jobs.get(taskId).stop();
      this.jobs.delete(taskId);
    }
  }

  /**
   * 删除任务
   */
  async delete(taskId) {
    await this.disable(taskId);
    this.db.prepare('DELETE FROM scheduled_task_runs WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(taskId);
  }

  /**
   * 获取用户的定时任务
   */
  async listByUser(userId) {
    return this.db.prepare('SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
  }

  /**
   * 获取运行历史
   */
  async getRunHistory(taskId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM scheduled_task_runs 
      WHERE task_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(taskId, limit);
  }
}

module.exports = { Scheduler };