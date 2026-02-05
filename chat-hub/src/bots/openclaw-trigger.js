const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const config = require('../config');
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
    this.delayMs = options.delayMs || config.trigger?.delayMs || 3000;  // 触发前延迟
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

    // 监听消息频道
    await redisClient.subscribe(config.channels.messages, async (message) => {
      await this.handleMessage(message);
    });

    // 也监听回复频道（机器人回复也可能需要触发其他机器人）
    await redisClient.subscribe(config.channels.replies, async (message) => {
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

    // 不响应其他机器人的消息（防止无限循环）
    const botNames = ['小琳', '小猪', 'maple-bot', 'lin-bot'];
    if (botNames.includes(message.sender)) {
      // console.log(`[${this.name}] 跳过机器人消息: ${message.sender}`);
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

      // 延迟 3 秒再触发，给 OpenClaw 处理时间
      const delayMs = this.delayMs || 3000;
      console.log(`[${this.name}] 延迟 ${delayMs}ms 后触发...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

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

    // 1. 明确 @ 自己或提到自己名字时必须触发
    if (content.includes(`@${this.name}`) || content.includes(this.name)) {
      console.log(`[${this.name}] 被提到了，触发处理`);
      return true;
    }

    // 2. 机器人消息：如果没提到自己，不触发（避免无关的机器人对话干扰）
    if (message.type === 'bot') {
      return false;
    }

    // 3. 不处理明确 @ 其他机器人的消息（人类消息）
    const atPattern = /@(小琳|小猪|lin-bot|maple-bot)/g;
    const mentions = content.match(atPattern) || [];
    if (mentions.length > 0) {
      console.log(`[${this.name}] 消息 @ 了其他人，跳过`);
      return false;
    }

    // 4. 人类消息默认触发（让 OpenClaw 自己决定是否回复）
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
    // 构造事件文本，限制长度避免命令行溢出
    const content = (message.content || '').substring(0, 500);
    const eventText = `[钉钉群消息] ${message.sender}: ${content}`;

    // 使用 spawn 而不是 exec，通过 stdin 传递消息，避免 shell 转义问题
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const args = ['system', 'event', '--mode', 'now', '--timeout', '10000'];
      
      // 如果是远程 Gateway
      if (this.gatewayUrl) {
        args.push('--url', this.gatewayUrl);
      }
      if (this.gatewayToken) {
        args.push('--token', this.gatewayToken);
      }
      
      // 添加 --text 参数
      args.push('--text', eventText);
      
      const child = spawn('openclaw', args, {
        timeout: 15000,
        shell: false  // 不使用 shell，避免特殊字符问题
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[${this.name}] 成功触发 OpenClaw`);
          resolve(stdout);
        } else {
          console.error(`[${this.name}] 触发失败 (code ${code}):`, stderr || stdout);
          reject(new Error(stderr || stdout));
        }
      });
      
      child.on('error', (err) => {
        console.error(`[${this.name}] 执行命令失败:`, err.message);
        reject(err);
      });
    });
  }
}

module.exports = OpenClawTrigger;
