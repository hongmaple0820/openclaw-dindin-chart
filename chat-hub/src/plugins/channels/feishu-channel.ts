import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// 飞书 API 基础地址
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

interface FeishuConfig {
  app_id: string;
  app_secret: string;
  encrypt_key?: string;
  verification_token?: string;
}

interface SendMessageOptions {
  receive_id: string;
  msg_type?: 'text' | 'post' | 'image' | 'card' | 'file' | 'interactive';
  content: string | Record<string, unknown>;
  receive_id_type?: 'open_id' | 'user_id' | 'union_id' | 'chat_id';
  uuid?: string;
}

interface TokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface SendMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
    create_time: string;
  };
}

interface FeishuEvent {
  type?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: {
    message?: {
      message_id: string;
      message_type: string;
      content: string;
      create_time: string;
      chat_id: string;
    };
    sender?: {
      sender_id: string;
      sender_type: string;
      tenant_key: string;
    };
  };
}

interface MessageData {
  messageId: string;
  messageType: string;
  content: unknown;
  createTime: string;
  chatId: string;
  sender: {
    senderId: string;
    senderType: string;
    tenantKey: string;
  };
}

interface FeishuStatus {
  name: string;
  connected: boolean;
  appId: string;
  hasToken: boolean;
  tokenExpireTime: number;
  configured: {
    hasEncryptKey: boolean;
    hasVerificationToken: boolean;
  };
}

/**
 * 飞书通道插件类
 */
class FeishuChannelPlugin extends EventEmitter {
  public name: string;
  private config: FeishuConfig;
  private appId: string;
  private appSecret: string;
  private encryptKey?: string;
  private verificationToken?: string;

  // Token 缓存
  private tenantAccessToken: string | null;
  private tokenExpireTime: number;

  public connected: boolean;

  constructor(config: FeishuConfig = {} as FeishuConfig) {
    super();
    this.name = 'feishu-channel';
    this.config = config;
    this.appId = config.app_id;
    this.appSecret = config.app_secret;
    this.encryptKey = config.encrypt_key;
    this.verificationToken = config.verification_token;

    // Token 缓存
    this.tenantAccessToken = null;
    this.tokenExpireTime = 0;

    this.connected = false;
  }

  /**
   * 初始化插件
   */
  async init(): Promise<{ success: boolean; message: string }> {
    if (!this.appId || !this.appSecret) {
      throw new Error('飞书插件配置不完整：需要 app_id 和 app_secret');
    }

    // 获取 tenant_access_token
    await this.refreshTenantAccessToken();

    console.log('[Feishu] 插件初始化成功:', this.appId);
    this.connected = true;

    return { success: true, message: '飞书插件初始化成功' };
  }

  /**
   * 获取 tenant_access_token（自动缓存和刷新）
   */
  async getTenantAccessToken(): Promise<string> {
    // 如果 token 有效，直接返回
    if (this.tenantAccessToken && Date.now() < this.tokenExpireTime) {
      return this.tenantAccessToken;
    }

    return this.refreshTenantAccessToken();
  }

  /**
   * 刷新 tenant_access_token
   */
  private async refreshTenantAccessToken(): Promise<string> {
    const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    const data = (await response.json()) as TokenResponse;

    if (data.code !== 0) {
      throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
    }

    this.tenantAccessToken = data.tenant_access_token;
    // 提前 5 分钟过期
    this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000;

    console.log('[Feishu] tenant_access_token 已刷新，有效期:', data.expire, '秒');

    return this.tenantAccessToken;
  }

  /**
   * 发送消息
   */
  async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    const { receive_id, msg_type = 'text', content, receive_id_type = 'open_id', uuid } = options;

    if (!receive_id) {
      throw new Error('缺少必要参数：receive_id');
    }

    const token = await this.getTenantAccessToken();

    // 构造消息内容
    let messageContent: string;
    if (msg_type === 'text' && typeof content === 'string') {
      messageContent = JSON.stringify({ text: content });
    } else if (typeof content === 'object') {
      messageContent = JSON.stringify(content);
    } else {
      messageContent = content as string;
    }

    const requestBody: Record<string, unknown> = {
      receive_id,
      msg_type,
      content: messageContent
    };

    if (uuid) {
      requestBody.uuid = uuid;
    }

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${receive_id_type}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = (await response.json()) as SendMessageResponse;

    if (data.code !== 0) {
      console.error('[Feishu] 发送消息失败:', data);
      throw new Error(`发送消息失败: ${data.msg}`);
    }

    console.log('[Feishu] 消息发送成功:', data.data?.message_id);

    this.emit('send:success', {
      messageId: data.data?.message_id,
      receive_id,
      msg_type
    });

    return {
      success: true,
      messageId: data.data?.message_id,
      createTime: data.data?.create_time
    };
  }

  /**
   * 发送文本消息（快捷方法）
   */
  async sendText(receive_id: string, text: string, receive_id_type: 'open_id' | 'user_id' | 'union_id' | 'chat_id' = 'open_id'): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    return this.sendMessage({
      receive_id,
      msg_type: 'text',
      content: text,
      receive_id_type
    });
  }

  /**
   * 发送富文本消息
   */
  async sendPost(receive_id: string, postContent: Record<string, unknown>, receive_id_type: 'open_id' | 'user_id' | 'union_id' | 'chat_id' = 'open_id'): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    return this.sendMessage({
      receive_id,
      msg_type: 'post',
      content: postContent,
      receive_id_type
    });
  }

  /**
   * 发送图片消息
   */
  async sendImage(receive_id: string, image_key: string, receive_id_type: 'open_id' | 'user_id' | 'union_id' | 'chat_id' = 'open_id'): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    return this.sendMessage({
      receive_id,
      msg_type: 'image',
      content: { image_key },
      receive_id_type
    });
  }

  /**
   * 发送消息卡片
   */
  async sendCard(receive_id: string, cardContent: Record<string, unknown>, receive_id_type: 'open_id' | 'user_id' | 'union_id' | 'chat_id' = 'open_id'): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    return this.sendMessage({
      receive_id,
      msg_type: 'interactive',
      content: cardContent,
      receive_id_type
    });
  }

  /**
   * 发送文件消息
   */
  async sendFile(receive_id: string, file_key: string, receive_id_type: 'open_id' | 'user_id' | 'union_id' | 'chat_id' = 'open_id'): Promise<{ success: boolean; messageId?: string; createTime?: string }> {
    return this.sendMessage({
      receive_id,
      msg_type: 'file',
      content: { file_key },
      receive_id_type
    });
  }

  /**
   * 处理飞书事件回调
   */
  async handleEvent(event: FeishuEvent): Promise<{ success: boolean; error?: string; message?: MessageData; handled?: boolean }> {
    const eventType = event.header?.event_type;

    console.log('[Feishu] 收到事件:', eventType);

    // 验证 Token
    if (this.verificationToken && event.header?.token !== this.verificationToken) {
      console.error('[Feishu] Token 验证失败');
      return { success: false, error: 'Token verification failed' };
    }

    // 处理不同类型的事件
    switch (eventType) {
      case 'im.message.receive_v1':
        return this._handleMessageReceive(event);

      default:
        console.log('[Feishu] 未处理的事件类型:', eventType);
        return { success: true, handled: false };
    }
  }

  /**
   * 处理消息接收事件
   */
  private async _handleMessageReceive(event: FeishuEvent): Promise<{ success: boolean; error?: string; message?: MessageData }> {
    const message = event.event?.message;
    const sender = event.event?.sender;

    if (!message) {
      return { success: false, error: 'No message in event' };
    }

    // 解密消息内容（如果配置了加密）
    let content: string | Record<string, unknown> = message.content;
    if (this.encryptKey && typeof content === 'string') {
      content = this._decryptContent(content);
    }

    // 解析消息内容
    let parsedContent: unknown;
    try {
      parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      parsedContent = content;
    }

    const messageData: MessageData = {
      messageId: message.message_id,
      messageType: message.message_type,
      content: parsedContent,
      createTime: message.create_time,
      chatId: message.chat_id,
      sender: {
        senderId: sender?.sender_id || '',
        senderType: sender?.sender_type || '',
        tenantKey: sender?.tenant_key || ''
      }
    };

    // 触发消息事件
    this.emit('message', messageData);

    console.log('[Feishu] 收到消息:', message.message_id, 'from', sender?.sender_id);

    return { success: true, message: messageData };
  }

  /**
   * 解密消息内容
   */
  private _decryptContent(encryptedContent: string): string {
    if (!this.encryptKey) {
      return encryptedContent;
    }

    try {
      const key = Buffer.from(this.encryptKey, 'base64');
      const encrypted = Buffer.from(encryptedContent, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, encrypted.slice(0, 16));
      const decrypted1 = decipher.update(encrypted.slice(16));
      const decrypted2 = decipher.final();
      const decrypted = Buffer.concat([decrypted1, decrypted2]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[Feishu] 解密失败:', error instanceof Error ? error.message : error);
      return encryptedContent;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await this.getTenantAccessToken();
      return { success: true, message: '飞书连接成功' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 关闭插件
   */
  async close(): Promise<void> {
    this.tenantAccessToken = null;
    this.tokenExpireTime = 0;
    this.connected = false;
    console.log('[Feishu] 插件已关闭');
  }

  /**
   * 获取插件状态
   */
  getStatus(): FeishuStatus {
    return {
      name: this.name,
      connected: this.connected,
      appId: this.appId,
      hasToken: !!this.tenantAccessToken,
      tokenExpireTime: this.tokenExpireTime,
      configured: {
        hasEncryptKey: !!this.encryptKey,
        hasVerificationToken: !!this.verificationToken
      }
    };
  }
}

// 单例实例
let instance: FeishuChannelPlugin | null = null;

/**
 * 获取飞书插件实例
 */
function getFeishuChannel(config: FeishuConfig): FeishuChannelPlugin | null {
  if (!instance && config) {
    instance = new FeishuChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化飞书插件
 */
async function initFeishuChannel(config: FeishuConfig): Promise<FeishuChannelPlugin> {
  const plugin = getFeishuChannel(config);
  if (!plugin) {
    throw new Error('Failed to create feishu channel plugin');
  }
  await plugin.init();
  return plugin;
}

export {
  FeishuChannelPlugin,
  getFeishuChannel,
  initFeishuChannel
};
export type { FeishuConfig, SendMessageOptions, MessageData, FeishuStatus };