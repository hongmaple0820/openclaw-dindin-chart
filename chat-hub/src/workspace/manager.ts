/**
 * 工作区管理器 - .fengLin 目录系统
 * 支持群聊/私聊/任务独立工作区
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import { Database } from 'better-sqlite3';

interface WorkspaceManagerConfig {
  rootDir?: string;
  defaultWorkspace?: string;
}

interface WorkspaceOptions {
  name?: string;
  type?: 'default' | 'group' | 'private' | 'task' | 'custom';
  ownerId?: string;
  groupId?: string;
  taskId?: string;
  path?: string;
  autoCleanup?: boolean;
  cleanupAfterDays?: number;
  maxSize?: number;
}

interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
  owner_id?: string;
  group_id?: string;
  task_id?: string;
  auto_cleanup: number;
  cleanup_after_days?: number;
  max_size?: number;
  created_at: number;
  last_accessed?: number;
  file_count?: number;
  total_size?: number;
}

interface FileInfo {
  name: string;
  type: 'directory' | 'file';
  path: string;
}

class WorkspaceManager {
  private db: Database;
  private config: {
    rootDir: string;
    defaultWorkspace: string;
  };

  constructor(db: Database, config: WorkspaceManagerConfig = {}) {
    this.db = db;
    this.config = {
      rootDir: config.rootDir || path.join(process.env.HOME || '', '.fengLin'),
      defaultWorkspace: config.defaultWorkspace || 'default',
      ...config
    };
  }

  async init(): Promise<void> {
    // 确保根目录存在
    await fse.ensureDir(this.config.rootDir);
    
    // 创建默认工作区
    await this._ensureDefaultWorkspace();
    
    console.log('[WorkspaceManager] 初始化完成');
  }

  /**
   * 确保默认工作区存在
   */
  private async _ensureDefaultWorkspace(): Promise<void> {
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
  async create(options: WorkspaceOptions = {}): Promise<Workspace> {
    const id = uuidv4();
    const type = options.type || 'custom';
    
    // 确定路径
    let workspacePath: string;
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

    const workspace: Workspace = {
      id,
      name: options.name || `工作区-${id.slice(0, 8)}`,
      path: workspacePath,
      type,
      owner_id: options.ownerId,
      group_id: options.groupId,
      task_id: options.taskId,
      auto_cleanup: options.autoCleanup ? 1 : 0,
      cleanup_after_days: options.cleanupAfterDays,
      max_size: options.maxSize,
      created_at: Date.now()
    };

    this.db.prepare(`
      INSERT INTO workspaces (
        id, name, path, type, owner_id, group_id, task_id,
        auto_cleanup, cleanup_after_days, max_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspace.id, workspace.name, workspace.path, workspace.type,
      workspace.owner_id, workspace.group_id, workspace.task_id,
      workspace.auto_cleanup, workspace.cleanup_after_days,
      workspace.max_size, workspace.created_at
    );

    // 创建标准子目录
    await this._createStandardDirs(workspacePath);

    return workspace;
  }

  /**
   * 创建标准子目录
   */
  private async _createStandardDirs(workspacePath: string): Promise<void> {
    const dirs = ['docs', 'temp', 'output', 'logs'];
    for (const dir of dirs) {
      await fse.ensureDir(path.join(workspacePath, dir));
    }
  }

  /**
   * 获取工作区
   */
  async get(workspaceId: string): Promise<Workspace | undefined> {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId) as Workspace | undefined;
    if (!row) return undefined;

    // 更新最后访问时间
    this.db.prepare('UPDATE workspaces SET last_accessed = ? WHERE id = ?')
      .run(Date.now(), workspaceId);

    return row;
  }

  /**
   * 根据路径获取工作区
   */
  async getByPath(workspacePath: string): Promise<Workspace | undefined> {
    return this.db.prepare('SELECT * FROM workspaces WHERE path = ?').get(workspacePath) as Workspace | undefined;
  }

  /**
   * 获取用户的工作区列表
   */
  async listByOwner(ownerId: string): Promise<Workspace[]> {
    return this.db.prepare(`
      SELECT * FROM workspaces 
      WHERE owner_id = ? OR type = 'default'
      ORDER BY last_accessed DESC
    `).all(ownerId) as Workspace[];
  }

  /**
   * 获取群聊工作区
   */
  async getGroupWorkspace(groupId: string): Promise<Workspace> {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE group_id = ?').get(groupId) as Workspace | undefined;
    
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
  async getPrivateWorkspace(userId: string): Promise<Workspace> {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE type = ? AND owner_id = ?')
      .get('private', userId) as Workspace | undefined;
    
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
  async getTaskWorkspace(taskId: string): Promise<Workspace> {
    let workspace = this.db.prepare('SELECT * FROM workspaces WHERE task_id = ?').get(taskId) as Workspace | undefined;
    
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
  async writeFile(workspaceId: string, relativePath: string, content: string | Buffer): Promise<string> {
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
  async readFile(workspaceId: string, relativePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string | Buffer> {
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
  async listFiles(workspaceId: string, dirPath: string = ''): Promise<FileInfo[]> {
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
  async deleteFile(workspaceId: string, relativePath: string): Promise<void> {
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
  private async _updateFileIndex(workspaceId: string, relativePath: string, fullPath: string): Promise<void> {
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
  private async _calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const content = await fse.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 更新统计
   */
  private async _updateStats(workspaceId: string): Promise<void> {
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
  private async _calculateStats(dirPath: string): Promise<{ fileCount: number; totalSize: number }> {
    let fileCount = 0;
    let totalSize = 0;

    const walk = async (dir: string): Promise<void> => {
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
  async cleanupTemp(workspaceId: string, daysOld: number = 2): Promise<number> {
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

export { WorkspaceManager };