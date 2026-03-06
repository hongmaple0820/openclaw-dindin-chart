/**
 * 权限系统路由
 * 
 * API 端点：
 * - GET    /api/permissions              获取权限列表
 * - POST   /api/permissions              创建权限
 * - GET    /api/roles                    获取角色列表
 * - POST   /api/roles                    创建角色
 * - GET    /api/roles/:id                获取角色详情
 * - PUT    /api/roles/:id/permissions    更新角色权限
 * - DELETE /api/roles/:id                删除角色
 * - GET    /api/agents/:id/roles         获取 Agent 角色
 * - POST   /api/agents/:id/roles         分配角色
 * - DELETE /api/agents/:id/roles/:roleId 移除角色
 * - GET    /api/agents/:id/permissions   获取 Agent 权限
 */
const express = require('express');
const router = express.Router();
const permissionManager = require('../services/permission-manager');

// ==================== 权限管理 API ====================

/**
 * GET /api/permissions
 * 获取权限列表
 * 
 * Query:
 * - category: 按分类筛选 (plugin/agent/channel)
 */
router.get('/permissions', (req, res) => {
  try {
    const { category } = req.query;
    const permissions = permissionManager.listPermissions({ category });
    
    res.json({
      success: true,
      data: permissions,
      total: permissions.length
    });
  } catch (error) {
    console.error('[Permissions API] 获取权限列表失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/permissions
 * 创建权限
 * 
 * Body:
 * - id: 权限 ID (如 plugin:read)
 * - name: 权限名称
 * - category: 分类 (plugin/agent/channel)
 * - description: 描述
 */
router.post('/permissions', (req, res) => {
  try {
    const { id, name, category, description } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'id 和 name 是必填字段'
      });
    }

    const permission = permissionManager.createPermission({
      id,
      name,
      category,
      description
    });

    console.log(`[Permissions API] 创建权限: ${id}`);

    res.status(201).json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('[Permissions API] 创建权限失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * DELETE /api/permissions/:id
 * 删除权限
 */
router.delete('/permissions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = permissionManager.deletePermission(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '权限不存在'
      });
    }

    console.log(`[Permissions API] 删除权限: ${id}`);

    res.json({
      success: true,
      message: '权限已删除'
    });
  } catch (error) {
    console.error('[Permissions API] 删除权限失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// ==================== 角色管理 API ====================

/**
 * GET /api/roles
 * 获取角色列表
 * 
 * Query:
 * - includePermissions: 是否包含权限列表 (默认 true)
 */
router.get('/roles', (req, res) => {
  try {
    const includePermissions = req.query.includePermissions !== 'false';
    const roles = permissionManager.listRoles({ includePermissions });

    res.json({
      success: true,
      data: roles,
      total: roles.length
    });
  } catch (error) {
    console.error('[Permissions API] 获取角色列表失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/roles/:id
 * 获取角色详情
 */
router.get('/roles/:id', (req, res) => {
  try {
    const role = permissionManager.getRole(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('[Permissions API] 获取角色详情失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/roles
 * 创建角色
 * 
 * Body:
 * - id: 角色 ID
 * - name: 角色名称
 * - description: 描述
 * - permissions: 权限 ID 列表
 */
router.post('/roles', (req, res) => {
  try {
    const { id, name, description, permissions } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'id 和 name 是必填字段'
      });
    }

    const role = permissionManager.createRole({
      id,
      name,
      description,
      permissions: permissions || []
    });

    console.log(`[Permissions API] 创建角色: ${id}`);

    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('[Permissions API] 创建角色失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * PUT /api/roles/:id
 * 更新角色
 * 
 * Body:
 * - name: 角色名称
 * - description: 描述
 */
router.put('/roles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = permissionManager.updateRole(id, { name, description });

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('[Permissions API] 更新角色失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * PUT /api/roles/:id/permissions
 * 更新角色权限
 * 
 * Body:
 * - permissions: 权限 ID 列表
 */
router.put('/roles/:id/permissions', (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'permissions 必须是数组'
      });
    }

    const role = permissionManager.updateRolePermissions(id, permissions);

    console.log(`[Permissions API] 更新角色权限: ${id}`);

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('[Permissions API] 更新角色权限失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * DELETE /api/roles/:id
 * 删除角色
 */
router.delete('/roles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = permissionManager.deleteRole(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    console.log(`[Permissions API] 删除角色: ${id}`);

    res.json({
      success: true,
      message: '角色已删除'
    });
  } catch (error) {
    console.error('[Permissions API] 删除角色失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// ==================== Agent 角色管理 API ====================

/**
 * GET /api/agents/:id/roles
 * 获取 Agent 的角色列表
 */
router.get('/agents/:id/roles', (req, res) => {
  try {
    const { id } = req.params;
    const roles = permissionManager.getAgentRoles(id);

    res.json({
      success: true,
      data: roles,
      total: roles.length
    });
  } catch (error) {
    console.error('[Permissions API] 获取 Agent 角色失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/agents/:id/roles
 * 为 Agent 分配角色
 * 
 * Body:
 * - roleId: 角色 ID
 * - assignedBy: 分配者 (可选)
 * 
 * 或者:
 * - roleIds: 角色ID列表 (替换所有角色)
 * - assignedBy: 分配者 (可选)
 */
router.post('/agents/:id/roles', (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, roleIds, assignedBy } = req.body;

    let roles;

    if (roleIds && Array.isArray(roleIds)) {
      // 替换所有角色
      roles = permissionManager.setAgentRoles(id, roleIds, assignedBy);
      console.log(`[Permissions API] 设置 Agent 角色: ${id} -> ${roleIds.join(', ')}`);
    } else if (roleId) {
      // 添加单个角色
      roles = permissionManager.assignRoleToAgent(id, roleId, assignedBy);
      console.log(`[Permissions API] 分配角色: ${id} -> ${roleId}`);
    } else {
      return res.status(400).json({
        success: false,
        error: '需要 roleId 或 roleIds 参数'
      });
    }

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('[Permissions API] 分配角色失败:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * DELETE /api/agents/:id/roles/:roleId
 * 移除 Agent 的角色
 */
router.delete('/agents/:id/roles/:roleId', (req, res) => {
  try {
    const { id, roleId } = req.params;
    const removed = permissionManager.removeRoleFromAgent(id, roleId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Agent 没有此角色'
      });
    }

    console.log(`[Permissions API] 移除角色: ${id} <- ${roleId}`);

    res.json({
      success: true,
      message: '角色已移除'
    });
  } catch (error) {
    console.error('[Permissions API] 移除角色失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/agents/:id/permissions
 * 获取 Agent 的所有权限
 */
router.get('/agents/:id/permissions', (req, res) => {
  try {
    const { id } = req.params;
    const permissions = permissionManager.getAgentPermissions(id);

    res.json({
      success: true,
      data: permissions,
      total: permissions.length
    });
  } catch (error) {
    console.error('[Permissions API] 获取 Agent 权限失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/agents/:id/check-permission
 * 检查 Agent 是否有指定权限
 * 
 * Body:
 * - permission: 权限 ID 或权限 ID 数组
 * - mode: 检查模式 (any/all, 默认 any)
 */
router.post('/agents/:id/check-permission', (req, res) => {
  try {
    const { id } = req.params;
    const { permission, mode = 'any' } = req.body;

    if (!permission) {
      return res.status(400).json({
        success: false,
        error: '需要 permission 参数'
      });
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    let hasPermission;

    if (mode === 'all') {
      hasPermission = permissionManager.hasAllPermissions(id, permissions);
    } else {
      hasPermission = permissionManager.hasAnyPermission(id, permissions);
    }

    res.json({
      success: true,
      data: {
        agentId: id,
        permissions,
        mode,
        hasPermission
      }
    });
  } catch (error) {
    console.error('[Permissions API] 检查权限失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/permissions/stats
 * 获取权限系统统计信息
 */
router.get('/permissions/stats', (req, res) => {
  try {
    const stats = permissionManager.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Permissions API] 获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

module.exports = router;

// Make this a module
export {};
