/**
 * 配置加载器
 * 
 * 加载顺序：
 * 1. config/default.json - 默认配置（在 Git 仓库中）
 * 2. config/local.json - 本地配置（不在 Git 中，覆盖 default）
 * 
 * 这样可以：
 * - 共享仓库但各自有不同的钉钉密钥和机器人配置
 * - git pull 不会覆盖本地配置
 */

const fs = require('fs');
const path = require('path');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigType = any;

function deepMerge(target: ConfigType, source: ConfigType): ConfigType {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadConfig(): ConfigType {
  const configDir = path.join(__dirname, '../config');
  
  // 加载默认配置
  const defaultPath = path.join(configDir, 'default.json');
  let config: ConfigType = {};
  if (fs.existsSync(defaultPath)) {
    config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
  }
  
  // 加载本地配置（覆盖默认）
  const localPath = path.join(configDir, 'local.json');
  if (fs.existsSync(localPath)) {
    const localConfig = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    config = deepMerge(config, localConfig);
    console.log('[Config] 已加载本地配置: config/local.json');
  } else {
    console.log('[Config] 警告: config/local.json 不存在，请创建本地配置文件');
    console.log('[Config] 示例:');
    console.log(`{
  "bot": { "name": "你的机器人名" },
  "dingtalk": {
    "webhooks": {
      "primary": {
        "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
        "secret": "你的密钥"
      },
      "secondary": {
        "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=另一个token",
        "secret": "另一个密钥"
      }
    },
    "defaultWebhook": "primary"
  }
}`);
  }
  
  return config;
}

const config: ConfigType = loadConfig();

// ========== 配置迁移（V2 兼容性） ==========
// 如果存在旧的 redis 配置，自动迁移到新的 transport.redis
if (config.redis && !config.transport) {
  console.log('[Config] 检测到旧版 Redis 配置，自动迁移到 V2 格式');
  config.transport = {
    mode: 'auto',
    redis: {
      enabled: config.redis.enabled !== false, // 默认启用
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    }
  };
  config.fallback = {
    enabled: true,
    order: ['redis']
  };
}

// 如果 transport.redis 存在但没有 enabled 字段，默认启用
if (config.transport?.redis && config.transport.redis.enabled === undefined) {
  config.transport.redis.enabled = true;
}

// ========== 钉钉 webhook 配置迁移 ==========
// 如果存在旧的 dingtalk 配置（单个 webhook），自动迁移到新的多 webhook 格式
if (config.dingtalk && 
    (config.dingtalk.webhookBase || config.dingtalk.secret) && 
    !config.dingtalk.webhooks) {
  console.log('[Config] 检测到旧版钉钉 webhook 配置，自动迁移到多 webhook 格式');
  config.dingtalk.webhooks = {
    primary: {
      webhookBase: config.dingtalk.webhookBase || '',
      secret: config.dingtalk.secret || ''
    }
  };
  config.dingtalk.defaultWebhook = 'primary';
  
  // 清理旧的配置字段
  delete config.dingtalk.webhookBase;
  delete config.dingtalk.secret;
}

// 如果 webhooks 存在但没有 defaultWebhook，设置默认值
if (config.dingtalk?.webhooks && !config.dingtalk.defaultWebhook) {
  const webhookNames = Object.keys(config.dingtalk.webhooks);
  if (webhookNames.length > 0) {
    config.dingtalk.defaultWebhook = webhookNames[0];
    console.log(`[Config] 自动设置默认 webhook: ${config.dingtalk.defaultWebhook}`);
  }
}

module.exports = config;
export {};
