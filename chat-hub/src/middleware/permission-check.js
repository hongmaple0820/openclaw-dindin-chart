/**
 * 权限检查中间件
 * 
 * 支持多种权限检查方式：
 * - requirePermission: 检查单个权限
 * - requireAnyPermission: 检查是否有任一权限
 * - requireAllPermissions: 检查是否有所有权限
 * - requireRole: 检查是否有指定角色
 * - requireAdmin: 检查是否是管理员
 */

const permissionManager = require('../services/permission-manager');

/**
 * 从请求中获取 Agent ID
 * 
 * 支持多种方式：
 * 1. req.user.id (已认证用户)
 * 2. req.agent.id (Agent 认证)
 * 3. req.headers['x-agent-id'] (Header 传递)
 * 4. req.params.agentId (URL 参数)
 */
function getAgentId(req) {
  return req.user?.id || 
         req.agent?.id || 
         req.headers['x-agent-id'] ||
         req.params.agentId ||
         null;
}

/**
 * 权限检查中间件工厂
 * 
 * @param {string|string[]} permissions - 权限 ID 或 ID 数组
 * @param {object} options - 配置选项
 * @param {string} options.mode - 检查模式: 'any' | 'all' (默认 'any')
 * @param {boolean} options.allowAdmin - 管理员是否自动通过 (默认 true)
 */
function requirePermission(permissions, options = {}) {
  const {
    mode = 'any',
    allowAdmin = true
  } = options;

  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  return async (req, res, next) => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
      }

      // 初始化权限管理器
      permissionManager.init();

      // 管理员自动通过
      if (allowAdmin && permissionManager.isAdmin(agentId)) {
        req.permissions = {
          agentId,
          isAdmin: true,
          checked: permissionList,
          mode,
          passed: true
        };
        return next();
      }

      // 检查权限
      let hasPermission;

      if (mode === 'all') {
        hasPermission = permissionManager.hasAllPermissions(agentId, permissionList);
      } else {
        hasPermission = permissionManager.hasAnyPermission(agentId, permissionList);
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: '权限不足',
          required: permissionList,
          mode
        });
      }

      // 记录权限信息
      req.permissions = {
        agentId,
        isAdmin: false,
        checked: permissionList,
        mode,
        passed: true
      };

      next();
    } catch (error) {
      console.error('[Permission Middleware] 权限检查失败:', error);
      return res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

/**
 * 检查是否有任一权限
 */
function requireAnyPermission(permissions, options = {}) {
  return requirePermission(permissions, { ...options, mode: 'any' });
}

/**
 * 检查是否有所有权限
 */
function requireAllPermissions(permissions, options = {}) {
  return requirePermission(permissions, { ...options, mode: 'all' });
}

/**
 * 角色检查中间件
 * 
 * @param {string|string[]} roles - 角色 ID 或 ID 数组
 * @param {object} options - 配置选项
 */
function requireRole(roles, options = {}) {
  const { allowAdmin = true } = options;
  const roleList = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
      }

      permissionManager.init();

      // 获取 Agent 的角色
      const agentRoles = permissionManager.getAgentRoles(agentId);
      const agentRoleIds = agentRoles.map(r => r.id);

      // 管理员自动通过
      if (allowAdmin && agentRoleIds.includes('admin')) {
        req.permissions = {
          agentId,
          isAdmin: true,
          hasRole: true
        };
        return next();
      }

      // 检查是否有任一角色
      const hasRole = roleList.some(roleId => agentRoleIds.includes(roleId));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          error: '角色权限不足',
          required: roleList
        });
      }

      req.permissions = {
        agentId,
        isAdmin: false,
        hasRole: true,
        roles: agentRoleIds
      };

      next();
    } catch (error) {
      console.error('[Permission Middleware] 角色检查失败:', error);
      return res.status(500).json({
        success: false,
        error: '角色检查失败'
      });
    }
  };
}

/**
 * 管理员权限检查
 */
function requireAdmin() {
  return async (req, res, next) => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
      }

      permissionManager.init();

      if (!permissionManager.isAdmin(agentId)) {
        return res.status(403).json({
          success: false,
          error: '需要管理员权限'
        });
      }

      req.permissions = {
        agentId,
        isAdmin: true
      };

      next();
    } catch (error) {
      console.error('[Permission Middleware] 管理员检查失败:', error);
      return res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

/**
 * 可选权限检查
 * 
 * 有权限则设置 req.permissions，无权限也放行
 * 用于需要根据权限调整行为的场景
 */
function optionalPermission(permissions, options = {}) {
  const { mode = 'any' } = options;
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  return async (req, res, next) => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        req.permissions = { passed: false, reason: 'no_auth' };
        return next();
      }

      permissionManager.init();

      const isAdmin = permissionManager.isAdmin(agentId);

      if (isAdmin) {
        req.permissions = {
          agentId,
          isAdmin: true,
          passed: true
        };
        return next();
      }

      let hasPermission;

      if (mode === 'all') {
        hasPermission = permissionManager.hasAllPermissions(agentId, permissionList);
      } else {
        hasPermission = permissionManager.hasAnyPermission(agentId, permissionList);
      }

      req.permissions = {
        agentId,
        isAdmin: false,
        checked: permissionList,
        mode,
        passed: hasPermission
      };

      next();
    } catch (error) {
      console.error('[Permission Middleware] 可选权限检查失败:', error);
      req.permissions = { passed: false, reason: 'error' };
      next();
    }
  };
}

/**
 * 创建资源所有权检查中间件
 * 
 * 检查用户是否是资源所有者或有管理权限
 * 
 * @param {function} getResourceOwnerId - 获取资源所有者 ID 的函数
 * @param {string} managePermission - 管理权限 ID
 */
function requireOwnerOrPermission(getResourceOwnerId, managePermission) {
  return async (req, res, next) => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
      }

      permissionManager.init();

      // 管理员通过
      if (permissionManager.isAdmin(agentId)) {
        req.permissions = { agentId, isAdmin: true, isOwner: false, passed: true };
        return next();
      }

      // 检查是否有管理权限
      if (managePermission && permissionManager.hasPermission(agentId, managePermission)) {
        req.permissions = { agentId, isAdmin: false, isOwner: false, passed: true };
        return next();
      }

      // 检查是否是所有者
      const ownerId = await getResourceOwnerId(req);

      if (ownerId && ownerId === agentId) {
        req.permissions = { agentId, isAdmin: false, isOwner: true, passed: true };
        return next();
      }

      return res.status(403).json({
        success: false,
        error: '无权访问此资源'
      });
    } catch (error) {
      console.error('[Permission Middleware] 所有权检查失败:', error);
      return res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

/**
 * 权限检查辅助函数
 */
const PermissionCheck = {
  /**
   * 同步检查权限
   */
  check(agentId, permissionId) {
    permissionManager.init();
    return permissionManager.hasPermission(agentId, permissionId);
  },

  /**
   * 检查是否有任一权限
   */
  checkAny(agentId, permissionIds) {
    permissionManager.init();
    return permissionManager.hasAnyPermission(agentId, permissionIds);
  },

  /**
   * 检查是否有所有权限
   */
  checkAll(agentId, permissionIds) {
    permissionManager.init();
    return permissionManager.hasAllPermissions(agentId, permissionIds);
  },

  /**
   * 检查是否是管理员
   */
  checkAdmin(agentId) {
    permissionManager.init();
    return permissionManager.isAdmin(agentId);
  },

  /**
   * 获取所有权限
   */
  getPermissions(agentId) {
    permissionManager.init();
    return permissionManager.getAgentPermissions(agentId);
  },

  /**
   * 获取角色
   */
  getRoles(agentId) {
    permissionManager.init();
    return permissionManager.getAgentRoles(agentId);
  }
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireAdmin,
  optionalPermission,
  requireOwnerOrPermission,
  PermissionCheck,
  getAgentId
};
