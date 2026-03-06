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

import permissionManager from '../services/permission-manager';
import { Request, Response, NextFunction } from 'express';

interface PermissionInfo {
  agentId?: string;
  isAdmin?: boolean;
  checked?: string[];
  mode?: string;
  passed?: boolean;
  reason?: string;
  hasRole?: boolean;
  roles?: string[];
  isOwner?: boolean;
}

export interface PermissionRequest extends Request {
  user?: { id: string };
  agent?: { id: string };
  permissions?: PermissionInfo;
}

/**
 * 从请求中获取 Agent ID
 */
export function getAgentId(req: PermissionRequest): string | null {
  const headerAgentId = req.headers['x-agent-id'];
  const paramsAgentId = req.params.agentId;
  return req.user?.id || 
         req.agent?.id || 
         (typeof headerAgentId === 'string' ? headerAgentId : headerAgentId?.[0]) ||
         (typeof paramsAgentId === 'string' ? paramsAgentId : null) ||
         null;
}

interface RequirePermissionOptions {
  mode?: 'any' | 'all';
  allowAdmin?: boolean;
}

/**
 * 权限检查中间件工厂
 */
export function requirePermission(
  permissions: string | string[],
  options: RequirePermissionOptions = {}
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  const {
    mode = 'any',
    allowAdmin = true
  } = options;

  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
        return;
      }

      permissionManager.init();

      if (allowAdmin && permissionManager.isAdmin(agentId)) {
        req.permissions = {
          agentId,
          isAdmin: true,
          checked: permissionList,
          mode,
          passed: true
        };
        next();
        return;
      }

      let hasPermission: boolean;

      if (mode === 'all') {
        hasPermission = permissionManager.hasAllPermissions(agentId, permissionList);
      } else {
        hasPermission = permissionManager.hasAnyPermission(agentId, permissionList);
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: '权限不足',
          required: permissionList,
          mode
        });
        return;
      }

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
      res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

export function requireAnyPermission(
  permissions: string | string[],
  options: RequirePermissionOptions = {}
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  return requirePermission(permissions, { ...options, mode: 'any' });
}

export function requireAllPermissions(
  permissions: string | string[],
  options: RequirePermissionOptions = {}
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  return requirePermission(permissions, { ...options, mode: 'all' });
}

interface RequireRoleOptions {
  allowAdmin?: boolean;
}

export function requireRole(
  roles: string | string[],
  options: RequireRoleOptions = {}
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  const { allowAdmin = true } = options;
  const roleList: string[] = Array.isArray(roles) ? roles : [roles];

  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
        return;
      }

      permissionManager.init();

      const agentRoles = permissionManager.getAgentRoles(agentId);
      const agentRoleIds = agentRoles.map((r: any) => r.id);

      if (allowAdmin && agentRoleIds.includes('admin')) {
        req.permissions = {
          agentId,
          isAdmin: true,
          hasRole: true
        };
        next();
        return;
      }

      const hasRole = roleList.some(roleId => agentRoleIds.includes(roleId));

      if (!hasRole) {
        res.status(403).json({
          success: false,
          error: '角色权限不足',
          required: roleList
        });
        return;
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
      res.status(500).json({
        success: false,
        error: '角色检查失败'
      });
    }
  };
}

export function requireAdmin(): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
        return;
      }

      permissionManager.init();

      if (!permissionManager.isAdmin(agentId)) {
        res.status(403).json({
          success: false,
          error: '需要管理员权限'
        });
        return;
      }

      req.permissions = {
        agentId,
        isAdmin: true
      };

      next();
    } catch (error) {
      console.error('[Permission Middleware] 管理员检查失败:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

export function optionalPermission(
  permissions: string | string[],
  options: { mode?: 'any' | 'all' } = {}
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  const { mode = 'any' } = options;
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        req.permissions = { passed: false, reason: 'no_auth' };
        next();
        return;
      }

      permissionManager.init();

      const isAdmin = permissionManager.isAdmin(agentId);

      if (isAdmin) {
        req.permissions = {
          agentId,
          isAdmin: true,
          passed: true
        };
        next();
        return;
      }

      let hasPermission: boolean;

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

export function requireOwnerOrPermission(
  getResourceOwnerId: (req: PermissionRequest) => Promise<string | null>,
  managePermission: string
): (req: PermissionRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = getAgentId(req);

      if (!agentId) {
        res.status(401).json({
          success: false,
          error: '未提供认证信息'
        });
        return;
      }

      permissionManager.init();

      if (permissionManager.isAdmin(agentId)) {
        req.permissions = { agentId, isAdmin: true, isOwner: false, passed: true };
        next();
        return;
      }

      if (managePermission && permissionManager.hasPermission(agentId, managePermission)) {
        req.permissions = { agentId, isAdmin: false, isOwner: false, passed: true };
        next();
        return;
      }

      const ownerId = await getResourceOwnerId(req);

      if (ownerId && ownerId === agentId) {
        req.permissions = { agentId, isAdmin: false, isOwner: true, passed: true };
        next();
        return;
      }

      res.status(403).json({
        success: false,
        error: '无权访问此资源'
      });
    } catch (error) {
      console.error('[Permission Middleware] 所有权检查失败:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

export const PermissionCheck = {
  check(agentId: string, permissionId: string): boolean {
    permissionManager.init();
    return permissionManager.hasPermission(agentId, permissionId);
  },

  checkAny(agentId: string, permissionIds: string[]): boolean {
    permissionManager.init();
    return permissionManager.hasAnyPermission(agentId, permissionIds);
  },

  checkAll(agentId: string, permissionIds: string[]): boolean {
    permissionManager.init();
    return permissionManager.hasAllPermissions(agentId, permissionIds);
  },

  checkAdmin(agentId: string): boolean {
    permissionManager.init();
    return permissionManager.isAdmin(agentId);
  },

  getPermissions(agentId: string): any[] {
    permissionManager.init();
    return permissionManager.getAgentPermissions(agentId);
  },

  getRoles(agentId: string): any[] {
    permissionManager.init();
    return permissionManager.getAgentRoles(agentId);
  }
};