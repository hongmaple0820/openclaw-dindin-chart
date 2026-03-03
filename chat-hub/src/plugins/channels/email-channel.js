/**
 * 邮箱通道插件
 * 支持发送和接收邮件
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const nodemailer = require('nodemailer');
const Imap = require('imap');
const { EventEmitter } = require('events');

class EmailChannelPlugin extends EventEmitter {
  constructor(config = {}) {
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
  async init() {
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
      console.error('[Email] SMTP 连接失败:', error.message);
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
  initImap() {
    this.imap = new Imap({
      user: this.config.smtp_user,
      password: this.config.smtp_password,
      host: this.config.imap_host,
      port: this.config.imap_port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.once('ready', () => {
      console.log('[Email] IMAP 连接成功');
      this.emit('imap:ready');
    });

    this.imap.once('error', (err) => {
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
   * @param {Object} options - 邮件选项
   * @param {string} options.to - 收件人
   * @param {string} options.subject - 主题
   * @param {string} options.text - 纯文本内容
   * @param {string} options.html - HTML 内容（可选）
   * @param {Array} options.attachments - 附件（可选）
   * @param {string} options.cc - 抄送（可选）
   * @param {string} options.bcc - 密送（可选）
   */
  async send(options) {
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

    const mailOptions = {
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
      console.error('[Email] 邮件发送失败:', error.message);
      this.emit('send:error', { error, to, subject });
      throw error;
    }
  }

  /**
   * 发送简单文本邮件（快捷方法）
   */
  async sendText(to, subject, text) {
    return this.send({ to, subject, text });
  }

  /**
   * 发送 HTML 邮件
   */
  async sendHtml(to, subject, html, text = '') {
    return this.send({ to, subject, html, text });
  }

  /**
   * 发送带附件的邮件
   */
  async sendWithAttachments(to, subject, text, attachments) {
    return this.send({ to, subject, text, attachments });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        return { success: false, error: 'SMTP 未初始化' };
      }

      await this.transporter.verify();
      return { success: true, message: 'SMTP 连接成功' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取未读邮件数量
   */
  async getUnreadCount() {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error('IMAP 未配置'));
      }

      this.imap.connect();
      
      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            this.imap.end();
            return reject(err);
          }
          
          this.imap.end();
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
   * @param {number} limit - 数量限制，默认 10
   */
  async getRecentEmails(limit = 10) {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        return reject(new Error('IMAP 未配置'));
      }

      const emails = [];
      
      this.imap.connect();
      
      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            this.imap.end();
            return reject(err);
          }

          const fetchLimit = Math.min(limit, box.messages.total);
          const start = box.messages.total - fetchLimit + 1;
          
          if (start < 1) {
            this.imap.end();
            return resolve([]);
          }

          const fetch = this.imap.seq.fetch(`${start}:${box.messages.total}`, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            const email = { seqno };
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
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
            this.imap.end();
            reject(err);
          });

          fetch.once('end', () => {
            this.imap.end();
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
  async close() {
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
  getStatus() {
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
let instance = null;

/**
 * 获取邮箱插件实例
 * @param {Object} config - 配置选项
 */
function getEmailChannel(config) {
  if (!instance && config) {
    instance = new EmailChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化邮箱插件
 */
async function initEmailChannel(config) {
  const plugin = getEmailChannel(config);
  await plugin.init();
  return plugin;
}

module.exports = {
  EmailChannelPlugin,
  getEmailChannel,
  initEmailChannel
};
