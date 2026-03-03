/**
 * 主动触发器初始化
 * 用于集成 ProactiveTrigger 到 server.js
 */
const ProactiveTrigger = require('./character/proactive-trigger');

// 创建触发器实例
const proactiveTrigger = new ProactiveTrigger({
  enabled: true,
  timeTriggers: {
    morning: {
      enabled: true,
      timeRange: ['07:00', '09:00'],
      messages: [
        '早安~ 昨晚睡得好吗？',
        '早上好呀！新的一天开始了~',
        '早安！记得吃早餐哦~',
        '早~ 今天有什么计划吗？'
      ]
    },
    noon: {
      enabled: true,
      timeRange: ['12:00', '13:00'],
      messages: [
        '中午啦~ 记得休息一下哦',
        '午饭时间到了，别太累了~',
        '午休一下吧，放松放松~'
      ]
    },
    evening: {
      enabled: true,
      timeRange: ['22:00', '23:00'],
      messages: [
        '晚安~ 今天辛苦了',
        '早点休息哦，熬夜对身体不好~',
        '晚安~ 明天继续加油！',
        '晚安！好梦~'
      ]
    }
  },
  randomTrigger: {
    enabled: false, // 暂时禁用随机触发
    probability: 0.05,
    interval: 3600000
  }
});

/**
 * 启动触发器并设置消息发送
 * @param {object} options - 配置选项
 * @param {function} options.messageSender - 消息发送函数
 */
function initProactiveTrigger(options) {
  const { messageSender, characterManager, memoryManager, relationshipManager, redisClient } = options;
  
  // 设置消息发送回调
  if (messageSender) {
    proactiveTrigger.setMessageSender(messageSender);
  }
  
  // 设置依赖
  proactiveTrigger.setDependencies({
    characterManager,
    memoryManager,
    relationshipManager,
    redisClient
  });
  
  // 启动触发器
  proactiveTrigger.start();
  
  console.log('[ProactiveTrigger] 已启动', proactiveTrigger.getStatus());
  
  return proactiveTrigger;
}

module.exports = {
  proactiveTrigger,
  initProactiveTrigger
};
