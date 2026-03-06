const BaseBot = require('./base-bot');

/**
 * 机器人A - 示例实现
 * 你可以在这里接入 openclaw 或其他 AI 服务
 */
class BotA extends BaseBot {
  constructor() {
    super('小明'); // 机器人名称
  }

  /**
   * 判断是否应该响应
   * 这里可以添加自定义逻辑，比如只响应@自己的消息
   */
  async shouldRespond(message) {
    // 示例：随机 50% 概率响应，避免每条消息都回复
    // 实际使用时可以改为：检查消息是否@自己，或者使用 AI 判断是否需要回复
    return Math.random() > 0.5;
  }

  /**
   * 处理消息并生成回复
   * TODO: 接入你的 openclaw API
   */
  async onMessage(message) {
    // 这里是示例回复，实际使用时替换为 AI 调用
    const responses = [
      `${message.sender}，你说的有道理！`,
      `我觉得这个话题很有趣~`,
      `让我想想... 嗯，我同意你的观点`,
      `哈哈，${message.sender} 说得好！`,
      `这个问题很复杂，我们可以继续讨论`
    ];

    // 模拟思考延迟
    await this.delay(1000 + Math.random() * 2000);

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 工具方法：延迟
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BotA;
