/**
 * 钉钉通道插件
 * 
 * 参考实现：openclaw-channel-dingtalk
 * 文档：https://open.dingtalk.com/document/robots/custom-robot-access
 */
const ChannelPlugin = require('./channel-plugin');
const crypto = require('crypto');
const https = require('https');

class DingTalkChannel extends ChannelPlugin {
  constructor(config) {
    super(config);
    this.name = 'dingtalk-channel';
    this.type = 'channel';
    this.webhooks = config.webhooks || {};
    this.defaultWebhook = config.defaultWebhook || Object.keys(this.webhooks)[0];
    this.userPhones = config.userPhones || {};
    this.replyMode = config.replyMode || 'text';
  }

  async init() {
    if (!this.webhooks || Object.keys(this.webhooks).length === 0) {
      return { success: false, error: '缺少 Webhook 配置' };
    }
    console.log('[DingTalkChannel] 初始化成功，已配置', Object.keys(this.webhooks).length, '个 Webhook');
    return { success: true };
  }

  async sendMessage(to, content, options = {}) {
    const webhookName = options.webhook || this.defaultWebhook;
    const webhook = this.webhooks[webhookName];
    if (!webhook) return { success: false, error: 'Webhook 不存在: ' + webhookName };
    
    if (typeof content === 'string') return this.sendText(webhook, content, options);
    if (content.type === 'markdown') return this.sendMarkdown(webhook, content, options);
    if (content.type === 'link') return this.sendLink(webhook, content, options);
    return { success: false, error: '不支持的消息类型' };
  }

  async sendText(webhook, text, options = {}) {
    const atMobiles = this._resolveAtPhones(options.at || []);
    const message = {
      msgtype: 'text',
      text: { content: text },
      at: { atMobiles, isAtAll: options.atAll || false }
    };
    return this._sendRequest(webhook, message);
  }

  async sendMarkdown(webhook, content, options = {}) {
    const atMobiles = this._resolveAtPhones(options.at || []);
    let text = content.text || content;
    if (atMobiles.length > 0) text += '\n\n' + atMobiles.map(m => '@' + m).join(' ');
    
    const message = {
      msgtype: 'markdown',
      markdown: { title: content.title || '消息', text },
      at: { atMobiles, isAtAll: options.atAll || false }
    };
    return this._sendRequest(webhook, message);
  }

  async sendLink(webhook, content, options = {}) {
    const message = {
      msgtype: 'link',
      link: {
        title: content.title,
        text: content.text,
        picUrl: content.picUrl || '',
        messageUrl: content.messageUrl
      }
    };
    return this._sendRequest(webhook, message);
  }

  async parseWebhook(body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      const messages = [];
      if (data.msgtype === 'text') {
        messages.push({
          type: 'text',
          content: data.text?.content || '',
          sender: data.senderNick || data.senderId,
          chatId: data.conversationId,
          timestamp: data.createAt || Date.now()
        });
      }
      return { success: true, messages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testConnection(webhookName) {
    const webhook = this.webhooks[webhookName || this.defaultWebhook];
    if (!webhook) return { success: false, error: 'Webhook 不存在' };
    return this.sendText(webhook, '🔔 钉钉通道连接测试成功！');
  }

  _sendRequest(webhook, message) {
    return new Promise((resolve) => {
      const url = this._buildSignedUrl(webhook);
      const urlObj = new URL(url);
      const postData = JSON.stringify(message);
      
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const r = JSON.parse(data);
            resolve(r.errcode === 0 ? { success: true } : { success: false, error: r.errmsg });
          } catch (e) { resolve({ success: false, error: '响应解析失败' }); }
        });
      });
      req.on('error', (e) => { resolve({ success: false, error: e.message }); });
      req.write(postData);
      req.end();
    });
  }

  _buildSignedUrl(webhook) {
    let url = webhook.webhookBase || webhook.webhook;
    if (webhook.secret) {
      const timestamp = Date.now();
      const sign = this._generateSign(timestamp, webhook.secret);
      url += '&timestamp=' + timestamp + '&sign=' + encodeURIComponent(sign);
    }
    return url;
  }

  _generateSign(timestamp, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(timestamp + '\n' + secret);
    return hmac.digest('base64');
  }

  _resolveAtPhones(userNames) {
    return userNames.map(name => /^\d{11}$/.test(name) ? name : this.userPhones[name] || name).filter(p => /^\d{11}$/.test(p));
  }

  getInfo() {
    return { id: this.id, name: this.name, webhooks: Object.keys(this.webhooks) };
  }
}

module.exports = DingTalkChannel;
