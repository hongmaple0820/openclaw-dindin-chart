const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const CONFIG_PATH = path.join(CHAT_HUB_PATH, 'config');

class Diagnoser {
  constructor(options = {}) {
    this.full = options.full || false;
    this.reportPath = options.report || null;
    this.results = [];
  }

  async diagnose() {
    console.log('\n🔍 开始系统诊断...\n');

    await this.checkConfigFiles();
    await this.checkServiceStatus();
    await this.checkPortAvailability();
    await this.checkDependencies();
    if (this.full) {
      await this.checkNetwork();
      await this.checkDiskSpace();
    }

    return this.generateReport();
  }

  async checkConfigFiles() {
    console.log('📁 检查配置文件...');

    const checks = [
      { name: 'default.json', path: path.join(CONFIG_PATH, 'default.json'), required: true },
      { name: 'local.json', path: path.join(CONFIG_PATH, 'local.json'), required: false },
      { name: '.env', path: path.join(CHAT_HUB_PATH, '.env'), required: false },
      { name: 'package.json', path: path.join(CHAT_HUB_PATH, 'package.json'), required: true }
    ];

    for (const check of checks) {
      if (!fs.existsSync(check.path)) {
        this.addResult('config', check.required ? 'error' : 'warning',
          `${check.name} ${check.required ? '缺失' : '不存在'}`,
          check.required ? 'high' : 'low',
          `创建 ${check.name} 或从示例文件复制`);
      } else {
        this.addResult('config', 'pass', `${check.name} 存在`, 'info', null);
      }
    }

    const localConfig = path.join(CONFIG_PATH, 'local.json');
    if (fs.existsSync(localConfig)) {
      try {
        const config = JSON.parse(fs.readFileSync(localConfig, 'utf-8'));
        this.checkFeatureStatus(config);
      } catch (e) {
        this.addResult('config', 'error', `配置文件解析失败: ${e.message}`, 'high', '检查 JSON 格式');
      }
    }
  }

  checkFeatureStatus(config) {
    const webhookConfigured = config.dingtalk?.enabled && 
                              config.dingtalk?.webhookBase && 
                              config.dingtalk?.secret;
    const dingtalkEnabled = config.dingtalk?.enabled !== false;

    this.addResult('feature', webhookConfigured ? 'pass' : 'warning',
      `Webhook 配置: ${webhookConfigured ? '已配置' : '未配置'}`,
      'info',
      webhookConfigured ? null : '配置 webhook 可启用第三方集成功能');

    if (dingtalkEnabled) {
      if (!webhookConfigured) {
        this.addResult('feature', 'warning',
          '功能受限: 第三方集成、机器人自动回复',
          'medium',
          '运行 "openclaw skill chat-hub-config setup" 配置 webhook');
      } else {
        this.addResult('feature', 'pass', '所有功能可用', 'info', null);
      }
    }
  }

  async checkServiceStatus() {
    console.log('🔧 检查服务状态...');

    try {
      const pidFile = path.join(CHAT_HUB_PATH, '.pid');
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
        try {
          process.kill(pid, 0);
          this.addResult('service', 'pass', `服务运行中 (PID: ${pid})`, 'info', null);

          const port = this.getConfigPort();
          await this.checkServiceHealth(port);
        } catch (e) {
          this.addResult('service', 'warning', 'PID 文件存在但进程未运行', 'medium', '删除 PID 文件或重启服务');
        }
      } else {
        this.addResult('service', 'info', '服务未运行', 'low', '运行 "openclaw skill chat-hub-config start" 启动');
      }
    } catch (e) {
      this.addResult('service', 'info', '无法确定服务状态', 'low', null);
    }
  }

  async checkServiceHealth(port) {
    return new Promise((resolve) => {
      const url = `http://localhost:${port}/api/health`;
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          this.addResult('service', 'pass', `服务健康检查通过 (端口: ${port})`, 'info', null);
        } else {
          this.addResult('service', 'warning', `服务返回状态码: ${res.statusCode}`, 'medium', null);
        }
        resolve();
      });

      req.on('error', (e) => {
        if (e.code === 'ECONNREFUSED') {
          this.addResult('service', 'error', '服务拒绝连接', 'high', '检查服务是否正常启动');
        } else if (e.code === 'ETIMEDOUT') {
          this.addResult('service', 'warning', '服务连接超时', 'medium', null);
        }
        resolve();
      });

      req.setTimeout(3000, () => {
        req.destroy();
        this.addResult('service', 'warning', '服务连接超时', 'medium', null);
        resolve();
      });
    });
  }

  async checkPortAvailability() {
    console.log('🔌 检查端口...');

    const port = this.getConfigPort();

    this.addResult('port', 'info', `配置端口: ${port}`, 'info', null);

    const isAvailable = await this.isPortAvailable(port);
    if (!isAvailable) {
      this.addResult('port', 'error', `端口 ${port} 被占用`, 'high', `关闭占用端口的程序或修改配置中的端口`);
    } else {
      this.addResult('port', 'pass', `端口 ${port} 可用`, 'info', null);
    }
  }

  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }

  async checkDependencies() {
    console.log('📦 检查依赖...');

    const requiredDeps = ['express', 'better-sqlite3', 'axios', 'ws', 'uuid'];

    const packageJsonPath = path.join(CHAT_HUB_PATH, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      this.addResult('dependencies', 'error', 'package.json 不存在', 'high', '运行 npm install');
      return;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const dep of requiredDeps) {
        if (deps[dep]) {
          this.addResult('dependencies', 'pass', `${dep} (${deps[dep]})`, 'info', null);
        } else {
          this.addResult('dependencies', 'error', `${dep} 未安装`, 'high', `运行 npm install ${dep}`);
        }
      }

      const nodeModulesPath = path.join(CHAT_HUB_PATH, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        this.addResult('dependencies', 'error', 'node_modules 不存在', 'high', '运行 npm install');
      }
    } catch (e) {
      this.addResult('dependencies', 'error', `解析 package.json 失败: ${e.message}`, 'high', null);
    }
  }

  async checkNetwork() {
    console.log('🌐 检查网络连接...');

    const testUrls = [
      { name: '钉钉 API', url: 'https://oapi.dingtalk.com' },
      { name: 'NPM Registry', url: 'https://registry.npmjs.org' }
    ];

    for (const test of testUrls) {
      await this.testConnection(test.url, test.name);
    }
  }

  testConnection(url, name) {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          this.addResult('network', 'pass', `${name} 可访问`, 'info', null);
        } else {
          this.addResult('network', 'warning', `${name} 返回状态: ${res.statusCode}`, 'medium', null);
        }
        resolve();
      });

      req.on('error', (e) => {
        this.addResult('network', 'error', `${name} 无法访问: ${e.message}`, 'high', '检查网络连接和防火墙');
        resolve();
      });

      req.setTimeout(5000, () => {
        req.destroy();
        this.addResult('network', 'warning', `${name} 连接超时`, 'medium', null);
        resolve();
      });
    });
  }

  async checkDiskSpace() {
    console.log('💾 检查磁盘空间...');

    try {
      const freeSpace = await this.getFreeDiskSpace();
      const threshold = 100 * 1024 * 1024 * 1024;

      if (freeSpace > threshold) {
        this.addResult('system', 'pass', `可用空间: ${(freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`, 'info', null);
      } else {
        this.addResult('system', 'warning', `可用空间不足: ${(freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`, 'medium', '清理磁盘空间');
      }
    } catch (e) {
      this.addResult('system', 'info', '无法获取磁盘空间信息', 'low', null);
    }
  }

  getFreeDiskSpace() {
    return new Promise((resolve) => {
      const drive = process.platform === 'win32' ? 'c:' : '/';
      exec(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace`, (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
          return;
        }
        const match = stdout.match(/(\d+)/);
        resolve(match ? parseInt(match[1]) : null);
      });
    });
  }

  getConfigPort() {
    try {
      const localConfig = path.join(CONFIG_PATH, 'local.json');
      if (fs.existsSync(localConfig)) {
        const config = JSON.parse(fs.readFileSync(localConfig, 'utf-8'));
        return config.server?.port || 3000;
      }
      const defaultConfig = path.join(CONFIG_PATH, 'default.json');
      if (fs.existsSync(defaultConfig)) {
        const config = JSON.parse(fs.readFileSync(defaultConfig, 'utf-8'));
        return config.server?.port || 3000;
      }
    } catch (e) {}
    return 3000;
  }

  addResult(category, status, message, severity, solution) {
    this.results.push({ category, status, message, severity, solution });
  }

  generateReport() {
    const passResults = this.results.filter(r => r.status === 'pass');
    const warningResults = this.results.filter(r => r.status === 'warning');
    const errorResults = this.results.filter(r => r.status === 'error');
    const infoResults = this.results.filter(r => r.status === 'info');

    console.log('\n' + '═'.repeat(60));
    console.log('📊 诊断报告');
    console.log('═'.repeat(60));

    const categories = [...new Set(this.results.map(r => r.category))];
    for (const category of categories) {
      console.log(`\n【${category.toUpperCase()}】`);
      const categoryResults = this.results.filter(r => r.category === category);
      for (const result of categoryResults) {
        const icon = result.status === 'pass' ? '✅' :
                    result.status === 'warning' ? '⚠️' :
                    result.status === 'error' ? '❌' : 'ℹ️';
        console.log(`  ${icon} ${result.message}`);
        if (result.solution && (result.status === 'warning' || result.status === 'error')) {
          console.log(`     💡 ${result.solution}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`📈 汇总: ${passResults.length} ✅ | ${warningResults.length} ⚠️ | ${errorResults.length} ❌ | ${infoResults.length} ℹ️`);
    console.log('═'.repeat(60));

    if (this.reportPath) {
      const report = this.generateReportText();
      fs.writeFileSync(this.reportPath, report, 'utf-8');
      console.log(`\n📄 报告已保存到: ${this.reportPath}`);
    }

    if (errorResults.length > 0) {
      console.log('\n💡 提示: 运行 "openclaw skill chat-hub-config repair --all" 尝试修复问题');
    }

    return {
      total: this.results.length,
      pass: passResults.length,
      warnings: warningResults.length,
      errors: errorResults.length,
      results: this.results
    };
  }

  generateReportText() {
    let report = 'Chat-Hub 诊断报告\n';
    report += '═'.repeat(50) + '\n';
    report += `生成时间: ${new Date().toISOString()}\n\n`;

    const categories = [...new Set(this.results.map(r => r.category))];
    for (const category of categories) {
      report += `【${category.toUpperCase()}】\n`;
      const categoryResults = this.results.filter(r => r.category === category);
      for (const result of categoryResults) {
        const icon = result.status === 'pass' ? '✅' :
                    result.status === 'warning' ? '⚠️' :
                    result.status === 'error' ? '❌' : 'ℹ️';
        report += `  ${icon} ${result.message}\n`;
        if (result.solution && (result.status === 'warning' || result.status === 'error')) {
          report += `     💡 ${result.solution}\n`;
        }
      }
      report += '\n';
    }

    report += '═'.repeat(50) + '\n';
    const passResults = this.results.filter(r => r.status === 'pass');
    const warningResults = this.results.filter(r => r.status === 'warning');
    const errorResults = this.results.filter(r => r.status === 'error');
    report += `汇总: ${passResults.length} ✅ | ${warningResults.length} ⚠️ | ${errorResults.length} ❌\n`;

    return report;
  }
}

async function runDiagnose(args) {
  const options = {
    full: args.includes('--full'),
    report: args.includes('--report') ? args[args.indexOf('--report') + 1] : null
  };

  const diagnoser = new Diagnoser(options);
  return await diagnoser.diagnose();
}

module.exports = { Diagnoser, runDiagnose };
