/**
 * 任务管理器 - 单次任务管理
 * 支持 @好友协作，上下文记录
 */

const { v4: uuidv4 } = require('uuid');

class TaskManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = config;
  }

  async init() {
    console.log('[TaskManager] 初始化完成');
  }

  /**
   * 创建任务
   */
  async create(options = {}) {
    const id = uuidv4();
    const task = {
      id,
      name: options.name || `任务-${id.slice(0, 8)}`,
      description: options.description,
      status: 'pending',
      priority: options.priority || 'normal',
      isPinned: false,
      creatorId: options.creatorId,
      creatorType: options.creatorType || 'human',
      workspaceId: options.workspaceId,
      workspacePath: options.workspacePath,
      context: options.context || {},
      tags: options.tags || [],
      dueAt: options.dueAt,
      createdAt: Date.now()
    };

    this.db.prepare(`
      INSERT INTO tasks (
        id, name, description, status, priority, is_pinned,
        creator_id, creator_type, workspace_id, workspace_path,
        context, tags, due_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.name, task.description, task.status, task.priority,
      task.isPinned ? 1 : 0, task.creatorId, task.creatorType,
      task.workspaceId, task.workspacePath,
      JSON.stringify(task.context), JSON.stringify(task.tags),
      task.dueAt, task.createdAt
    );

    // 如果有执行者，添加到 assignees 表
    if (options.assignees && options.assignees.length > 0) {
      for (const assignee of options.assignees) {
        await this.addAssignee(task.id, assignee);
      }
    }

    return task;
  }

  /**
   * 获取任务
   */
  async get(taskId) {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!row) return null;

    return {
      ...row,
      context: JSON.parse(row.context || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      result: row.result ? JSON.parse(row.result) : null
    };
  }

  /**
   * 更新任务
   */
  async update(taskId, updates) {
    const allowedFields = ['name', 'description', 'status', 'priority', 'is_pinned', 
                          'workspace_id', 'workspace_path', 'context', 'tags', 'result',
                          'started_at', 'completed_at', 'due_at'];
    
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClause.push(`${dbKey} = ?`);
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (setClause.length === 0) return null;

    values.push(taskId);
    
    this.db.prepare(`UPDATE tasks SET ${setClause.join(', ')} WHERE id = ?`).run(...values);
    
    return this.get(taskId);
  }

  /**
   * 删除任务
   */
  async delete(taskId) {
    // 先删除关联数据
    this.db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM task_context_items WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
    
    // 删除任务
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  }

  /**
   * 置顶/取消置顶
   */
  async togglePin(taskId) {
    const task = await this.get(taskId);
    if (!task) throw new Error('任务不存在');

    return this.update(taskId, { isPinned: !task.is_pinned });
  }

  /**
   * 添加执行者 (@好友)
   */
  async addAssignee(taskId, assignee) {
    const id = uuidv4();
    
    this.db.prepare(`
      INSERT INTO task_assignees (
        id, task_id, user_id, user_type, user_name, role, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, taskId, assignee.userId, assignee.userType || 'human',
      assignee.userName, assignee.role || 'collaborator',
      'pending', Date.now()
    );

    return this.getAssignees(taskId);
  }

  /**
   * 移除执行者
   */
  async removeAssignee(taskId, userId) {
    this.db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?')
      .run(taskId, userId);
  }

  /**
   * 获取任务执行者
   */
  async getAssignees(taskId) {
    return this.db.prepare('SELECT * FROM task_assignees WHERE task_id = ?').all(taskId);
  }

  /**
   * 更新执行者状态
   */
  async updateAssigneeStatus(taskId, userId, status) {
    this.db.prepare(`
      UPDATE task_assignees SET status = ?, responded_at = ? 
      WHERE task_id = ? AND user_id = ?
    `).run(status, Date.now(), taskId, userId);
  }

  /**
   * 添加上下文条目
   */
  async addContextItem(taskId, item) {
    const id = uuidv4();
    
    this.db.prepare(`
      INSERT INTO task_context_items (
        id, task_id, type, title, content, file_path, url, metadata, importance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, taskId, item.type, item.title, item.content,
      item.filePath, item.url, JSON.stringify(item.metadata || {}),
      item.importance || 0, Date.now()
    );

    return id;
  }

  /**
   * 获取上下文
   */
  async getContext(taskId) {
    return this.db.prepare('SELECT * FROM task_context_items WHERE task_id = ? ORDER BY importance DESC')
      .all(taskId);
  }

  /**
   * 记录日志
   */
  log(taskId, level, message, metadata = {}) {
    this.db.prepare(`
      INSERT INTO task_logs (id, task_id, level, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), taskId, level, message, JSON.stringify(metadata), Date.now());
  }

  /**
   * 开始执行
   */
  async start(taskId) {
    return this.update(taskId, {
      status: 'running',
      startedAt: Date.now()
    });
  }

  /**
   * 完成任务
   */
  async complete(taskId, result = {}) {
    const task = await this.get(taskId);
    const duration = task.started_at ? Date.now() - task.started_at : 0;

    return this.update(taskId, {
      status: 'completed',
      completedAt: Date.now(),
      result,
      durationMs: duration
    });
  }

  /**
   * 失败任务
   */
  async fail(taskId, error) {
    return this.update(taskId, {
      status: 'failed',
      completedAt: Date.now()
    });
  }

  /**
   * 获取用户的任务列表
   */
  async listByUser(userId, filters = {}) {
    let query = `
      SELECT t.* FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      WHERE (t.creator_id = ? OR ta.user_id = ?)
    `;
    const params = [userId, userId];

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    query += ' GROUP BY t.id ORDER BY t.is_pinned DESC, t.created_at DESC';

    return this.db.prepare(query).all(...params);
  }

  /**
   * 获取置顶任务
   */
  async listPinned(userId) {
    return this.db.prepare(`
      SELECT * FROM tasks 
      WHERE creator_id = ? AND is_pinned = 1
      ORDER BY created_at DESC
    `).all(userId);
  }

  /**
   * 添加评论
   */
  async addComment(taskId, userId, userName, content, parentId = null) {
    const id = uuidv4();
    
    this.db.prepare(`
      INSERT INTO task_comments (id, task_id, user_id, user_name, content, parent_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, userId, userName, content, parentId, Date.now());

    return id;
  }

  /**
   * 获取评论
   */
  async getComments(taskId) {
    return this.db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at')
      .all(taskId);
  }
}

module.exports = { TaskManager };