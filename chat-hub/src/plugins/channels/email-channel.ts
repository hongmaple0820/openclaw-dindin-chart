import * as nodemailer from 'nodemailer';
import * as Imap from 'imap';
import { EventEmitter } from 'events';

interface EmailConfig {
  smtp_host: string;
  smtp_port?: number;
  smtp_user: string;
  smtp_password: string;
  from?: string;
  imap_host?: string;
  imap_port?: number;
}

interface SendOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: (string | nodemailer.Attachment)[];
  cc?: string;
  bcc?: string;
}

interface EmailInfo {
  seqno?: number;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
}

interface UnreadCount {
  total: number;
  unread: number;
}

interface EmailStatus {
  name: string;
  connected: boolean;
  smtp: {
    host: string;
    port: number;
    user: string;
  };
  imap: {
    host: string;
    port: number;
  } | null;
}

/**
 * 邮箱通道插件
 * 支持发送和接收邮件
 * 
 * @author 小琳
 * @date 2026-03-03
 */
class EmailChannelPlugin extends EventEmitter {
  public name: string;
  private config: EmailConfig;
  private transporter: nodemailer.Transporter | null;
  private imap: Imap | null;
  public connected: boolean;

  constructor(config: EmailConfig = {} as EmailConfig) {
    super();
    this.name = 'email-channel';
    this.config = config;
    this.transporter = null;
    this.imap = null;
    this.connected = false;
  }

  /**
   * 初始化 SMTP 连接
   */
  async init(): Promise<void> {
    if (!this.config.smtp_host || !this.config.smtp_user || !this.config.smtp_password) {
      throw new Error('邮箱插件配置不完整：需要 smtp_host, smtp_user, smtp_password');
    }

    // 创建 SMTP 传输
    this.transporter = nodemailer.createTransport({
      host: this.config.smtp_host,
      port: this.config.smtp_port || 587,
      secure: this.config.smtp_port === 465, // 465 为 SSL，587 为 TLS
      auth: {
        user: this.config.smtp_user,
        pass: this.config.smtp_password
      },
      // 连接超时设置
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    // 验证连接
    try {
      await this.transporter.verify();
      console.log('[Email] SMTP 连接成功:', this.config.smtp_user);
      this.connected = true;
    } catch (error) {
      console.error('[Email] SMTP 连接失败:', error instanceof Error ? error.message : error);
      throw error;
    }

    // 如果配置了 IMAP，初始化接收功能
    if (this.config.imap_host) {
      this.initImap();
    }
  }

  /**
   * 初始化 IMAP 连接（用于接收邮件）
   */
  private initImap(): void {
    this.imap = new Imap({
      user: this.config.smtp_user,
      password: this.config.smtp_password,
      host: this.config.imap_host!,
      port: this.config.imap_port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.once('ready', () => {
      console.log('[Email] IMAP 连接成功');
      this.emit('imap:ready');
    });

    this.imap.once('error', (err: Error) => {
      console.error('[Email] IMAP 错误:', err.message);
      this.emit('imap:error', err);
    });

    this.imap.once('end', () => {
      console.log('[Email] IMAP 连接关闭');
      this.emit('imap:end');
    });
  }

  /**
   * 发送邮件
   */
  async send(options: SendOptions): Promise<{ success: boolean; messageId?: string; response?: string }> {
    if (!this.transporter) {
      throw new Error('邮箱插件未初始化');
    }

    const {
      to,
      subject,
      text,
      html,
      attachments,
      cc,
      bcc
    } = options;

    if (!to || !subject) {
      throw new Error('缺少必要参数：to 和 subject');
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.config.from || this.config.smtp_user,
      to,
      subject,
      text: text || subject,
      html,
      cc,
      bcc,
      attachments: attachments?.map(att => {
        if (typeof att === 'string') {
          return { path: att };
        }
        return att;
      })
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('[Email] 邮件发送成功:', info.messageId);

      this.emit('send:success', { messageId: info.messageId, to, subject });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error('[Email] 邮件发送失败:', error instanceof Error ? error.message : error);
      this.emit('send:error', { error, to, subject });
      throw error;
    }
  }

  /**
   * 发送简单文本邮件（快捷方法）
   */
  async sendText(to: string, subject: string, text: string): Promise<{ success: boolean; messageId?: string; response?: string }> {
    return this.send({ to, subject, text });
  }

  /**
   * 发送 HTML 邮件
   */
  async sendHtml(to: string, subject: string, html: string, text: string = ''): Promise<{ success: boolean; messageId?: string; response?: string }> {
    return this.send({ to, subject, html, text });
  }

  /**
   * 发送带附件的邮件
   */
  async sendWithAttachments(to: string, subject: string, text: string, attachments: (string | nodemailer.Attachment)[]): Promise<{ success: boolean; messageId?: string; response?: string }> {
    return this.send({ to, subject, text, attachments });
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (!this.transporter) {
        return { success: false, error: 'SMTP 未初始化' };
      }

      await this.transporter.verify();
      return { success: true, message: 'SMTP 连接成功' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 获取未读邮件数量
   */
  async getUnreadCount(): Promise<UnreadCount> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error('IMAP 未配置'));
      }

      this.imap.connect();

      this.imap.once('ready', () => {
        this.imap!.openBox('INBOX', false, (err, box) => {
          if (err) {
            this.imap!.end();
            return reject(err);
          }

          this.imap!.end();
          resolve({
            total: box.messages.total,
            unread: box.messages.new || 0
          });
        });
      });

      this.imap.once('error', reject);
    });
  }

  /**
   * 获取最近的邮件
   */
  async getRecentEmails(limit: number = 10): Promise<EmailInfo[]> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error('IMAP 未配置'));
      }

      const emails: EmailInfo[] = [];

      this.imap.connect();

      this.imap.once('ready', () => {
        this.imap!.openBox('INBOX', true, (err, box) => {
          if (err) {
            this.imap!.end();
            return reject(err);
          }

          const fetchLimit = Math.min(limit, box.messages.total);
          const start = box.messages.total - fetchLimit + 1;

          if (start < 1) {
            this.imap!.end();
            return resolve([]);
          }

          const fetch = this.imap!.seq.fetch(`${start}:${box.messages.total}`, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            const email: EmailInfo = { seqno };

            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk: Buffer) => buffer += chunk.toString('utf8'));
              stream.once('end', () => {
                const parsed = Imap.parseHeader(buffer);
                email.from = parsed.from?.[0];
                email.to = parsed.to?.[0];
                email.subject = parsed.subject?.[0];
                email.date = parsed.date?.[0];
              });
            });

            msg.once('end', () => emails.push(email));
          });

          fetch.once('error', (err) => {
            this.imap!.end();
            reject(err);
          });

          fetch.once('end', () => {
            this.imap!.end();
            resolve(emails.reverse());
          });
        });
      });

      this.imap.once('error', reject);
    });
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
    if (this.imap) {
      this.imap.end();
    }
    this.connected = false;
    console.log('[Email] 插件已关闭');
  }

  /**
   * 获取插件状态
   */
  getStatus(): EmailStatus {
    return {
      name: this.name,
      connected: this.connected,
      smtp: {
        host: this.config.smtp_host,
        port: this.config.smtp_port || 587,
        user: this.config.smtp_user
      },
      imap: this.config.imap_host ? {
        host: this.config.imap_host,
        port: this.config.imap_port || 993
      } : null
    };
  }
}

// 单例实例
let instance: EmailChannelPlugin | null = null;

/**
 * 获取邮箱插件实例
 */
function getEmailChannel(config: EmailConfig): EmailChannelPlugin | null {
  if (!instance && config) {
    instance = new EmailChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化邮箱插件
 */
async function initEmailChannel(config: EmailConfig): Promise<EmailChannelPlugin> {
  const plugin = getEmailChannel(config);
  if (!plugin) {
    throw new Error('Failed to create email channel plugin');
  }
  await plugin.init();
  return plugin;
}

export {
  EmailChannelPlugin,
  getEmailChannel,
  initEmailChannel
};
export type { EmailConfig, SendOptions, EmailInfo, UnreadCount, EmailStatus };