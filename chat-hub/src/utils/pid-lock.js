const fs = require('fs');
const path = require('path');
const os = require('os');

class PidLock {
  constructor(pidFile) {
    this.pidFile = pidFile || path.join(os.homedir(), '.openclaw/chat-hub.pid');
  }

  async acquire() {
    // 检查 PID 文件是否存在
    if (fs.existsSync(this.pidFile)) {
      const oldPid = parseInt(fs.readFileSync(this.pidFile, 'utf8').trim());
      
      // 检查进程是否还在运行
      let processExists = false;
      try {
        process.kill(oldPid, 0); // 信号 0 只检测，不杀死
        processExists = true; // 如果没抛异常，说明进程存在
      } catch (e) {
        // ESRCH: 进程不存在
        // 其他错误也认为进程不存在
        processExists = false;
      }
      
      if (processExists) {
        throw new Error(`另一个实例正在运行 (PID: ${oldPid})`);
      } else {
        console.log(`[PidLock] 清理陈旧 PID 文件 (PID: ${oldPid})`);
        fs.unlinkSync(this.pidFile);
      }
    }

    // 写入当前 PID
    const pidDir = path.dirname(this.pidFile);
    if (!fs.existsSync(pidDir)) {
      fs.mkdirSync(pidDir, { recursive: true });
    }
    fs.writeFileSync(this.pidFile, process.pid.toString());
    console.log(`[PidLock] 已获取锁 (PID: ${process.pid})`);

    // 退出时清理
    const cleanup = () => this.release();
    process.on('exit', cleanup);
    process.on('SIGINT', () => { this.release(); process.exit(0); });
    process.on('SIGTERM', () => { this.release(); process.exit(0); });
  }

  release() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
        console.log(`[PidLock] 已释放锁`);
      }
    } catch (error) {
      console.error('[PidLock] 释放锁失败:', error.message);
    }
  }
}

module.exports = PidLock;
