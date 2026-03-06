import * as crypto from 'crypto';
import * as https from 'https';
import ChannelPlugin from '../channel-plugin';
import type { PluginConfig, ExecuteResult, PluginInfo } from '../base-plugin';

interface WebhookConfig {
  webhook?: string;
  webhookBase?: string;
  secret?: string;
}

interface DingTalkConfig extends PluginConfig {
  webhooks?: Record<string, WebhookConfig>;
  defaultWebhook?: string;
  userPhones?: Record<string, string>;
  replyMode?: string;
}

interface MessageOptions {
  webhook?: string;
  at?: string[];
  atAll?: boolean;
}

interface MarkdownContent {
  type: 'markdown';
  title?: string;
  text: string;
}

interface LinkContent {
  type: 'link';
  title: string;
  text: string;
  picUrl?: string;
  messageUrl: string;
}

type MessageContent = string | MarkdownContent | LinkContent;

interface ParsedMessage {
  type: string;
  content: string;
  sender?: string;
  chatId?: string;
  timestamp?: number;
}

/**
 * 钉钉通道插件
 * 
 * 参考实现：openclaw-channel-dingtalk
 * 文档：https://open.dingtalk.com/document/robots/custom-robot-access
 */
class DingTalkChannel extends ChannelPlugin {
  private webhooks: Record<string, WebhookConfig>;
  private defaultWebhook: string | undefined;
  private userPhones: Record<string, string>;
  private replyMode: string;

  constructor(config: DingTalkConfig) {
    super(config);
    this.name = 'dingtalk-channel';
    this.type = 'channel';
    this.webhooks = config.webhooks || {};
    this.defaultWebhook = config.defaultWebhook || Object.keys(this.webhooks)[0];
    this.userPhones = config.userPhones || {};
    this.replyMode = config.replyMode || 'text';
  }

  async init(): Promise<ExecuteResult> {
    if (!this.webhooks || Object.keys(this.webhooks).length === 0) {
      return { success: false, error: '缺少 Webhook 配置' };
    }
    console.log('[DingTalkChannel] 初始化成功，已配置', Object.keys(this.webhooks).length, '个 Webhook');
    return { success: true };
  }

  async sendMessage(to: string, content: MessageContent, options: MessageOptions = {}): Promise<ExecuteResult> {
    const webhookName = options.webhook || this.defaultWebhook;
    const webhook = webhookName ? this.webhooks[webhookName] : undefined;
    if (!webhook) return { success: false, error: 'Webhook 不存在: ' + webhookName };

    if (typeof content === 'string') return this.sendText(webhook, content, options);
    if (content.type === 'markdown') return this.sendMarkdown(webhook, content, options);
    if (content.type === 'link') return this.sendLink(webhook, content, options);
    return { success: false, error: '不支持的消息类型' };
  }

  async sendText(webhook: WebhookConfig, text: string, options: MessageOptions = {}): Promise<ExecuteResult> {
    const atMobiles = this._resolveAtPhones(options.at || []);
    const message = {
      msgtype: 'text' as const,
      text: { content: text },
      at: { atMobiles, isAtAll: options.atAll || false }
    };
    return this._sendRequest(webhook, message);
  }

  async sendMarkdown(webhook: WebhookConfig, content: MarkdownContent, options: MessageOptions = {}): Promise<ExecuteResult> {
    const atMobiles = this._resolveAtPhones(options.at || []);
    let text = content.text || '';
    if (typeof content === 'object' && 'text' in content) {
      text = content.text;
    }
    if (atMobiles.length > 0) text += '\n\n' + atMobiles.map(m => '@' + m).join(' ');

    const message = {
      msgtype: 'markdown' as const,
      markdown: { title: content.title || '消息', text },
      at: { atMobiles, isAtAll: options.atAll || false }
    };
    return this._sendRequest(webhook, message);
  }

  async sendLink(webhook: WebhookConfig, content: LinkContent, options: MessageOptions = {}): Promise<ExecuteResult> {
    const message = {
      msgtype: 'link' as const,
      link: {
        title: content.title,
        text: content.text,
        picUrl: content.picUrl || '',
        messageUrl: content.messageUrl
      }
    };
    return this._sendRequest(webhook, message);
  }

  async parseWebhook(body: string | Record<string, unknown>): Promise<ExecuteResult & { messages?: ParsedMessage[] }> {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      const messages: ParsedMessage[] = [];
      const msgtype = (data as Record<string, unknown>).msgtype;
      if (msgtype === 'text') {
        const textData = (data as Record<string, Record<string, unknown>>).text;
        messages.push({
          type: 'text',
          content: textData?.content as string || '',
          sender: (data as Record<string, unknown>).senderNick as string || (data as Record<string, unknown>).senderId as string,
          chatId: (data as Record<string, unknown>).conversationId as string,
          timestamp: (data as Record<string, unknown>).createAt as number || Date.now()
        });
      }
      return { success: true, messages };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async testConnection(webhookName?: string): Promise<ExecuteResult> {
    const webhook = this.webhooks[webhookName || this.defaultWebhook || ''];
    if (!webhook) return { success: false, error: 'Webhook 不存在' };
    return this.sendText(webhook, '🔔 钉钉通道连接测试成功！');
  }

  private _sendRequest(webhook: WebhookConfig, message: Record<string, unknown>): Promise<ExecuteResult> {
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
          } catch (e) {
            resolve({ success: false, error: '响应解析失败' });
          }
        });
      });
      req.on('error', (e) => { resolve({ success: false, error: e.message }); });
      req.write(postData);
      req.end();
    });
  }

  private _buildSignedUrl(webhook: WebhookConfig): string {
    let url = webhook.webhookBase || webhook.webhook || '';
    if (webhook.secret) {
      const timestamp = Date.now();
      const sign = this._generateSign(timestamp, webhook.secret);
      url += '&timestamp=' + timestamp + '&sign=' + encodeURIComponent(sign);
    }
    return url;
  }

  private _generateSign(timestamp: number, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(timestamp + '\n' + secret);
    return hmac.digest('base64');
  }

  private _resolveAtPhones(userNames: string[]): string[] {
    return userNames
      .map(name => /^\d{11}$/.test(name) ? name : this.userPhones[name] || name)
      .filter(p => /^\d{11}$/.test(p));
  }

  getInfo(): PluginInfo & { webhooks: string[] } {
    return { 
      id: this.id, 
      name: this.name, 
      type: this.type,
      category: this.category,
      version: this.version,
      description: this.description,
      capabilities: this.capabilities,
      status: this._status,
      initialized: this._initialized,
      webhooks: Object.keys(this.webhooks) 
    };
  }
}

export default DingTalkChannel;