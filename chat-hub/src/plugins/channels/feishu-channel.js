/**
 * 飞书通道插件
 * 支持发送和接收飞书消息
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// 飞书 API 基础地址
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * 飞书通道插件类
 */
class FeishuChannelPlugin extends EventEmitter {
  constructor(config = {}) {
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
  async init() {
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
  async getTenantAccessToken() {
    // 如果 token 有效，直接返回
    if (this.tenantAccessToken && Date.now() < this.tokenExpireTime) {
      return this.tenantAccessToken;
    }
    
    return this.refreshTenantAccessToken();
  }

  /**
   * 刷新 tenant_access_token
   */
  async refreshTenantAccessToken() {
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

    const data = await response.json();

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
   * @param {Object} options - 发送选项
   * @param {string} options.receive_id - 接收者ID
   * @param {string} options.msg_type - 消息类型 (text/post/image/card/file)
   * @param {string|object} options.content - 消息内容
   * @param {string} options.receive_id_type - 接收者类型 (open_id/user_id/union_id/chat_id)
   * @param {string} options.uuid - 消息UUID（可选，用于去重）
   */
  async sendMessage(options) {
    const { receive_id, msg_type = 'text', content, receive_id_type = 'open_id', uuid } = options;

    if (!receive_id) {
      throw new Error('缺少必要参数：receive_id');
    }

    const token = await this.getTenantAccessToken();

    // 构造消息内容
    let messageContent = content;
    if (msg_type === 'text' && typeof content === 'string') {
      messageContent = JSON.stringify({ text: content });
    } else if (typeof content === 'object') {
      messageContent = JSON.stringify(content);
    }

    const requestBody = {
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

    const data = await response.json();

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
  async sendText(receive_id, text, receive_id_type = 'open_id') {
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
  async sendPost(receive_id, postContent, receive_id_type = 'open_id') {
    return this.sendMessage({
      receive_id,
      msg_type: 'post',
      content: postContent,
      receive_id_type
    });
  }

  /**
   * 发送图片消息
   * @param {string} receive_id - 接收者ID
   * @param {string} image_key - 图片key（需先上传）
   * @param {string} receive_id_type - 接收者类型
   */
  async sendImage(receive_id, image_key, receive_id_type = 'open_id') {
    return this.sendMessage({
      receive_id,
      msg_type: 'image',
      content: { image_key },
      receive_id_type
    });
  }

  /**
   * 发送消息卡片
   * @param {string} receive_id - 接收者ID
   * @param {object} cardContent - 卡片内容
   * @param {string} receive_id_type - 接收者类型
   */
  async sendCard(receive_id, cardContent, receive_id_type = 'open_id') {
    return this.sendMessage({
      receive_id,
      msg_type: 'interactive',
      content: cardContent,
      receive_id_type
    });
  }

  /**
   * 发送文件消息
   * @param {string} receive_id - 接收者ID
   * @param {string} file_key - 文件key（需先上传）
   * @param {string} receive_id_type - 接收者类型
   */
  async sendFile(receive_id, file_key, receive_id_type = 'open_id') {
    return this.sendMessage({
      receive_id,
      msg_type: 'file',
      content: { file_key },
      receive_id_type
    });
  }

  /**
   * 上传图片
   * @param {Buffer|Readable} imageStream - 图片流
   * @param {string} imageName - 图片名称
   * @param {string} imageType - 图片类型 (message/avatar)
   */
  async uploadImage(imageStream, imageName = 'image.png', imageType = 'message') {
    const token = await this.getTenantAccessToken();

    const formData = new FormData();
    formData.append('image_type', imageType);
    formData.append('image', imageStream, imageName);

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`上传图片失败: ${data.msg}`);
    }

    return {
      success: true,
      image_key: data.data?.image_key
    };
  }

  /**
   * 上传文件
   * @param {Buffer|Readable} fileStream - 文件流
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型 (stream/pdf/stream)
   */
  async uploadFile(fileStream, fileName, fileType = 'stream') {
    const token = await this.getTenantAccessToken();

    const formData = new FormData();
    formData.append('file_type', fileType);
    formData.append('file_name', fileName);
    formData.append('file', fileStream, fileName);

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`上传文件失败: ${data.msg}`);
    }

    return {
      success: true,
      file_key: data.data?.file_key
    };
  }

  /**
   * 处理飞书事件回调
   * @param {object} event - 飞书事件
   */
  async handleEvent(event) {
    const { type, header } = event;
    const eventType = header?.event_type;

    console.log('[Feishu] 收到事件:', eventType);

    // 验证 Token
    if (this.verificationToken && header?.token !== this.verificationToken) {
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
  async _handleMessageReceive(event) {
    const message = event.event?.message;
    const sender = event.event?.sender;

    if (!message) {
      return { success: false, error: 'No message in event' };
    }

    // 解密消息内容（如果配置了加密）
    let content = message.content;
    if (this.encryptKey && typeof content === 'string') {
      content = this._decryptContent(content);
    }

    // 解析消息内容
    let parsedContent;
    try {
      parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      parsedContent = content;
    }

    const messageData = {
      messageId: message.message_id,
      messageType: message.message_type,
      content: parsedContent,
      createTime: message.create_time,
      chatId: message.chat_id,
      sender: {
        senderId: sender?.sender_id,
        senderType: sender?.sender_type,
        tenantKey: sender?.tenant_key
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
  _decryptContent(encryptedContent) {
    if (!this.encryptKey) {
      return encryptedContent;
    }

    try {
      const key = Buffer.from(this.encryptKey, 'base64');
      const encrypted = Buffer.from(encryptedContent, 'base64');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, encrypted.slice(0, 16));
      let decrypted = decipher.update(encrypted.slice(16), 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[Feishu] 解密失败:', error.message);
      return encryptedContent;
    }
  }

  /**
   * 验证 URL 签名（用于事件订阅配置）
   */
  verifyUrlSignature(timestamp, nonce, signature, body) {
    if (!this.verificationToken) {
      return true;
    }

    const content = timestamp + nonce + this.verificationToken + body;
    const expectedSignature = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      await this.getTenantAccessToken();
      return { success: true, message: '飞书连接成功' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   * @param {string} userIdType - 用户ID类型 (open_id/user_id/union_id)
   */
  async getUserInfo(userId, userIdType = 'open_id') {
    const token = await this.getTenantAccessToken();

    const response = await fetch(`${FEISHU_API_BASE}/contact/v3/users/${userId}?user_id_type=${userIdType}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`获取用户信息失败: ${data.msg}`);
    }

    return {
      success: true,
      user: data.data?.user
    };
  }

  /**
   * 获取群信息
   * @param {string} chatId - 群ID
   */
  async getChatInfo(chatId) {
    const token = await this.getTenantAccessToken();

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/chats/${chatId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`获取群信息失败: ${data.msg}`);
    }

    return {
      success: true,
      chat: data.data
    };
  }

  /**
   * 获取群成员列表
   * @param {string} chatId - 群ID
   * @param {number} page_size - 每页数量
   * @param {string} page_token - 分页token
   */
  async getChatMembers(chatId, page_size = 50, page_token = null) {
    const token = await this.getTenantAccessToken();

    let url = `${FEISHU_API_BASE}/im/v1/chats/${chatId}/members?member_id_type=open_id&page_size=${page_size}`;
    if (page_token) {
      url += `&page_token=${page_token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`获取群成员失败: ${data.msg}`);
    }

    return {
      success: true,
      members: data.data?.items || [],
      hasMore: data.data?.has_more,
      pageToken: data.data?.page_token
    };
  }

  /**
   * 关闭插件
   */
  async close() {
    this.tenantAccessToken = null;
    this.tokenExpireTime = 0;
    this.connected = false;
    console.log('[Feishu] 插件已关闭');
  }

  /**
   * 获取插件状态
   */
  getStatus() {
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
let instance = null;

/**
 * 获取飞书插件实例
 */
function getFeishuChannel(config) {
  if (!instance && config) {
    instance = new FeishuChannelPlugin(config);
  }
  return instance;
}

/**
 * 初始化飞书插件
 */
async function initFeishuChannel(config) {
  const plugin = getFeishuChannel(config);
  await plugin.init();
  return plugin;
}

module.exports = {
  FeishuChannelPlugin,
  getFeishuChannel,
  initFeishuChannel
};
