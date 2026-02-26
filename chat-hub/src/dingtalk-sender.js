/**
 * 钉钉消息发送器 - 双模式支持
 * 
 * 支持两种发送模式：
 * - webhook: 使用钉钉自定义机器人 Webhook
 * - plugin: 使用 OpenClaw 钉钉插件（支持私聊和群聊主动消息）
 * 
 * @author 小熊
 * @date 2026-02-25
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

// 发送队列，防止并发
let sendQueue = Promise.resolve();
const MIN_SEND_INTERVAL = 1000;
let lastSendTime = 0;

// 频率限制
const RATE_LIMIT = new Map();

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryDelayMultiplier: 2,
};

/**
 * 获取用户手机号映射
 */
function getUserPhoneMap() {
  try {
    const userManager = require('./user-manager');
    const dynamicMap = userManager.getDingtalkPhoneMap();
    return { ...config.userPhones || {}, ...dynamicMap };
  } catch (error) {
    return config.userPhones || {};
  }
}

/**
 * 获取群聊配置
 */
function getGroupConfig(groupName) {
  // 新配置格式
  if (config.groups && config.groups[groupName]) {
    return config.groups[groupName];
  }
  
  // 旧配置格式兼容
  if (config.dingtalk?.webhook?.groups?.[groupName]) {
    return {
      name: groupName,
      webhook: groupName,
      ...config.dingtalk.webhook.groups[groupName]
    };
  }
  
  return null;
}

/**
 * 获取用户配置
 */
function getUserConfig(userId) {
  // 新配置格式
  if (config.users && config.users[userId]) {
    return config.users[userId];
  }
  
  // 从 userPhones 反向查找
  const phoneMap = getUserPhoneMap();
  if (phoneMap[userId]) {
    return { phone: phoneMap[userId] };
  }
  
  return null;
}

/**
 * 获取当前发送模式
 */
function getSendingMode() {
  return config.messageSending?.mode || 'webhook';
}

/**
 * 检查频率限制
 */
function checkRateLimit(key) {
  const now = Date.now();
  
  if (!RATE_LIMIT.has(key)) {
    RATE_LIMIT.set(key, {
      maxPerMinute: 20,
      window: 60000,
      records: [],
    });
  }
  
  const limit = RATE_LIMIT.get(key);
  limit.records = limit.records.filter(time => now - time < limit.window);
  
  if (limit.records.length >= limit.maxPerMinute) {
    const oldestRecord = limit.records[0];
    const waitTime = limit.window - (now - oldestRecord);
    throw new Error(`频率限制：已达到每分钟 ${limit.maxPerMinute} 条上限，请等待 ${Math.ceil(waitTime / 1000)}s`);
  }
  
  limit.records.push(now);
}

/**
 * 带重试的 HTTP 请求
 */
async function requestWithRetry(url, data, options = {}) {
  const { retries = 0, headers = {} } = options;
  
  try {
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 10000,
    });
    
    // 钉钉 Webhook 返回 { errcode: 0, errmsg: "ok" }
    if (response.data.errcode !== undefined && response.data.errcode !== 0) {
      throw new Error(`钉钉 API 错误: ${response.data.errmsg || '未知错误'}`);
    }
    
    return response;
  } catch (error) {
    if (retries < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryDelayMultiplier, retries);
      console.warn(`[DingTalkSender] 请求失败，${delay}ms 后重试 (${retries + 1}/${RETRY_CONFIG.maxRetries}):`, error.message);
      await sleep(delay);
      return requestWithRetry(url, data, { ...options, retries: retries + 1 });
    }
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 队列发送（防止并发）
 */
async function queuedSend(sendFn) {
  sendQueue = sendQueue.then(async () => {
    await sendFn();
  }).catch(err => {
    console.error('[DingTalkSender] 队列发送失败:', err.message);
  });
  
  return sendQueue;
}

/**
 * 生成钉钉签名
 */
function generateSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}

/**
 * 解析 @ 目标
 */
function parseAtTargets(atTargets) {
  const USER_PHONES = getUserPhoneMap();
  const result = { atMobiles: [], isAtAll: false, atText: '' };
  
  if (!atTargets) return result;
  
  const targets = Array.isArray(atTargets) ? atTargets : [atTargets];
  
  for (const target of targets) {
    if (target === 'all' || target === '所有人') {
      result.isAtAll = true;
      result.atText = '@所有人 ';
    } else if (USER_PHONES[target]) {
      const phone = USER_PHONES[target];
      if (!result.atMobiles.includes(phone)) {
        result.atMobiles.push(phone);
        result.atText += `@${phone} `;
      }
    }
  }
  
  return result;
}

// ==================== Webhook 模式 ====================

/**
 * 通过 Webhook 发送群聊消息
 */
async function sendViaWebhook(groupName, content, options = {}) {
  const groupConfig = getGroupConfig(groupName);
  if (!groupConfig) {
    throw new Error(`群聊配置不存在: ${groupName}`);
  }
  
  // 获取 webhook 配置
  let webhookBase, secret;
  
  if (groupConfig.webhookBase) {
    webhookBase = groupConfig.webhookBase;
    secret = groupConfig.secret;
  } else if (config.dingtalk?.webhook?.groups?.[groupName]) {
    webhookBase = config.dingtalk.webhook.groups[groupName].webhookBase;
    secret = config.dingtalk.webhook.groups[groupName].secret;
  } else {
    throw new Error(`群聊 webhook 未配置: ${groupName}`);
  }
  
  return queuedSend(async () => {
    checkRateLimit(`webhook:${groupName}`);
    
    // 限速
    const now = Date.now();
    const elapsed = now - lastSendTime;
    if (elapsed < MIN_SEND_INTERVAL) {
      await sleep(MIN_SEND_INTERVAL - elapsed);
    }
    
    const timestamp = Date.now();
    let url = webhookBase;
    
    if (secret) {
      const sign = generateSign(secret, timestamp);
      url = `${webhookBase}&timestamp=${timestamp}&sign=${sign}`;
    }
    
    const { atMobiles, isAtAll, atText } = parseAtTargets(options.atTargets);
    const sender = options.sender || config.bot?.name || 'Bot';
    const fullContent = `${atText}${content} [${sender}]`;
    
    const data = {
      msgtype: 'text',
      text: { content: fullContent },
      at: { atMobiles, isAtAll }
    };
    
    console.log(`[DingTalkSender:Webhook] 发送到群 ${groupName}:`, content.substring(0, 50));
    
    const response = await requestWithRetry(url, data);
    lastSendTime = Date.now();
    
    console.log(`[DingTalkSender:Webhook] 发送成功: ${groupName}`);
    return response.data;
  });
}

// ==================== 插件模式 ====================

// Access Token 缓存
const tokenCache = new Map();

/**
 * 获取钉钉 Access Token
 */
async function getAccessToken(options = {}) {
  const accountId = options.accountId || 'default';
  const pluginConfig = config.dingtalk?.plugin || {};
  const accountConfig = pluginConfig.accounts?.[accountId] || {};
  
  const clientId = accountConfig.clientId || config.dingtalk?.clientId;
  const clientSecret = accountConfig.clientSecret || config.dingtalk?.clientSecret;
  
  if (!clientId || !clientSecret) {
    throw new Error('插件模式需要配置 clientId 和 clientSecret');
  }
  
  // 检查缓存
  const cacheKey = clientId;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.token;
  }
  
  // 获��新 token
  const url = 'https://api.dingtalk.com/v1.0/oauth2/accessToken';
  const response = await axios.post(url, {
    appKey: clientId,
    appSecret: clientSecret
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  });
  
  const token = response.data.accessToken;
  const expiresIn = response.data.expireIn || 7200;
  
  // 缓存 token（提前 5 分钟过期）
  tokenCache.set(cacheKey, {
    token,
    expiry: Date.now() + (expiresIn - 300) * 1000
  });
  
  console.log(`[DingTalkSender:Plugin] 获取 Access Token 成功，有效期 ${expiresIn}s`);
  return token;
}

/**
 * 通过钉钉 OpenAPI 发送消息（插件模式）
 * 
 * 支持群聊和私聊：
 * - 群聊: conversationId = openConversationId (cidxxx)
 * - 私聊: conversationId = userId
 */
async function sendViaPlugin(conversationId, content, options = {}) {
  const accountId = options.accountId || 'default';
  
  // 获取配置
  const pluginConfig = config.dingtalk?.plugin || {};
  const accountConfig = pluginConfig.accounts?.[accountId] || {};
  const robotCode = accountConfig.robotCode || accountConfig.clientId || config.dingtalk?.robotCode || config.dingtalk?.clientId;
  
  if (!robotCode) {
    throw new Error('插件模式需要配置 robotCode 或 clientId');
  }
  
  return queuedSend(async () => {
    checkRateLimit(`plugin:${accountId}`);
    
    // 限速
    const now = Date.now();
    const elapsed = now - lastSendTime;
    if (elapsed < MIN_SEND_INTERVAL) {
      await sleep(MIN_SEND_INTERVAL - elapsed);
    }
    
    // 获取 access token
    const token = await getAccessToken({ accountId });
    
    // 判断是群聊还是私聊
    const isGroup = conversationId.startsWith('cid');
    
    // 选择 API
    const url = isGroup
      ? 'https://api.dingtalk.com/v1.0/robot/groupMessages/send'
      : 'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend';
    
    // 构建消息体
    const { atMobiles, isAtAll, atText } = parseAtTargets(options.atTargets);
    const sender = options.sender || config.bot?.name || 'Bot';
    const fullContent = options.messageType === 'markdown' 
      ? `${atText}${content}\n\n---\n*来自 ${sender}*`
      : `${atText}${content}`;
    
    // 判断是否为 Markdown
    const useMarkdown = options.messageType === 'markdown' || 
                        content.includes('###') || 
                        content.includes('**') ||
                        content.includes('- [');
    
    const msgKey = useMarkdown ? 'sampleMarkdown' : 'sampleText';
    const msgParam = useMarkdown 
      ? JSON.stringify({ title: '消息', text: fullContent })
      : JSON.stringify({ content: fullContent });
    
    const payload = {
      robotCode,
      msgKey,
      msgParam
    };
    
    if (isGroup) {
      payload.openConversationId = conversationId;
    } else {
      payload.userIds = [conversationId];
    }
    
    console.log(`[DingTalkSender:Plugin] 发送到 ${isGroup ? '群' : '用户'} ${conversationId}:`, content.substring(0, 50));
    
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'x-acs-dingtalk-access-token': token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      lastSendTime = Date.now();
      console.log(`[DingTalkSender:Plugin] 发送成功: ${conversationId}`);
      return response.data;
    } catch (error) {
      const errorDetail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : error.message;
      console.error(`[DingTalkSender:Plugin] 发送失败:`, errorDetail);
      
      // 如果插件发送失败，尝试降级��� webhook（仅群聊）
      if (isGroup && config.dingtalk?.webhook?.groups) {
        console.log(`[DingTalkSender:Plugin] 尝试降级到 webhook 模式...`);
        const groupName = Object.keys(config.dingtalk.webhook.groups)[0];
        if (groupName) {
          return sendViaWebhook(groupName, content, options);
        }
      }
      
      throw error;
    }
  });
}

// ==================== 统一发送接口 ====================

/**
 * 发送群聊消息（自动选择模式）
 * 
 * @param {string} groupName - 群聊名称
 * @param {string} content - 消息内容
 * @param {object} options - 选项
 * @param {string} options.sender - 发送者名称
 * @param {string[]} options.atTargets - @ 目标
 * @param {string} options.mode - 强制指定模式 ('webhook' | 'plugin')
 */
async function sendToGroup(groupName, content, options = {}) {
  const mode = options.mode || getSendingMode();
  const groupConfig = getGroupConfig(groupName);
  
  if (!groupConfig) {
    throw new Error(`群聊配置不存在: ${groupName}`);
  }
  
  if (mode === 'plugin') {
    // 插件模式需要 openConversationId
    const conversationId = groupConfig.openConversationId;
    if (!conversationId) {
      console.warn(`[DingTalkSender] 群聊 ${groupName} 未配置 openConversationId，降级到 webhook 模式`);
      return sendViaWebhook(groupName, content, options);
    }
    
    return sendViaPlugin(conversationId, content, {
      ...options,
      accountId: groupConfig.accountId || 'default'
    });
  } else {
    return sendViaWebhook(groupName, content, options);
  }
}

/**
 * 发送私聊消息（仅插件模式支持）
 * 
 * @param {string} userId - 用户 ID 或名称
 * @param {string} content - 消息内容
 * @param {object} options - 选项
 */
async function sendToUser(userId, content, options = {}) {
  const mode = options.mode || getSendingMode();
  
  if (mode === 'webhook') {
    throw new Error('Webhook 模式不支持私聊主动消息，请切换到插件模式');
  }
  
  const userConfig = getUserConfig(userId);
  
  // 需要 dingtalkUserId
  let conversationId = userConfig?.dingtalkUserId;
  
  if (!conversationId) {
    // 如果没有��置 dingtalkUserId，尝试通过手机号查找
    // 这需要调用钉钉 API 查询，暂时报错
    throw new Error(`用户 ${userId} 未配置 dingtalkUserId，无法发送私聊消息`);
  }
  
  return sendViaPlugin(conversationId, content, {
    ...options,
    accountId: userConfig?.accountId || 'default'
  });
}

/**
 * 发送消息（兼容旧接口）
 * 
 * @param {string} content - 消息内容
 * @param {string} sender - 发送者
 * @param {string[]} atTargets - @ 目标
 */
async function sendText(content, sender, atTargets) {
  const mode = getSendingMode();
  
  // 获取默认群聊
  const defaultGroup = config.dingtalk?.webhook?.defaultGroup || 
                       Object.keys(config.groups || {})[0] ||
                       Object.keys(config.dingtalk?.webhook?.groups || {})[0];
  
  if (!defaultGroup) {
    throw new Error('未配置默认群聊');
  }
  
  return sendToGroup(defaultGroup, content, {
    sender,
    atTargets,
    mode
  });
}

/**
 * 发送 Markdown 消息
 */
async function sendMarkdown(title, text, sender = 'System', atTargets = null) {
  const mode = getSendingMode();
  const defaultGroup = config.dingtalk?.webhook?.defaultGroup || 
                       Object.keys(config.groups || {})[0] ||
                       Object.keys(config.dingtalk?.webhook?.groups || {})[0];
  
  if (!defaultGroup) {
    throw new Error('未配置默认群聊');
  }
  
  const groupConfig = getGroupConfig(defaultGroup);
  const { atMobiles, isAtAll, atText } = parseAtTargets(atTargets);
  
  if (mode === 'webhook' || !groupConfig?.openConversationId) {
    // Webhook 模式
    let webhookBase, secret;
    
    if (groupConfig.webhookBase) {
      webhookBase = groupConfig.webhookBase;
      secret = groupConfig.secret;
    } else if (config.dingtalk?.webhook?.groups?.[defaultGroup]) {
      webhookBase = config.dingtalk.webhook.groups[defaultGroup].webhookBase;
      secret = config.dingtalk.webhook.groups[defaultGroup].secret;
    } else {
      throw new Error(`群聊 webhook 未配置: ${defaultGroup}`);
    }
    
    return queuedSend(async () => {
      checkRateLimit(`webhook:${defaultGroup}`);
      
      const now = Date.now();
      const elapsed = now - lastSendTime;
      if (elapsed < MIN_SEND_INTERVAL) {
        await sleep(MIN_SEND_INTERVAL - elapsed);
      }
      
      const timestamp = Date.now();
      let url = webhookBase;
      
      if (secret) {
        const sign = generateSign(secret, timestamp);
        url = `${webhookBase}&timestamp=${timestamp}&sign=${sign}`;
      }
      
      const body = {
        msgtype: 'markdown',
        markdown: {
          title: title,
          text: `${atText}${text}\n\n---\n*来自 ${sender}*`
        },
        at: { atMobiles, isAtAll }
      };
      
      const res = await requestWithRetry(url, body);
      lastSendTime = Date.now();
      
      console.log(`[DingTalkSender] Markdown 发送成功: ${title}`);
      return res.data;
    });
  } else {
    // 插件模式：转换为文本发送（插件暂不支持 Markdown 格式）
    const markdownText = `### ${title}\n\n${text}\n\n---\n*来自 ${sender}*`;
    return sendViaPlugin(groupConfig.openConversationId, markdownText, {
      sender,
      atTargets,
      messageType: 'markdown'
    });
  }
}

// ==================== 导出 ====================

module.exports = {
  // 统一接口
  sendText,
  sendMarkdown,
  sendToGroup,
  sendToUser,
  
  // 底层接口
  sendViaWebhook,
  sendViaPlugin,
  
  // 工具函数
  parseAtTargets,
  getUserPhoneMap,
  getGroupConfig,
  getUserConfig,
  getSendingMode,
  
  // 兼容旧接口
  generateSign,
  getAvailableWebhooks: () => Object.keys(config.dingtalk?.webhook?.groups || {}),
  setDefaultWebhook: (name) => {
    if (config.dingtalk?.webhook) {
      config.dingtalk.webhook.defaultGroup = name;
    }
  },
  getWebhookConfig: (name) => {
    const groups = config.dingtalk?.webhook?.groups || {};
    return groups[name] ? { name, ...groups[name] } : null;
  }
};
