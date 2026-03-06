import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import ChannelPlugin from '../channel-plugin';
import type { PluginConfig, ExecuteResult, StatusInfo } from '../base-plugin';

// 企业微信 API 基础 URL
const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

interface WecomConfig extends PluginConfig {
  corp_id: string;
  agent_id: string;
  secret: string;
  token?: string;
  encoding_aes_key?: string;
}

interface SendOptions {
  type?: 'user' | 'party' | 'tag';
  msgtype?: string;
  content: string | Record<string, unknown>;
}

interface TextCardOptions {
  title: string;
  description: string;
  url: string;
  btntxt?: string;
}

interface SendTextOptions {
  toParty?: string;
  toTag?: string;
  safe?: boolean;
}

interface UploadResult {
  success: boolean;
  mediaId?: string;
  createdAt?: number;
  type?: string;
}

interface DecryptResult {
  message: string;
  fromCorpId: string;
}

interface EncryptResult {
  encrypted: string;
  signature: string;
  timestamp: string;
  nonce: string;
}

interface WecomStatus {
  name: string;
  type: string;
  status: string;
  initialized: boolean;
  corpId: string;
  agentId: string;
  hasToken: boolean;
  tokenExpireTime: string | null;
  hasEncryption: boolean;
}

/**
 * 简单的 XML 解析器
 * 避免依赖 xml2js
 */
function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 匹配 <key>value</key> 或 <key><![CDATA[value]]></key>
  const regex = /<([^>]+)>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/\1>/g;
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
function buildXml(obj: Record<string, string | number | undefined | null>): string {
  let xml = '<xml>';
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      const strValue = String(value);
      // 转义特殊字符或使用 CDATA
      if (/[<>&'"]/.test(strValue)) {
        xml += `<${key}><![CDATA[${strValue}]]></${key}>`;
      } else {
        xml += `<${key}>${strValue}</${key}>`;
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
  private corpId: string;
  private agentId: string;
  private secret: string;
  private token?: string;
  private encodingAesKey?: string;

  // Token 缓存
  private accessToken: string | null;
  private tokenExpireTime: number;

  constructor(config: WecomConfig = {} as WecomConfig) {
    super(config);
    this.name = 'wecom-channel';
    this.type = 'channel';
    this.channelTypes = ['wecom', 'wechat_work'];
    this.capabilities = ['send', 'receive', 'send_image', 'send_file', 'reply'];

    // 企业微信配置
    this.corpId = config.corp_id;
    this.agentId = config.agent_id;
    this.secret = config.secret;
    this.token = config.token;
    this.encodingAesKey = config.encoding_aes_key;

    // Token 缓存
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 初始化插件
   */
  async init(): Promise<ExecuteResult> {
    if (!this.corpId || !this.agentId || !this.secret) {
      throw new Error('企业微信插件配置不完整：需要 corp_id, agent_id, secret');
    }

    try {
      // 获取 access_token 测试连接
      await this.getAccessToken();
      console.log('[Wecom] 初始化成功, corpId:', this.corpId, 'agentId:', this.agentId);
      this._initialized = true;
      this._status = 'ready';
      return { success: true, message: '企业微信插件初始化成功' };
    } catch (error) {
      console.error('[Wecom] 初始化失败:', error instanceof Error ? error.message : error);
      this._status = 'error';
      this._lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * 获取 access_token
   */
  async getAccessToken(): Promise<string> {
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
              resolve(this.accessToken!);
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
  private async request(apiPath: string, method: 'GET' | 'POST' = 'GET', body: Record<string, unknown> | null = null): Promise<Record<string, unknown>> {
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
   */
  async sendMessage(target: string, message: SendOptions): Promise<ExecuteResult> {
    const { type = 'user', msgtype = 'text', content } = message;

    const body: Record<string, unknown> = {
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

    return this.sendRaw(body as Record<string, unknown>);
  }

  /**
   * 发送原始消息
   */
  async sendRaw(message: Record<string, unknown>): Promise<ExecuteResult> {
    if (!this._initialized) {
      throw new Error('企业微信插件未初始化');
    }

    try {
      const result = await this.request('/message/send', 'POST', message) as Record<string, unknown>;

      if (result.errcode === 0) {
        console.log('[Wecom] 消息发送成功, msgId:', result.msgid);
        this._emitMessage({
          direction: 'sent',
          msgId: result.msgid,
          ...message
        });
        return {
          success: true,
          msgId: result.msgid as string,
          invaliduser: result.invaliduser as string,
          invalidparty: result.invalidparty as string,
          invalidtag: result.invalidtag as string
        };
      } else {
        console.error('[Wecom] 消息发送失败:', result.errmsg);
        return {
          success: false,
          error: result.errmsg as string,
          code: result.errcode as number
        };
      }
    } catch (error) {
      console.error('[Wecom] 消息发送异常:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * 发送文本消息
   */
  async sendText(toUser: string, content: string, options: SendTextOptions = {}): Promise<ExecuteResult> {
    const message: Record<string, unknown> = {
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
   */
  async sendImage(toUser: string, mediaId: string, options: SendTextOptions = {}): Promise<ExecuteResult> {
    const message: Record<string, unknown> = {
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
   */
  async sendFile(toUser: string, mediaId: string, options: SendTextOptions = {}): Promise<ExecuteResult> {
    const message: Record<string, unknown> = {
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
   */
  async sendMarkdown(toUser: string, content: string): Promise<ExecuteResult> {
    const message: Record<string, unknown> = {
      touser: toUser,
      msgtype: 'markdown',
      agentid: parseInt(this.agentId),
      markdown: { content }
    };

    return this.sendRaw(message);
  }

  /**
   * 发送文本卡片消息
   */
  async sendTextCard(toUser: string, card: TextCardOptions): Promise<ExecuteResult> {
    const message: Record<string, unknown> = {
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
   * 上传临时素材
   */
  async uploadMedia(file: Buffer | string, type: 'image' | 'voice' | 'video' | 'file' = 'file', filename: string = 'file'): Promise<UploadResult> {
    const token = await this.getAccessToken();

    // 如果是文件路径，读取文件
    let fileBuffer: Buffer;
    if (typeof file === 'string' && fs.existsSync(file)) {
      fileBuffer = fs.readFileSync(file);
    } else {
      fileBuffer = file as Buffer;
    }

    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const url = `${WECOM_API_BASE}/media/upload?access_token=${token}&type=${type}`;

      const parts: string[] = [];
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
   * 验证回调 URL
   */
  verifyCallback(signature: string, timestamp: string, nonce: string, echostr?: string): { valid: boolean; error?: string; echostr?: string } {
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
        return { valid: false, error: '解密失败: ' + (error instanceof Error ? error.message : String(error)) };
      }
    }

    return { valid: true, echostr };
  }

  /**
   * 解析回调消息
   */
  async parseCallback(body: string): Promise<Record<string, string>> {
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
   */
  decrypt(encrypted: string): DecryptResult {
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
   * 加密消息
   */
  encryptMessage(message: string, nonce: string, timestamp: string): EncryptResult {
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
   */
  replyText(toUser: string, fromUser: string, content: string): string {
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
      const encrypted = this.encryptMessage(replyXml, nonce, timestamp);
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
  async testConnection(): Promise<ExecuteResult> {
    try {
      await this.getAccessToken();
      return {
        success: true,
        message: '企业微信连接成功',
        corpId: this.corpId,
        agentId: this.agentId
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 获取插件状态
   */
  getStatus(): WecomStatus & StatusInfo {
    return {
      name: this.name,
      type: this.type,
      status: this._status,
      initialized: this._initialized,
      lastError: this._lastError,
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
  async close(): Promise<void> {
    this.accessToken = null;
    this.tokenExpireTime = 0;
    this._initialized = false;
    this._status = 'disabled';
    console.log('[Wecom] 插件已关闭');
  }
}

// 单例实例
let instance: WecomChannelPlugin | null = null;

/**
 * 获取企业微信插件实例
 */
function getWecomChannel(config: WecomConfig): WecomChannelPlugin | null {
  if (!instance && config) {
    instance = new WecomChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化企业微信插件
 */
async function initWecomChannel(config: WecomConfig): Promise<WecomChannelPlugin> {
  const plugin = getWecomChannel(config);
  if (!plugin) {
    throw new Error('Failed to create wecom channel plugin');
  }
  await plugin.init();
  return plugin;
}

export {
  WecomChannelPlugin,
  getWecomChannel,
  initWecomChannel,
  parseXml,
  buildXml
};
export type { WecomConfig, SendOptions, TextCardOptions, SendTextOptions, UploadResult, WecomStatus };