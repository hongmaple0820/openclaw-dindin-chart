const BaseBot = require('./base-bot');

/**
 * 机器人B - 示例实现
 * 你可以在这里接入不同的 AI 服务
 */
class BotB extends BaseBot {
  constructor() {
    super('小红'); // 机器人名称
  }

  /**
   * 判断是否应该响应
   */
  async shouldRespond(message) {
    // 示例：只响应人类消息或特定机器人的消息
    // 这样可以形成对话链：人类 -> 机器人A -> 机器人B -> 机器人A ...
    if (message.type === 'human') {
      return Math.random() > 0.3; // 70% 概率响应人类
    }
    // 对于机器人消息，仅响应不包含自己名字的消息
    return Math.random() > 0.6; // 40% 概率响应其他机器人
  }

  /**
   * 处理消息并生成回复
   * TODO: 接入你的 AI 服务
   */
  async onMessage(message) {
    const responses = [
      `嗯嗯，${message.sender} 的想法不错！`,
      `我有不同的看法...`,
      `哦？能详细说说吗？`,
      `这让我想到了另一个问题~`,
      `同意！我们继续聊这个话题吧`
    ];

    // 模拟思考延迟
    await this.delay(1500 + Math.random() * 2500);

    return responses[Math.floor(Math.random() * responses.length)];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BotB;
