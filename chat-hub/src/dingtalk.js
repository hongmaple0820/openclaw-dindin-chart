const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/default.json');

// 用户手机号映射
const USER_PHONES = {
  'lin': '16670151072',
  'maple': '19976618156',
  '鸿枫': '19976618156'
};

// 发送队列和锁，防止并发发送
let sendQueue = Promise.resolve();
const MIN_SEND_INTERVAL = 1000; // 最小发送间隔 1 秒
let lastSendTime = 0;

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
 * 带队列的发送（防止并发）
 */
async function queuedSend(sendFn) {
  sendQueue = sendQueue.then(async () => {
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

    // 添加发送者标识和 @ 文本
    const fullContent = sender 
      ? `${atText}${content} [${sender}]`
      : `${atText}${content}`;

    const body = {
      msgtype: 'text',
      text: {
        content: fullContent
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: isAtAll
      }
    };

    try {
      const res = await axios.post(url, body, { timeout: 10000 });
      if (res.data.errcode !== 0) {
        console.error('[钉钉] 发送失败:', res.data);
      } else {
        console.log('[钉钉] 发送成功:', sender, '->', content.substring(0, 50));
        if (atMobiles.length > 0) {
          console.log('[钉钉] @用户:', atMobiles.join(', '));
        }
        if (isAtAll) {
          console.log('[钉钉] @所有人');
        }
      }
      return res.data;
    } catch (error) {
      console.error('[钉钉] 请求失败:', error.message);
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
  USER_PHONES
};
