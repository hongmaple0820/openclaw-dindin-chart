/**
 * 沙箱管理器 - 虚拟隔离执行环境
 * 支持 Docker 容器，资源限制，GPU 支持
 */

const { v4: uuidv4 } = require('uuid');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class SandboxManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      defaultImage: 'node:20-slim',
      defaultCpuLimit: 1,
      defaultMemoryLimit: 512, // MB
      defaultDiskLimit: 1024, // MB
      enableGpu: false,
      dockerPath: 'docker',
      ...config
    };
    this.activeSandboxes = new Map();
  }

  async init() {
    // 检查 Docker 是否可用
    this.dockerAvailable = await this._checkDocker();
    if (!this.dockerAvailable) {
      console.warn('[SandboxManager] Docker 不可用，沙箱功能将受限');
    }
    console.log('[SandboxManager] 初始化完成');
  }

  /**
   * 检查 Docker 是否可用
   */
  async _checkDocker() {
    return new Promise((resolve) => {
      exec('docker --version', (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * 创建沙箱
   */
  async create(options = {}) {
    const id = uuidv4();
    const sandbox = {
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

    // 插入数据库
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

    // 如果 Docker 可用，创建容器
    if (this.dockerAvailable) {
      try {
        await this._createContainer(sandbox);
      } catch (error) {
        console.error(`[SandboxManager] 创建容器失败:`, error.message);
        sandbox.status = 'error';
      }
    }

    this.activeSandboxes.set(id, sandbox);
    return sandbox;
  }

  /**
   * 创建 Docker 容器
   */
  async _createContainer(sandbox) {
    const args = [
      'run', '-d',
      '--name', `sandbox-${sandbox.id}`,
      '--cpus', String(sandbox.cpuLimit),
      '--memory', `${sandbox.memoryLimit}m`,
      '--network', sandbox.networkEnabled ? 'bridge' : 'none',
    ];

    // GPU 支持
    if (sandbox.gpuEnabled) {
      args.push('--gpus', 'all');
    }

    // 环境变量
    for (const [key, value] of Object.entries(sandbox.environmentVars)) {
      args.push('-e', `${key}=${value}`);
    }

    // 挂载
    for (const mount of sandbox.mounts) {
      args.push('-v', `${mount.source}:${mount.target}`);
    }

    args.push(sandbox.image);
    args.push('tail', '-f', '/dev/null'); // 保持容器运行

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
          resolve(sandbox.containerId);
        } else {
          reject(new Error(stderr || 'Docker 创建失败'));
        }
      });
    });
  }

  /**
   * 执行代码
   */
  async execute(sandboxId, code, language = 'javascript') {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');
    if (sandbox.status !== 'running') throw new Error('沙箱未运行');

    const startTime = Date.now();
    
    // 记录日志
    this._log(sandboxId, 'info', 'system', `执行 ${language} 代码`);

    // 在容器中执行
    const result = await this._execInContainer(sandbox.containerId, code, language);
    
    const duration = Date.now() - startTime;
    
    // 更新活动时间
    this.db.prepare('UPDATE sandboxes SET last_activity = ? WHERE id = ?')
      .run(Date.now(), sandboxId);

    return {
      ...result,
      duration
    };
  }

  /**
   * 在容器中执行命令
   */
  async _execInContainer(containerId, code, language) {
    return new Promise((resolve, reject) => {
      let cmd;
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
          exitCode: code,
          stdout,
          stderr,
          success: code === 0
        });
      });
    });
  }

  /**
   * 获取沙箱
   */
  async get(sandboxId) {
    const row = this.db.prepare('SELECT * FROM sandboxes WHERE id = ?').get(sandboxId);
    if (!row) return null;
    
    return {
      ...row,
      allowed_hosts: JSON.parse(row.allowed_hosts || '[]'),
      environment_vars: JSON.parse(row.environment_vars || '{}'),
      mounts: JSON.parse(row.mounts || '[]')
    };
  }

  /**
   * 停止沙箱
   */
  async stop(sandboxId) {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');

    if (sandbox.containerId) {
      await new Promise((resolve) => {
        exec(`docker stop ${sandbox.containerId}`, () => resolve());
      });
    }

    this.db.prepare('UPDATE sandboxes SET status = ?, stopped_at = ? WHERE id = ?')
      .run('stopped', Date.now(), sandboxId);
    
    this.activeSandboxes.delete(sandboxId);
  }

  /**
   * 删除沙箱
   */
  async destroy(sandboxId) {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error('沙箱不存在');

    if (sandbox.containerId) {
      await new Promise((resolve) => {
        exec(`docker rm -f ${sandbox.containerId}`, () => resolve());
      });
    }

    this.db.prepare('DELETE FROM sandboxes WHERE id = ?').run(sandboxId);
    this.activeSandboxes.delete(sandboxId);
  }

  /**
   * 更新沙箱状态
   */
  _updateSandbox(sandbox) {
    this.db.prepare(`
      UPDATE sandboxes SET 
        container_id = ?, status = ?, last_activity = ?
      WHERE id = ?
    `).run(sandbox.containerId, sandbox.status, Date.now(), sandbox.id);
  }

  /**
   * 记录日志
   */
  _log(sandboxId, level, source, message) {
    this.db.prepare(`
      INSERT INTO sandbox_logs (id, sandbox_id, level, source, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), sandboxId, level, source, message, Date.now());
  }

  /**
   * 清理过期沙箱
   */
  async cleanupExpired() {
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
}

module.exports = { SandboxManager };