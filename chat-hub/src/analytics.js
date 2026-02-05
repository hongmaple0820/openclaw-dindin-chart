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
 * 
 * 统计服务使用 CountAPI (免费开源)
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

class Analytics {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;  // 默认启用
    this.projectId = 'openclaw-dindin-chart';
    this.namespace = 'hongmaple';
    this.version = '1.0.0';
    
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
   * 使用 CountAPI 记录启动次数 (免费开源服务)
   * https://countapi.xyz/
   */
  async trackStartup() {
    if (!this.enabled) return;

    try {
      // CountAPI - 免费的计数服务
      const url = `https://api.countapi.xyz/hit/${this.namespace}/${this.projectId}-startup`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.value) {
              console.log(`[Analytics] 全球第 ${result.value} 次启动`);
            }
          } catch (e) {}
        });
      }).on('error', () => {});
      
    } catch (err) {
      // 统计失败不影响主程序
    }
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
      
      // CountAPI 记录每日活跃
      const url = `https://api.countapi.xyz/hit/${this.namespace}/${this.projectId}-daily`;
      https.get(url, () => {}).on('error', () => {});
      
    } catch (err) {
      // 静默失败
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

  /**
   * 获取全局统计（从 CountAPI）
   */
  async getGlobalStats() {
    return new Promise((resolve) => {
      const url = `https://api.countapi.xyz/get/${this.namespace}/${this.projectId}-startup`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ totalStartups: result.value || 0 });
          } catch (e) {
            resolve({ totalStartups: 0 });
          }
        });
      }).on('error', () => {
        resolve({ totalStartups: 0 });
      });
    });
  }
}

module.exports = Analytics;
