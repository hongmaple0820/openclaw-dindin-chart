const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const dbPath = path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
const db = new Database(dbPath);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

// ==================== 认证中间件 ====================

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: '未授权：缺少用户ID' });
  }
  
  req.userId = userId;
  next();
}

// ==================== 任务 CRUD ====================

/**
 * 获取任务列表
 * GET /api/tasks
 */
function listTasks(req, res) {
  try {
    const { status, priority, creator_id, pinned, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    
    if (creator_id) {
      sql += ' AND creator_id = ?';
      params.push(creator_id);
    }
    
    if (pinned === 'true' || pinned === '1') {
      sql += ' AND is_pinned = 1';
    }
    
    sql += ' ORDER BY is_pinned DESC, priority DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const tasks = db.prepare(sql).all(...params);
    
    // 解析 JSON 字段
    const parsedTasks = tasks.map(t => ({
      ...t,
      context: t.context ? JSON.parse(t.context) : null,
      result: t.result ? JSON.parse(t.result) : null,
      tags: t.tags ? JSON.parse(t.tags) : []
    }));
    
    res.json({ success: true, count: parsedTasks.length, tasks: parsedTasks });
  } catch (error) {
    console.error('[Tasks] 获取任务列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 获取任务详情
 * GET /api/tasks/:id
 */
function getTask(req, res) {
  try {
    const { id } = req.params;
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 解析 JSON 字段
    task.context = task.context ? JSON.parse(task.context) : null;
    task.result = task.result ? JSON.parse(task.result) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    // 获取执行者数量
    const assigneeCount = db.prepare('SELECT COUNT(*) as count FROM task_assignees WHERE task_id = ?').get(id);
    
    // 获取上下文条目数量
    const contextCount = db.prepare('SELECT COUNT(*) as count FROM task_context_items WHERE task_id = ?').get(id);
    
    // 获取评论数量
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?').get(id);
    
    res.json({ 
      success: true, 
      task,
      stats: {
        assignees: assigneeCount.count,
        contextItems: contextCount.count,
        comments: commentCount.count
      }
    });
  } catch (error) {
    console.error('[Tasks] 获取任务详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 创建任务
 * POST /api/tasks
 */
function createTask(req, res) {
  try {
    const { 
      name, 
      description, 
      priority = 'normal',
      creator_type = 'human',
      workspace_id,
      workspace_path,
      context,
      tags,
      due_at
    } = req.body;
    const userId = req.userId;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'name 为必填项' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO tasks (
        id, name, description, status, priority, is_pinned,
        creator_id, creator_type, workspace_id, workspace_path,
        context, tags, created_at, due_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description || null, 'pending', priority, 0,
      userId, creator_type, workspace_id || null, workspace_path || null,
      context ? JSON.stringify(context) : null,
      tags ? JSON.stringify(tags) : null,
      now, due_at || null
    );
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('[Tasks] 创建任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 更新任务
 * PUT /api/tasks/:id
 */
function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      status, 
      priority, 
      workspace_id,
      workspace_path,
      context,
      tags,
      due_at
    } = req.body;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (workspace_id !== undefined) { updates.push('workspace_id = ?'); params.push(workspace_id); }
    if (workspace_path !== undefined) { updates.push('workspace_path = ?'); params.push(workspace_path); }
    if (context !== undefined) { updates.push('context = ?'); params.push(JSON.stringify(context)); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (due_at !== undefined) { updates.push('due_at = ?'); params.push(due_at); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }
    
    params.push(id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('[Tasks] 更新任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 删除任务
 * DELETE /api/tasks/:id
 */
function deleteTask(req, res) {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 删除关联数据
    db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM task_context_items WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(id);
    
    // 删除任务
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('[Tasks] 删除任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== 任务操作 ====================

/**
 * 开始任务
 * POST /api/tasks/:id/start
 */
function startTask(req, res) {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    if (existing.status !== 'pending') {
      return res.status(400).json({ success: false, message: `任务状态为 ${existing.status}，无法启动` });
    }
    
    const now = Date.now();
    db.prepare('UPDATE tasks SET status = ?, started_at = ? WHERE id = ?').run('running', now, id);
    
    // 记录日志
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO task_logs (id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(logId, id, 'info', '任务已启动', now);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task, message: '任务已启动' });
  } catch (error) {
    console.error('[Tasks] 启动任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 完成任务
 * POST /api/tasks/:id/complete
 */
function completeTask(req, res) {
  try {
    const { id } = req.params;
    const { result, result_summary } = req.body;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const now = Date.now();
    const durationMs = existing.started_at ? now - existing.started_at : null;
    
    db.prepare(`
      UPDATE tasks 
      SET status = ?, completed_at = ?, duration_ms = ?, result = ?, result_summary = ?
      WHERE id = ?
    `).run(
      'completed', 
      now, 
      durationMs, 
      result ? JSON.stringify(result) : null,
      result_summary || null,
      id
    );
    
    // 记录日志
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO task_logs (id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(logId, id, 'info', '任务已完成', now);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.result = task.result ? JSON.parse(task.result) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task, message: '任务已完成' });
  } catch (error) {
    console.error('[Tasks] 完成任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 标记任务失败
 * POST /api/tasks/:id/fail
 */
function failTask(req, res) {
  try {
    const { id } = req.params;
    const { error_message, error_details } = req.body;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const now = Date.now();
    const newRetryCount = (existing.retry_count || 0) + 1;
    
    db.prepare(`
      UPDATE tasks 
      SET status = ?, retry_count = ?, result_summary = ?
      WHERE id = ?
    `).run('failed', newRetryCount, error_message || null, id);
    
    // 记录日志
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO task_logs (id, task_id, level, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId, id, 'error', error_message || '任务失败', error_details ? JSON.stringify(error_details) : null, now);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task, retryCount: newRetryCount, message: '任务已标记为失败' });
  } catch (error) {
    console.error('[Tasks] 标记任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 切换置顶状态
 * POST /api/tasks/:id/pin
 */
function togglePin(req, res) {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const newPinned = existing.is_pinned ? 0 : 1;
    db.prepare('UPDATE tasks SET is_pinned = ? WHERE id = ?').run(newPinned, id);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    task.context = task.context ? JSON.parse(task.context) : null;
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ 
      success: true, 
      task, 
      isPinned: !!newPinned,
      message: newPinned ? '任务已置顶' : '任务已取消置顶'
    });
  } catch (error) {
    console.error('[Tasks] 切换置顶状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== 执行者管理 ====================

/**
 * 获取任务执行者列表
 * GET /api/tasks/:id/assignees
 */
function getAssignees(req, res) {
  try {
    const { id } = req.params;
    
    const assignees = db.prepare(`
      SELECT * FROM task_assignees 
      WHERE task_id = ? 
      ORDER BY created_at ASC
    `).all(id);
    
    res.json({ success: true, count: assignees.length, assignees });
  } catch (error) {
    console.error('[Tasks] 获取执行者列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 添加执行者
 * POST /api/tasks/:id/assignees
 */
function addAssignee(req, res) {
  try {
    const { id } = req.params;
    const { user_id, user_type = 'human', user_name, role = 'collaborator' } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id 为必填项' });
    }
    
    // 检查任务是否存在
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 检查是否已添加
    const existing = db.prepare('SELECT * FROM task_assignees WHERE task_id = ? AND user_id = ?').get(id, user_id);
    if (existing) {
      return res.status(409).json({ success: false, message: '该用户已是任务执行者' });
    }
    
    const assigneeId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO task_assignees (id, task_id, user_id, user_type, user_name, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(assigneeId, id, user_id, user_type, user_name || null, role, 'pending', now);
    
    const assignee = db.prepare('SELECT * FROM task_assignees WHERE id = ?').get(assigneeId);
    
    res.json({ success: true, assignee });
  } catch (error) {
    console.error('[Tasks] 添加执行者失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 移除执行者
 * DELETE /api/tasks/:id/assignees/:userId
 */
function removeAssignee(req, res) {
  try {
    const { id, userId } = req.params;
    
    const existing = db.prepare('SELECT * FROM task_assignees WHERE task_id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '该用户不是任务执行者' });
    }
    
    db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?').run(id, userId);
    
    res.json({ success: true, message: '执行者已移除' });
  } catch (error) {
    console.error('[Tasks] 移除执行者失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== 上下文管理 ====================

/**
 * 获取任务上下文
 * GET /api/tasks/:id/context
 */
function getContext(req, res) {
  try {
    const { id } = req.params;
    const { type, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM task_context_items WHERE task_id = ?';
    const params = [id];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY importance DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const items = db.prepare(sql).all(...params);
    
    // 解析 JSON 字段
    const parsedItems = items.map(item => ({
      ...item,
      content: item.content ? JSON.parse(item.content) : null,
      metadata: item.metadata ? JSON.parse(item.metadata) : null
    }));
    
    res.json({ success: true, count: parsedItems.length, items: parsedItems });
  } catch (error) {
    console.error('[Tasks] 获取上下文失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 添加上下文条目
 * POST /api/tasks/:id/context
 */
function addContextItem(req, res) {
  try {
    const { id } = req.params;
    const { 
      type, 
      title, 
      content, 
      file_path, 
      url, 
      metadata, 
      importance = 0 
    } = req.body;
    
    if (!type) {
      return res.status(400).json({ success: false, message: 'type 为必填项' });
    }
    
    // 验证 type
    const validTypes = ['file', 'conversation', 'config', 'note', 'url'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: `type 必须是: ${validTypes.join(', ')}` 
      });
    }
    
    // 检查任务是否存在
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const itemId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO task_context_items (
        id, task_id, type, title, content, file_path, url, metadata, importance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId, id, type, title || null, 
      content ? JSON.stringify(content) : null,
      file_path || null, url || null,
      metadata ? JSON.stringify(metadata) : null,
      importance, now
    );
    
    // 更新任务的 context_tokens（简单估算）
    const tokenEstimate = content ? JSON.stringify(content).length / 4 : 0;
    db.prepare('UPDATE tasks SET context_tokens = context_tokens + ? WHERE id = ?').run(tokenEstimate, id);
    
    const item = db.prepare('SELECT * FROM task_context_items WHERE id = ?').get(itemId);
    item.content = item.content ? JSON.parse(item.content) : null;
    item.metadata = item.metadata ? JSON.parse(item.metadata) : null;
    
    res.json({ success: true, item });
  } catch (error) {
    console.error('[Tasks] 添加上下文条目失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== 评论管理 ====================

/**
 * 获取任务评论
 * GET /api/tasks/:id/comments
 */
function getComments(req, res) {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const comments = db.prepare(`
      SELECT * FROM task_comments 
      WHERE task_id = ? 
      ORDER BY created_at ASC 
      LIMIT ? OFFSET ?
    `).all(id, parseInt(limit), parseInt(offset));
    
    res.json({ success: true, count: comments.length, comments });
  } catch (error) {
    console.error('[Tasks] 获取评论失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 添加评论
 * POST /api/tasks/:id/comments
 */
function addComment(req, res) {
  try {
    const { id } = req.params;
    const { content, user_name, parent_id } = req.body;
    const userId = req.userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'content 为必填项' });
    }
    
    // 检查任务是否存在
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 如果是回复，检查父评论是否存在
    if (parent_id) {
      const parent = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(parent_id);
      if (!parent) {
        return res.status(404).json({ success: false, message: '父评论不存在' });
      }
    }
    
    const commentId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO task_comments (id, task_id, user_id, user_name, content, parent_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(commentId, id, userId, user_name || null, content, parent_id || null, now);
    
    const comment = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(commentId);
    
    res.json({ success: true, comment });
  } catch (error) {
    console.error('[Tasks] 添加评论失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== 路由注册 ====================

// 任务 CRUD
router.get('/', listTasks);
router.get('/:id', getTask);
router.post('/', authMiddleware, createTask);
router.put('/:id', authMiddleware, updateTask);
router.delete('/:id', authMiddleware, deleteTask);

// 任务操作
router.post('/:id/start', authMiddleware, startTask);
router.post('/:id/complete', authMiddleware, completeTask);
router.post('/:id/fail', authMiddleware, failTask);
router.post('/:id/pin', authMiddleware, togglePin);

// 执行者
router.get('/:id/assignees', getAssignees);
router.post('/:id/assignees', authMiddleware, addAssignee);
router.delete('/:id/assignees/:userId', authMiddleware, removeAssignee);

// 上下文
router.get('/:id/context', getContext);
router.post('/:id/context', authMiddleware, addContextItem);

// 评论
router.get('/:id/comments', getComments);
router.post('/:id/comments', authMiddleware, addComment);

module.exports = router;
