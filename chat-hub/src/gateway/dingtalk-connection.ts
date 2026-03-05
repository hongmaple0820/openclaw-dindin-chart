/**
 * 钉钉连接实现
 * 
 * 实现 DingTalk 平台的消息收发
 * 
 * @author 小琳
 * @date 2026-03-05
 */

import { BaseConnection, UnifiedMessage, ConnectionConfig, MessageSender, MessageRecipient } from './index';
import * as crypto from 'crypto';

/** 钉钉连接配置 */
export interface DingTalkConfig extends ConnectionConfig {
  platform: 'dingtalk';
  credentials: {
    webhookUrl: string;
    secret?: string;
    accessToken?: string;
  };
  options?: {
    defaultGroup?: string;
    groups?: Record<string, {
      webhookUrl: string;
      secret?: string;
    }>;
  };
}

/** 钉钉消息格式 */
interface DingTalkMessage {
  msgtype: string;
  text?: { content: string };
  markdown?: { title: string; text: string };
  at?: {
    atMobiles?: string[];
    atUserIds?: string[];
    isAtAll?: boolean;
  };
}

/**
 * 钉钉连接类
 */
export class DingTalkConnection extends BaseConnection {
  private dingTalkConfig: DingTalkConfig;
  private groups: Map<string, { webhookUrl: string; secret?: string }> = new Map();

  constructor(config: DingTalkConfig) {
    super(config);
    this.dingTalkConfig = config;
    
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
   * 连接（钉钉 webhook 不需要持久连接）
   */
  async connect(): Promise<void> {
    this.updateStatus('connected');
    console.log('[DingTalk] 连接成功');
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.updateStatus('disconnected');
    console.log('[DingTalk] 已断开');
  }

  /**
   * 发送消息
   */
  async send(message: UnifiedMessage): Promise<void> {
    const groupId = message.recipient.id;
    const group = this.groups.get(groupId) || this.groups.get(this.dingTalkConfig.options?.defaultGroup || '');
    
    if (!group) {
      throw new Error(`未找到群组配置: ${groupId}`);
    }

    const dingTalkMessage = this.convertToDingTalkFormat(message);
    const url = this.buildWebhookUrl(group);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dingTalkMessage)
    });

    const result = await response.json() as { errcode?: number; errmsg?: string };
    
    if (result.errcode !== 0) {
      throw new Error(`钉钉发送失败: ${result.errmsg}`);
    }

    console.log(`[DingTalk] 消息发送成功: ${message.id}`);
  }

  /**
   * 接收消息（由 OpenClaw 插件调用）
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
      id: `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: 'dingtalk',
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
   * 转换为钉钉消息格式
   */
  private convertToDingTalkFormat(message: UnifiedMessage): DingTalkMessage {
    // 提取 @ 手机号
    const atMobiles = this.extractAtMobiles(message.content);

    if (message.type === 'markdown') {
      return {
        msgtype: 'markdown',
        markdown: {
          title: message.content.slice(0, 50),
          text: message.content
        },
        at: atMobiles.length > 0 ? { atMobiles } : undefined
      };
    }

    return {
      msgtype: 'text',
      text: { content: message.content },
      at: atMobiles.length > 0 ? { atMobiles } : undefined
    };
  }

  /**
   * 提取 @ 手机号
   */
  private extractAtMobiles(content: string): string[] {
    const pattern = /@(\d{11})/g;
    const matches = content.match(pattern) || [];
    return matches.map(m => m.slice(1));
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
    const hmac = crypto.createHmac('sha256', group.secret);
    hmac.update(stringToSign);
    const sign = encodeURIComponent(hmac.digest('base64'));

    return `${group.webhookUrl}&timestamp=${timestamp}&sign=${sign}`;
  }

  /**
   * 映射消息类型
   */
  private mapMessageType(msgtype: string): 'text' | 'image' | 'markdown' {
    const typeMap: Record<string, 'text' | 'image' | 'markdown'> = {
      text: 'text',
      markdown: 'markdown',
      picture: 'image',
      image: 'image'
    };
    return typeMap[msgtype] || 'text';
  }
}

export default DingTalkConnection;