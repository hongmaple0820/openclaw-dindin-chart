/**
 * 工作区路由 - .fengLin 目录系统
 */

const express = require('express');
const router = express.Router();

// WorkspaceManager 将在 app.js 中注入
let workspaceManager = null;

/**
 * 设置 WorkspaceManager 实例
 */
router.setManager = (manager) => {
  workspaceManager = manager;
};

/**
 * 获取管理器中间件
 */
const getManager = (req, res, next) => {
  if (!workspaceManager) {
    return res.status(503).json({ error: 'WorkspaceManager 未初始化' });
  }
  req.workspaceManager = workspaceManager;
  next();
};

/**
 * GET /api/workspace
 * 列出所有工作区
 */
async function listWorkspaces(req, res) {
  try {
    const { type, ownerId, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM workspaces WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (ownerId) {
      query += ' AND (owner_id = ? OR type = \'default\')';
      params.push(ownerId);
    }
    
    query += ' ORDER BY last_accessed DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const workspaces = req.app.locals.db.prepare(query).all(...params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM workspaces WHERE 1=1';
    const countParams = [];
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (ownerId) {
      countQuery += ' AND (owner_id = ? OR type = \'default\')';
      countParams.push(ownerId);
    }
    const total = req.app.locals.db.prepare(countQuery).get(...countParams);
    
    res.json({
      success: true,
      data: {
        workspaces,
        total: total.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Workspace] List failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/workspace/:id
 * 获取单个工作区详情
 */
async function getWorkspace(req, res) {
  try {
    const { id } = req.params;
    
    const workspace = await req.workspaceManager.get(id);
    
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    // 获取文件统计
    const fileStats = req.app.locals.db.prepare(`
      SELECT 
        COUNT(*) as file_count,
        SUM(size) as total_size
      FROM workspace_files 
      WHERE workspace_id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: {
        ...workspace,
        stats: fileStats
      }
    });
  } catch (error) {
    console.error('[Workspace] Get failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/workspace
 * 创建新工作区
 */
async function createWorkspace(req, res) {
  try {
    const {
      name,
      type = 'custom',
      ownerId,
      groupId,
      taskId,
      autoCleanup,
      cleanupAfterDays,
      maxSize
    } = req.body;
    
    const workspace = await req.workspaceManager.create({
      name,
      type,
      ownerId,
      groupId,
      taskId,
      autoCleanup,
      cleanupAfterDays,
      maxSize
    });
    
    res.status(201).json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('[Workspace] Create failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * DELETE /api/workspace/:id
 * 删除工作区
 */
async function deleteWorkspace(req, res) {
  try {
    const { id } = req.params;
    
    const workspace = await req.workspaceManager.get(id);
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    // 不允许删除默认工作区
    if (workspace.type === 'default') {
      return res.status(403).json({ error: '不能删除默认工作区' });
    }
    
    // 删除文件记录
    req.app.locals.db.prepare('DELETE FROM workspace_files WHERE workspace_id = ?').run(id);
    
    // 删除工作区记录
    req.app.locals.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    
    // 删除物理文件
    const fse = require('fs-extra');
    if (workspace.path && await fse.pathExists(workspace.path)) {
      await fse.remove(workspace.path);
    }
    
    res.json({
      success: true,
      message: '工作区已删除'
    });
  } catch (error) {
    console.error('[Workspace] Delete failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/workspace/:id/files
 * 列出工作区文件
 */
async function listFiles(req, res) {
  try {
    const { id } = req.params;
    const { path: dirPath = '' } = req.query;
    
    // 验证工作区存在
    const workspace = await req.workspaceManager.get(id);
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    const files = await req.workspaceManager.listFiles(id, dirPath);
    
    res.json({
      success: true,
      data: {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path
        },
        currentPath: dirPath,
        files
      }
    });
  } catch (error) {
    console.error('[Workspace] List files failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/workspace/:id/files/*
 * 读取文件内容
 */
async function readFile(req, res) {
  try {
    const { id } = req.params;
    // 获取文件路径（files 后面的所有内容）
    const pathMatch = req.path.match(/\/files\/(.+)$/);
    const filePath = pathMatch ? pathMatch[1] : '';
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    // 验证工作区存在
    const workspace = await req.workspaceManager.get(id);
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    const content = await req.workspaceManager.readFile(id, decodeURIComponent(filePath));
    
    // 尝试检测内容类型
    const isBinary = Buffer.isBuffer(content);
    
    res.json({
      success: true,
      data: {
        path: filePath,
        content: isBinary ? content.toString('base64') : content,
        encoding: isBinary ? 'base64' : 'utf-8'
      }
    });
  } catch (error) {
    console.error('[Workspace] Read file failed:', error);
    if ((error as Error).message === '文件不存在') {
      return res.status(404).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/workspace/:id/files/*
 * 写入文件
 */
async function writeFile(req, res) {
  try {
    const { id } = req.params;
    const { content, encoding = 'utf-8' } = req.body;
    
    // 获取文件路径
    const pathMatch = req.path.match(/\/files\/(.+)$/);
    const filePath = pathMatch ? pathMatch[1] : '';
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ error: '缺少 content 参数' });
    }
    
    // 验证工作区存在
    const workspace = await req.workspaceManager.get(id);
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    // 处理编码
    let fileContent = content;
    if (encoding === 'base64') {
      fileContent = Buffer.from(content, 'base64');
    }
    
    const fullPath = await req.workspaceManager.writeFile(id, decodeURIComponent(filePath), fileContent);
    
    res.json({
      success: true,
      data: {
        path: filePath,
        fullPath,
        message: '文件已保存'
      }
    });
  } catch (error) {
    console.error('[Workspace] Write file failed:', error);
    if ((error as Error).message === '工作区不存在') {
      return res.status(404).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * DELETE /api/workspace/:id/files/*
 * 删除文件
 */
async function deleteFile(req, res) {
  try {
    const { id } = req.params;
    
    // 获取文件路径
    const pathMatch = req.path.match(/\/files\/(.+)$/);
    const filePath = pathMatch ? pathMatch[1] : '';
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    // 验证工作区存在
    const workspace = await req.workspaceManager.get(id);
    if (!workspace) {
      return res.status(404).json({ error: '工作区不存在' });
    }
    
    await req.workspaceManager.deleteFile(id, decodeURIComponent(filePath));
    
    res.json({
      success: true,
      message: '文件已删除'
    });
  } catch (error) {
    console.error('[Workspace] Delete file failed:', error);
    if ((error as Error).message === '工作区不存在') {
      return res.status(404).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/workspace/group/:groupId
 * 获取群聊工作区
 */
async function getGroupWorkspace(req, res) {
  try {
    const { groupId } = req.params;
    
    const workspace = await req.workspaceManager.getGroupWorkspace(groupId);
    
    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('[Workspace] Get group workspace failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/workspace/private/:userId
 * 获取私聊工作区
 */
async function getPrivateWorkspace(req, res) {
  try {
    const { userId } = req.params;
    
    const workspace = await req.workspaceManager.getPrivateWorkspace(userId);
    
    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('[Workspace] Get private workspace failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

// 注册路由
// 注意：更具体的路由要放在动态路由（:id）之前
router.get('/group/:groupId', getManager, getGroupWorkspace);
router.get('/private/:userId', getManager, getPrivateWorkspace);
router.get('/:id/files', getManager, listFiles);
router.get('/:id/files/*', getManager, readFile);
router.post('/:id/files/*', getManager, writeFile);
router.delete('/:id/files/*', getManager, deleteFile);
router.get('/:id', getManager, getWorkspace);
router.post('/', getManager, createWorkspace);
router.delete('/:id', getManager, deleteWorkspace);
router.get('/', getManager, listWorkspaces);

module.exports = router;

// Make this a module
export {};
