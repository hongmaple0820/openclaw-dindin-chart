/**
 * 企业微信连接实现
 * 
 * 实现企业微信(WeCom)平台的消息收发
 * 文档: https://developer.work.weixin.qq.com/document/path/91770
 * 
 * @author 小琳
 * @date 2026-03-06
 */

import { BaseConnection, UnifiedMessage, ConnectionConfig } from './index';
import * as crypto from 'crypto';

/** 企业微信连接配置 */
export interface WeComConfig extends ConnectionConfig {
  platform: 'wecom';
  credentials: {
    webhookUrl: string;
    secret?: string;
  };
  options?: {
    defaultGroup?: string;
    groups?: Record<string, {
      webhookUrl: string;
      secret?: string;
    }>;
  };
}

/** 企业微信消息类型 */
type WeComMsgType = 'text' | 'markdown' | 'image' | 'news' | 'file' | 'template_card';

/** 企业微信文本消息 */
interface WeComTextMessage {
  msgtype: 'text';
  text: {
    content: string;
    mentioned_list?: string[];
    mentioned_mobile_list?: string[];
  };
}

/** 企业微信 Markdown 消息 */
interface WeComMarkdownMessage {
  msgtype: 'markdown';
  markdown: {
    content: string;
  };
}

/** 企业微信图片消息 */
interface WeComImageMessage {
  msgtype: 'image';
  image: {
    base64: string;
    md5: string;
  };
}

/** 企业微信图文消息 */
interface WeComNewsMessage {
  msgtype: 'news';
  news: {
    articles: Array<{
      title: string;
      description?: string;
      url: string;
      picurl?: string;
    }>;
  };
}

/** 企业微信消息联合类型 */
type WeComMessage = WeComTextMessage | WeComMarkdownMessage | WeComImageMessage | WeComNewsMessage;

/** 企业微信响应 */
interface WeComResponse {
  errcode: number;
  errmsg: string;
}

/**
 * 企业微信连接类
 */
export class WeComConnection extends BaseConnection {
  private wecomConfig: WeComConfig;
  private groups: Map<string, { webhookUrl: string; secret?: string }> = new Map();

  constructor(config: WeComConfig) {
    super(config);
    this.wecomConfig = config;
    
    // 初始化群组配置
    if (config.options?.groups) {
      for (const [name, group] of Object.entries(config.options.groups)) {
        this.groups.set(name, {
          webhookUrl: group.webhookUrl,
          secret: group.secret
        });
      }
    }
  }

  /**
   * 连接（企业微信 webhook 不需要持久连接）
   */
  async connect(): Promise<void> {
    this.updateStatus('connected');
    console.log('[WeCom] 连接成功');
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.updateStatus('disconnected');
    console.log('[WeCom] 已断开');
  }

  /**
   * 发送消息
   */
  async send(message: UnifiedMessage): Promise<void> {
    const groupId = message.recipient.id;
    const group = this.groups.get(groupId) || this.groups.get(this.wecomConfig.options?.defaultGroup || '');
    
    if (!group) {
      throw new Error(`未找到群组配置: ${groupId}`);
    }

    const wecomMessage = this.convertToWeComFormat(message);
    const url = this.buildWebhookUrl(group);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wecomMessage)
    });

    const result = await response.json() as WeComResponse;
    
    if (result.errcode !== 0) {
      throw new Error(`企业微信发送失败: ${result.errmsg} (code: ${result.errcode})`);
    }

    console.log(`[WeCom] 消息发送成功: ${message.id}`);
  }

  /**
   * 接收消息（由 OpenClaw 插件或回调调用）
   */
  receiveMessage(rawMessage: {
    senderId: string;
    senderName: string;
    groupId: string;
    groupName: string;
    content: string;
    msgtype: string;
  }): void {
    const message: UnifiedMessage = {
      id: `wecom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: 'wecom',
      direction: 'inbound',
      type: this.mapMessageType(rawMessage.msgtype),
      content: rawMessage.content,
      sender: {
        id: rawMessage.senderId,
        name: rawMessage.senderName,
        type: 'human'
      },
      recipient: {
        id: rawMessage.groupId,
        type: 'group',
        name: rawMessage.groupName
      },
      timestamp: Date.now()
    };

    this.emitMessage(message);
  }

  /**
   * 处理企业微信回调消息
   * 用于接收企业微信服务器推送的消息
   */
  handleCallback(callbackData: {
    ToUserName: string;
    FromUserName: string;
    CreateTime: number;
    MsgType: string;
    Content?: string;
    PicUrl?: string;
    MediaId?: string;
    Event?: string;
  }): void {
    const message: UnifiedMessage = {
      id: `wecom_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: 'wecom',
      direction: 'inbound',
      type: this.mapMessageType(callbackData.MsgType),
      content: callbackData.Content || callbackData.Event || '',
      sender: {
        id: callbackData.FromUserName,
        name: callbackData.FromUserName,
        type: 'human'
      },
      recipient: {
        id: callbackData.ToUserName,
        type: 'user'
      },
      metadata: {
        msgType: callbackData.MsgType,
        picUrl: callbackData.PicUrl,
        mediaId: callbackData.MediaId,
        event: callbackData.Event
      },
      timestamp: callbackData.CreateTime * 1000
    };

    this.emitMessage(message);
  }

  /**
   * 转换为企业微信消息格式
   */
  private convertToWeComFormat(message: UnifiedMessage): WeComMessage {
    // 提取 @ 用户和手机号
    const { mentionedList, mentionedMobileList } = this.extractMentions(message.content);

    if (message.type === 'markdown') {
      return {
        msgtype: 'markdown',
        markdown: {
          content: message.content
        }
      };
    }

    if (message.type === 'image' && message.metadata?.base64 && message.metadata?.md5) {
      return {
        msgtype: 'image',
        image: {
          base64: message.metadata.base64 as string,
          md5: message.metadata.md5 as string
        }
      };
    }

    // 默认发送文本消息
    return {
      msgtype: 'text',
      text: {
        content: message.content,
        mentioned_list: mentionedList.length > 0 ? mentionedList : undefined,
        mentioned_mobile_list: mentionedMobileList.length > 0 ? mentionedMobileList : undefined
      }
    };
  }

  /**
   * 提取 @ 用户和手机号
   * 企业微信格式: <@user_id> 或 @手机号
   */
  private extractMentions(content: string): {
    mentionedList: string[];
    mentionedMobileList: string[];
  } {
    // 提取用户ID: <@user_id>
    const userIdPattern = /<@([^>]+)>/g;
    const userIds: string[] = [];
    let match;
    while ((match = userIdPattern.exec(content)) !== null) {
      userIds.push(match[1]);
    }

    // 提取手机号: @13800138000
    const mobilePattern = /@(\d{11})/g;
    const mobiles: string[] = [];
    while ((match = mobilePattern.exec(content)) !== null) {
      mobiles.push(match[1]);
    }

    return {
      mentionedList: userIds,
      mentionedMobileList: mobiles
    };
  }

  /**
   * 构建 Webhook URL（含签名）
   */
  private buildWebhookUrl(group: { webhookUrl: string; secret?: string }): string {
    if (!group.secret) {
      return group.webhookUrl;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `${timestamp}\n${group.secret}`;
    
    // 使用 HMAC-SHA256 签名
    const hmac = crypto.createHmac('sha256', group.secret);
    hmac.update(stringToSign);
    const sign = encodeURIComponent(hmac.digest('base64'));

    return `${group.webhookUrl}&timestamp=${timestamp}&sign=${sign}`;
  }

  /**
   * 映射消息类型
   */
  private mapMessageType(msgtype: string): 'text' | 'image' | 'markdown' | 'file' | 'audio' | 'video' {
    const typeMap: Record<string, 'text' | 'image' | 'markdown' | 'file' | 'audio' | 'video'> = {
      text: 'text',
      markdown: 'markdown',
      image: 'image',
      picture: 'image',
      file: 'file',
      voice: 'audio',
      video: 'video',
      event: 'text'
    };
    return typeMap[msgtype.toLowerCase()] || 'text';
  }

  /**
   * 验证回调签名
   * 用于验证企业微信服务器推送的消息合法性
   */
  static verifyCallback(token: string, encodingAESKey: string, signature: string, timestamp: string, nonce: string, echostr?: string): boolean {
    // 企业微信回调验证使用 SHA1
    const arr = [token, timestamp, nonce].sort();
    const sha1 = crypto.createHash('sha1');
    sha1.update(arr.join(''));
    const calculatedSignature = sha1.digest('hex');
    return calculatedSignature === signature;
  }

  /**
   * 解密回调消息
   * 企业微信使用 AES-256-CBC 加密
   */
  static decryptMessage(encodingAESKey: string, encryptedMsg: string): string {
    const key = Buffer.from(encodingAESKey + '=', 'base64');
    const iv = key.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let decrypted = decipher.update(encryptedMsg, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // 移除 padding 和随机字符串
    const content = decrypted.slice(20);
    const len = content.charCodeAt(0) * 256 * 256 * 256 +
                content.charCodeAt(1) * 256 * 256 +
                content.charCodeAt(2) * 256 +
                content.charCodeAt(3);
    
    return content.slice(4, 4 + len);
  }
}

export default WeComConnection;