/**
 * 权限管理服务
 * 
 * 功能：
 * - 权限检查
 * - 角色管理
 * - 权限分配
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class PermissionManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * 初始化数据库连接
   */
  init() {
    if (this.initialized) return;

    // 使用与 message-store 相同的数据目录
    const storeDir = path.join(process.env.HOME, '.openclaw', 'chat-data');
    const dbPath = path.join(storeDir, 'messages.db');

    // 确保目录存在
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }

    // 连接到现有的数据库
    this.db = new Database(dbPath, {
      timeout: 10000
    });

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 10000');

    // 运行迁移
    this.runMigrations();

    this.initialized = true;
    console.log('[PermissionManager] 初始化完成');
  }

  /**
   * 运行数据库迁移
   */
  runMigrations() {
    // 检查表是否存在
    const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='permissions'
    `).get();

    if (!tableExists) {
      console.log('[PermissionManager] 创建权限系统表...');
      
      // 创建表
      this.db.exec(`
        -- 权限表
        CREATE TABLE IF NOT EXISTS permissions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );

        -- 角色表
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          is_system INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );

        -- 角色-权限关联表
        CREATE TABLE IF NOT EXISTS role_permissions (
          role_id TEXT NOT NULL,
          permission_id TEXT NOT NULL,
          PRIMARY KEY (role_id, permission_id),
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        );

        -- Agent-角色关联表
        CREATE TABLE IF NOT EXISTS agent_roles (
          agent_id TEXT NOT NULL,
          role_id TEXT NOT NULL,
          assigned_by TEXT,
          assigned_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          PRIMARY KEY (agent_id, role_id),
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        );

        -- 索引
        CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
        CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
        CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
        CREATE INDEX IF NOT EXISTS idx_agent_roles_agent ON agent_roles(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_roles_role ON agent_roles(role_id);
      `);

      // 初始化默认数据
      this.initDefaultData();
    }
  }

  /**
   * 初始化默认权限和角色
   */
  initDefaultData() {
    const now = Date.now();

    // 插入默认权限
    const insertPermission = this.db.prepare(`
      INSERT OR IGNORE INTO permissions (id, name, category, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const permissions = [
      ['plugin:read', '查看插件', 'plugin', '查看插件列表和详情', now],
      ['plugin:write', '管理插件', 'plugin', '创建、更新、删除插件', now],
      ['agent:read', '查看 Agent', 'agent', '查看 Agent 列表和详情', now],
      ['agent:write', '管理 Agent', 'agent', '创建、更新、删除 Agent', now],
      ['channel:read', '查看通道', 'channel', '查看通道列表和详情', now],
      ['channel:write', '管理通道', 'channel', '创建、更新、删除通道', now]
    ];

    for (const perm of permissions) {
      insertPermission.run(...perm);
    }

    // 插入默认角色
    const insertRole = this.db.prepare(`
      INSERT OR IGNORE INTO roles (id, name, is_system, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const roles = [
      ['admin', '管理员', 1, '拥有所有权限', now],
      ['developer', '开发者', 1, '拥有开发权限', now],
      ['viewer', '观察者', 1, '只读权限', now]
    ];

    for (const role of roles) {
      insertRole.run(...role);
    }

    // 插入角色权限关联
    const insertRolePerm = this.db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      VALUES (?, ?)
    `);

    const rolePermissions = [
      // admin 拥有所有权限
      ['admin', 'plugin:read'],
      ['admin', 'plugin:write'],
      ['admin', 'agent:read'],
      ['admin', 'agent:write'],
      ['admin', 'channel:read'],
      ['admin', 'channel:write'],
      // developer 有读取权限
      ['developer', 'plugin:read'],
      ['developer', 'agent:read'],
      ['developer', 'channel:read'],
      // viewer 只有基本读取权限
      ['viewer', 'plugin:read'],
      ['viewer', 'agent:read'],
      ['viewer', 'channel:read']
    ];

    for (const rp of rolePermissions) {
      insertRolePerm.run(...rp);
    }

    console.log('[PermissionManager] 默认权限数据初始化完成');
  }

  // ==================== 权限管理 ====================

  /**
   * 获取所有权限
   */
  listPermissions(options = {}) {
    this.init();

    const { category } = options;
    let sql = 'SELECT * FROM permissions';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY category, id';

    return this.db.prepare(sql).all(...params);
  }

  /**
   * 获取单个权限
   */
  getPermission(id) {
    this.init();
    return this.db.prepare('SELECT * FROM permissions WHERE id = ?').get(id);
  }

  /**
   * 创建权限
   */
  createPermission(data) {
    this.init();

    const { id, name, category, description } = data;
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO permissions (id, name, category, description, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, category || null, description || null, now);

      return this.getPermission(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new Error('权限 ID 已存在');
      }
      throw error;
    }
  }

  /**
   * 删除权限
   */
  deletePermission(id) {
    this.init();

    // 检查是否被角色使用
    const used = this.db.prepare(`
      SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?
    `).get(id);

    if (used.count > 0) {
      throw new Error('权限正在被角色使用，无法删除');
    }

    const result = this.db.prepare('DELETE FROM permissions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==================== 角色管理 ====================

  /**
   * 获取所有角色
   */
  listRoles(options = {}) {
    this.init();

    const { includePermissions = true } = options;

    const roles = this.db.prepare('SELECT * FROM roles ORDER BY name').all();

    if (includePermissions) {
      for (const role of roles) {
        role.permissions = this.getRolePermissions(role.id);
      }
    }

    return roles;
  }

  /**
   * 获取单个角色
   */
  getRole(id) {
    this.init();

    const role = this.db.prepare('SELECT * FROM roles WHERE id = ?').get(id);

    if (role) {
      role.permissions = this.getRolePermissions(id);
    }

    return role;
  }

  /**
   * 获取角色的权限列表
   */
  getRolePermissions(roleId) {
    this.init();

    return this.db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.id
    `).all(roleId);
  }

  /**
   * 创建角色
   */
  createRole(data) {
    this.init();

    const { id, name, description, permissions = [] } = data;
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO roles (id, name, description, is_system, created_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(id, name, description || null, now);

      // 添加权限
      if (permissions.length > 0) {
        this.updateRolePermissions(id, permissions);
      }

      return this.getRole(id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new Error('角色 ID 已存在');
      }
      throw error;
    }
  }

  /**
   * 更新角色
   */
  updateRole(id, data) {
    this.init();

    const role = this.getRole(id);
    if (!role) {
      throw new Error('角色不存在');
    }

    if (role.is_system) {
      throw new Error('系统角色不能修改');
    }

    const { name, description } = data;
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

    if (updates.length > 0) {
      params.push(id);
      this.db.prepare(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return this.getRole(id);
  }

  /**
   * 更新角色权限
   */
  updateRolePermissions(roleId, permissionIds) {
    this.init();

    const role = this.getRole(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    if (role.is_system) {
      throw new Error('系统角色不能修改权限');
    }

    // 验证权限是否存在
    for (const permId of permissionIds) {
      const perm = this.getPermission(permId);
      if (!perm) {
        throw new Error(`权限不存在: ${permId}`);
      }
    }

    // 删除旧权限
    this.db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);

    // 添加新权限
    const insertPerm = this.db.prepare(`
      INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)
    `);

    for (const permId of permissionIds) {
      insertPerm.run(roleId, permId);
    }

    return this.getRole(roleId);
  }

  /**
   * 删除角色
   */
  deleteRole(id) {
    this.init();

    const role = this.getRole(id);
    if (!role) {
      return false;
    }

    if (role.is_system) {
      throw new Error('系统角色不能删除');
    }

    // 删除角色权限关联
    this.db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);

    // 删除 Agent 角色关联
    this.db.prepare('DELETE FROM agent_roles WHERE role_id = ?').run(id);

    // 删除角色
    const result = this.db.prepare('DELETE FROM roles WHERE id = ?').run(id);

    return result.changes > 0;
  }

  // ==================== Agent 角色管理 ====================

  /**
   * 获取 Agent 的角色
   */
  getAgentRoles(agentId) {
    this.init();

    const roles = this.db.prepare(`
      SELECT r.*, ar.assigned_by, ar.assigned_at
      FROM roles r
      JOIN agent_roles ar ON r.id = ar.role_id
      WHERE ar.agent_id = ?
      ORDER BY r.name
    `).all(agentId);

    // 为每个角色添加权限
    for (const role of roles) {
      role.permissions = this.getRolePermissions(role.id);
    }

    return roles;
  }

  /**
   * 为 Agent 分配角色
   */
  assignRoleToAgent(agentId, roleId, assignedBy = null) {
    this.init();

    // 检查角色是否存在
    const role = this.getRole(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO agent_roles (agent_id, role_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, ?)
      `).run(agentId, roleId, assignedBy, now);

      return this.getAgentRoles(agentId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 移除 Agent 的角色
   */
  removeRoleFromAgent(agentId, roleId) {
    this.init();

    const result = this.db.prepare(`
      DELETE FROM agent_roles WHERE agent_id = ? AND role_id = ?
    `).run(agentId, roleId);

    return result.changes > 0;
  }

  /**
   * 设置 Agent 的角色（替换所有）
   */
  setAgentRoles(agentId, roleIds, assignedBy = null) {
    this.init();

    // 验证所有角色
    for (const roleId of roleIds) {
      const role = this.getRole(roleId);
      if (!role) {
        throw new Error(`角色不存在: ${roleId}`);
      }
    }

    // 删除旧角色
    this.db.prepare('DELETE FROM agent_roles WHERE agent_id = ?').run(agentId);

    // 添加新角色
    const now = Date.now();
    const insertRole = this.db.prepare(`
      INSERT INTO agent_roles (agent_id, role_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const roleId of roleIds) {
      insertRole.run(agentId, roleId, assignedBy, now);
    }

    return this.getAgentRoles(agentId);
  }

  // ==================== 权限检查 ====================

  /**
   * 获取 Agent 的所有权限（合并所有角色的权限）
   */
  getAgentPermissions(agentId) {
    this.init();

    const permissions = this.db.prepare(`
      SELECT DISTINCT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN agent_roles ar ON rp.role_id = ar.role_id
      WHERE ar.agent_id = ?
      ORDER BY p.category, p.id
    `).all(agentId);

    return permissions;
  }

  /**
   * 检查 Agent 是否有指定权限
   */
  hasPermission(agentId, permissionId) {
    this.init();

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM agent_roles ar
      JOIN role_permissions rp ON ar.role_id = rp.role_id
      WHERE ar.agent_id = ? AND rp.permission_id = ?
    `).get(agentId, permissionId);

    return result.count > 0;
  }

  /**
   * 检查 Agent 是否有任一权限
   */
  hasAnyPermission(agentId, permissionIds) {
    this.init();

    if (!permissionIds || permissionIds.length === 0) {
      return false;
    }

    const placeholders = permissionIds.map(() => '?').join(',');
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM agent_roles ar
      JOIN role_permissions rp ON ar.role_id = rp.role_id
      WHERE ar.agent_id = ? AND rp.permission_id IN (${placeholders})
    `).get(agentId, ...permissionIds);

    return result.count > 0;
  }

  /**
   * 检查 Agent 是否有所有权限
   */
  hasAllPermissions(agentId, permissionIds) {
    this.init();

    if (!permissionIds || permissionIds.length === 0) {
      return true;
    }

    for (const permId of permissionIds) {
      if (!this.hasPermission(agentId, permId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查 Agent 是否是管理员
   */
  isAdmin(agentId) {
    this.init();

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM agent_roles
      WHERE agent_id = ? AND role_id = 'admin'
    `).get(agentId);

    return result.count > 0;
  }

  /**
   * 获取有指定权限的所有 Agent
   */
  getAgentsWithPermission(permissionId) {
    this.init();

    return this.db.prepare(`
      SELECT DISTINCT ar.agent_id
      FROM agent_roles ar
      JOIN role_permissions rp ON ar.role_id = rp.role_id
      WHERE rp.permission_id = ?
    `).all(permissionId).map(r => r.agent_id);
  }

  /**
   * 获取有指定角色的所有 Agent
   */
  getAgentsWithRole(roleId) {
    this.init();

    return this.db.prepare(`
      SELECT agent_id FROM agent_roles WHERE role_id = ?
    `).all(roleId).map(r => r.agent_id);
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  getStats() {
    this.init();

    const permissionCount = this.db.prepare('SELECT COUNT(*) as count FROM permissions').get().count;
    const roleCount = this.db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
    const agentRoleCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_roles').get().count;

    const agentsWithRoles = this.db.prepare(`
      SELECT COUNT(DISTINCT agent_id) as count FROM agent_roles
    `).get().count;

    return {
      permissions: permissionCount,
      roles: roleCount,
      agentRoleAssignments: agentRoleCount,
      agentsWithRoles
    };
  }
}

// 单例
const permissionManager = new PermissionManager();

module.exports = permissionManager;
