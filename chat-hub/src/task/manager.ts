/**
 * 任务管理器 - 单次任务管理
 * 支持 @好友协作，上下文记录
 */

import { v4 as uuidv4 } from 'uuid';
import { Database } from 'better-sqlite3';

interface TaskManagerConfig {
  [key: string]: unknown;
}

interface TaskOptions {
  name?: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
  creatorId?: string;
  creatorType?: 'human' | 'agent';
  workspaceId?: string;
  workspacePath?: string;
  context?: Record<string, unknown>;
  tags?: string[];
  dueAt?: number;
  assignees?: Assignee[];
}

interface Assignee {
  userId: string;
  userType?: 'human' | 'agent';
  userName: string;
  role?: 'owner' | 'collaborator' | 'reviewer';
}

interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  is_pinned: number;
  creator_id?: string;
  creator_type: string;
  workspace_id?: string;
  workspace_path?: string;
  context: Record<string, unknown>;
  tags: string[];
  due_at?: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  result?: unknown;
  duration_ms?: number;
}

interface TaskFilters {
  status?: string;
  priority?: string;
}

interface ContextItem {
  type: string;
  title?: string;
  content?: string;
  filePath?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  importance?: number;
}

class TaskManager {
  private db: Database;
  private config: TaskManagerConfig;

  constructor(db: Database, config: TaskManagerConfig = {}) {
    this.db = db;
    this.config = config;
  }

  async init(): Promise<void> {
    console.log('[TaskManager] 初始化完成');
  }

  /**
   * 创建任务
   */
  async create(options: TaskOptions): Promise<Task> {
    const id = uuidv4();
    const task: Task = {
      id,
      name: options.name || `任务-${id.slice(0, 8)}`,
      description: options.description,
      status: 'pending',
      priority: options.priority || 'normal',
      is_pinned: 0,
      creator_id: options.creatorId,
      creator_type: options.creatorType || 'human',
      workspace_id: options.workspaceId,
      workspace_path: options.workspacePath,
      context: options.context || {},
      tags: options.tags || [],
      due_at: options.dueAt,
      created_at: Date.now()
    };

    this.db.prepare(`
      INSERT INTO tasks (
        id, name, description, status, priority, is_pinned,
        creator_id, creator_type, workspace_id, workspace_path,
        context, tags, due_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.name, task.description, task.status, task.priority,
      task.is_pinned, task.creator_id, task.creator_type,
      task.workspace_id, task.workspace_path,
      JSON.stringify(task.context), JSON.stringify(task.tags),
      task.due_at, task.created_at
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
  async get(taskId: string): Promise<Task | null> {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      ...row,
      context: JSON.parse(row.context as string || '{}'),
      tags: JSON.parse(row.tags as string || '[]'),
      result: row.result ? JSON.parse(row.result as string) : null
    } as Task;
  }

  /**
   * 更新任务
   */
  async update(taskId: string, updates: Record<string, unknown>): Promise<Task | null> {
    const allowedFields = ['name', 'description', 'status', 'priority', 'is_pinned', 
                          'workspace_id', 'workspace_path', 'context', 'tags', 'result',
                          'started_at', 'completed_at', 'due_at'];
    
    const setClause: string[] = [];
    const values: unknown[] = [];

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
  async delete(taskId: string): Promise<void> {
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
  async togglePin(taskId: string): Promise<Task | null> {
    const task = await this.get(taskId);
    if (!task) throw new Error('任务不存在');

    return this.update(taskId, { isPinned: !task.is_pinned });
  }

  /**
   * 添加执行者 (@好友)
   */
  async addAssignee(taskId: string, assignee: Assignee): Promise<unknown[]> {
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
  async removeAssignee(taskId: string, userId: string): Promise<void> {
    this.db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?')
      .run(taskId, userId);
  }

  /**
   * 获取任务执行者
   */
  async getAssignees(taskId: string): Promise<unknown[]> {
    return this.db.prepare('SELECT * FROM task_assignees WHERE task_id = ?').all(taskId);
  }

  /**
   * 更新执行者状态
   */
  async updateAssigneeStatus(taskId: string, userId: string, status: string): Promise<void> {
    this.db.prepare(`
      UPDATE task_assignees SET status = ?, responded_at = ? 
      WHERE task_id = ? AND user_id = ?
    `).run(status, Date.now(), taskId, userId);
  }

  /**
   * 添加上下文条目
   */
  async addContextItem(taskId: string, item: ContextItem): Promise<string> {
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
  async getContext(taskId: string): Promise<unknown[]> {
    return this.db.prepare('SELECT * FROM task_context_items WHERE task_id = ? ORDER BY importance DESC')
      .all(taskId);
  }

  /**
   * 记录日志
   */
  log(taskId: string, level: string, message: string, metadata: Record<string, unknown> = {}): void {
    this.db.prepare(`
      INSERT INTO task_logs (id, task_id, level, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), taskId, level, message, JSON.stringify(metadata), Date.now());
  }

  /**
   * 开始执行
   */
  async start(taskId: string): Promise<Task | null> {
    return this.update(taskId, {
      status: 'running',
      startedAt: Date.now()
    });
  }

  /**
   * 完成任务
   */
  async complete(taskId: string, result: Record<string, unknown> = {}): Promise<Task | null> {
    const task = await this.get(taskId);
    const duration = task?.started_at ? Date.now() - task.started_at : 0;

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
  async fail(taskId: string, error: string): Promise<Task | null> {
    return this.update(taskId, {
      status: 'failed',
      completedAt: Date.now()
    });
  }

  /**
   * 获取用户的任务列表
   */
  async listByUser(userId: string, filters: TaskFilters = {}): Promise<unknown[]> {
    let query = `
      SELECT t.* FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      WHERE (t.creator_id = ? OR ta.user_id = ?)
    `;
    const params: (string | number)[] = [userId, userId];

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
  async listPinned(userId: string): Promise<unknown[]> {
    return this.db.prepare(`
      SELECT * FROM tasks 
      WHERE creator_id = ? AND is_pinned = 1
      ORDER BY created_at DESC
    `).all(userId);
  }

  /**
   * 添加评论
   */
  async addComment(taskId: string, userId: string, userName: string, content: string, parentId: string | null = null): Promise<string> {
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
  async getComments(taskId: string): Promise<unknown[]> {
    return this.db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at')
      .all(taskId);
  }
}

export { TaskManager };