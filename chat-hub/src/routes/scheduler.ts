/**
 * 定时任务系统路由
 *
 * API 端点：
 * - GET    /api/scheduler/tasks           - 获取定时任务列表
 * - GET    /api/scheduler/tasks/:id       - 获取单个任务
 * - POST   /api/scheduler/tasks           - 创建定时任务
 * - PUT    /api/scheduler/tasks/:id       - 更新任务
 * - DELETE /api/scheduler/tasks/:id       - 删除任务
 *
 * - POST   /api/scheduler/tasks/:id/enable  - 启用任务
 * - POST   /api/scheduler/tasks/:id/disable - 禁用任务
 * - POST   /api/scheduler/tasks/:id/run     - 立即执行
 *
 * - GET    /api/scheduler/tasks/:id/history - 获取执行历史
 * - GET    /api/scheduler/tasks/:id/logs    - 获取日志
 *
 * - GET    /api/scheduler/status           - 获取调度器状态
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const cron = require('node-cron');

// 数据库路径
const dbPath = path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
const db = new Database(dbPath);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

// Scheduler 实例（需要从外部注入或创建）
let schedulerInstance = null;

/**
 * 设置 Scheduler 实例
 * @param {Scheduler} scheduler
 */
function setScheduler(scheduler) {
  schedulerInstance = scheduler;
}

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: '未授权' });
  }
  req.userId = userId;
  next();
}

/**
 * Cron 表达式验证
 */
function validateCronExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Cron 表达式不能为空' };
  }

  const parts = expression.trim().split(/\s+/);
  
  // 标准 cron 有 5 个部分，扩展 cron 有 6 个部分（秒）
  if (parts.length < 5 || parts.length > 6) {
    return { valid: false, error: 'Cron 表达式必须包含 5 或 6 个字段' };
  }

  // 使用 node-cron 验证
  if (!cron.validate(expression)) {
    return { valid: false, error: '无效的 Cron 表达式' };
  }

  // 解析表达式含义
  const description = describeCronExpression(expression);

  return { valid: true, description };
}

/**
 * 生成 Cron 表达式描述
 */
function describeCronExpression(expression) {
  const parts = expression.trim().split(/\s+/);
  const hasSeconds = parts.length === 6;
  
  let minute, hour, dayOfMonth, month, dayOfWeek;
  
  if (hasSeconds) {
    [, minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  } else {
    [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  }

  const descriptions = [];

  // 分钟
  if (minute === '*') {
    descriptions.push('每分钟');
  } else if (minute.includes('/')) {
    descriptions.push(`每 ${minute.split('/')[1]} 分钟`);
  } else if (minute.includes(',')) {
    descriptions.push(`在第 ${minute} 分钟`);
  }

  // 小时
  if (hour === '*') {
    if (minute !== '*') descriptions.push('每小时');
  } else if (hour.includes('/')) {
    descriptions.push(`每 ${hour.split('/')[1]} 小时`);
  } else if (hour.includes(',')) {
    descriptions.push(`在 ${hour} 点`);
  }

  // 月份日期
  if (dayOfMonth !== '*') {
    descriptions.push(`每月 ${dayOfMonth} 号`);
  }

  // 星期
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  if (dayOfWeek !== '*') {
    if (dayOfWeek.includes(',')) {
      const days = dayOfWeek.split(',').map(d => weekDays[parseInt(d)] || d).join('、');
      descriptions.push(`每${days}`);
    } else {
      descriptions.push(`每${weekDays[parseInt(dayOfWeek)] || dayOfWeek}`);
    }
  }

  return descriptions.join('，') || '按指定时间执行';
}

// ==================== 调度器状态 API ====================

/**
 * 获取调度器状态
 * GET /api/scheduler/status
 */
router.get('/status', authMiddleware, (req, res) => {
  try {
    // 获取统计信息
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_count,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled_count,
        SUM(run_count) as total_runs,
        SUM(error_count) as total_errors
      FROM scheduled_tasks
    `).get();

    // 获取最近运行的任务
    const recentRuns = db.prepare(`
      SELECT r.*, t.name as task_name
      FROM scheduled_task_runs r
      JOIN scheduled_tasks t ON r.task_id = t.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `).all();

    // 获取正在运行的任务
    const runningTasks = db.prepare(`
      SELECT r.*, t.name as task_name
      FROM scheduled_task_runs r
      JOIN scheduled_tasks t ON r.task_id = t.id
      WHERE r.status = 'running'
      ORDER BY r.started_at DESC
    `).all();

    res.json({
      success: true,
      status: {
        running: schedulerInstance?.running || false,
        jobsCount: schedulerInstance?.jobs?.size || 0,
        config: schedulerInstance?.config || {}
      },
      stats,
      recentRuns,
      runningTasks
    });
  } catch (error) {
    console.error('[Scheduler] 获取状态失败:', error);
    res.status(500).json({ success: false, message: '获取状态失败', error: (error as Error).message });
  }
});

// ==================== 任务 CRUD API ====================

/**
 * 获取定时任务列表
 * GET /api/scheduler/tasks?userId=xxx&enabled=1&taskType=xxx
 */
router.get('/tasks', authMiddleware, (req, res) => {
  try {
    const { enabled, taskType, scheduleType, limit = 50, offset = 0 } = req.query;
    const userId = req.userId;

    let sql = 'SELECT * FROM scheduled_tasks WHERE user_id = ?';
    const params = [userId];

    if (enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(parseInt(enabled));
    }

    if (taskType) {
      sql += ' AND task_type = ?';
      params.push(taskType);
    }

    if (scheduleType) {
      sql += ' AND schedule_type = ?';
      params.push(scheduleType);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const tasks = db.prepare(sql).all(...params);

    // 解析 JSON 字段
    const parsedTasks = tasks.map(task => ({
      ...task,
      task_config: task.task_config ? JSON.parse(task.task_config) : {},
      external_config: task.external_config ? JSON.parse(task.external_config) : {},
      input_params: task.input_params ? JSON.parse(task.input_params) : {},
      notification_channels: task.notification_channels ? JSON.parse(task.notification_channels) : []
    }));

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM scheduled_tasks WHERE user_id = ?';
    const countParams = [userId];
    
    if (enabled !== undefined) {
      countSql += ' AND enabled = ?';
      countParams.push(parseInt(enabled));
    }
    
    const total = db.prepare(countSql).get(...countParams);

    res.json({
      success: true,
      tasks: parsedTasks,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[Scheduler] 获取任务列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 获取单个任务
 * GET /api/scheduler/tasks/:id
 */
router.get('/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 解析 JSON 字段
    const parsedTask = {
      ...task,
      task_config: task.task_config ? JSON.parse(task.task_config) : {},
      external_config: task.external_config ? JSON.parse(task.external_config) : {},
      input_params: task.input_params ? JSON.parse(task.input_params) : {},
      notification_channels: task.notification_channels ? JSON.parse(task.notification_channels) : []
    };

    res.json({ success: true, task: parsedTask });
  } catch (error) {
    console.error('[Scheduler] 获取任务失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 创建定时任务
 * POST /api/scheduler/tasks
 */
router.post('/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      name,
      description,
      scheduleType,
      cronExpr,
      timezone = 'Asia/Shanghai',
      intervalSeconds,
      runOnceAt,
      taskType,
      taskConfig = {},
      useExternal = false,
      externalType,
      externalConfig = {},
      inputParams = {},
      enabled = true,
      retryOnFailure = true,
      maxRetries = 3,
      retryDelaySeconds = 60,
      notifyOnSuccess = false,
      notifyOnFailure = true,
      notificationChannels = []
    } = req.body;

    // 验证必填字段
    if (!name || !scheduleType || !taskType) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: name, scheduleType, taskType'
      });
    }

    // 验证调度类型
    const validScheduleTypes = ['cron', 'interval', 'once'];
    if (!validScheduleTypes.includes(scheduleType)) {
      return res.status(400).json({
        success: false,
        message: `无效的调度类型: ${scheduleType}，有效值: ${validScheduleTypes.join(', ')}`
      });
    }

    // 验证任务类型
    const validTaskTypes = ['skill', 'agent', 'message', 'webhook', 'custom'];
    if (!validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        success: false,
        message: `无效的任务类型: ${taskType}，有效值: ${validTaskTypes.join(', ')}`
      });
    }

    // Cron 表达式验证
    if (scheduleType === 'cron') {
      if (!cronExpr) {
        return res.status(400).json({
          success: false,
          message: 'Cron 调度类型必须提供 cronExpr 字段'
        });
      }

      const validation = validateCronExpression(cronExpr);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }

    // Interval 验证
    if (scheduleType === 'interval' && (!intervalSeconds || intervalSeconds < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Interval 调度类型必须提供有效的 intervalSeconds (>= 1)'
      });
    }

    // Once 验证
    if (scheduleType === 'once' && (!runOnceAt || runOnceAt < Date.now())) {
      return res.status(400).json({
        success: false,
        message: 'Once 调度类型必须提供有效的 runOnceAt (未来时间)'
      });
    }

    // 外部调度器配置验证
    if (useExternal) {
      const validExternalTypes = ['kubernetes', 'systemd', 'cron', 'aws-eventbridge', 'github-actions'];
      if (externalType && !validExternalTypes.includes(externalType)) {
        return res.status(400).json({
          success: false,
          message: `无效的外部调度器类型: ${externalType}，有效值: ${validExternalTypes.join(', ')}`
        });
      }
    }

    // 使用 Scheduler 实例创建任务
    if (schedulerInstance) {
      const task = await schedulerInstance.create({
        name,
        description,
        userId,
        scheduleType,
        cronExpr,
        timezone,
        intervalSeconds,
        runOnceAt,
        taskType,
        taskConfig,
        useExternal,
        externalType,
        externalConfig,
        inputParams,
        enabled,
        retryOnFailure,
        maxRetries,
        retryDelaySeconds,
        notifyOnSuccess,
        notifyOnFailure,
        notificationChannels
      });

      res.json({ success: true, task });
    } else {
      // 没有 Scheduler 实例时直接插入数据库
      const id = uuidv4();
      const now = Date.now();

      // 计算下次执行时间
      let nextRunAt = null;
      if (scheduleType === 'once') {
        nextRunAt = runOnceAt;
      } else if (scheduleType === 'interval') {
        nextRunAt = now + (intervalSeconds * 1000);
      } else if (scheduleType === 'cron') {
        nextRunAt = now + 60000; // 简化：1分钟后
      }

      db.prepare(`
        INSERT INTO scheduled_tasks (
          id, name, description, user_id, schedule_type, cron_expr, timezone,
          interval_seconds, run_once_at, next_run_at, task_type, task_config,
          use_external, external_type, external_config, input_params,
          enabled, retry_on_failure, max_retries, retry_delay_seconds,
          notify_on_success, notify_on_failure, notification_channels, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, name, description, userId, scheduleType,
        cronExpr, timezone, intervalSeconds, runOnceAt,
        nextRunAt, taskType, JSON.stringify(taskConfig),
        useExternal ? 1 : 0, externalType,
        JSON.stringify(externalConfig),
        JSON.stringify(inputParams),
        enabled ? 1 : 0, retryOnFailure ? 1 : 0,
        maxRetries, retryDelaySeconds,
        notifyOnSuccess ? 1 : 0, notifyOnFailure ? 1 : 0,
        JSON.stringify(notificationChannels), now
      );

      const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);

      res.json({
        success: true,
        task: {
          ...task,
          task_config: JSON.parse(task.task_config || '{}'),
          external_config: JSON.parse(task.external_config || '{}'),
          input_params: JSON.parse(task.input_params || '{}'),
          notification_channels: JSON.parse(task.notification_channels || '[]')
        }
      });
    }
  } catch (error) {
    console.error('[Scheduler] 创建任务失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: (error as Error).message });
  }
});

/**
 * 更新任务
 * PUT /api/scheduler/tasks/:id
 */
router.put('/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 检查任务是否存在
    const existingTask = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!existingTask) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    const {
      name,
      description,
      scheduleType,
      cronExpr,
      timezone,
      intervalSeconds,
      runOnceAt,
      taskType,
      taskConfig,
      useExternal,
      externalType,
      externalConfig,
      inputParams,
      retryOnFailure,
      maxRetries,
      retryDelaySeconds,
      notifyOnSuccess,
      notifyOnFailure,
      notificationChannels
    } = req.body;

    // Cron 表达式验证（如果更新了）
    if (scheduleType === 'cron' && cronExpr) {
      const validation = validateCronExpression(cronExpr);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }

    // 构建更新语句
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (scheduleType !== undefined) {
      updates.push('schedule_type = ?');
      params.push(scheduleType);
    }
    if (cronExpr !== undefined) {
      updates.push('cron_expr = ?');
      params.push(cronExpr);
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      params.push(timezone);
    }
    if (intervalSeconds !== undefined) {
      updates.push('interval_seconds = ?');
      params.push(intervalSeconds);
    }
    if (runOnceAt !== undefined) {
      updates.push('run_once_at = ?');
      params.push(runOnceAt);
    }
    if (taskType !== undefined) {
      updates.push('task_type = ?');
      params.push(taskType);
    }
    if (taskConfig !== undefined) {
      updates.push('task_config = ?');
      params.push(JSON.stringify(taskConfig));
    }
    if (useExternal !== undefined) {
      updates.push('use_external = ?');
      params.push(useExternal ? 1 : 0);
    }
    if (externalType !== undefined) {
      updates.push('external_type = ?');
      params.push(externalType);
    }
    if (externalConfig !== undefined) {
      updates.push('external_config = ?');
      params.push(JSON.stringify(externalConfig));
    }
    if (inputParams !== undefined) {
      updates.push('input_params = ?');
      params.push(JSON.stringify(inputParams));
    }
    if (retryOnFailure !== undefined) {
      updates.push('retry_on_failure = ?');
      params.push(retryOnFailure ? 1 : 0);
    }
    if (maxRetries !== undefined) {
      updates.push('max_retries = ?');
      params.push(maxRetries);
    }
    if (retryDelaySeconds !== undefined) {
      updates.push('retry_delay_seconds = ?');
      params.push(retryDelaySeconds);
    }
    if (notifyOnSuccess !== undefined) {
      updates.push('notify_on_success = ?');
      params.push(notifyOnSuccess ? 1 : 0);
    }
    if (notifyOnFailure !== undefined) {
      updates.push('notify_on_failure = ?');
      params.push(notifyOnFailure ? 1 : 0);
    }
    if (notificationChannels !== undefined) {
      updates.push('notification_channels = ?');
      params.push(JSON.stringify(notificationChannels));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updates.push('updated_at = ?');
    params.push(Date.now());

    params.push(id, userId);

    db.prepare(`
      UPDATE scheduled_tasks
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).run(...params);

    // 如果任务已启用且不是外部调度，需要重新调度
    if (schedulerInstance && existingTask.enabled && !existingTask.use_external) {
      const updatedTask = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);
      await schedulerInstance._scheduleTask(updatedTask);
    }

    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);

    res.json({
      success: true,
      task: {
        ...task,
        task_config: JSON.parse(task.task_config || '{}'),
        external_config: JSON.parse(task.external_config || '{}'),
        input_params: JSON.parse(task.input_params || '{}'),
        notification_channels: JSON.parse(task.notification_channels || '[]')
      }
    });
  } catch (error) {
    console.error('[Scheduler] 更新任务失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: (error as Error).message });
  }
});

/**
 * 删除任务
 * DELETE /api/scheduler/tasks/:id
 */
router.delete('/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 检查任务是否存在
    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 使用 Scheduler 实例删除
    if (schedulerInstance) {
      await schedulerInstance.delete(id);
    } else {
      // 没有 Scheduler 实例时直接删除数据库记录
      db.prepare('DELETE FROM scheduled_task_runs WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Scheduler] 删除任务失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: (error as Error).message });
  }
});

// ==================== 任务控制 API ====================

/**
 * 启用任务
 * POST /api/scheduler/tasks/:id/enable
 */
router.post('/tasks/:id/enable', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (task.enabled) {
      return res.status(400).json({ success: false, message: '任务已启用' });
    }

    if (schedulerInstance) {
      await schedulerInstance.enable(id);
    } else {
      db.prepare('UPDATE scheduled_tasks SET enabled = 1 WHERE id = ?').run(id);
    }

    res.json({ success: true, message: '任务已启用' });
  } catch (error) {
    console.error('[Scheduler] 启用任务失败:', error);
    res.status(500).json({ success: false, message: '启用失败', error: (error as Error).message });
  }
});

/**
 * 禁用任务
 * POST /api/scheduler/tasks/:id/disable
 */
router.post('/tasks/:id/disable', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (!task.enabled) {
      return res.status(400).json({ success: false, message: '任务已禁用' });
    }

    if (schedulerInstance) {
      await schedulerInstance.disable(id);
    } else {
      db.prepare('UPDATE scheduled_tasks SET enabled = 0 WHERE id = ?').run(id);
    }

    res.json({ success: true, message: '任务已禁用' });
  } catch (error) {
    console.error('[Scheduler] 禁用任务失败:', error);
    res.status(500).json({ success: false, message: '禁用失败', error: (error as Error).message });
  }
});

/**
 * 立即执行任务
 * POST /api/scheduler/tasks/:id/run
 */
router.post('/tasks/:id/run', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 检查是否有正在运行的实例
    const runningCount = db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_task_runs
      WHERE task_id = ? AND status = 'running'
    `).get(id);

    if (runningCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: '任务正在运行中，请等待完成后再执行'
      });
    }

    // 创建手动执行记录
    const runId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO scheduled_task_runs (
        id, task_id, scheduled_at, started_at, status, is_manual, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, id, now, now, 'running', 1, now);

    if (schedulerInstance) {
      // 使用 Scheduler 实例执行
      const parsedTask = {
        ...task,
        task_config: JSON.parse(task.task_config || '{}'),
        external_config: JSON.parse(task.external_config || '{}'),
        input_params: JSON.parse(task.input_params || '{}'),
        notification_channels: JSON.parse(task.notification_channels || '[]')
      };
      
      await schedulerInstance._executeTask(parsedTask);
    } else {
      // 没有 Scheduler 实例时，模拟执行
      setTimeout(() => {
        const duration = 100;
        db.prepare(`
          UPDATE scheduled_task_runs SET 
            status = 'success', completed_at = ?, duration_ms = ?, result = ?
          WHERE id = ?
        `).run(Date.now(), duration, JSON.stringify({ manual: true, message: '手动执行完成' }), runId);

        db.prepare(`
          UPDATE scheduled_tasks SET 
            last_run_at = ?, run_count = run_count + 1
          WHERE id = ?
        `).run(now, id);
      }, 100);
    }

    res.json({
      success: true,
      message: '任务已开始执行',
      runId
    });
  } catch (error) {
    console.error('[Scheduler] 执行任务失败:', error);
    res.status(500).json({ success: false, message: '执行失败', error: (error as Error).message });
  }
});

// ==================== 执行历史 API ====================

/**
 * 获取执行历史
 * GET /api/scheduler/tasks/:id/history?limit=50&offset=0&status=success
 */
router.get('/tasks/:id/history', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;
    const userId = req.userId;

    // 检查任务是否存在
    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    let sql = 'SELECT * FROM scheduled_task_runs WHERE task_id = ?';
    const params = [id];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const runs = db.prepare(sql).all(...params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM scheduled_task_runs WHERE task_id = ?';
    const countParams = [id];
    
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    
    const total = db.prepare(countSql).get(...countParams);

    // 解析 JSON 字段
    const parsedRuns = runs.map(run => ({
      ...run,
      result: run.result ? JSON.parse(run.result) : null
    }));

    res.json({
      success: true,
      history: parsedRuns,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[Scheduler] 获取执行历史失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

/**
 * 获取任务日志
 * GET /api/scheduler/tasks/:id/logs?runId=xxx&limit=100
 */
router.get('/tasks/:id/logs', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { runId, limit = 100 } = req.query;
    const userId = req.userId;

    // 检查任务是否存在
    const task = db.prepare(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (runId) {
      // 获取特定运行的详细信息
      const run = db.prepare(`
        SELECT * FROM scheduled_task_runs WHERE id = ? AND task_id = ?
      `).get(runId, id);

      if (!run) {
        return res.status(404).json({ success: false, message: '运行记录不存在' });
      }

      res.json({
        success: true,
        run: {
          ...run,
          result: run.result ? JSON.parse(run.result) : null
        },
        task: {
          ...task,
          task_config: JSON.parse(task.task_config || '{}'),
          external_config: JSON.parse(task.external_config || '{}'),
          input_params: JSON.parse(task.input_params || '{}'),
          notification_channels: JSON.parse(task.notification_channels || '[]')
        }
      });
    } else {
      // 获取所有运行的摘要
      const runs = db.prepare(`
        SELECT id, task_id, scheduled_at, started_at, completed_at, status,
               duration_ms, is_retry, retry_count, is_manual
        FROM scheduled_task_runs
        WHERE task_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(id, parseInt(limit));

      // 统计信息
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_runs,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          AVG(duration_ms) as avg_duration_ms,
          MAX(duration_ms) as max_duration_ms,
          MIN(duration_ms) as min_duration_ms
        FROM scheduled_task_runs
        WHERE task_id = ?
      `).get(id);

      res.json({
        success: true,
        runs,
        stats: {
          ...stats,
          avg_duration_ms: stats.avg_duration_ms ? Math.round(stats.avg_duration_ms) : null,
          success_rate: stats.total_runs > 0 
            ? Math.round((stats.success_count / stats.total_runs) * 100) 
            : null
        }
      });
    }
  } catch (error) {
    console.error('[Scheduler] 获取日志失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: (error as Error).message });
  }
});

// ==================== Cron 验证 API ====================

/**
 * 验证 Cron 表达式
 * POST /api/scheduler/validate-cron
 */
router.post('/validate-cron', (req, res) => {
  try {
    const { expression } = req.body;

    if (!expression) {
      return res.status(400).json({ success: false, message: '请提供 Cron 表达式' });
    }

    const validation = validateCronExpression(expression);
    
    if (validation.valid) {
      res.json({
        success: true,
        valid: true,
        description: validation.description,
        expression
      });
    } else {
      res.json({
        success: true,
        valid: false,
        error: validation.error,
        expression
      });
    }
  } catch (error) {
    console.error('[Scheduler] 验证 Cron 失败:', error);
    res.status(500).json({ success: false, message: '验证失败', error: (error as Error).message });
  }
});

// 导出路由和工具函数
module.exports = router;
module.exports.setScheduler = setScheduler;
module.exports.validateCronExpression = validateCronExpression;

// Make this a module
export {};
