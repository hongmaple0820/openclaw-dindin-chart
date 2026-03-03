/**
 * 企业微信通道插件
 * 支持发送和接收企业微信消息
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const https = require('https');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const ChannelPlugin = require('../channel-plugin');

// 企业微信 API 基础 URL
const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

/**
 * 简单的 XML 解析器
 * 避免依赖 xml2js
 */
function parseXml(xml) {
  const result = {};
  
  // 匹配 <key>value</key> 或 <key><![CDATA[value]]></key>
  const regex = /<([^>]+)>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/\1>/gs;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1];
    const value = match[2] || match[3] || '';
    result[key] = value;
  }
  
  return result;
}

/**
 * 简单的 XML 生成器
 */
function buildXml(obj) {
  let xml = '<xml>';
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      // 转义特殊字符或使用 CDATA
      if (/[<>&'"]/.test(value)) {
        xml += `<${key}><![CDATA[${value}]]></${key}>`;
      } else {
        xml += `<${key}>${value}</${key}>`;
      }
    }
  }
  xml += '</xml>';
  return xml;
}

/**
 * 企业微信通道插件
 */
class WecomChannelPlugin extends ChannelPlugin {
  constructor(config = {}) {
    super(config);
    this.name = 'wecom-channel';
    this.type = 'channel';
    this.channelTypes = ['wecom', 'wechat_work'];
    this.capabilities = ['send', 'receive', 'send_image', 'send_file', 'reply'];
    
    // 企业微信配置
    this.corpId = config.corp_id;
    this.agentId = config.agent_id;
    this.secret = config.secret;
    this.token = config.token;           // 回调 Token
    this.encodingAesKey = config.encoding_aes_key;  // 加密 Key
    
    // Token 缓存
    this.accessToken = null;
    this.tokenExpireTime = 0;
    
    // 消息回调
    this._messageCallbacks = new Set();
  }

  /**
   * 初始化插件
   */
  async init() {
    if (!this.corpId || !this.agentId || !this.secret) {
      throw new Error('企业微信插件配置不完整：需要 corp_id, agent_id, secret');
    }

    try {
      // 获取 access_token 测试连接
      const token = await this.getAccessToken();
      console.log('[Wecom] 初始化成功, corpId:', this.corpId, 'agentId:', this.agentId);
      this._initialized = true;
      this._status = 'ready';
      return { success: true, message: '企业微信插件初始化成功' };
    } catch (error) {
      console.error('[Wecom] 初始化失败:', error.message);
      this._status = 'error';
      this._lastError = error.message;
      throw error;
    }
  }

  /**
   * 获取 access_token
   * 自动缓存，过期前自动刷新
   */
  async getAccessToken() {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      const url = `${WECOM_API_BASE}/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.errcode === 0) {
              this.accessToken = result.access_token;
              // 提前 5 分钟过期，避免临界情况
              this.tokenExpireTime = Date.now() + (result.expires_in - 300) * 1000;
              console.log('[Wecom] access_token 获取成功，有效期:', result.expires_in, '秒');
              resolve(this.accessToken);
            } else {
              reject(new Error(`获取 access_token 失败: ${result.errmsg} (${result.errcode})`));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 发送 HTTP 请求到企业微信 API
   */
  async request(apiPath, method = 'GET', body = null) {
    const token = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const url = `${WECOM_API_BASE}${apiPath}${apiPath.includes('?') ? '&' : '?'}access_token=${token}`;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  /**
   * 发送消息（ChannelPlugin 基类方法）
   * @param {string} target - 目标用户/部门/标签
   * @param {object} message - 消息内容
   */
  async sendMessage(target, message) {
    const { type = 'user', msgtype = 'text', content } = message;
    
    const body = {
      msgtype,
      agentid: parseInt(this.agentId),
      [msgtype]: typeof content === 'string' ? { content } : content
    };

    // 设置接收者
    if (type === 'user' || !type) {
      body.touser = target;
    } else if (type === 'party') {
      body.toparty = target;
    } else if (type === 'tag') {
      body.totag = target;
    }

    return this.sendRaw(body);
  }

  /**
   * 发送原始消息（直接调用企业微信 API）
   * @param {object} message - 完整的消息体
   */
  async sendRaw(message) {
    if (!this._initialized) {
      throw new Error('企业微信插件未初始化');
    }

    try {
      const result = await this.request('/message/send', 'POST', message);
      
      if (result.errcode === 0) {
        console.log('[Wecom] 消息发送成功, msgId:', result.msgid);
        this._emitMessage({
          direction: 'sent',
          msgId: result.msgid,
          ...message
        });
        return {
          success: true,
          msgId: result.msgid,
          invaliduser: result.invaliduser,
          invalidparty: result.invalidparty,
          invalidtag: result.invalidtag
        };
      } else {
        console.error('[Wecom] 消息发送失败:', result.errmsg);
        return {
          success: false,
          error: result.errmsg,
          code: result.errcode
        };
      }
    } catch (error) {
      console.error('[Wecom] 消息发送异常:', error.message);
      throw error;
    }
  }

  /**
   * 发送文本消息
   * @param {string} toUser - 接收用户ID
   * @param {string} content - 消息内容
   * @param {object} options - 其他选项（toParty, toTag, safe）
   */
  async sendText(toUser, content, options = {}) {
    const message = {
      touser: toUser,
      toparty: options.toParty,
      totag: options.toTag,
      msgtype: 'text',
      agentid: parseInt(this.agentId),
      text: { content },
      safe: options.safe ? 1 : 0
    };

    return this.sendRaw(message);
  }

  /**
   * 发送图片消息
   * @param {string} toUser - 接收用户ID
   * @param {string} mediaId - 图片素材ID
   * @param {object} options - 其他选项
   */
  async sendImage(toUser, mediaId, options = {}) {
    const message = {
      touser: toUser,
      toparty: options.toParty,
      totag: options.toTag,
      msgtype: 'image',
      agentid: parseInt(this.agentId),
      image: { media_id: mediaId },
      safe: options.safe ? 1 : 0
    };

    return this.sendRaw(message);
  }

  /**
   * 发送文件消息
   * @param {string} toUser - 接收用户ID
   * @param {string} mediaId - 文件素材ID
   * @param {object} options - 其他选项
   */
  async sendFile(toUser, mediaId, options = {}) {
    const message = {
      touser: toUser,
      toparty: options.toParty,
      totag: options.toTag,
      msgtype: 'file',
      agentid: parseInt(this.agentId),
      file: { media_id: mediaId }
    };

    return this.sendRaw(message);
  }

  /**
   * 发送 Markdown 消息
   * @param {string} toUser - 接收用户ID
   * @param {string} content - Markdown 内容
   */
  async sendMarkdown(toUser, content) {
    const message = {
      touser: toUser,
      msgtype: 'markdown',
      agentid: parseInt(this.agentId),
      markdown: { content }
    };

    return this.sendRaw(message);
  }

  /**
   * 发送文本卡片消息
   * @param {string} toUser - 接收用户ID
   * @param {object} card - 卡片内容 {title, description, url, btntxt}
   */
  async sendTextCard(toUser, card) {
    const message = {
      touser: toUser,
      msgtype: 'textcard',
      agentid: parseInt(this.agentId),
      textcard: {
        title: card.title,
        description: card.description,
        url: card.url,
        btntxt: card.btntxt || '详情'
      }
    };

    return this.sendRaw(message);
  }

  /**
   * 发送模板卡片消息
   * @param {string} toUser - 接收用户ID
   * @param {object} card - 模板卡片内容
   */
  async sendTemplateCard(toUser, card) {
    const message = {
      touser: toUser,
      msgtype: 'template_card',
      agentid: parseInt(this.agentId),
      template_card: card
    };

    return this.sendRaw(message);
  }

  /**
   * 上传临时素材
   * @param {Buffer|string} file - 文件内容或路径
   * @param {string} type - 素材类型 (image, voice, video, file)
   * @param {string} filename - 文件名
   */
  async uploadMedia(file, type = 'file', filename = 'file') {
    const token = await this.getAccessToken();
    const fs = require('fs');
    
    // 如果是文件路径，读取文件
    let fileBuffer = file;
    if (typeof file === 'string' && fs.existsSync(file)) {
      fileBuffer = fs.readFileSync(file);
    }

    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const url = `${WECOM_API_BASE}/media/upload?access_token=${token}&type=${type}`;
      
      const parts = [];
      parts.push(`--${boundary}`);
      parts.push(`Content-Disposition: form-data; name="media"; filename="${filename}"`);
      parts.push('Content-Type: application/octet-stream');
      parts.push('');
      parts.push('');
      
      const preamble = Buffer.from(parts.join('\r\n'), 'utf8');
      const postamble = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const contentLength = preamble.length + fileBuffer.length + postamble.length;

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': contentLength
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.errcode === 0 || result.media_id) {
              resolve({
                success: true,
                mediaId: result.media_id,
                createdAt: result.created_at,
                type: result.type
              });
            } else {
              reject(new Error(`上传素材失败: ${result.errmsg} (${result.errcode})`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(preamble);
      req.write(fileBuffer);
      req.write(postamble);
      req.end();
    });
  }

  /**
   * 获取临时素材
   * @param {string} mediaId - 素材ID
   */
  async getMedia(mediaId) {
    const token = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const url = `${WECOM_API_BASE}/media/get?access_token=${token}&media_id=${mediaId}`;
      
      https.get(url, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          // 检查是否是错误响应
          const contentType = res.headers['content-type'];
          if (contentType && contentType.includes('application/json')) {
            try {
              const result = JSON.parse(buffer.toString());
              reject(new Error(`获取素材失败: ${result.errmsg} (${result.errcode})`));
            } catch (e) {
              reject(e);
            }
          } else {
            resolve({
              data: buffer,
              contentType,
              filename: res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1]
            });
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 验证回调 URL（首次配置回调时使用）
   * @param {string} signature - 签名
   * @param {string} timestamp - 时间戳
   * @param {string} nonce - 随机数
   * @param {string} echostr - 加密的随机字符串
   */
  verifyCallback(signature, timestamp, nonce, echostr) {
    if (!this.token) {
      throw new Error('回调 Token 未配置');
    }

    // 验证签名
    const arr = [this.token, timestamp, nonce].sort();
    const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
    
    if (sha1 !== signature) {
      return { valid: false, error: '签名验证失败' };
    }

    // 解密 echostr
    if (this.encodingAesKey && echostr) {
      try {
        const decrypted = this.decrypt(echostr);
        return { valid: true, echostr: decrypted.message };
      } catch (error) {
        return { valid: false, error: '解密失败: ' + error.message };
      }
    }

    return { valid: true, echostr };
  }

  /**
   * 解析回调消息
   * @param {string} body - 回调请求体
   */
  async parseCallback(body) {
    // 如果是加密消息
    if (body.includes('<Encrypt>')) {
      if (!this.encodingAesKey) {
        throw new Error('收到加密消息但 EncodingAESKey 未配置');
      }
      
      const parsed = parseXml(body);
      const decrypted = this.decrypt(parsed.Encrypt);
      
      // 解析解密后的消息
      return parseXml(decrypted.message);
    }
    
    // 非加密消息直接解析
    return parseXml(body);
  }

  /**
   * 解密消息
   * @param {string} encrypted - 加密的消息
   */
  decrypt(encrypted) {
    if (!this.encodingAesKey) {
      throw new Error('EncodingAESKey 未配置');
    }

    // AES Key 是 Base64 编码的，需要解码
    const aesKey = Buffer.from(this.encodingAesKey + '=', 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesKey.slice(0, 16));
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final()
    ]);

    // 去除补位
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, -pad);

    // 解析内容
    const content = decrypted.slice(16);
    const msgLen = content.readUInt32BE(0);
    const message = content.slice(4, 4 + msgLen).toString('utf8');
    const fromCorpId = content.slice(4 + msgLen).toString('utf8');

    return { message, fromCorpId };
  }

  /**
   * 加密消息（用于被动回复）
   * @param {string} message - 要加密的消息
   * @param {string} nonce - 随机数
   * @param {string} timestamp - 时间戳
   */
  encrypt(message, nonce, timestamp) {
    if (!this.encodingAesKey || !this.token) {
      throw new Error('EncodingAESKey 或 Token 未配置');
    }

    const aesKey = Buffer.from(this.encodingAesKey + '=', 'base64');
    
    // 生成随机 16 字节
    const random = crypto.randomBytes(16);
    
    // 消息内容
    const msgBuffer = Buffer.from(message, 'utf8');
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(msgBuffer.length, 0);
    
    // CorpId
    const corpIdBuffer = Buffer.from(this.corpId, 'utf8');
    
    // 组合内容
    const content = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer]);
    
    // PKCS7 补位
    const blockSize = 32;
    const padLen = blockSize - (content.length % blockSize);
    const padded = Buffer.concat([content, Buffer.alloc(padLen, padLen)]);
    
    // AES 加密
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesKey.slice(0, 16));
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    
    // 计算签名
    const arr = [this.token, timestamp, nonce, encrypted.toString('base64')].sort();
    const signature = crypto.createHash('sha1').update(arr.join('')).digest('hex');

    return {
      encrypted: encrypted.toString('base64'),
      signature,
      timestamp,
      nonce
    };
  }

  /**
   * 被动回复文本消息
   * @param {string} toUser - 接收用户
   * @param {string} fromUser - 发送者（应用）
   * @param {string} content - 回复内容
   */
  replyText(toUser, fromUser, content) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2);
    
    const replyXml = buildXml({
      ToUserName: toUser,
      FromUserName: fromUser,
      CreateTime: timestamp,
      MsgType: 'text',
      Content: content
    });

    if (this.encodingAesKey) {
      const encrypted = this.encrypt(replyXml, nonce, timestamp);
      return buildXml({
        Encrypt: encrypted.encrypted,
        MsgSignature: encrypted.signature,
        TimeStamp: encrypted.timestamp,
        Nonce: encrypted.nonce
      });
    }

    return replyXml;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      return { 
        success: true, 
        message: '企业微信连接成功',
        corpId: this.corpId,
        agentId: this.agentId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取插件状态
   */
  getStatus() {
    return {
      name: this.name,
      type: this.type,
      status: this._status,
      initialized: this._initialized,
      corpId: this.corpId,
      agentId: this.agentId,
      hasToken: !!this.accessToken,
      tokenExpireTime: this.tokenExpireTime ? new Date(this.tokenExpireTime).toISOString() : null,
      hasEncryption: !!this.encodingAesKey
    };
  }

  /**
   * 关闭插件
   */
  async close() {
    this.accessToken = null;
    this.tokenExpireTime = 0;
    this._initialized = false;
    this._status = 'disabled';
    console.log('[Wecom] 插件已关闭');
  }
}

// 单例实例
let instance = null;

/**
 * 获取企业微信插件实例
 */
function getWecomChannel(config) {
  if (!instance && config) {
    instance = new WecomChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化企业微信插件
 */
async function initWecomChannel(config) {
  const plugin = getWecomChannel(config);
  await plugin.init();
  return plugin;
}

module.exports = {
  WecomChannelPlugin,
  getWecomChannel,
  initWecomChannel,
  parseXml,
  buildXml
};
