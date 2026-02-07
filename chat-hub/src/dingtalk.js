const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

// 动态获取用户手机号映射
function getUserPhoneMap() {
  try {
    const userManager = require('./user-manager');
    const dynamicMap = userManager.getDingtalkPhoneMap();
    // 合并配置文件中的映射和数据库中的映射
    return { ...config.userPhones || {}, ...dynamicMap };
  } catch (error) {
    console.warn('[钉钉] 无法获取动态用户映射，使用配置文件映射:', error.message);
    return config.userPhones || {};
  }
}

// 发送队列和锁，防止并发发送
let sendQueue = Promise.resolve();
const MIN_SEND_INTERVAL = 1000; // 最小发送间隔 1 秒
let lastSendTime = 0;

// 频率限制
const RATE_LIMIT = {
  maxPerMinute: 20, // 每分钟最多 20 条
  window: 60000, // 1 分钟
  records: [], // 发送记录
};

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1s
  retryDelayMultiplier: 2, // 指数退避
};

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
 * 检查频率限制
 */
function checkRateLimit() {
  const now = Date.now();
  
  // 清理过期记录
  RATE_LIMIT.records = RATE_LIMIT.records.filter(
    time => now - time < RATE_LIMIT.window
  );
  
  // 检查是否超限
  if (RATE_LIMIT.records.length >= RATE_LIMIT.maxPerMinute) {
    const oldestRecord = RATE_LIMIT.records[0];
    const waitTime = RATE_LIMIT.window - (now - oldestRecord);
    throw new Error(`频率限制：已达到每分钟 ${RATE_LIMIT.maxPerMinute} 条上限，请等待 ${Math.ceil(waitTime / 1000)}s`);
  }
  
  // 记录本次发送
  RATE_LIMIT.records.push(now);
}

/**
 * 带重试的 HTTP 请求
 */
async function requestWithRetry(url, data, retries = 0) {
  try {
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // 10s 超时
    });
    
    if (response.data.errcode !== 0) {
      throw new Error(`钉钉 API 错误: ${response.data.errmsg || '未知错误'}`);
    }
    
    return response;
    
  } catch (error) {
    // 如果还有重试次数
    if (retries < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryDelayMultiplier, retries);
      console.warn(`[钉钉] 请求失败，${delay}ms 后重试 (${retries + 1}/${RETRY_CONFIG.maxRetries}):`, error.message);
      await sleep(delay);
      return requestWithRetry(url, data, retries + 1);
    }
    
    // 重试耗尽，抛出错误
    throw error;
  }
}

/**
 * 带队列的发送（防止并发）
 */
async function queuedSend(sendFn) {
  sendQueue = sendQueue.then(async () => {
    // 检查频率限制
    try {
      checkRateLimit();
    } catch (error) {
      console.error('[钉钉]', error.message);
      throw error;
    }
    
    // 限速
    const now = Date.now();
    const elapsed = now - lastSendTime;
    if (elapsed < MIN_SEND_INTERVAL) {
      await sleep(MIN_SEND_INTERVAL - elapsed);
    }
    
    await sendFn();
    lastSendTime = Date.now();
  }).catch(err => {
    console.error('[钉钉] 队列发送失败:', err.message);
  });
  
  return sendQueue;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 解析 @ 目标，返回手机号列表
 * @param {string|string[]} atTargets - 'all' | 'lin' | 'maple' | ['lin', 'maple']
 * @returns {{ atMobiles: string[], isAtAll: boolean, atText: string }}
 */
function parseAtTargets(atTargets) {
  const USER_PHONES = getUserPhoneMap(); // 动态获取映射
  
  const result = {
    atMobiles: [],
    isAtAll: false,
    atText: ''
  };

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

/**
 * 发送文本消息到钉钉群
 * @param {string} content - 消息内容
 * @param {string} sender - 发送者名称
 * @param {string|string[]} atTargets - @ 目标: 'all' | 'lin' | 'maple' | ['lin', 'maple']
 */
async function sendText(content, sender = 'System', atTargets = null) {
  return queuedSend(async () => {
    const timestamp = Date.now();
    const sign = generateSign(config.dingtalk.secret, timestamp);
    const url = `${config.dingtalk.webhookBase}&timestamp=${timestamp}&sign=${sign}`;

    // 解析 @ 目标
    const { atMobiles, isAtAll, atText } = parseAtTargets(atTargets);

    // 添加发送者标识
    const fullContent = sender 
      ? `${atText}${content} [${sender}]`
      : `${atText}${content}`;

    // 构造消息体
    const data = {
      msgtype: 'text',
      text: {
        content: fullContent
      },
      at: {
        atMobiles,
        isAtAll
      }
    };

    console.log('[钉钉] 发送文本:', content.substring(0, 50));

    try {
      const response = await requestWithRetry(url, data);
      console.log('[钉钉] 发送成功:', sender, '->', content.substring(0, 50));
      if (atMobiles.length > 0) {
        console.log('[钉钉] @用户:', atMobiles.join(', '));
      }
      if (isAtAll) {
        console.log('[钉钉] @所有人');
      }
      return response.data;
    } catch (error) {
      console.error('[钉钉] 发送失败:', error.message);
      throw error;
    }
  });
}

/**
 * 发送 Markdown 消息到钉钉群
 * @param {string} title - 标题
 * @param {string} text - Markdown 内容
 * @param {string} sender - 发送者名称
 * @param {string|string[]} atTargets - @ 目标
 */
async function sendMarkdown(title, text, sender = 'System', atTargets = null) {
  return queuedSend(async () => {
    const timestamp = Date.now();
    const sign = generateSign(config.dingtalk.secret, timestamp);
    const url = `${config.dingtalk.webhookBase}&timestamp=${timestamp}&sign=${sign}`;

    // 解析 @ 目标
    const { atMobiles, isAtAll, atText } = parseAtTargets(atTargets);

    const body = {
      msgtype: 'markdown',
      markdown: {
        title: title,
        text: `${atText}${text}\n\n---\n*来自 ${sender}*`
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: isAtAll
      }
    };

    try {
      const res = await axios.post(url, body, { timeout: 10000 });
      if (res.data.errcode !== 0) {
        console.error('[钉钉] Markdown 发送失败:', res.data);
      }
      return res.data;
    } catch (error) {
      console.error('[钉钉] 请求失败:', error.message);
      throw error;
    }
  });
}

module.exports = { 
  sendText, 
  sendMarkdown, 
  generateSign,
  parseAtTargets,
  getUserPhoneMap
};
