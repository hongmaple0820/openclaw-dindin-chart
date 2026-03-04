/**
 * 工作区管理器 - .fengLin 目录系统
 * 支持群聊/私聊/任务独立工作区
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

class WorkspaceManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      rootDir: config.rootDir || path.join(process.env.HOME, '.fengLin'),
      defaultWorkspace: 'default',
      ...config
    };
  }

  async init() {
    // 确保根目录存在
    await fse.ensureDir(this.config.rootDir);
    
    // 创建默认工作区
    await this._ensureDefaultWorkspace();
    
    console.log('[WorkspaceManager] 初始化完成');
  }

  /**
   * 确保默认工作区存在
   */
  async _ensureDefaultWorkspace() {
    const defaultPath = path.join(this.config.rootDir, 'default');
    await fse.ensureDir(defaultPath);
    
    // 检查数据库中是否有记录
    const existing = this.db.prepare('SELECT id FROM workspaces WHERE type = ?').get('default');
    if (!existing) {
      this.db.prepare(`
        INSERT INTO workspaces (id, name, path, type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('default', '默认工作区', defaultPath, 'default', Date.now());
    }
  }

  /**
   * 创建工作区
   */
  async create(options = {}) {
    const id = uuidv4();
    const type = options.type || 'custom';
    
    // 确定路径
    let workspacePath;
    switch (type) {
      case 'default':
        workspacePath = path.join(this.config.rootDir, 'default');
        break;
      case 'group':
        workspacePath = path.join(this.config.rootDir, 'groups', options.groupId || id);
        break;
      case 'private':
        workspacePath = path.join(this.config.rootDir, 'private', options.ownerId || id);
        break;
      case 'task':
        workspacePath = path.join(this.config.rootDir, 'tasks', options.taskId || id);
        break;
      default:
        workspacePath = options.path || path.join(this.config.rootDir, 'custom', id);
    }

    // 确保目录存在
    await fse.ensureDir(workspacePath);

    const workspace = {
      id,
      name: options.name || `工作区-${id.slice(0, 8)}`,
      path: workspacePath,
      type,
      ownerId: options.ownerId,
      groupId: options.groupId,
      taskId: options.taskId,
      autoCleanup: options.autoCleanup || false,
      cleanupAfterDays: options.cleanupAfterDays,
      maxSize: options.maxSize,
      createdAt: Date.now()
    };

    this.db.prepare(`
      INSERT INTO workspaces (
        id, name, path, type, owner_id, group_id, task_id,
        auto_cleanup, cleanup_after_days, max_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspace.id, workspace.name, workspace.path, workspace.type,
      workspace.ownerId, workspace.groupId, workspace.taskId,
      workspace.autoCleanup ? 1 : 0, workspace.cleanupAfterDays,
      workspace.maxSize, workspace.createdAt
    );

    // 创建标准子目录
    await this._createStandardDirs(workspacePath);

    return workspace;
  }

  /**
   * 创建标准子目录
   */
  async _createStandardDirs(workspacePath) {
    const dirs = ['docs', 'temp', 'output', 'logs'];
    for (const dir of dirs) {
      await fse.ensureDir(path.join(workspacePath, dir));
    }
  }

  /**
   * 获取工作区
   */
  async get(workspaceId) {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
    if (!row) return null;

    // 更新最后访问时间
    this.db.prepare('UPDATE workspaces SET last_accessed = ? WHERE id = ?')
      .run(Date.now(), workspaceId);

    return row;
  }

  /**
   * 根据路径获取工作区
   */
  async getByPath(workspacePath) {
    return this.db.prepare('SELECT * FROM workspaces WHERE path = ?').get(workspacePath);
  }

  /**
   * 获取用户的工作区列表
   */
  async listByOwner(ownerId) {
    return this.db.prepare(`
      SELECT * FROM workspaces 
      WHERE owner_id = ? OR type = 'default'
      ORDER BY last_accessed DESC
    `).all(ownerId);
  }

  /**
   * 获取群聊工作区
   */
  async getGroupWorkspace(groupId) {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE group_id = ?').get(groupId);
    
    if (!workspace) {
      // 自动创建群聊工作区
      workspace = await this.create({
        type: 'group',
        groupId,
        name: `群聊-${groupId.slice(0, 8)}`
      });
    }

    return workspace;
  }

  /**
   * 获取私聊工作区
   */
  async getPrivateWorkspace(userId) {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE type = ? AND owner_id = ?')
      .get('private', userId);
    
    if (!workspace) {
      workspace = await this.create({
        type: 'private',
        ownerId: userId,
        name: `私聊-${userId.slice(0, 8)}`
      });
    }

    return workspace;
  }

  /**
   * 获取任务工作区
   */
  async getTaskWorkspace(taskId) {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE task_id = ?').get(taskId);
    
    if (!workspace) {
      workspace = await this.create({
        type: 'task',
        taskId,
        name: `任务-${taskId.slice(0, 8)}`
      });
    }

    return workspace;
  }

  /**
   * 写入文件
   */
  async writeFile(workspaceId, relativePath, content) {
    const workspace = await this.get(workspaceId);
    if (!workspace) throw new Error('工作区不存在');

    const fullPath = path.join(workspace.path, relativePath);
    await fse.ensureDir(path.dirname(fullPath));
    
    if (Buffer.isBuffer(content)) {
      await fse.writeFile(fullPath, content);
    } else {
      await fse.writeFile(fullPath, content, 'utf-8');
    }

    // 更新文件索引
    await this._updateFileIndex(workspaceId, relativePath, fullPath);

    // 更新统计
    await this._updateStats(workspaceId);

    return fullPath;
  }

  /**
   * 读取文件
   */
  async readFile(workspaceId, relativePath, encoding = 'utf-8') {
    const workspace = await this.get(workspaceId);
    if (!workspace) throw new Error('工作区不存在');

    const fullPath = path.join(workspace.path, relativePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('文件不存在');
    }

    return fse.readFile(fullPath, encoding);
  }

  /**
   * 列出文件
   */
  async listFiles(workspaceId, dirPath = '') {
    const workspace = await this.get(workspaceId);
    if (!workspace) throw new Error('工作区不存在');

    const fullPath = path.join(workspace.path, dirPath);
    
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const files = await fse.readdir(fullPath, { withFileTypes: true });
    
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, f.name)
    }));
  }

  /**
   * 删除文件
   */
  async deleteFile(workspaceId, relativePath) {
    const workspace = await this.get(workspaceId);
    if (!workspace) throw new Error('工作区不存在');

    const fullPath = path.join(workspace.path, relativePath);
    await fse.remove(fullPath);

    // 删除文件索引
    this.db.prepare('DELETE FROM workspace_files WHERE workspace_id = ? AND relative_path = ?')
      .run(workspaceId, relativePath);

    // 更新统计
    await this._updateStats(workspaceId);
  }

  /**
   * 更新文件索引
   */
  async _updateFileIndex(workspaceId, relativePath, fullPath) {
    const stats = await fse.stat(fullPath);
    const checksum = await this._calculateChecksum(fullPath);

    this.db.prepare(`
      INSERT OR REPLACE INTO workspace_files 
      (id, workspace_id, relative_path, type, size, checksum, modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), workspaceId, relativePath, 
      stats.isDirectory() ? 'directory' : 'file',
      stats.size, checksum, Date.now());
  }

  /**
   * 计算校验和
   */
  async _calculateChecksum(filePath) {
    const crypto = require('crypto');
    const content = await fse.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 更新统计
   */
  async _updateStats(workspaceId) {
    const workspace = await this.get(workspaceId);
    if (!workspace) return;

    const stats = await this._calculateStats(workspace.path);
    
    this.db.prepare(`
      UPDATE workspaces SET file_count = ?, total_size = ? WHERE id = ?
    `).run(stats.fileCount, stats.totalSize, workspaceId);
  }

  /**
   * 计算目录统计
   */
  async _calculateStats(dirPath) {
    let fileCount = 0;
    let totalSize = 0;

    const walk = async (dir) => {
      const files = await fse.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          await walk(fullPath);
        } else {
          fileCount++;
          const stats = await fse.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await walk(dirPath);
    return { fileCount, totalSize };
  }

  /**
   * 清理临时文件
   */
  async cleanupTemp(workspaceId, daysOld = 2) {
    const workspace = await this.get(workspaceId);
    if (!workspace) return 0;

    const tempPath = path.join(workspace.path, 'temp');
    if (!fs.existsSync(tempPath)) return 0;

    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    const files = await fse.readdir(tempPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(tempPath, file.name);
      const stats = await fse.stat(fullPath);
      
      if (stats.mtimeMs < cutoff) {
        await fse.remove(fullPath);
        cleaned++;
      }
    }

    return cleaned;
  }
}

module.exports = { WorkspaceManager };