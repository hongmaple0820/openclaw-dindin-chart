const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const PID_FILE = path.join(CHAT_HUB_PATH, '.pid');
const LOG_FILE = path.join(CHAT_HUB_PATH, 'chat-hub.log');

class Runner {
  constructor() {
    this.serviceName = 'chat-hub';
  }

  async start(options = {}) {
    const background = options.background !== false;
    const withLog = options.log || false;

    console.log('\n🚀 启动 Chat-Hub...');

    if (this.isRunning()) {
      console.log('\n⚠️ 服务已在运行中');
      return this.status();
    }

    const startScript = path.join(CHAT_HUB_PATH, 'start.sh');
    const startDevScript = path.join(CHAT_HUB_PATH, 'start-dev.sh');

    let command;
    if (fs.existsSync(startDevScript)) {
      command = withLog ? startDevScript : `node "${path.join(CHAT_HUB_PATH, 'src', 'index.js')}"`;
    } else if (fs.existsSync(startScript)) {
      command = startScript;
    } else {
      command = `node "${path.join(CHAT_HUB_PATH, 'src', 'index.js')}"`;
    }

    console.log(`执行命令: ${command}`);

    return new Promise((resolve) => {
      if (background) {
        const child = spawn(command, [], {
          cwd: CHAT_HUB_PATH,
          detached: true,
          stdio: ['ignore', 'fs', 'fs']
        });

        const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);

        child.unref();

        fs.writeFileSync(PID_FILE, child.pid.toString());

        setTimeout(() => {
          if (this.isRunning()) {
            console.log('\n✅ 服务已启动');
            console.log(`📝 日志文件: ${LOG_FILE}`);
            resolve(this.status());
          } else {
            console.log('\n❌ 服务启动失败');
            resolve({ success: false, error: '服务启动后立即退出' });
          }
        }, 2000);
      } else {
        const child = spawn(command, [], {
          cwd: CHAT_HUB_PATH,
          stdio: 'inherit'
        });

        child.on('close', (code) => {
          console.log(`\n服务已退出，退出码: ${code}`);
        });
      }
    });
  }

  async stop() {
    console.log('\n🛑 停止 Chat-Hub...');

    if (!this.isRunning()) {
      console.log('\n⚠️ 服务未在运行');
      return { success: true, message: '服务未运行' };
    }

    const pid = this.getPid();

    try {
      if (process.platform === 'win32') {
        exec(`taskkill /PID ${pid} /F`, (error) => {
          this.cleanup();
          console.log('\n✅ 服务已停止');
          return { success: true };
        });
      } else {
        process.kill(pid, 'SIGTERM');

        setTimeout(() => {
          if (this.isRunning()) {
            process.kill(pid, 'SIGKILL');
          }
          this.cleanup();
          console.log('\n✅ 服务已停止');
        }, 3000);

        return { success: true };
      }
    } catch (e) {
      this.cleanup();
      console.log('\n⚠️ 无法正常停止，强制清理');
      return { success: true, message: '强制清理完成' };
    }
  }

  async restart() {
    console.log('\n🔄 重启 Chat-Hub...');

    await this.stop();

    await new Promise(resolve => setTimeout(resolve, 2000));

    return await this.start();
  }

  async status() {
    console.log('\n📊 服务状态:');

    const isRunning = this.isRunning();

    if (isRunning) {
      const pid = this.getPid();
      console.log(`  🟢 运行中`);
      console.log(`  PID: ${pid}`);

      const port = this.getPort();
      console.log(`  端口: ${port}`);
      console.log(`  访问: http://localhost:${port}`);

      return {
        running: true,
        pid,
        port,
        success: true
      };
    } else {
      console.log(`  🔴 未运行`);

      const pidFileExists = fs.existsSync(PID_FILE);
      if (pidFileExists) {
        console.log(`  ⚠️ PID 文件存在但进程未运行，建议清理`);
      }

      return {
        running: false,
        success: true
      };
    }
  }

  async getLogs(lines = 50) {
    console.log(`\n📜 最近 ${lines} 行日志:`);
    console.log('═'.repeat(50));

    if (!fs.existsSync(LOG_FILE)) {
      console.log('日志文件不存在');
      return { success: false, error: '日志文件不存在' };
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.split('\n');
    const recentLines = allLines.slice(-lines);

    console.log(recentLines.join('\n'));

    return { success: true, lines: recentLines };
  }

  isRunning() {
    if (!fs.existsSync(PID_FILE)) {
      return false;
    }

    const pid = this.getPid();
    if (!pid) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      this.cleanup();
      return false;
    }
  }

  getPid() {
    try {
      return parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
    } catch (e) {
      return null;
    }
  }

  getPort() {
    try {
      const configPath = path.join(CHAT_HUB_PATH, 'config', 'local.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config.server?.port || 3000;
      }
    } catch (e) {}
    return 3000;
  }

  cleanup() {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch (e) {}
  }
}

async function runStart(args) {
  const options = {
    background: !args.includes('--foreground'),
    log: args.includes('--log')
  };

  const runner = new Runner();
  return await runner.start(options);
}

async function runStop(args) {
  const runner = new Runner();
  return await runner.stop();
}

async function runRestart(args) {
  const runner = new Runner();
  return await runner.restart();
}

async function runStatus(args) {
  const runner = new Runner();
  return await runner.status();
}

async function runLogs(args) {
  const lines = args.includes('--lines') ? parseInt(args[args.indexOf('--lines') + 1]) : 50;

  const runner = new Runner();
  return await runner.getLogs(lines);
}

module.exports = { Runner, runStart, runStop, runRestart, runStatus, runLogs };
