const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const config = require('../../config/default.json');
const redisClient = require('../redis-client');

/**
 * OpenClaw 触发器
 * 通过 openclaw system event 命令触发 OpenClaw 处理消息
 * 不是自己生成回复，而是通知真正的 OpenClaw 实例
 */
class OpenClawTrigger {
  constructor(name, options = {}) {
    this.name = name;
    this.gatewayUrl = options.gatewayUrl || null;  // 远程 OpenClaw 的 WebSocket URL
    this.gatewayToken = options.gatewayToken || null;  // 远程 OpenClaw 的 token
    this.cooldownMs = options.cooldownMs || config.bots?.cooldownMs || 3000;
    this.lastTriggerTime = 0;
    this.processing = false;
  }

  /**
   * 启动触发器
   */
  async start() {
    console.log(`[${this.name}] 触发器启动中...`);
    if (this.gatewayUrl) {
      console.log(`[${this.name}] 远程 Gateway: ${this.gatewayUrl}`);
    } else {
      console.log(`[${this.name}] 使用本地 Gateway`);
    }

    await redisClient.subscribe(config.channels.messages, async (message) => {
      await this.handleMessage(message);
    });

    console.log(`[${this.name}] 触发器已就绪`);
  }

  /**
   * 处理消息
   */
  async handleMessage(message) {
    // 不响应自己触发的消息
    if (message.sender === this.name) {
      return;
    }

    // 不响应机器人消息（避免循环）
    if (message.type === 'bot') {
      return;
    }

    // 不响应已转发的消息
    if (message.forwarded) {
      return;
    }

    // 防止并发处理
    if (this.processing) {
      console.log(`[${this.name}] 正在处理中，跳过`);
      return;
    }

    // 冷却检查
    const now = Date.now();
    if (now - this.lastTriggerTime < this.cooldownMs) {
      console.log(`[${this.name}] 冷却中，跳过`);
      return;
    }

    // 判断是否需要触发
    const shouldTrigger = this.shouldTrigger(message);
    if (!shouldTrigger) {
      return;
    }

    try {
      this.processing = true;
      this.lastTriggerTime = Date.now();

      console.log(`[${this.name}] 触发 OpenClaw 处理:`, message.sender, '->', message.content?.substring(0, 50));
      await this.triggerOpenClaw(message);
    } catch (error) {
      console.error(`[${this.name}] 触发失败:`, error.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * 判断是否应该触发
   */
  shouldTrigger(message) {
    const content = message.content || '';

    // 1. 明确 @ 自己时必须触发
    if (content.includes(`@${this.name}`)) {
      console.log(`[${this.name}] 被 @ 了，触发处理`);
      return true;
    }

    // 2. 不处理 @ 其他机器人的消息
    // 如果消息 @ 了别人但没 @ 自己，跳过
    const atPattern = /@(小琳|小猪)/g;
    const mentions = content.match(atPattern) || [];
    if (mentions.length > 0 && !mentions.includes(`@${this.name}`)) {
      console.log(`[${this.name}] 消息 @ 了其他人，跳过`);
      return false;
    }

    // 3. 人类消息默认触发（让 OpenClaw 自己决定是否回复）
    if (message.type === 'human') {
      console.log(`[${this.name}] 收到人类消息，触发处理`);
      return true;
    }

    return false;
  }

  /**
   * 通过 openclaw system event 触发 OpenClaw
   */
  async triggerOpenClaw(message) {
    // 构造事件文本
    const eventText = `[钉钉群消息] ${message.sender}: ${message.content}`;

    // 构造命令
    let cmd = `openclaw system event --text "${eventText.replace(/"/g, '\\"')}" --mode now --timeout 10000`;

    // 如果是远程 Gateway，添加 url 和 token
    if (this.gatewayUrl) {
      cmd += ` --url "${this.gatewayUrl}"`;
    }
    if (this.gatewayToken) {
      cmd += ` --token "${this.gatewayToken}"`;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
      if (stdout.trim() === 'ok') {
        console.log(`[${this.name}] 成功触发 OpenClaw`);
      } else {
        console.log(`[${this.name}] OpenClaw 响应:`, stdout.trim());
      }
      if (stderr) {
        console.error(`[${this.name}] 警告:`, stderr);
      }
    } catch (error) {
      console.error(`[${this.name}] 执行命令失败:`, error.message);
    }
  }
}

module.exports = OpenClawTrigger;
