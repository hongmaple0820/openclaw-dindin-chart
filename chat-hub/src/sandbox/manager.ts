/**
 * 沙箱管理器 - 虚拟隔离执行环境
 * 支持 Docker 容器，资源限制，GPU 支持
 */

import { v4 as uuidv4 } from 'uuid';
import { spawn, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface SandboxConfig {
  defaultImage?: string;
  defaultCpuLimit?: number;
  defaultMemoryLimit?: number;
  defaultDiskLimit?: number;
  enableGpu?: boolean;
  dockerPath?: string;
}

interface CreateSandboxOptions {
  name?: string;
  sessionId?: string;
  taskId?: string;
  image?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  diskLimit?: number;
  gpuEnabled?: boolean;
  networkEnabled?: boolean;
  allowedHosts?: string[];
  environmentVars?: Record<string, string>;
  mounts?: { source: string; target: string }[];
}

interface Sandbox {
  id: string;
  name: string;
  sessionId?: string;
  taskId?: string;
  image: string;
  cpuLimit: number;
  memoryLimit: number;
  diskLimit: number;
  gpuEnabled: boolean;
  networkEnabled: boolean;
  allowedHosts: string[];
  environmentVars: Record<string, string>;
  mounts: { source: string; target: string }[];
  status: string;
  containerId?: string;
  createdAt: number;
}

interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
  duration?: number;
}

interface SandboxOptions {
  name?: string;
  sessionId?: string;
  taskId?: string;
  image?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  diskLimit?: number;
  gpuEnabled?: boolean;
  networkEnabled?: boolean;
  allowedHosts?: string[];
  environmentVars?: Record<string, string>;
  mounts?: { source: string; target: string }[];
}

interface SandboxStatus {
  id: string;
  name: string;
  status: string;
  containerId?: string;
  createdAt: number;
}

class SandboxManager {
  private db: any;
  private config: {
    defaultImage: string;
    defaultCpuLimit: number;
    defaultMemoryLimit: number;
    defaultDiskLimit: number;
    enableGpu: boolean;
    dockerPath: string;
  };
  private activeSandboxes: Map<string, Sandbox>;
  private dockerAvailable: boolean = false;

  constructor(db: any, config: SandboxConfig = {}) {
    this.db = db;
    this.config = {
      defaultImage: config.defaultImage || 'node:20-slim',
      defaultCpuLimit: config.defaultCpuLimit || 1,
      defaultMemoryLimit: config.defaultMemoryLimit || 512,
      defaultDiskLimit: config.defaultDiskLimit || 1024,
      enableGpu: config.enableGpu || false,
      dockerPath: config.dockerPath || 'docker',
      ...config
    };
    this.activeSandboxes = new Map();
  }

  async init(): Promise<void> {
    this.dockerAvailable = await this._checkDocker();
    if (!this.dockerAvailable) {
      console.warn('[SandboxManager] Docker 不可用，沙箱功能将受限');
    }
    console.log('[SandboxManager] 初始化完成');
  }

  async _checkDocker(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('docker --version', (error) => {
        resolve(!error);
      });
    });
  }

  async create(options: CreateSandboxOptions = {}): Promise<Sandbox> {
    const id = uuidv4();
    const sandbox: Sandbox = {
      id,
      name: options.name || `sandbox-${id.slice(0, 8)}`,
      sessionId: options.sessionId,
      taskId: options.taskId,
      image: options.image || this.config.defaultImage,
      cpuLimit: options.cpuLimit || this.config.defaultCpuLimit,
      memoryLimit: options.memoryLimit || this.config.defaultMemoryLimit,
      diskLimit: options.diskLimit || this.config.defaultDiskLimit,
      gpuEnabled: options.gpuEnabled && this.config.enableGpu || false,
      networkEnabled: options.networkEnabled !== false,
      allowedHosts: options.allowedHosts || [],
      environmentVars: options.environmentVars || {},
      mounts: options.mounts || [],
      status: 'pending',
      createdAt: Date.now()
    };

    this.db.prepare(`
      INSERT INTO sandboxes (
        id, name, session_id, task_id, image, status,
        cpu_limit, memory_limit, disk_limit, gpu_enabled,
        network_enabled, allowed_hosts, environment_vars, mounts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sandbox.id, sandbox.name, sandbox.sessionId, sandbox.taskId,
      sandbox.image, sandbox.status, sandbox.cpuLimit, sandbox.memoryLimit,
      sandbox.diskLimit, sandbox.gpuEnabled ? 1 : 0, sandbox.networkEnabled ? 1 : 0,
      JSON.stringify(sandbox.allowedHosts),
      JSON.stringify(sandbox.environmentVars),
      JSON.stringify(sandbox.mounts), sandbox.createdAt
    );

    if (this.dockerAvailable) {
      try {
        await this._createContainer(sandbox);
      } catch (error: any) {
        console.error(`[SandboxManager] 创建容器失败:`, error.message);
        sandbox.status = 'error';
      }
    }

    this.activeSandboxes.set(id, sandbox);
    return sandbox;
  }

  async _createContainer(sandbox: Sandbox): Promise<string> {
    const args = [
      'run', '-d',
      '--name', `sandbox-${sandbox.id}`,
      '--cpus', String(sandbox.cpuLimit),
      '--memory', `${sandbox.memoryLimit}m`,
      '--network', sandbox.networkEnabled ? 'bridge' : 'none',
    ];

    if (sandbox.gpuEnabled) {
      args.push('--gpus', 'all');
    }

    for (const [key, value] of Object.entries(sandbox.environmentVars)) {
      args.push('-e', `${key}=${value}`);
    }

    for (const mount of sandbox.mounts) {
      args.push('-v', `${mount.source}:${mount.target}`);
    }

    args.push(sandbox.image);
    args.push('tail', '-f', '/dev/null');

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.dockerPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => stdout += data);
      proc.stderr.on('data', (data) => stderr += data);

      proc.on('close', (code) => {
        if (code === 0) {
          sandbox.containerId = stdout.trim();
          sandbox.status = 'running';
          this._updateSandbox(sandbox);
          resolve(sandbox.containerId!);
        } else {
          reject(new Error(stderr || 'Docker 创建失败'));
        }
      });
    });
  }

  async execute(sandboxId: string, code: string, language: 'javascript' | 'js' | 'python' | 'shell' | 'bash' = 'javascript'): Promise<ExecutionResult> {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');
    if (sandbox.status !== 'running') throw new Error('沙箱未运行');

    const startTime = Date.now();
    
    this._log(sandboxId, 'info', 'system', `执行 ${language} 代码`);

    const result = await this._execInContainer(sandbox.containerId!, code, language);
    
    const duration = Date.now() - startTime;
    
    this.db.prepare('UPDATE sandboxes SET last_activity = ? WHERE id = ?')
      .run(Date.now(), sandboxId);

    return {
      ...result,
      duration
    };
  }

  async _execInContainer(containerId: string, code: string, language: string): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      let cmd: string[];
      switch (language) {
        case 'javascript':
        case 'js':
          cmd = ['exec', containerId, 'node', '-e', code];
          break;
        case 'python':
          cmd = ['exec', containerId, 'python3', '-c', code];
          break;
        case 'shell':
        case 'bash':
          cmd = ['exec', containerId, 'bash', '-c', code];
          break;
        default:
          return reject(new Error(`不支持的语言: ${language}`));
      }

      const proc = spawn(this.config.dockerPath, cmd);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => stdout += data);
      proc.stderr.on('data', (data) => stderr += data);

      proc.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          success: code === 0
        });
      });
    });
  }

  async get(sandboxId: string): Promise<Sandbox | null> {
    const row = this.db.prepare('SELECT * FROM sandboxes WHERE id = ?').get(sandboxId);
    if (!row) return null;
    
    return {
      ...row,
      allowed_hosts: JSON.parse(row.allowed_hosts || '[]'),
      environment_vars: JSON.parse(row.environment_vars || '{}'),
      mounts: JSON.parse(row.mounts || '[]')
    };
  }

  async stop(sandboxId: string): Promise<void> {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');

    if (sandbox.containerId) {
      await new Promise<void>((resolve) => {
        exec(`docker stop ${sandbox.containerId}`, () => resolve());
      });
    }

    this.db.prepare('UPDATE sandboxes SET status = ?, stopped_at = ? WHERE id = ?')
      .run('stopped', Date.now(), sandboxId);
    
    this.activeSandboxes.delete(sandboxId);
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');

    if (sandbox.containerId) {
      await new Promise<void>((resolve) => {
        exec(`docker rm -f ${sandbox.containerId}`, () => resolve());
      });
    }

    this.db.prepare('DELETE FROM sandboxes WHERE id = ?').run(sandboxId);
    this.activeSandboxes.delete(sandboxId);
  }

  _updateSandbox(sandbox: Sandbox): void {
    this.db.prepare(`
      UPDATE sandboxes SET 
        container_id = ?, status = ?, last_activity = ?
      WHERE id = ?
    `).run(sandbox.containerId, sandbox.status, Date.now(), sandbox.id);
  }

  _log(sandboxId: string, level: string, source: string, message: string): void {
    this.db.prepare(`
      INSERT INTO sandbox_logs (id, sandbox_id, level, source, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), sandboxId, level, source, message, Date.now());
  }

  async cleanupExpired(): Promise<number> {
    const expired = this.db.prepare(`
      SELECT id, container_id FROM sandboxes 
      WHERE expires_at IS NOT NULL AND expires_at < ? AND status = 'running'
    `).all(Date.now());

    for (const sandbox of expired) {
      await this.stop(sandbox.id);
      console.log(`[SandboxManager] 已停止过期沙箱: ${sandbox.id}`);
    }

    return expired.length;
  }

  async list(options: any = {}): Promise<Sandbox[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const status = options.status;

    let sql = 'SELECT * FROM sandboxes';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => ({
      ...row,
      allowed_hosts: JSON.parse(row.allowed_hosts || '[]'),
      environment_vars: JSON.parse(row.environment_vars || '{}'),
      mounts: JSON.parse(row.mounts || '[]')
    }));
  }

  async executeCode(sandboxId: string, language: string, code: string): Promise<ExecutionResult> {
    return this.execute(sandboxId, code, language as any);
  }

  async getStats(): Promise<{ total: number; byStatus: Record<string, number> }> {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM sandboxes').get() as { count: number };
    const byStatus = this.db.prepare('SELECT status, COUNT(*) as count FROM sandboxes GROUP BY status').all() as { status: string; count: number }[];

    return {
      total: total.count,
      byStatus: byStatus.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export { SandboxManager, SandboxOptions, SandboxStatus };