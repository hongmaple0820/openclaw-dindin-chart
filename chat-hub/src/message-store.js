const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * 本地消息存储
 * 消息持久化到 JSON 文件，Redis 只做中转
 */
class MessageStore {
  constructor() {
    // 存储目录：机器人工作空间
    this.storeDir = config.store?.dir || path.join(process.env.HOME, '.openclaw', 'chat-data');
    this.messagesFile = path.join(this.storeDir, 'messages.json');
    this.syncStateFile = path.join(this.storeDir, 'sync-state.json');
    this.maxMessages = config.store?.maxMessages || 1000;  // 最多保留消息数
    
    this.messages = [];
    this.syncState = {};  // 每个参与者的同步状态 { participantId: lastSyncTimestamp }
    
    this.init();
  }

  /**
   * 初始化存储
   */
  init() {
    // 创建目录
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
      console.log('[Store] 创建存储目录:', this.storeDir);
    }

    // 加载消息
    if (fs.existsSync(this.messagesFile)) {
      try {
        const data = fs.readFileSync(this.messagesFile, 'utf-8');
        this.messages = JSON.parse(data);
        console.log('[Store] 加载了', this.messages.length, '条历史消息');
      } catch (error) {
        console.error('[Store] 加载消息失败:', error.message);
        this.messages = [];
      }
    }

    // 加载同步状态
    if (fs.existsSync(this.syncStateFile)) {
      try {
        const data = fs.readFileSync(this.syncStateFile, 'utf-8');
        this.syncState = JSON.parse(data);
        console.log('[Store] 加载同步状态:', Object.keys(this.syncState).length, '个参与者');
      } catch (error) {
        console.error('[Store] 加载同步状态失败:', error.message);
        this.syncState = {};
      }
    }
  }

  /**
   * 保存消息到文件
   */
  save() {
    try {
      fs.writeFileSync(this.messagesFile, JSON.stringify(this.messages, null, 2));
    } catch (error) {
      console.error('[Store] 保存消息失败:', error.message);
    }
  }

  /**
   * 保存同步状态
   */
  saveSyncState() {
    try {
      fs.writeFileSync(this.syncStateFile, JSON.stringify(this.syncState, null, 2));
    } catch (error) {
      console.error('[Store] 保存同步状态失败:', error.message);
    }
  }

  /**
   * 添加消息
   */
  addMessage(message) {
    // 检查重复
    if (this.messages.some(m => m.id === message.id)) {
      return false;
    }

    this.messages.push(message);

    // 超过最大数量时删除旧消息
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.save();
    return true;
  }

  /**
   * 删除消息
   */
  deleteMessage(messageId) {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index === -1) {
      return false;
    }
    this.messages.splice(index, 1);
    this.save();
    return true;
  }

  /**
   * 获取最近消息
   */
  getMessages(limit = 50) {
    return this.messages.slice(-limit);
  }

  /**
   * 获取参与者未同步的消息
   * @param {string} participantId - 参与者标识
   * @returns {Array} 未同步的消息
   */
  getUnsyncedMessages(participantId) {
    const lastSync = this.syncState[participantId] || 0;
    return this.messages.filter(m => m.timestamp > lastSync);
  }

  /**
   * 标记参与者已同步到某个时间点
   */
  markSynced(participantId, timestamp = Date.now()) {
    this.syncState[participantId] = timestamp;
    this.saveSyncState();
  }

  /**
   * 获取所有参与者的同步状态
   */
  getSyncStatus() {
    const status = {};
    for (const [id, lastSync] of Object.entries(this.syncState)) {
      const unsynced = this.messages.filter(m => m.timestamp > lastSync).length;
      status[id] = {
        lastSync,
        lastSyncTime: new Date(lastSync).toISOString(),
        unsyncedCount: unsynced
      };
    }
    return status;
  }

  /**
   * 清空所有消息
   */
  clear() {
    this.messages = [];
    this.save();
  }

  /**
   * 检查消息是否重复
   */
  isDuplicate(messageId) {
    return this.messages.some(m => m.id === messageId);
  }
}

module.exports = new MessageStore();
