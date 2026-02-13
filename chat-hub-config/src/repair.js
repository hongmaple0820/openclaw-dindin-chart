const fs = require('fs');
const path = require('path');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const CONFIG_PATH = path.join(CHAT_HUB_PATH, 'config');

class RepairManager {
  constructor() {
    this.issues = [];
    this.fixed = [];
    this.failed = [];
  }

  getAvailableRepairs() {
    return [
      {
        id: 'missing-local-config',
        name: '缺失本地配置文件',
        description: 'local.json 配置文件不存在',
        severity: 'high',
        check: () => {
          const localPath = path.join(CONFIG_PATH, 'local.json');
          return !fs.existsSync(localPath);
        },
        fix: async () => {
          const examplePath = path.join(CONFIG_PATH, 'local.example.json');
          const localPath = path.join(CONFIG_PATH, 'local.json');

          if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, localPath);
            console.log('  ✅ 已从示例创建 local.json');
            return true;
          } else {
            const defaultConfig = {
              bot: { name: 'Bot', local: true, prefix: '' },
              dingtalk: { enabled: false, webhookBase: '', secret: '' },
              redis: { enabled: true, host: 'localhost', port: 6379, password: '' }
            };
            fs.writeFileSync(localPath, JSON.stringify(defaultConfig, null, 2));
            console.log('  ✅ 已创建默认 local.json');
            return true;
          }
        }
      },
      {
        id: 'missing-default-config',
        name: '缺失默认配置文件',
        description: 'default.json 配置文件不存在',
        severity: 'high',
        check: () => {
          const defaultPath = path.join(CONFIG_PATH, 'default.json');
          return !fs.existsSync(defaultPath);
        },
        fix: async () => {
          const defaultPath = path.join(CONFIG_PATH, 'default.json');
          const defaultConfig = {
            mode: 'storage',
            server: { port: 3000 },
            storage: { type: 'sqlite', path: '~/.openclaw/chat-data/messages.db' },
            redis: { enabled: true, host: 'localhost', port: 6379, password: '' },
            channels: { messages: 'chat:messages', replies: 'chat:replies' },
            bot: { name: 'Bot', local: true, prefix: '' },
            dingtalk: { enabled: true, webhookBase: '', secret: '' },
            trigger: { enabled: false, command: 'openclaw system event --text', mode: 'now' },
            features: { storage: true, analytics: true, webUI: true, redis: true },
            sync: { saveAllReplies: true, broadcastToRedis: true }
          };
          fs.writeFileSync(defaultPath, JSON.stringify(defaultConfig, null, 2));
          console.log('  ✅ 已创建默认 default.json');
          return true;
        }
      },
      {
        id: 'missing-env',
        name: '缺失环境变量文件',
        description: '.env 文件不存在',
        severity: 'low',
        check: () => {
          const envPath = path.join(CHAT_HUB_PATH, '.env');
          return !fs.existsSync(envPath);
        },
        fix: async () => {
          const envPath = path.join(CHAT_HUB_PATH, '.env');
          const envExamplePath = path.join(CHAT_HUB_PATH, '.env.example');

          if (fs.existsSync(envExamplePath)) {
            fs.copyFileSync(envExamplePath, envPath);
            console.log('  ✅ 已从示例创建 .env');
            return true;
          } else {
            const envContent = `# Chat-Hub 环境配置
LOG_LEVEL=INFO
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
BOT_NAME=Bot
DINGTALK_WEBHOOK=
DINGTALK_SECRET=
`;
            fs.writeFileSync(envPath, envContent);
            console.log('  ✅ 已创建默认 .env');
            return true;
          }
        }
      },
      {
        id: 'invalid-json',
        name: '配置文件格式错误',
        description: '配置文件 JSON 格式错误',
        severity: 'high',
        check: () => {
          const localPath = path.join(CONFIG_PATH, 'local.json');
          if (!fs.existsSync(localPath)) return false;

          try {
            JSON.parse(fs.readFileSync(localPath, 'utf-8'));
            return false;
          } catch (e) {
            return true;
          }
        },
        fix: async () => {
          const localPath = path.join(CONFIG_PATH, 'local.json');
          const backupPath = path.join(CONFIG_PATH, 'local.json.bak');

          if (fs.existsSync(localPath)) {
            fs.copyFileSync(localPath, backupPath);
            console.log('  ✅ 已备份损坏的配置文件');
          }

          const defaultConfig = {
            bot: { name: 'Bot', local: true, prefix: '' },
            dingtalk: { enabled: false, webhookBase: '', secret: '' },
            redis: { enabled: true, host: 'localhost', port: 6379, password: '' }
          };
          fs.writeFileSync(localPath, JSON.stringify(defaultConfig, null, 2));
          console.log('  ✅ 已重置 local.json');
          return true;
        }
      },
      {
        id: 'dingtalk-incomplete',
        name: '钉钉配置不完整',
        description: '钉钉已启用但 webhook 或 secret 未配置',
        severity: 'high',
        check: () => {
          const localPath = path.join(CONFIG_PATH, 'local.json');
          if (!fs.existsSync(localPath)) return false;

          try {
            const config = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
            if (config.dingtalk?.enabled) {
              return !config.dingtalk?.webhookBase || !config.dingtalk?.secret;
            }
            return false;
          } catch (e) {
            return false;
          }
        },
        fix: async () => {
          console.log('  ℹ️ 请运行 "openclaw skill chat-hub-config setup" 配置钉钉');
          return false;
        }
      },
      {
        id: 'node-modules-missing',
        name: '依赖未安装',
        description: 'node_modules 目录不存在',
        severity: 'high',
        check: () => {
          const nodeModulesPath = path.join(CHAT_HUB_PATH, 'node_modules');
          return !fs.existsSync(nodeModulesPath);
        },
        fix: async () => {
          console.log('  ℹ️ 请运行 "cd chat-hub && npm install" 安装依赖');
          return false;
        }
      },
      {
        id: 'permission-issue',
        name: '权限问题',
        description: '配置文件权限不正确',
        severity: 'medium',
        check: () => {
          const configFiles = ['local.json', 'default.json'];
          for (const file of configFiles) {
            const filePath = path.join(CONFIG_PATH, file);
            if (fs.existsSync(filePath)) {
              try {
                fs.accessSync(filePath, fs.constants.RW_OK);
              } catch (e) {
                return true;
              }
            }
          }
          return false;
        },
        fix: async () => {
          const configFiles = ['local.json', 'default.json'];
          for (const file of configFiles) {
            const filePath = path.join(CONFIG_PATH, file);
            if (fs.existsSync(filePath)) {
              try {
                fs.chmodSync(filePath, 0o644);
                console.log(`  ✅ 已修复 ${file} 权限`);
              } catch (e) {
                console.log(`  ❌ 无法修复 ${file} 权限: ${e.message}`);
              }
            }
          }
          return true;
        }
      }
    ];
  }

  async list() {
    console.log('\n📋 可修复问题列表:');
    console.log('═'.repeat(50));

    const repairs = this.getAvailableRepairs();
    const available = repairs.filter(r => r.check());

    if (available.length === 0) {
      console.log('✅ 未发现需要修复的问题');
      return [];
    }

    available.forEach((issue, index) => {
      const severityIcon = issue.severity === 'high' ? '🔴' :
                         issue.severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${index + 1}. ${severityIcon} ${issue.name}`);
      console.log(`     ${issue.description}`);
    });

    console.log('\n💡 使用 "openclaw skill chat-hub-config repair --all" 修复所有问题');
    console.log('   使用 "openclaw skill chat-hub-config repair --fix <问题编号>" 修复指定问题');

    return available;
  }

  async repair(options = {}) {
    const fixAll = options.all || false;
    const fixId = options.fix || null;

    console.log('\n🔧 开始修复...');
    console.log('═'.repeat(50));

    const repairs = this.getAvailableRepairs();

    let toFix = [];
    if (fixId) {
      const issue = repairs.find(r => r.id === fixId);
      if (issue) {
        toFix = [issue];
      } else {
        console.log(`\n❌ 未找到问题: ${fixId}`);
        return null;
      }
    } else if (fixAll) {
      toFix = repairs.filter(r => r.check());
    }

    if (toFix.length === 0) {
      console.log('\n✅ 没有需要修复的问题');
      return { fixed: [], failed: [] };
    }

    console.log(`\n发现 ${toFix.length} 个问题待修复:\n`);

    for (const issue of toFix) {
      console.log(`🔧 修复: ${issue.name}`);
      console.log(`   ${issue.description}`);

      try {
        const success = await issue.fix();
        if (success) {
          this.fixed.push(issue);
          console.log('   ✅ 已修复\n');
        } else {
          this.failed.push(issue);
          console.log('   ⚠️ 需要手动处理\n');
        }
      } catch (e) {
        this.failed.push(issue);
        console.log(`   ❌ 修复失败: ${e.message}\n`);
      }
    }

    console.log('═'.repeat(50));
    console.log(`📊 修复结果: ${this.fixed.length} 成功 | ${this.failed.length} 失败`);
    console.log('═'.repeat(50));

    if (this.failed.length > 0) {
      console.log('\n⚠️ 以下问题需要手动处理:');
      this.failed.forEach(issue => {
        console.log(`  - ${issue.name}: ${issue.description}`);
      });
    }

    return { fixed: this.fixed, failed: this.failed };
  }
}

async function runRepair(args) {
  const options = {
    all: args.includes('--all'),
    fix: args.includes('--fix') ? args[args.indexOf('--fix') + 1] : null,
    list: args.includes('--list')
  };

  const manager = new RepairManager();

  if (options.list) {
    return await manager.list();
  }

  return await manager.repair(options);
}

module.exports = { RepairManager, runRepair };
