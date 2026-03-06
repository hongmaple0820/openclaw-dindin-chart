import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as config from '../config';
import * as redisClient from '../redis-client';
import { Message } from './base-bot';

/**
 * OpenClaw 机器人配置选项
 */
export interface OpenClawBotOptions {
  baseUrl?: string;
  token?: string;
  cooldownMs?: number;
}

/**
 * OpenClaw 机器人
 * 直接调用 OpenClaw HTTP API，不绕道钉钉
 */
export class OpenClawBot {
  name: string;
  baseUrl: string;
  token: string;
  cooldownMs: number;
  lastReplyTime: number;
  processing: boolean;

  constructor(name: string, options: OpenClawBotOptions = {}) {
    this.name = name;
    this.baseUrl = options.baseUrl || (config as any).openclaw?.baseUrl || 'http://127.0.0.1:18789';
    this.token = options.token || (config as any).openclaw?.token || '';
    this.cooldownMs = options.cooldownMs || (config as any).bots?.cooldownMs || 3000;
    this.lastReplyTime = 0;
    this.processing = false;
  }

  /**
   * 启动机器人
   */
  async start(): Promise<void> {
    console.log(`[${this.name}] 启动中...`);
    console.log(`[${this.name}] OpenClaw API: ${this.baseUrl}`);

    await (redisClient as any).subscribe((config as any).channels.messages, async (message: Message) => {
      await this.handleMessage(message);
    });

    console.log(`[${this.name}] 已就绪，等待消息...`);
  }

  /**
   * 处理消息
   */
  async handleMessage(message: Message): Promise<void> {
    // 不响应自己的消息
    if (message.sender === this.name) {
      return;
    }

    // 不响应已转发的消息（避免循环）
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
    if (now - this.lastReplyTime < this.cooldownMs) {
      console.log(`[${this.name}] 冷却中，跳过`);
      return;
    }

    // 判断是否需要回复
    const shouldReply = await this.shouldRespond(message);
    if (!shouldReply) {
      return;
    }

    try {
      this.processing = true;
      console.log(`[${this.name}] 处理消息:`, message.sender, '->', message.content?.substring(0, 50));

      // 获取上下文
      const context = await (redisClient as any).getContext((config as any).bots?.contextSize || 10);

      // 调用 OpenClaw
      const reply = await this.callOpenClaw(message, context);

      if (reply) {
        this.lastReplyTime = Date.now();
        await this.sendReply(reply, message.id);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`[${this.name}] 处理失败:`, err.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * 判断是否应该回复
   */
  async shouldRespond(message: Message): Promise<boolean> {
    const content = message.content || '';

    // 1. 明确 @ 自己
    if (content.includes(`@${this.name}`)) {
      console.log(`[${this.name}] 被 @ 了，需要回复`);
      return true;
    }

    // 2. 人类消息且是问句
    if (message.type === 'human' && /[?？]$/.test(content.trim())) {
      console.log(`[${this.name}] 检测到问句，考虑回复`);
      return true;
    }

    // 3. 人类消息，有一定概率回复（模拟自然对话）
    if (message.type === 'human') {
      const chance = 0.3;
      if (Math.random() < chance) {
        console.log(`[${this.name}] 随机触发回复`);
        return true;
      }
    }

    // 4. 机器人消息，低概率回复（避免无限对话）
    if (message.type === 'bot') {
      const chance = 0.1;
      if (Math.random() < chance) {
        console.log(`[${this.name}] 随机回复其他机器人`);
        return true;
      }
    }

    return false;
  }

  /**
   * 调用 OpenClaw API
   */
  async callOpenClaw(message: Message, context: Message[] = []): Promise<string | null> {
    // 构建带上下文的消息
    let prompt = '';
    
    if (context.length > 0) {
      prompt += '以下是最近的对话记录：\n';
      for (const msg of context) {
        prompt += `${msg.sender}: ${msg.content}\n`;
      }
      prompt += '\n---\n';
    }
    
    prompt += `${message.sender}: ${message.content}\n\n请以 ${this.name} 的身份回复，简洁自然。`;

    try {
      // 尝试调用 OpenClaw 的聊天 API
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          message: prompt,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` })
          },
          timeout: 60000
        }
      );

      const data = response.data as { reply?: string; content?: string; message?: string };
      const reply = data?.reply || data?.content || data?.message;
      
      if (reply) {
        console.log(`[${this.name}] OpenClaw 回复:`, reply.substring(0, 50));
        return reply;
      }
      
      return null;
    } catch (error) {
      // 如果 OpenClaw API 不可用，返回备用回复
      console.log(`[${this.name}] OpenClaw 不可用，使用备用回复`);
      return this.getFallbackReply(message);
    }
  }

  /**
   * 备用回复（当 OpenClaw 不可用时）
   */
  getFallbackReply(message: Message): string {
    const replies = [
      `${message.sender}，你说的有道理！`,
      `嗯嗯，我理解你的意思`,
      `这个问题很有趣~`,
      `让我想想...`,
      `有道理，继续说？`
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  /**
   * 发送回复
   */
  async sendReply(content: string, replyTo: string | null = null): Promise<void> {
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

export default OpenClawBot;