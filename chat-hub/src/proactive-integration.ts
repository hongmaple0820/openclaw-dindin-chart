/**
 * 主动触发器集成代码
 * 将此代码添加到 server.js 的 start() 函数中
 * 位置：在 instanceAuth.startHeartbeat() 之后
 */

import { v4 as uuidv4 } from 'uuid';

// Type declarations for external dependencies
declare const dingtalk: any;
declare const myBotName: string;
declare const messageStore: any;
declare const transportManager: any;
declare const config: any;

// ==================== 主动触发器启动 ====================
const { initProactiveTrigger } = require('./proactive-init');

initProactiveTrigger({
  messageSender: async (message: string, options: any) => {
    console.log('[ProactiveTrigger] 发送主动消息:', message);
    // 发送到钉钉群
    await dingtalk.sendText(message, myBotName, null);
    // 同步到 Redis
    const proactiveMessage = {
      id: uuidv4(),
      type: 'bot',
      sender: myBotName,
      content: message,
      timestamp: Date.now(),
      source: 'proactive',
      triggerType: options?.triggerType
    };
    messageStore.addMessage(proactiveMessage);
    await transportManager.send(proactiveMessage, config.channels.messages);
  },
  redisClient: transportManager.redisClient
});

export {};