/**
 * 浏览器通知工具
 * @author 小琳
 * @date 2026-02-06
 */

class NotificationManager {
  constructor() {
    this.permission = 'default';
    this.enabled = true;
  }

  /**
   * 请求通知权限
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('[Notify] 浏览器不支持通知');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    }

    return false;
  }

  /**
   * 检查是否可以发送通知
   */
  canNotify() {
    return this.enabled && this.permission === 'granted' && document.hidden;
  }

  /**
   * 发送通知
   */
  notify(title, options = {}) {
    if (!this.canNotify()) return null;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'chat-message',
        renotify: options.renotify || false,
        silent: options.silent || false,
        ...options
      });

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      // 自动关闭
      if (options.timeout !== 0) {
        setTimeout(() => notification.close(), options.timeout || 5000);
      }

      return notification;
    } catch (e) {
      console.error('[Notify] 发送通知失败:', e);
      return null;
    }
  }

  /**
   * 发送新消息通知
   */
  notifyMessage(sender, content, options = {}) {
    const truncated = content.length > 50 ? content.slice(0, 50) + '...' : content;
    return this.notify(`${sender} 发来消息`, {
      body: truncated,
      tag: 'new-message',
      ...options
    });
  }

  /**
   * 发送 @ 提及通知
   */
  notifyMention(sender, content, options = {}) {
    const truncated = content.length > 50 ? content.slice(0, 50) + '...' : content;
    return this.notify(`${sender} @ 了你`, {
      body: truncated,
      tag: 'mention',
      renotify: true, // @ 提及总是提醒
      ...options
    });
  }

  /**
   * 启用/禁用通知
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('notification_enabled', enabled ? '1' : '0');
  }

  /**
   * 从本地存储恢复设置
   */
  restore() {
    const saved = localStorage.getItem('notification_enabled');
    if (saved !== null) {
      this.enabled = saved === '1';
    }
  }
}

const notifyManager = new NotificationManager();

export default notifyManager;
