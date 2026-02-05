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

function deepMerge(target, source) {
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

function loadConfig() {
  const configDir = path.join(__dirname, '../config');
  
  // 加载默认配置
  const defaultPath = path.join(configDir, 'default.json');
  let config = {};
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
    "webhookBase": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "你的密钥"
  }
}`);
  }
  
  return config;
}

module.exports = loadConfig();
