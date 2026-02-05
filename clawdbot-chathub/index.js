/**
 * clawdbot-chathub
 * 
 * OpenClaw channel plugin for chat-hub
 * 让 OpenClaw 的回复自动发送到 chat-hub，再由 chat-hub 转发到钉钉群
 * 
 * 配置示例 (openclaw.yaml):
 * channels:
 *   chathub:
 *     plugin: clawdbot-chathub
 *     apiBase: http://localhost:3000
 *     sender: 小琳
 */

const axios = require('axios');

class ChatHubChannel {
  constructor(config) {
    this.apiBase = config.apiBase || 'http://localhost:3000';
    this.sender = config.sender || 'AI';
    this.timeout = config.timeout || 10000;
  }

  /**
   * 发送消息到 chat-hub
   */
  async send(options) {
    const { message, to, replyTo } = options;

    if (!message) {
      throw new Error('message is required');
    }

    try {
      const response = await axios.post(
        `${this.apiBase}/api/reply`,
        {
          content: message,
          sender: this.sender,
          replyTo: replyTo || null
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return {
          success: true,
          messageId: response.data.message?.id
        };
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`chat-hub error: ${error.response.status} ${error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * 探测服务是否可用
   */
  async probe() {
    try {
      const response = await axios.get(`${this.apiBase}/health`, {
        timeout: 5000
      });
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * 获取频道信息
   */
  info() {
    return {
      name: 'chathub',
      description: 'Chat-Hub (DingTalk Group)',
      apiBase: this.apiBase,
      sender: this.sender
    };
  }
}

module.exports = ChatHubChannel;
