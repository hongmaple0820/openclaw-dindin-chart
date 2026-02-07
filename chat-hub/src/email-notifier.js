const nodemailer = require('nodemailer');
const config = require('./config');

/**
 * 邮件通知模块
 * 用于在 chat-hub 故障时发送邮件提醒
 */
class EmailNotifier {
  constructor() {
    this.enabled = config.email?.enabled || false;
    this.alertThreshold = config.email?.alertThreshold || 3;
    this.failureCount = 0;
    this.lastAlertTime = 0;
    this.minAlertInterval = 30 * 60 * 1000; // 最小提醒间隔 30 分钟
    
    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        service: config.email.service || 'QQ',
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass,
        },
      });
      
      console.log('[Email] 邮件通知已启用');
    } else {
      console.log('[Email] 邮件通知未启用');
    }
  }

  /**
   * 发送邮件
   */
  async send(subject, text) {
    if (!this.enabled) {
      return;
    }

    // 检查最小间隔
    const now = Date.now();
    if (now - this.lastAlertTime < this.minAlertInterval) {
      console.log('[Email] 距离上次提醒不足 30 分钟，跳过');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.email.from,
        to: config.email.to,
        subject: `[chat-hub] ${subject}`,
        text: `${text}\n\n发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n机器人：${config.bot?.name || 'Unknown'}`,
      });

      console.log('[Email] 邮件发送成功:', info.messageId);
      this.lastAlertTime = now;
      this.failureCount = 0; // 重置失败计数
      
    } catch (error) {
      console.error('[Email] 邮件发送失败:', error.message);
    }
  }

  /**
   * 记录失败并检查是否需要发送提醒
   */
  async reportFailure(type, error) {
    this.failureCount++;
    
    console.log(`[Email] 记录失败 (${this.failureCount}/${this.alertThreshold}):`, type, error.message);

    if (this.failureCount >= this.alertThreshold) {
      await this.send(
        `${type} 故障`,
        `检测到 ${type} 连续失败 ${this.failureCount} 次\n\n错误信息：\n${error.message}\n\n请尽快检查！`
      );
      this.failureCount = 0; // 发送后重置
    }
  }

  /**
   * 发送恢复通知
   */
  async reportRecovery(type) {
    if (this.failureCount > 0) {
      await this.send(
        `${type} 已恢复`,
        `${type} 已恢复正常运行。`
      );
      this.failureCount = 0;
    }
  }

  /**
   * 发送自定义通知
   */
  async notify(subject, text) {
    await this.send(subject, text);
  }
}

module.exports = new EmailNotifier();
