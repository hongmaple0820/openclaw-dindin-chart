const fs = require('fs');
const path = require('path');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const CONFIG_PATH = path.join(CHAT_HUB_PATH, 'config');

class ConfigChecker {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.fix = options.fix || false;
    this.format = options.format || 'text';
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  async check() {
    console.log('\n🔍 开始配置检查...\n');

    await this.checkConfigFiles();
    await this.checkDingtalkConfig();
    await this.checkRedisConfig();
    await this.checkBotConfig();
    await this.checkServerConfig();
    await this.checkEnvFile();
    await this.checkCorsConfig();
    await this.checkRateLimitConfig();
    await this.checkAuthConfig();

    return this.generateReport();
  }

  async checkConfigFiles() {
    const defaultConfig = path.join(CONFIG_PATH, 'default.json');
    const localConfig = path.join(CONFIG_PATH, 'local.json');

    if (!fs.existsSync(defaultConfig)) {
      this.issues.push({
        type: 'error',
        category: 'config',
        message: 'default.json 配置文件不存在',
        severity: 'high',
        solution: '创建 chat-hub/config/default.json'
      });
      return;
    }

    this.passed.push('✓ default.json 配置文件存在');

    if (!fs.existsSync(localConfig)) {
      this.warnings.push({
        type: 'warning',
        category: 'config',
        message: 'local.json 配置文件不存在，建议创建',
        severity: 'medium',
        solution: '复制 local.example.json 为 local.json 并配置'
      });
      return;
    }

    this.passed.push('✓ local.json 配置文件存在');

    try {
      const config = JSON.parse(fs.readFileSync(localConfig, 'utf-8'));
      if (Object.keys(config).length === 0) {
        this.warnings.push({
          type: 'warning',
          category: 'config',
          message: 'local.json 为空配置',
          severity: 'medium',
          solution: '配置必要的参数如 dingtalk webhook'
        });
      }
    } catch (e) {
      this.issues.push({
        type: 'error',
        category: 'config',
        message: `local.json 解析失败: ${e.message}`,
        severity: 'high',
        solution: '检查 JSON 格式是否正确'
      });
    }
  }

  async checkDingtalkConfig() {
    const config = this.loadConfig();

    if (!config.dingtalk) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: '钉钉配置不存在（可选）',
        severity: 'low',
        solution: '如需使用钉钉集成，请在 local.json 中添加 dingtalk 配置'
      });
      return;
    }

    if (config.dingtalk.enabled === false) {
      this.passed.push('✓ 钉钉已禁用（可选）');
      return;
    }

    const isConfigured = this.isWebhookConfigured(config);

    if (!isConfigured) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: '钉钉 webhook 未配置，部分功能将受限',
        severity: 'medium',
        solution: '配置 webhook 后可启用：第三方集成、机器人自动回复等功能'
      });
      return;
    }

    if (!config.dingtalk.webhookBase) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: '钉钉 Webhook URL 未配置',
        severity: 'medium',
        solution: '在 local.json 中配置 dingtalk.webhookBase'
      });
    } else if (!this.isValidUrl(config.dingtalk.webhookBase)) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: '钉钉 Webhook URL 格式不正确',
        severity: 'medium',
        solution: 'Webhook URL 应该是: https://oapi.dingtalk.com/robot/send?access_token=xxx'
      });
    } else if (!config.dingtalk.webhookBase.includes('access_token=')) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: 'Webhook URL 可能缺少 access_token 参数',
        severity: 'low',
        solution: '确认 URL 包含 ?access_token=xxx'
      });
    } else {
      this.passed.push('✓ 钉钉 Webhook URL 格式正确');
    }

    if (!config.dingtalk.secret) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: '钉钉 Secret 密钥未配置，消息发送功能不可用',
        severity: 'medium',
        solution: '在 local.json 中配置 dingtalk.secret (SEC 开头的加签密钥)'
      });
    } else if (!config.dingtalk.secret.startsWith('SEC')) {
      this.warnings.push({
        type: 'warning',
        category: 'dingtalk',
        message: 'Secret 密钥格式可能不正确',
        severity: 'low',
        solution: 'Secret 应该是以 SEC 开头的加签密钥'
      });
    } else {
      this.passed.push('✓ 钉钉 Secret 密钥格式正确');
    }
  }

  isWebhookConfigured(config) {
    return config.dingtalk?.enabled === true && 
           config.dingtalk?.webhookBase && 
           config.dingtalk?.secret;
  }

  getFeatureStatus(config) {
    const webhookConfigured = this.isWebhookConfigured(config);
    return {
      webhook: {
        configured: webhookConfigured,
        enabled: config.dingtalk?.enabled !== false
      },
      features: {
        dingtalkIntegration: webhookConfigured,
        wechatIntegration: webhookConfigured,
        botAutoReply: webhookConfigured,
        basicInteraction: true
      }
    };
  }

  async checkRedisConfig() {
    const config = this.loadConfig();

    if (!config.redis) {
      this.warnings.push({
        type: 'warning',
        category: 'redis',
        message: '缺少 redis 配置',
        severity: 'low',
        solution: '如果不需要 Redis 可以忽略，否则添加 redis 配置'
      });
      return;
    }

    if (config.redis.enabled === false) {
      this.passed.push('✓ Redis 已禁用（可选）');
      return;
    }

    if (!config.redis.host) {
      this.warnings.push({
        type: 'warning',
        category: 'redis',
        message: 'Redis host 未配置，使用默认值 localhost',
        severity: 'low',
        solution: '在 local.json 中配置 redis.host'
      });
    }

    if (!config.redis.port) {
      this.warnings.push({
        type: 'warning',
        category: 'redis',
        message: 'Redis port 未配置，使用默认值 6379',
        severity: 'low',
        solution: '在 local.json 中配置 redis.port'
      });
    }

    this.passed.push('✓ Redis 配置存在');
  }

  async checkBotConfig() {
    const config = this.loadConfig();

    if (!config.bot) {
      this.warnings.push({
        type: 'warning',
        category: 'bot',
        message: '缺少 bot 配置',
        severity: 'low',
        solution: '在 local.json 中添加 bot 配置'
      });
      return;
    }

    if (!config.bot.name) {
      this.warnings.push({
        type: 'warning',
        category: 'bot',
        message: '机器人名称未配置',
        severity: 'low',
        solution: '在 local.json 中配置 bot.name'
      });
    } else {
      this.passed.push(`✓ 机器人名称: ${config.bot.name}`);
    }
  }

  async checkServerConfig() {
    const config = this.loadConfig();

    if (!config.server) {
      this.warnings.push({
        type: 'warning',
        category: 'server',
        message: '缺少 server 配置',
        severity: 'low',
        solution: 'server.port 默认值为 3000'
      });
      return;
    }

    if (config.server.port) {
      const port = config.server.port;
      if (port < 1024 || port > 65535) {
        this.issues.push({
          type: 'error',
          category: 'server',
          message: `端口 ${port} 不在有效范围内 (1024-65535)`,
          severity: 'high',
          solution: '修改 server.port 为有效端口'
        });
      } else {
        this.passed.push(`✓ 服务端口: ${port}`);
      }
    } else {
      this.passed.push('✓ 服务端口: 3000 (默认)');
    }
  }

  async checkEnvFile() {
    const envPath = path.join(CHAT_HUB_PATH, '.env');
    const envExamplePath = path.join(CHAT_HUB_PATH, '.env.example');

    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        this.warnings.push({
          type: 'warning',
          category: 'env',
          message: '.env 文件不存在',
          severity: 'low',
          solution: '复制 .env.example 为 .env'
        });
      }
      return;
    }

    this.passed.push('✓ .env 文件存在');
  }

  async checkCorsConfig() {
    const config = this.loadConfig();

    if (!config.cors) {
      this.warnings.push({
        type: 'warning',
        category: 'cors',
        message: '缺少 CORS 配置',
        severity: 'low',
        solution: '添加 cors 配置以优化跨域支持'
      });
      return;
    }

    if (!config.cors.origins) {
      this.warnings.push({
        type: 'warning',
        category: 'cors',
        message: 'CORS origins 未配置，默认允许所有来源',
        severity: 'medium',
        solution: '生产环境建议配置具体的 origins 白名单'
      });
    } else {
      this.passed.push('✓ CORS origins 已配置');
    }

    if (config.cors.credentials) {
      this.passed.push('✓ CORS credentials 支持已启用');
    }

    if (config.cors.maxAge) {
      this.passed.push(`✓ CORS maxAge: ${config.cors.maxAge}秒`);
    }
  }

  async checkRateLimitConfig() {
    const config = this.loadConfig();

    if (!config.rateLimit) {
      this.warnings.push({
        type: 'warning',
        category: 'rate-limit',
        message: '缺少速率限制配置',
        severity: 'low',
        solution: '添加 rateLimit 配置以防止 API 滥用'
      });
      return;
    }

    if (config.rateLimit.enabled === false) {
      this.warnings.push({
        type: 'warning',
        category: 'rate-limit',
        message: '速率限制已禁用，可能导致 API 滥用',
        severity: 'medium',
        solution: '生产环境建议启用速率限制'
      });
      return;
    }

    if (config.rateLimit.maxRequests) {
      this.passed.push(`✓ 速率限制: ${config.rateLimit.maxRequests} 次/分钟`);
    }

    if (config.rateLimit.auth) {
      this.passed.push('✓ 认证接口速率限制已配置');
    }

    if (config.rateLimit.message) {
      this.passed.push('✓ 消息接口速率限制已配置');
    }
  }

  async checkAuthConfig() {
    const config = this.loadConfig();

    if (!config.auth) {
      this.warnings.push({
        type: 'warning',
        category: 'auth',
        message: '缺少认证配置',
        severity: 'low',
        solution: '添加 auth 配置以增强安全性'
      });
      return;
    }

    if (config.auth.jwtSecret) {
      this.passed.push('✓ JWT Secret 已配置');
    } else {
      this.warnings.push({
        type: 'warning',
        category: 'auth',
        message: 'JWT Secret 未配置，使用默认值可能不安全',
        severity: 'medium',
        solution: '配置强随机的 JWT Secret'
      });
    }

    if (config.auth.refreshTokenExpires) {
      this.passed.push('✓ Refresh Token 过期时间已配置');
    }
  }

  async checkBotConfig() {
    const config = this.loadConfig();

    if (!config.bot) {
      this.warnings.push({
        type: 'warning',
        category: 'bot',
        message: '缺少 bot 配置',
        severity: 'low',
        solution: '在 local.json 中添加 bot 配置'
      });
      return;
    }

    if (config.bot.name) {
      this.passed.push(`✓ 机器人名称: ${config.bot.name}`);
    }

    if (config.bot.multiBot === true) {
      this.passed.push('✓ 多 Bot 模式已启用');
    }
  }

  loadConfig() {
    try {
      const defaultPath = path.join(CONFIG_PATH, 'default.json');
      const localPath = path.join(CONFIG_PATH, 'local.json');

      let config = {};
      if (fs.existsSync(defaultPath)) {
        config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
      }

      if (fs.existsSync(localPath)) {
        const localConfig = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        config = this.deepMerge(config, localConfig);
      }

      return config;
    } catch (e) {
      return {};
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

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  generateReport() {
    const result = {
      success: this.issues.length === 0,
      summary: {
        passed: this.passed.length,
        warnings: this.warnings.length,
        issues: this.issues.length
      },
      passed: this.passed,
      warnings: this.warnings,
      issues: this.issues
    };

    if (this.format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    console.log('═'.repeat(50));
    console.log('📊 配置检查报告');
    console.log('═'.repeat(50));

    if (this.passed.length > 0) {
      console.log('\n✅ 通过项:');
      this.passed.forEach(p => console.log(`  ${p}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      this.warnings.forEach(w => {
        console.log(`  - ${w.message}`);
        if (this.verbose) {
          console.log(`    💡 ${w.solution}`);
        }
      });
    }

    if (this.issues.length > 0) {
      console.log('\n❌ 问题:');
      this.issues.forEach(i => {
        console.log(`  - ${i.message}`);
        if (this.verbose) {
          console.log(`    🔧 解决方案: ${i.solution}`);
        }
      });
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📈 汇总: ${this.passed.length} 通过, ${this.warnings.length} 警告, ${this.issues.length} 错误`);
    console.log('═'.repeat(50));

    if (this.issues.length > 0) {
      console.log('\n💡 提示: 运行 "openclaw skill chat-hub-config setup" 进行配置');
    }

    return result;
  }
}

async function runCheck(args) {
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    fix: args.includes('--fix'),
    format: args.includes('--format') ? 'json' : 'text'
  };

  const checker = new ConfigChecker(options);
  return await checker.check();
}

module.exports = { ConfigChecker, runCheck };
