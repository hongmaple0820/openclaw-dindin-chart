/**
 * 沙箱路由 - Docker 容器隔离执行环境
 */

const express = require('express');
const router = express.Router();

// SandboxManager 将在 app.js 中注入
let sandboxManager = null;

/**
 * 设置 SandboxManager 实例
 */
router.setManager = (manager) => {
  sandboxManager = manager;
};

/**
 * 获取管理器中间件
 */
const getManager = (req, res, next) => {
  if (!sandboxManager) {
    return res.status(503).json({ error: 'SandboxManager 未初始化' });
  }
  req.sandboxManager = sandboxManager;
  next();
};

/**
 * GET /api/sandbox
 * 列出所有沙箱
 */
async function listSandboxes(req, res) {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM sandboxes';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const sandboxes = req.app.locals.db.prepare(query).all(...params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM sandboxes';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE status = ?';
      countParams.push(status);
    }
    const total = req.app.locals.db.prepare(countQuery).get(...countParams);
    
    res.json({
      success: true,
      data: {
        sandboxes,
        total: total.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Sandbox] List failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/sandbox/:id
 * 获取单个沙箱详情
 */
async function getSandbox(req, res) {
  try {
    const { id } = req.params;
    
    const sandbox = await req.sandboxManager.get(id);
    
    if (!sandbox) {
      return res.status(404).json({ error: '沙箱不存在' });
    }
    
    // 获取最近日志
    const logs = req.app.locals.db.prepare(`
      SELECT * FROM sandbox_logs 
      WHERE sandbox_id = ? 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all(id);
    
    res.json({
      success: true,
      data: {
        ...sandbox,
        logs
      }
    });
  } catch (error) {
    console.error('[Sandbox] Get failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/sandbox
 * 创建新沙箱
 */
async function createSandbox(req, res) {
  try {
    const {
      name,
      sessionId,
      taskId,
      image,
      cpuLimit,
      memoryLimit,
      diskLimit,
      gpuEnabled,
      networkEnabled,
      allowedHosts,
      environmentVars,
      mounts
    } = req.body;
    
    const sandbox = await req.sandboxManager.create({
      name,
      sessionId,
      taskId,
      image,
      cpuLimit,
      memoryLimit,
      diskLimit,
      gpuEnabled,
      networkEnabled,
      allowedHosts,
      environmentVars,
      mounts
    });
    
    res.status(201).json({
      success: true,
      data: sandbox
    });
  } catch (error) {
    console.error('[Sandbox] Create failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/sandbox/:id
 * 删除沙箱
 */
async function deleteSandbox(req, res) {
  try {
    const { id } = req.params;
    
    await req.sandboxManager.destroy(id);
    
    res.json({
      success: true,
      message: '沙箱已删除'
    });
  } catch (error) {
    console.error('[Sandbox] Delete failed:', error);
    if (error.message === '沙箱不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/sandbox/:id/start
 * 启动沙箱（如果已停止）
 */
async function startSandbox(req, res) {
  try {
    const { id } = req.params;
    
    const sandbox = await req.sandboxManager.get(id);
    if (!sandbox) {
      return res.status(404).json({ error: '沙箱不存在' });
    }
    
    if (sandbox.status === 'running') {
      return res.status(400).json({ error: '沙箱已在运行中' });
    }
    
    // 重新创建容器
    if (req.sandboxManager.dockerAvailable && !sandbox.containerId) {
      await req.sandboxManager._createContainer(sandbox);
    }
    
    // 更新状态
    req.app.locals.db.prepare(`
      UPDATE sandboxes SET status = 'running', last_activity = ? WHERE id = ?
    `).run(Date.now(), id);
    
    res.json({
      success: true,
      data: { ...sandbox, status: 'running' }
    });
  } catch (error) {
    console.error('[Sandbox] Start failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/sandbox/:id/stop
 * 停止沙箱
 */
async function stopSandbox(req, res) {
  try {
    const { id } = req.params;
    
    await req.sandboxManager.stop(id);
    
    res.json({
      success: true,
      message: '沙箱已停止'
    });
  } catch (error) {
    console.error('[Sandbox] Stop failed:', error);
    if (error.message === '沙箱不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/sandbox/:id/execute
 * 在沙箱中执行代码
 */
async function executeCode(req, res) {
  try {
    const { id } = req.params;
    const { code, language = 'javascript' } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }
    
    const result = await req.sandboxManager.execute(id, code, language);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Sandbox] Execute failed:', error);
    if (error.message === '沙箱不存在' || error.message === '沙箱未运行') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/sandbox/:id/logs
 * 获取沙箱日志
 */
async function getLogs(req, res) {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0, level } = req.query;
    
    // 验证沙箱存在
    const sandbox = await req.sandboxManager.get(id);
    if (!sandbox) {
      return res.status(404).json({ error: '沙箱不存在' });
    }
    
    let query = 'SELECT * FROM sandbox_logs WHERE sandbox_id = ?';
    const params = [id];
    
    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const logs = req.app.locals.db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[Sandbox] Get logs failed:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/sandbox/:id/stats
 * 获取沙箱资源统计
 */
async function getStats(req, res) {
  try {
    const { id } = req.params;
    
    const sandbox = await req.sandboxManager.get(id);
    if (!sandbox) {
      return res.status(404).json({ error: '沙箱不存在' });
    }
    
    // 获取 Docker 容器统计（如果运行中）
    let containerStats = null;
    if (sandbox.status === 'running' && sandbox.containerId) {
      try {
        const { exec } = require('child_process');
        containerStats = await new Promise((resolve) => {
          exec(`docker stats ${sandbox.containerId} --no-stream --format "{{json .}}"`, 
            (error, stdout) => {
              if (error) {
                resolve(null);
              } else {
                try {
                  resolve(JSON.parse(stdout.trim()));
                } catch {
                  resolve(null);
                }
              }
            }
          );
        });
      } catch (e) {
        console.warn('[Sandbox] Failed to get container stats:', e.message);
      }
    }
    
    // 获取日志统计
    const logStats = req.app.locals.db.prepare(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN level = 'error' THEN 1 END) as errors,
        COUNT(CASE WHEN level = 'warn' THEN 1 END) as warnings
      FROM sandbox_logs 
      WHERE sandbox_id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: {
        sandbox,
        container: containerStats,
        logs: logStats
      }
    });
  } catch (error) {
    console.error('[Sandbox] Get stats failed:', error);
    res.status(500).json({ error: error.message });
  }
}

// 注册路由
router.get('/', getManager, listSandboxes);
router.get('/:id', getManager, getSandbox);
router.post('/', getManager, createSandbox);
router.delete('/:id', getManager, deleteSandbox);
router.post('/:id/start', getManager, startSandbox);
router.post('/:id/stop', getManager, stopSandbox);
router.post('/:id/execute', getManager, executeCode);
router.get('/:id/logs', getManager, getLogs);
router.get('/:id/stats', getManager, getStats);

module.exports = router;
