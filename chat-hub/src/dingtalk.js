const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/default.json');

/**
 * 生成钉钉签名
 * @param {string} secret - 密钥
 * @param {number} timestamp - 时间戳（毫秒）
 * @returns {string} - 签名
 */
function generateSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}

/**
 * 发送文本消息到钉钉群
 * @param {string} content - 消息内容
 * @param {string} sender - 发送者名称（会附加到消息末尾）
 * @param {string[]} atMobiles - 要@的手机号列表
 * @param {boolean} isAtAll - 是否@所有人
 */
async function sendText(content, sender = 'System', atMobiles = [], isAtAll = false) {
  const timestamp = Date.now();
  const sign = generateSign(config.dingtalk.secret, timestamp);
  const url = `${config.dingtalk.webhookBase}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    msgtype: 'text',
    text: {
      content: `${content} [${sender}]`
    },
    at: {
      atMobiles: atMobiles,
      isAtAll: isAtAll
    }
  };

  try {
    const res = await axios.post(url, body);
    if (res.data.errcode !== 0) {
      console.error('[钉钉] 发送失败:', res.data);
    } else {
      console.log('[钉钉] 发送成功:', sender, '->', content.substring(0, 50));
    }
    return res.data;
  } catch (error) {
    console.error('[钉钉] 请求失败:', error.message);
    throw error;
  }
}

/**
 * 发送 Markdown 消息到钉钉群
 * @param {string} title - 标题
 * @param {string} text - Markdown 内容
 * @param {string} sender - 发送者名称
 */
async function sendMarkdown(title, text, sender = 'System') {
  const timestamp = Date.now();
  const sign = generateSign(config.dingtalk.secret, timestamp);
  const url = `${config.dingtalk.webhookBase}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    msgtype: 'markdown',
    markdown: {
      title: title,
      text: `${text}\n\n---\n*来自 ${sender}*`
    }
  };

  try {
    const res = await axios.post(url, body);
    return res.data;
  } catch (error) {
    console.error('[钉钉] 请求失败:', error.message);
    throw error;
  }
}

module.exports = { sendText, sendMarkdown, generateSign };
