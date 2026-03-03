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

// ==================== 项目群管理 ====================

/**
 * 1. 创建项目群
 * POST /api/projects
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { group_id, name, description, repo_url, settings } = req.body;
    const userId = req.userId;
    
    if (!group_id || !name) {
      return res.status(400).json({ success: false, message: 'group_id 和 name 为必填项' });
    }
    
    // 检查 group_id 是否已存在
    const existing = db.prepare('SELECT id FROM project_groups WHERE group_id = ? AND status = ?').get(group_id, 'active');
    if (existing) {
      return res.status(409).json({ success: false, message: '项目群 ID 已存在' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO project_groups (id, group_id, name, description, repo_url, status, created_at, updated_at, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, group_id, name, description || null, repo_url || null, 'active', now, now, settings ? JSON.stringify(settings) : null);
    
    const project = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id);
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('[Projects] 创建项目群失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 2. 获取项目群列表
 * GET /api/projects
 */
router.get('/', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM project_groups WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += " AND status != 'deleted'";
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const projects = db.prepare(sql).all(...params);
    
    // 解析 settings
    const parsedProjects = projects.map(p => ({
      ...p,
      settings: p.settings ? JSON.parse(p.settings) : null
    }));
    
    res.json({ success: true, count: parsedProjects.length, projects: parsedProjects });
  } catch (error) {
    console.error('[Projects] 获取项目群列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 3. 获取项目群详情
 * GET /api/projects/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const project = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id);
    
    if (!project) {
      return res.status(404).json({ success: false, message: '项目群不存在' });
    }
    
    // 解析 settings
    project.settings = project.settings ? JSON.parse(project.settings) : null;
    
    // 获取技能数量
    const skillCount = db.prepare('SELECT COUNT(*) as count FROM project_skills WHERE project_id = ? AND is_active = 1').get(id);
    
    // 获取任务统计
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM project_tasks WHERE project_id = ?
    `).get(id);
    
    res.json({ 
      success: true, 
      project,
      stats: {
        skills: skillCount.count,
        tasks: taskStats || { total: 0, todo: 0, in_progress: 0, done: 0 }
      }
    });
  } catch (error) {
    console.error('[Projects] 获取项目群详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 4. 更新项目群
 * PUT /api/projects/:id
 */
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, repo_url, status, settings } = req.body;
    
    const existing = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '项目群不存在' });
    }
    
    const now = Date.now();
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (repo_url !== undefined) { updates.push('repo_url = ?'); params.push(repo_url); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (settings !== undefined) { updates.push('settings = ?'); params.push(JSON.stringify(settings)); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    db.prepare(`UPDATE project_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const project = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id);
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('[Projects] 更新项目群失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 5. 删除项目群（软删除）
 * DELETE /api/projects/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '项目群不存在' });
    }
    
    const now = Date.now();
    db.prepare("UPDATE project_groups SET status = 'deleted', updated_at = ? WHERE id = ?").run(now, id);
    
    res.json({ success: true, message: '项目群已删除' });
  } catch (error) {
    console.error('[Projects] 删除项目群失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 技能管理 ====================

/**
 * 6. 获取技能列表
 * GET /api/projects/:id/skills
 */
router.get('/:id/skills', (req, res) => {
  try {
    const { id } = req.params;
    const { type, active_only = true } = req.query;
    
    let sql = 'SELECT * FROM project_skills WHERE project_id = ?';
    const params = [id];
    
    if (active_only === 'true' || active_only === true) {
      sql += ' AND is_active = 1';
    }
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const skills = db.prepare(sql).all(...params);
    
    res.json({ success: true, count: skills.length, skills });
  } catch (error) {
    console.error('[Projects] 获取技能列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 7. 创建技能
 * POST /api/projects/:id/skills
 */
router.post('/:id/skills', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, content } = req.body;
    const userId = req.userId;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'name 和 type 为必填项' });
    }
    
    // 验证 type
    const validTypes = ['rule', 'tool', 'workflow'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `type 必须是: ${validTypes.join(', ')}` });
    }
    
    const skillId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO project_skills (id, project_id, name, type, content, created_by, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(skillId, id, name, type, content || null, userId, now);
    
    const skill = db.prepare('SELECT * FROM project_skills WHERE id = ?').get(skillId);
    
    res.json({ success: true, skill });
  } catch (error) {
    console.error('[Projects] 创建技能失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 8. 更新技能
 * PUT /api/projects/:id/skills/:skillId
 */
router.put('/:id/skills/:skillId', authMiddleware, (req, res) => {
  try {
    const { skillId } = req.params;
    const { name, type, content, is_active } = req.body;
    
    const existing = db.prepare('SELECT * FROM project_skills WHERE id = ?').get(skillId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '技能不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { 
      const validTypes = ['rule', 'tool', 'workflow'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: `type 必须是: ${validTypes.join(', ')}` });
      }
      updates.push('type = ?'); 
      params.push(type); 
    }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }
    
    params.push(skillId);
    db.prepare(`UPDATE project_skills SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const skill = db.prepare('SELECT * FROM project_skills WHERE id = ?').get(skillId);
    
    res.json({ success: true, skill });
  } catch (error) {
    console.error('[Projects] 更新技能失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 9. 删除技能
 * DELETE /api/projects/:id/skills/:skillId
 */
router.delete('/:id/skills/:skillId', authMiddleware, (req, res) => {
  try {
    const { skillId } = req.params;
    
    const existing = db.prepare('SELECT * FROM project_skills WHERE id = ?').get(skillId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '技能不存在' });
    }
    
    db.prepare('DELETE FROM project_skills WHERE id = ?').run(skillId);
    
    res.json({ success: true, message: '技能已删除' });
  } catch (error) {
    console.error('[Projects] 删除技能失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 任务管理 ====================

/**
 * 10. 获取任务列表
 * GET /api/projects/:id/tasks
 */
router.get('/:id/tasks', (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignee_id, limit = 100, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM project_tasks WHERE project_id = ?';
    const params = [id];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    
    if (assignee_id) {
      sql += ' AND assignee_id = ?';
      params.push(assignee_id);
    }
    
    sql += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const tasks = db.prepare(sql).all(...params);
    
    // 解析 tags
    const parsedTasks = tasks.map(t => ({
      ...t,
      tags: t.tags ? JSON.parse(t.tags) : []
    }));
    
    res.json({ success: true, count: parsedTasks.length, tasks: parsedTasks });
  } catch (error) {
    console.error('[Projects] 获取任务列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 11. 创建任务
 * POST /api/projects/:id/tasks
 */
router.post('/:id/tasks', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, assignee_id, due_date, tags } = req.body;
    const userId = req.userId;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'title 为必填项' });
    }
    
    const taskId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO project_tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_by, created_at, updated_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId, id, title, description || null, 'todo', priority || 'medium',
      assignee_id || null, due_date || null, userId, now, now,
      tags ? JSON.stringify(tags) : null
    );
    
    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('[Projects] 创建任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 12. 更新任务
 * PUT /api/projects/:id/tasks/:taskId
 */
router.put('/:id/tasks/:taskId', authMiddleware, (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, assignee_id, due_date, tags } = req.body;
    
    const existing = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const now = Date.now();
    const updates = ['updated_at = ?'];
    const params = [now];
    
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assignee_id !== undefined) { updates.push('assignee_id = ?'); params.push(assignee_id); }
    if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
    
    params.push(taskId);
    db.prepare(`UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    task.tags = task.tags ? JSON.parse(task.tags) : [];
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('[Projects] 更新任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 13. 删除任务
 * DELETE /api/projects/:id/tasks/:taskId
 */
router.delete('/:id/tasks/:taskId', authMiddleware, (req, res) => {
  try {
    const { taskId } = req.params;
    
    const existing = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 先删除相关评论
    db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
    
    // 删除看板卡片关联
    db.prepare('DELETE FROM task_cards WHERE task_id = ?').run(taskId);
    
    // 删除任务
    db.prepare('DELETE FROM project_tasks WHERE id = ?').run(taskId);
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('[Projects] 删除任务失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 14. 添加任务评论
 * POST /api/projects/:id/tasks/:taskId/comments
 */
router.post('/:id/tasks/:taskId/comments', authMiddleware, (req, res) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'content 为必填项' });
    }
    
    const existing = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const commentId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO task_comments (id, task_id, user_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(commentId, taskId, userId, content, now);
    
    const comment = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(commentId);
    
    res.json({ success: true, comment });
  } catch (error) {
    console.error('[Projects] 添加任务评论失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 看板管理 ====================

/**
 * 15. 获取看板
 * GET /api/projects/:id/boards
 */
router.get('/:id/boards', (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取看板列表
    const boards = db.prepare(`
      SELECT * FROM task_boards 
      WHERE project_id = ? 
      ORDER BY order_index ASC
    `).all(id);
    
    // 为每个看板获取卡片
    const boardsWithCards = boards.map(board => {
      const cards = db.prepare(`
        SELECT tc.*, pt.title, pt.status, pt.priority, pt.assignee_id
        FROM task_cards tc
        JOIN project_tasks pt ON tc.task_id = pt.id
        WHERE tc.board_id = ?
        ORDER BY tc.order_index ASC
      `).all(board.id);
      
      return {
        ...board,
        cards
      };
    });
    
    res.json({ success: true, count: boardsWithCards.length, boards: boardsWithCards });
  } catch (error) {
    console.error('[Projects] 获取看板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 16. 创建看板列表
 * POST /api/projects/:id/boards
 */
router.post('/:id/boards', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'name 为必填项' });
    }
    
    // 获取当前最大 order_index
    const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM task_boards WHERE project_id = ?').get(id);
    const orderIndex = (maxOrder.max || 0) + 1;
    
    const boardId = uuidv4();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO task_boards (id, project_id, name, order_index, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(boardId, id, name, orderIndex, now);
    
    const board = db.prepare('SELECT * FROM task_boards WHERE id = ?').get(boardId);
    
    res.json({ success: true, board });
  } catch (error) {
    console.error('[Projects] 创建看板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 17. 重新排序看板
 * PUT /api/projects/:id/boards/reorder
 */
router.put('/:id/boards/reorder', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { orders } = req.body; // [{ boardId, orderIndex }, ...]
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'orders 数组为必填项' });
    }
    
    // 使用事务批量更新
    const updateStmt = db.prepare('UPDATE task_boards SET order_index = ? WHERE id = ? AND project_id = ?');
    const updateMany = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.orderIndex, item.boardId, id);
      }
    });
    
    updateMany(orders);
    
    // 返回更新后的看板
    const boards = db.prepare('SELECT * FROM task_boards WHERE project_id = ? ORDER BY order_index ASC').all(id);
    
    res.json({ success: true, boards });
  } catch (error) {
    console.error('[Projects] 重新排序看板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 18. 添加卡片到看板
 * POST /api/projects/:id/boards/:boardId/cards
 */
router.post('/:id/boards/:boardId/cards', authMiddleware, (req, res) => {
  try {
    const { boardId } = req.params;
    const { task_id } = req.body;
    
    if (!task_id) {
      return res.status(400).json({ success: false, message: 'task_id 为必填项' });
    }
    
    // 检查任务是否存在
    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(task_id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 检查任务是否已在其他看板中
    const existingCard = db.prepare('SELECT * FROM task_cards WHERE task_id = ?').get(task_id);
    if (existingCard) {
      // 移动到新看板
      db.prepare('UPDATE task_cards SET board_id = ? WHERE task_id = ?').run(boardId, task_id);
    } else {
      // 创建新卡片
      const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM task_cards WHERE board_id = ?').get(boardId);
      const orderIndex = (maxOrder.max || 0) + 1;
      
      db.prepare(`
        INSERT INTO task_cards (id, board_id, task_id, order_index)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), boardId, task_id, orderIndex);
    }
    
    res.json({ success: true, message: '卡片已添加到看板' });
  } catch (error) {
    console.error('[Projects] 添加卡片失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 19. 删除看板
 * DELETE /api/projects/:id/boards/:boardId
 */
router.delete('/:id/boards/:boardId', authMiddleware, (req, res) => {
  try {
    const { boardId } = req.params;
    
    const existing = db.prepare('SELECT * FROM task_boards WHERE id = ?').get(boardId);
    if (!existing) {
      return res.status(404).json({ success: false, message: '看板不存在' });
    }
    
    // 删除看板中的卡片关联（不删除任务本身）
    db.prepare('DELETE FROM task_cards WHERE board_id = ?').run(boardId);
    
    // 删除看板
    db.prepare('DELETE FROM task_boards WHERE id = ?').run(boardId);
    
    res.json({ success: true, message: '看板已删除' });
  } catch (error) {
    console.error('[Projects] 删除看板失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 20. 获取任务评论列表
 * GET /api/projects/:id/tasks/:taskId/comments
 */
router.get('/:id/tasks/:taskId/comments', (req, res) => {
  try {
    const { taskId } = req.params;
    
    const comments = db.prepare(`
      SELECT * FROM task_comments 
      WHERE task_id = ? 
      ORDER BY created_at ASC
    `).all(taskId);
    
    res.json({ success: true, count: comments.length, comments });
  } catch (error) {
    console.error('[Projects] 获取任务评论失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
