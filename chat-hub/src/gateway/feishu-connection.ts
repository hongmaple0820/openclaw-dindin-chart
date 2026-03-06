/**
 * 飞书连接实现
 * 
 * 实现飞书(Lark)平台的消息收发
 * 文档: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 * 
 * @author 小琳
 * @date 2026-03-06
 */

import { BaseConnection, UnifiedMessage, ConnectionConfig } from './index';
import * as crypto from 'crypto';

/** 飞书连接配置 */
export interface FeishuConfig extends ConnectionConfig {
  platform: 'feishu';
  credentials: {
    webhookUrl: string;
    secret?: string;
    /** 应用凭证（用于 API 调用） */
    appId?: string;
    appSecret?: string;
  };
  options?: {
    defaultGroup?: string;
    groups?: Record<string, {
      webhookUrl: string;
      secret?: string;
    }>;
  };
}

/** 飞书消息类型 */
type FeishuMsgType = 'text' | 'post' | 'interactive' | 'image' | 'share_chat' | 'audio' | 'media';

/** 飞书文本消息 */
interface FeishuTextMessage {
  msg_type: 'text';
  content: {
    text: string;
  };
}

/** 飞书富文本消息 */
interface FeishuPostMessage {
  msg_type: 'post';
  content: {
    post: {
      zh_cn: {
        title: string;
        content: Array<Array<{
          tag: string;
          text?: string;
          href?: string;
          image_key?: string;
        }>>;
      };
    };
  };
}

/** 飞书卡片消息 */
interface FeishuInteractiveMessage {
  msg_type: 'interactive';
  card: {
    header?: {
      title: {
        tag: 'plain_text';
        content: string;
      };
      template?: string;
    };
    elements: Array<{
      tag: string;
      text?: {
        tag: string;
        content: string;
      };
      actions?: Array<{
        tag: string;
        text: {
          tag: string;
          content: string;
        };
        type?: string;
        url?: string;
      }>;
    }>;
  };
}

/** 飞书图片消息 */
interface FeishuImageMessage {
  msg_type: 'image';
  content: {
    image_key: string;
  };
}

/** 飞书分享群消息 */
interface FeishuShareChatMessage {
  msg_type: 'share_chat';
  content: {
    share_chat_id: string;
  };
}

/** 飞书消息联合类型 */
type FeishuMessage = FeishuTextMessage | FeishuPostMessage | FeishuInteractiveMessage | FeishuImageMessage | FeishuShareChatMessage;

/** 飞书响应 */
interface FeishuResponse {
  code: number;
  msg: string;
  data?: unknown;
}

/** 飞书事件订阅消息 */
interface FeishuEvent {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: Record<string, unknown>;
}

/** 飞书消息事件体 */
interface FeishuMessageEvent {
  sender: {
    sender_id: {
      open_id: string;
      user_id: string;
      union_id: string;
    };
    sender_type: string;
    tenant_key: string;
  };
  message: {
    message_id: string;
    root_id: string;
    parent_id: string;
    create_time: string;
    chat_id: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        open_id: string;
        user_id: string;
      };
      name: string;
      tenant_key: string;
    }>;
  };
}

/** 飞书访问令牌响应 */
interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

/**
 * 飞书连接类
 */
export class FeishuConnection extends BaseConnection {
  private feishuConfig: FeishuConfig;
  private groups: Map<string, { webhookUrl: string; secret?: string }> = new Map();
  private tenantAccessToken?: string;
  private tokenExpireTime?: number;

  constructor(config: FeishuConfig) {
    super(config);
    this.feishuConfig = config;
    
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
   * 连接（飞书 webhook 不需要持久连接，但需要获取 access token）
   */
  async connect(): Promise<void> {
    // 如果配置了应用凭证，获取 tenant_access_token
    if (this.feishuConfig.credentials.appId && this.feishuConfig.credentials.appSecret) {
      await this.refreshAccessToken();
    }
    
    this.updateStatus('connected');
    console.log('[Feishu] 连接成功');
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.tenantAccessToken = undefined;
    this.tokenExpireTime = undefined;
    this.updateStatus('disconnected');
    console.log('[Feishu] 已断开');
  }

  /**
   * 获取/刷新访问令牌
   */
  private async refreshAccessToken(): Promise<void> {
    const { appId, appSecret } = this.feishuConfig.credentials;
    
    if (!appId || !appSecret) {
      return;
    }

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });

    const result = await response.json() as FeishuTokenResponse;
    
    if (result.code !== 0) {
      throw new Error(`飞书获取访问令牌失败: ${result.msg}`);
    }

    this.tenantAccessToken = result.tenant_access_token;
    this.tokenExpireTime = Date.now() + (result.expire - 60) * 1000; // 提前 60 秒过期
    
    console.log(`[Feishu] 访问令牌已更新，有效期 ${result.expire} 秒`);
  }

  /**
   * 确保访问令牌有效
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.tenantAccessToken && this.tokenExpireTime && Date.now() < this.tokenExpireTime) {
      return;
    }

    await this.refreshAccessToken();
  }

  /**
   * 发送消息
   */
  async send(message: UnifiedMessage): Promise<void> {
    const groupId = message.recipient.id;
    const group = this.groups.get(groupId) || this.groups.get(this.feishuConfig.options?.defaultGroup || '');
    
    if (!group) {
      throw new Error(`未找到群组配置: ${groupId}`);
    }

    const feishuMessage = this.convertToFeishuFormat(message);
    const url = this.buildWebhookUrl(group);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feishuMessage)
    });

    const result = await response.json() as FeishuResponse;
    
    if (result.code !== 0) {
      throw new Error(`飞书发送失败: ${result.msg} (code: ${result.code})`);
    }

    console.log(`[Feishu] 消息发送成功: ${message.id}`);
  }

  /**
   * 通过 API 发送消息（需要应用凭证）
   */
  async sendViaAPI(chatId: string, message: UnifiedMessage): Promise<void> {
    await this.ensureAccessToken();

    const feishuMessage = this.convertToFeishuFormat(message);
    
    // 获取消息内容
    let contentStr: string;
    if ('content' in feishuMessage) {
      contentStr = JSON.stringify(feishuMessage.content);
    } else if ('card' in feishuMessage) {
      contentStr = JSON.stringify({ card: feishuMessage.card });
    } else {
      contentStr = '{}';
    }
    
    const response = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tenantAccessToken}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: feishuMessage.msg_type,
        content: contentStr
      })
    });

    const result = await response.json() as FeishuResponse;
    
    if (result.code !== 0) {
      throw new Error(`飞书 API 发送失败: ${result.msg} (code: ${result.code})`);
    }

    console.log(`[Feishu] API 消息发送成功: ${message.id}`);
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
      id: `feishu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: 'feishu',
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
   * 处理飞书事件订阅消息
   */
  handleEventSubscription(event: FeishuEvent): void {
    const { event_type } = event.header;
    
    // 处理消息事件
    if (event_type === 'im.message.receive_v1') {
      const messageEvent = event.event as unknown as FeishuMessageEvent;
      this.handleMessageEvent(messageEvent);
    } else {
      console.log(`[Feishu] 收到事件: ${event_type}`);
      this.emit('event', event);
    }
  }

  /**
   * 处理消息事件
   */
  private handleMessageEvent(event: FeishuMessageEvent): void {
    let content = '';
    
    // 解析不同类型的消息内容
    const msgType = event.message.message_type;
    if (msgType === 'text') {
      const textContent = JSON.parse(event.message.content);
      content = textContent.text || '';
    } else {
      content = `[${msgType}] ${event.message.content}`;
    }

    const message: UnifiedMessage = {
      id: event.message.message_id,
      platform: 'feishu',
      direction: 'inbound',
      type: this.mapMessageType(msgType),
      content,
      sender: {
        id: event.sender.sender_id.open_id || event.sender.sender_id.user_id,
        name: '', // 需要通过 API 获取
        type: 'human'
      },
      recipient: {
        id: event.message.chat_id,
        type: 'group'
      },
      metadata: {
        rootId: event.message.root_id,
        parentId: event.message.parent_id,
        mentions: event.message.mentions,
        tenantKey: event.sender.tenant_key
      },
      timestamp: parseInt(event.message.create_time)
    };

    this.emitMessage(message);
  }

  /**
   * 转换为飞书消息格式
   */
  private convertToFeishuFormat(message: UnifiedMessage): FeishuMessage {
    if (message.type === 'markdown') {
      // 飞书使用富文本 post 消息来展示 markdown
      return {
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title: '',
              content: this.parseMarkdownToFeishuPost(message.content)
            }
          }
        }
      };
    }

    if (message.type === 'image' && message.metadata?.imageKey) {
      return {
        msg_type: 'image',
        content: {
          image_key: message.metadata.imageKey as string
        }
      };
    }

    if (message.type === 'action' && message.metadata?.card) {
      // 发送交互式卡片
      return message.metadata.card as FeishuInteractiveMessage;
    }

    // 默认发送文本消息
    return {
      msg_type: 'text',
      content: {
        text: message.content
      }
    };
  }

  /**
   * 解析 Markdown 为飞书富文本格式
   */
  private parseMarkdownToFeishuPost(markdown: string): Array<Array<{ tag: string; text?: string; href?: string }>> {
    const lines = markdown.split('\n');
    const content: Array<Array<{ tag: string; text?: string; href?: string }>> = [];

    for (const line of lines) {
      const segment: Array<{ tag: string; text?: string; href?: string }> = [];
      
      // 处理粗体 **text**
      let processedLine = line.replace(/\*\*(.+?)\*\*/g, (_, text) => {
        return `[[BOLD:${text}]]`;
      });
      
      // 处理链接 [text](url)
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let lastIndex = 0;
      let match;
      
      while ((match = linkPattern.exec(processedLine)) !== null) {
        // 添加链接前的文本
        if (match.index > lastIndex) {
          const beforeText = processedLine.slice(lastIndex, match.index);
          segment.push({ tag: 'text', text: this.cleanMarkers(beforeText) });
        }
        
        // 添加链接
        segment.push({ tag: 'a', text: match[1], href: match[2] });
        lastIndex = match.index + match[0].length;
      }
      
      // 添加剩余文本
      if (lastIndex < processedLine.length) {
        const remainingText = processedLine.slice(lastIndex);
        segment.push({ tag: 'text', text: this.cleanMarkers(remainingText) });
      }
      
      if (segment.length > 0) {
        content.push(segment);
      }
    }

    return content;
  }

  /**
   * 清理标记
   */
  private cleanMarkers(text: string): string {
    return text.replace(/\[\[BOLD:(.+?)\]\]/g, '$1');
  }

  /**
   * 构建 Webhook URL（含签名）
   */
  private buildWebhookUrl(group: { webhookUrl: string; secret?: string }): string {
    if (!group.secret) {
      return group.webhookUrl;
    }

    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${group.secret}`;
    
    // 使用 HMAC-SHA256 签名
    const hmac = crypto.createHmac('sha256', group.secret);
    hmac.update(stringToSign);
    const sign = hmac.digest('base64');

    return `${group.webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }

  /**
   * 映射消息类型
   */
  private mapMessageType(msgtype: string): 'text' | 'image' | 'markdown' | 'file' | 'audio' | 'video' | 'action' {
    const typeMap: Record<string, 'text' | 'image' | 'markdown' | 'file' | 'audio' | 'video' | 'action'> = {
      text: 'text',
      post: 'markdown',
      image: 'image',
      file: 'file',
      audio: 'audio',
      media: 'audio',
      video: 'video',
      interactive: 'action'
    };
    return typeMap[msgtype.toLowerCase()] || 'text';
  }

  /**
   * 验证事件订阅签名
   */
  static verifyEventSignature(encryptKey: string, signature: string, timestamp: string, nonce: string, body: string): boolean {
    const token = encryptKey;
    const arr = [token, timestamp, nonce, body].sort();
    const sha1 = crypto.createHash('sha1');
    sha1.update(arr.join(''));
    const calculatedSignature = sha1.digest('hex');
    return calculatedSignature === signature;
  }

  /**
   * 解密事件订阅消息
   * 飞书使用 AES-256-CBC 加密
   */
  static decryptEvent(encryptKey: string, encryptedData: string): string {
    const key = crypto.createHash('sha256').update(encryptKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 16), 'base64');
    const encryptedBuffer = Buffer.from(encryptedData.slice(16), 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    // 移除 padding
    const pad = decrypted.charCodeAt(decrypted.length - 1);
    return decrypted.slice(0, -pad);
  }

  /**
   * 创建交互式卡片
   */
  static createCard(options: {
    title?: string;
    content: string;
    template?: string;
    actions?: Array<{
      text: string;
      type: 'primary' | 'default';
      url?: string;
    }>;
  }): FeishuInteractiveMessage {
    const elements: FeishuInteractiveMessage['card']['elements'] = [
      {
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: options.content
        }
      }
    ];

    if (options.actions && options.actions.length > 0) {
      elements.push({
        tag: 'action',
        actions: options.actions.map(action => ({
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: action.text
          },
          type: action.type,
          url: action.url
        }))
      });
    }

    return {
      msg_type: 'interactive',
      card: {
        header: options.title ? {
          title: {
            tag: 'plain_text',
            content: options.title
          },
          template: options.template
        } : undefined,
        elements
      }
    };
  }
}

export default FeishuConnection;