const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const CONFIG_PATH = path.join(CHAT_HUB_PATH, 'config');

class ConfigWizard {
  constructor() {
    this.rl = null;
    this.config = {};
    this.steps = [
      { id: 'welcome', name: '欢迎', fn: this.stepWelcome.bind(this) },
      { id: 'dingtalk', name: '钉钉配置', fn: this.stepDingtalk.bind(this) },
      { id: 'redis', name: 'Redis配置', fn: this.stepRedis.bind(this) },
      { id: 'bot', name: '机器人配置', fn: this.stepBot.bind(this) },
      { id: 'verify', name: '验证配置', fn: this.stepVerify.bind(this) },
      { id: 'save', name: '保存配置', fn: this.stepSave.bind(this) }
    ];
  }

  createInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  closeInterface() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async start(options = {}) {
    console.log('\n' + '═'.repeat(50));
    console.log('🔧 Chat-Hub 配置向导');
    console.log('═'.repeat(50));

    this.loadCurrentConfig();

    const startStep = options.step || 0;
    const force = options.force || false;

    try {
      this.createInterface();

      for (let i = startStep; i < this.steps.length; i++) {
        const step = this.steps[i];
        console.log(`\n📌 步骤 ${i + 1}/${this.steps.length}: ${step.name}`);

        if (force || !this.isStepCompleted(step.id)) {
          await step.fn();
        } else {
          console.log('  ⏭️ 已完成，跳过');
        }
      }

      console.log('\n' + '═'.repeat(50));
      console.log('✅ 配置完成！');
      console.log('═'.repeat(50));
      console.log('\n💡 提示:');
      console.log('   - 运行 "openclaw skill chat-hub-config check" 检查配置');
      console.log('   - 运行 "openclaw skill chat-hub-config start" 启动服务');

    } catch (error) {
      console.error('\n❌ 配置向导出错:', error.message);
    } finally {
      this.closeInterface();
    }
  }

  loadCurrentConfig() {
    try {
      const defaultPath = path.join(CONFIG_PATH, 'default.json');
      const localPath = path.join(CONFIG_PATH, 'local.json');

      if (fs.existsSync(defaultPath)) {
        this.config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
      }

      if (fs.existsSync(localPath)) {
        const localConfig = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        this.config = this.deepMerge(this.config, localConfig);
      }
    } catch (e) {
      this.config = {};
    }
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  isStepCompleted(stepId) {
    switch (stepId) {
      case 'dingtalk':
        return this.config.dingtalk?.webhookBase && this.config.dingtalk?.secret;
      case 'redis':
        return this.config.redis?.enabled !== undefined;
      case 'bot':
        return this.config.bot?.name;
      default:
        return false;
    }
  }

  async stepWelcome() {
    console.log('\n欢迎使用 Chat-Hub 配置向导！');
    console.log('此向导将帮助你完成 chat-hub 的基本配置。');
    console.log('\n当前配置路径:', CONFIG_PATH);

    const answer = await this.question('\n是否继续? (Y/n): ');
    if (answer.toLowerCase() === 'n') {
      console.log('已取消配置。');
      process.exit(0);
    }
  }

  async stepDingtalk() {
    console.log('\n--- 钉钉配置（可选）---');
    console.log('配置钉钉机器人以启用第三方集成功能。');
    console.log('⚠️ 注意: 不配置 webhook 也可使用基础前端功能，但以下功能将受限:');
    console.log('   - 第三方软件集成功能（钉钉、企业微信等）');
    console.log('   - 机器人自动回复功能');
    console.log('   - 消息同步到第三方平台');

    const currentEnabled = this.config.dingtalk?.enabled;
    const currentWebhook = this.config.dingtalk?.webhookBase || '';
    const currentSecret = this.config.dingtalk?.secret || '';

    console.log(`\n当前状态: ${currentEnabled === false ? '已禁用' : currentWebhook && currentSecret ? '已配置' : '未配置'}`);
    console.log(`当前 Webhook: ${currentWebhook ? (currentWebhook.substring(0, 30) + '...') : '(未配置)'}`);

    const skipConfig = await this.question('\n是否现在配置钉钉? (Y/n，直接回车跳过): ');

    if (skipConfig.toLowerCase() === 'n' || skipConfig.trim() === '') {
      if (!this.config.dingtalk) {
        this.config.dingtalk = { enabled: false };
      } else if (!this.config.dingtalk.enabled) {
        this.config.dingtalk.enabled = false;
      }
      console.log('  ⏭️ 已跳过钉钉配置');
      console.log('  💡 提示: 稍后可运行 "openclaw skill chat-hub-config setup" 重新配置');
      return;
    }

    console.log('\n📝 请配置钉钉机器人:');
    console.log('1. 在钉钉群设置中添加机器人');
    console.log('2. 选择"自定义"机器人');
    console.log('3. 设置机器人名称并复制 webhook 地址');
    console.log('4. 开启"加签"并复制 secret 密钥');

    const webhook = await this.question(`\n请输入钉钉 Webhook URL: `);
    if (webhook.trim()) {
      this.config.dingtalk = this.config.dingtalk || {};
      this.config.dingtalk.webhookBase = webhook.trim();
      this.config.dingtalk.enabled = true;
    } else {
      console.log('  ⚠️ 未输入 Webhook，将禁用钉钉功能');
      this.config.dingtalk = this.config.dingtalk || {};
      this.config.dingtalk.enabled = false;
      return;
    }

    const secret = await this.question(`请输入钉钉 Secret 密钥 (SEC开头): `);
    if (secret.trim()) {
      this.config.dingtalk = this.config.dingtalk || {};
      this.config.dingtalk.secret = secret.trim();
    } else {
      console.log('  ⚠️ 未输入 Secret，消息发送功能将不可用');
    }

    console.log('  ✓ 钉钉配置已更新');
  }

  async stepRedis() {
    console.log('\n--- Redis 配置 ---');
    console.log('Redis 用于消息队列和实时通信。');

    const currentEnabled = this.config.redis?.enabled;
    const currentHost = this.config.redis?.host || 'localhost';
    const currentPort = this.config.redis?.port || 6379;

    console.log(`\n当前状态: ${currentEnabled === false ? '已禁用' : '已启用'}`);
    console.log(`当前 Host: ${currentHost}`);
    console.log(`当前 Port: ${currentPort}`);

    const useRedis = await this.question('\n是否启用 Redis? (Y/n，直接回车使用当前值): ');

    if (useRedis.toLowerCase() === 'n') {
      this.config.redis = this.config.redis || {};
      this.config.redis.enabled = false;
      console.log('  ℹ️ Redis 已禁用');
      return;
    }

    this.config.redis = this.config.redis || { enabled: true };

    const host = await this.question(`Redis Host (直接回车使用 localhost): `);
    if (host.trim()) {
      this.config.redis.host = host.trim();
    } else if (!this.config.redis.host) {
      this.config.redis.host = 'localhost';
    }

    const port = await this.question(`Redis Port (直接回车使用 6379): `);
    if (port.trim()) {
      this.config.redis.port = parseInt(port.trim());
    } else if (!this.config.redis.port) {
      this.config.redis.port = 6379;
    }

    const password = await this.question('Redis Password (如无密码直接回车): ');
    if (password.trim()) {
      this.config.redis.password = password.trim();
    }

    this.config.redis.enabled = true;
    console.log('  ✓ Redis 配置已更新');
  }

  async stepBot() {
    console.log('\n--- 机器人配置 ---');

    const currentName = this.config.bot?.name || 'Bot';

    console.log(`\n当前机器人名称: ${currentName}`);

    const name = await this.question('请输入机器人名称 (直接回车使用当前值): ');
    if (name.trim()) {
      this.config.bot = this.config.bot || {};
      this.config.bot.name = name.trim();
    } else if (!this.config.bot?.name) {
      this.config.bot = this.config.bot || {};
      this.config.bot.name = 'Bot';
    }

    console.log('  ✓ 机器人配置已更新');
  }

  async stepVerify() {
    console.log('\n--- 验证配置 ---');

    console.log('\n当前配置预览:');
    console.log(JSON.stringify({
      bot: this.config.bot,
      dingtalk: this.config.dingtalk ? {
        enabled: this.config.dingtalk.enabled,
        webhookBase: this.config.dingtalk.webhookBase ? this.config.dingtalk.webhookBase.substring(0, 50) + '...' : '(未配置)',
        secret: this.config.dingtalk.secret ? '******' : '(未配置)'
      } : '(未配置)',
      redis: this.config.redis ? {
        enabled: this.config.redis.enabled,
        host: this.config.redis.host,
        port: this.config.redis.port
      } : '(未配置)'
    }, null, 2));

    const confirm = await this.question('\n确认配置正确? (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('配置未保存，请重新运行向导。');
      process.exit(0);
    }
  }

  async stepSave() {
    console.log('\n--- 保存配置 ---');

    const localPath = path.join(CONFIG_PATH, 'local.json');

    const existingConfig = fs.existsSync(localPath)
      ? JSON.parse(fs.readFileSync(localPath, 'utf-8'))
      : {};

    const mergedConfig = this.deepMerge(existingConfig, this.config);

    fs.writeFileSync(localPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');

    console.log(`  ✓ 配置已保存到: ${localPath}`);
  }
}

async function runSetup(args) {
  const options = {
    force: args.includes('--force'),
    step: args.includes('--step') ? parseInt(args[args.indexOf('--step') + 1]) : 0
  };

  const wizard = new ConfigWizard();
  await wizard.start(options);
}

module.exports = { ConfigWizard, runSetup };
