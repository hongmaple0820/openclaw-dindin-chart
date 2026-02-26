/**
 * 钉钉消息发送模块
 * 
 * 向后兼容层：导出 dingtalk-sender 的功能
 * 支持双模式：webhook 和 plugin
 * 
 * @author 小熊
 * @date 2026-02-25
 */

const sender = require('./dingtalk-sender');
const config = require('./config');

// 导出所有 sender 功能
module.exports = {
  // 主要发送接口
  sendText: sender.sendText,
  sendMarkdown: sender.sendMarkdown,
  
  // 新增：群聊和私聊接口
  sendToGroup: sender.sendToGroup,
  sendToUser: sender.sendToUser,
  
  // 底层接口
  sendViaWebhook: sender.sendViaWebhook,
  sendViaPlugin: sender.sendViaPlugin,
  
  // 工具函数
  generateSign: sender.generateSign,
  parseAtTargets: sender.parseAtTargets,
  getUserPhoneMap: sender.getUserPhoneMap,
  getAvailableWebhooks: sender.getAvailableWebhooks,
  setDefaultWebhook: sender.setDefaultWebhook,
  getWebhookConfig: sender.getWebhookConfig,
  getGroupConfig: sender.getGroupConfig,
  getUserConfig: sender.getUserConfig,
  getSendingMode: sender.getSendingMode
};
