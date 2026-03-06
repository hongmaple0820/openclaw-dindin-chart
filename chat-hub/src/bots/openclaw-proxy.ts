import * as config from '../config';
import * as redisClient from '../redis-client';
import * as dingtalk from '../dingtalk';
import { Message } from './base-bot';

/**
 * OpenClaw 机器人代理
 *
 * 这个类不直接调用 AI API，而是通过在钉钉群 @ OpenClaw 机器人来触发它
 * 工作流程：
 * 1. 收到消息 -> 通过钉钉 Webhook 发送消息并 @ OpenClaw 机器人
 * 2. OpenClaw 收到 @ 后处理并回复到钉钉群
 * 3. 钉钉 Outgoing Webhook 把 OpenClaw 的回复发送到聊天室
 */
export class OpenClawProxy {
  name: string;
  openclawAtName: string;
  lastTriggerTime: number;
  cooldownMs: number;

  constructor(name: string, openclawAtName: string) {
    this.name = name;
    this.openclawAtName = openclawAtName;
    this.lastTriggerTime = 0;
    this.cooldownMs = (config as any).bots?.cooldownMs || 5000;
  }

  /**
   * 启动代理，订阅消息频道
   */
  async start(): Promise<void> {
    console.log(`[${this.name}] OpenClaw 代理启动中...`);

    await (redisClient as any).subscribe((config as any).channels.messages, async (message: Message) => {
      // 过滤：不响应机器人消息（避免循环）
      if (message.type === 'bot') {
        return;
      }

      // 冷却检查
      const now = Date.now();
      if (now - this.lastTriggerTime < this.cooldownMs) {
        console.log(`[${this.name}] 冷却中，跳过`);
        return;
      }

      // 判断是否需要触发这个机器人
      const shouldTrigger = await this.shouldTrigger(message);
      if (!shouldTrigger) {
        return;
      }

      try {
        console.log(`[${this.name}] 转发给 OpenClaw:`, message.content?.substring(0, 30));
        await this.triggerOpenClaw(message);
        this.lastTriggerTime = Date.now();
      } catch (error) {
        console.error(`[${this.name}] 触发 OpenClaw 失败:`, error);
      }
    });

    console.log(`[${this.name}] OpenClaw 代理已就绪`);
  }

  /**
   * 判断是否应该触发 OpenClaw（子类可覆盖）
   */
  async shouldTrigger(message: Message): Promise<boolean> {
    // 默认：检查消息内容是否 @ 了这个机器人
    const content = message.content || '';
    return content.includes(this.openclawAtName) || content.includes(`@${this.name}`);
  }

  /**
   * 通过钉钉 @ OpenClaw 机器人
   */
  async triggerOpenClaw(message: Message): Promise<void> {
    // 构造消息：包含 @ 和原始消息
    const triggerMessage = `${this.openclawAtName} ${message.content}`;

    // 发送到钉钉群，@ 机器人会触发 OpenClaw
    await (dingtalk as any).sendText(triggerMessage, this.name);
  }
}

export default OpenClawProxy;