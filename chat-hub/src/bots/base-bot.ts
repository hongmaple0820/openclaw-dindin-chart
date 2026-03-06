import { v4 as uuidv4 } from 'uuid';
import * as config from '../config';
import * as redisClient from '../redis-client';

/**
 * 消息接口
 */
export interface Message {
  id: string;
  type: 'human' | 'bot' | 'system';
  sender: string;
  content: string;
  timestamp: number;
  replyTo?: string | null;
  forwarded?: boolean;
}

/**
 * 机器人基类
 * 所有 AI 机器人都应该继承这个类
 */
export class BaseBot {
  name: string;
  lastReplyTime: number;
  cooldownMs: number;

  constructor(name: string) {
    this.name = name;
    this.lastReplyTime = 0;
    this.cooldownMs = (config as any).bots?.cooldownMs || 5000;
  }

  /**
   * 启动机器人，订阅消息频道
   */
  async start(): Promise<void> {
    console.log(`[${this.name}] 机器人启动中...`);

    await (redisClient as any).subscribe((config as any).channels.messages, async (message: Message) => {
      // 过滤：不响应自己发的消息
      if (message.sender === this.name) {
        return;
      }

      // 冷却检查：避免频繁回复
      const now = Date.now();
      if (now - this.lastReplyTime < this.cooldownMs) {
        console.log(`[${this.name}] 冷却中，跳过消息`);
        return;
      }

      // 调用子类实现的处理逻辑
      const shouldReply = await this.shouldRespond(message);
      if (!shouldReply) {
        return;
      }

      try {
        console.log(`[${this.name}] 处理消息:`, message.sender, '->', message.content?.substring(0, 30));
        const reply = await this.onMessage(message);

        if (reply) {
          this.lastReplyTime = Date.now();
          await this.reply(reply, message.id);
        }
      } catch (error) {
        console.error(`[${this.name}] 处理消息失败:`, error);
      }
    });

    console.log(`[${this.name}] 机器人已就绪，等待消息...`);
  }

  /**
   * 判断是否应该响应此消息（子类可覆盖）
   * @param message - 消息对象
   * @returns 是否应该响应
   */
  async shouldRespond(message: Message): Promise<boolean> {
    // 默认：响应人类消息和其他机器人的消息
    return true;
  }

  /**
   * 处理消息并生成回复（子类必须实现）
   * @param message - 消息对象
   * @returns 回复内容，返回 null 表示不回复
   */
  async onMessage(message: Message): Promise<string | null> {
    throw new Error('子类必须实现 onMessage 方法');
  }

  /**
   * 发送回复到回复频道
   * @param content - 回复内容
   * @param replyTo - 回复的消息ID
   */
  async reply(content: string, replyTo: string | null = null): Promise<void> {
    const message: Message = {
      id: uuidv4(),
      type: 'bot',
      sender: this.name,
      content,
      timestamp: Date.now(),
      replyTo
    };

    await (redisClient as any).publish((config as any).channels.replies, message);
    console.log(`[${this.name}] 已发送回复:`, content.substring(0, 50));
  }
}

export default BaseBot;