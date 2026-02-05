/**
 * 使用统计模块 (Usage Analytics)
 * 
 * 功能：匿名统计软件使用情况，帮助作者了解项目影响力
 * 
 * 收集的信息：
 * - 安装 ID（随机生成，不关联个人身份）
 * - 软件版本
 * - 操作系统类型
 * - Node.js 版本
 * - 启动次数
 * - 活跃天数
 * 
 * 不收集的信息：
 * - IP 地址（不记录）
 * - 用户名/密码
 * - 消息内容
 * - 任何业务数据
 * 
 * 禁用方法：
 * 在 config/local.json 中设置 "analytics": { "enabled": false }
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Analytics {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;  // 默认启用
    this.endpoint = config.endpoint || 'https://analytics.example.com/v1/collect';
    this.projectId = 'openclaw-dindin-chart';
    this.version = require('../package.json').version || '0.0.0';
    
    // 安装 ID 存储路径
    this.idPath = path.join(os.homedir(), '.openclaw', '.analytics-id');
    this.installId = this.getOrCreateInstallId();
  }

  /**
   * 获取或创建安装 ID
   */
  getOrCreateInstallId() {
    try {
      if (fs.existsSync(this.idPath)) {
        return fs.readFileSync(this.idPath, 'utf-8').trim();
      }
      
      // 生成随机 ID
      const id = crypto.randomBytes(16).toString('hex');
      fs.mkdirSync(path.dirname(this.idPath), { recursive: true });
      fs.writeFileSync(this.idPath, id);
      return id;
    } catch (err) {
      // 如果无法创建文件，使用临时 ID
      return 'temp-' + crypto.randomBytes(8).toString('hex');
    }
  }

  /**
   * 记录启动事件
   */
  async trackStartup() {
    if (!this.enabled) return;

    const data = {
      event: 'startup',
      installId: this.installId,
      projectId: this.projectId,
      version: this.version,
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch()
      },
      node: process.version,
      timestamp: new Date().toISOString()
    };

    await this.send(data);
  }

  /**
   * 记录每日活跃
   */
  async trackDaily() {
    if (!this.enabled) return;

    const today = new Date().toISOString().split('T')[0];
    const statePath = path.join(os.homedir(), '.openclaw', '.analytics-daily');
    
    try {
      // 检查今天是否已经记录
      if (fs.existsSync(statePath)) {
        const lastDate = fs.readFileSync(statePath, 'utf-8').trim();
        if (lastDate === today) return;  // 今天已记录
      }
      
      // 记录今天
      fs.writeFileSync(statePath, today);
      
      const data = {
        event: 'daily_active',
        installId: this.installId,
        projectId: this.projectId,
        version: this.version,
        date: today
      };

      await this.send(data);
    } catch (err) {
      // 静默失败
    }
  }

  /**
   * 发送统计数据
   */
  async send(data) {
    if (!this.enabled) return;

    try {
      // 使用 fetch 或 axios 发送
      // 这里用简单的 http 请求
      const https = require('https');
      const url = new URL(this.endpoint);
      
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000  // 5 秒超时
      };

      const req = https.request(options, (res) => {
        // 静默处理响应
      });

      req.on('error', (err) => {
        // 静默失败，不影响主程序
      });

      req.setTimeout(5000, () => {
        req.destroy();
      });

      req.write(postData);
      req.end();
    } catch (err) {
      // 统计失败不应影响主程序
    }
  }

  /**
   * 获取统计摘要（本地）
   */
  getLocalStats() {
    return {
      installId: this.installId,
      version: this.version,
      platform: os.platform(),
      enabled: this.enabled
    };
  }
}

module.exports = Analytics;
