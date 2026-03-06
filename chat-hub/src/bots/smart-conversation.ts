import { spawn } from 'child_process';
import * as config from '../config';
import * as redisClient from '../redis-client';
import { Message } from './base-bot';

/**
 * 智能对话管理器配置选项
 */
export interface SmartConversationOptions {
  gatewayUrl?: string | null;
  gatewayToken?: string | null;
  checkIntervalMs?: number;
  botCooldownMs?: number;
  humanCooldownMs?: number;
  maxConversationTurns?: number;
}

/**
 * 对话状态
 */
interface ConversationState {
  id: string;
  participants: string[];
  pendingMessages: Message[];
  turns: number;
  isBot: boolean;
  lastActivity: number;
  processing: boolean;
  topicClosed: boolean;
}

/**
 * 智能对话管理器
 * 自主检测消息 + 智能判断回复 + 对话状态追踪
 * @author 小琳
 * @date 2026-02-06
 */
export class SmartConversationManager {
  name: string;
  gatewayUrl: string | null;
  gatewayToken: string | null;
  
  // 对话状态追踪
  conversations: Map<string, ConversationState>;
  recentMessages: string[];
  lastCheckTime: number;
  lastReplyTime: Record<string, number>;
  
  // 配置
  checkIntervalMs: number;
  botCooldownMs: number;
  humanCooldownMs: number;
  maxConversationTurns: number;
  
  // 机器人名单
  botNames: string[];
  
  // 话题终结词
  topicEnders: RegExp[];
  
  // 需要回复的信号
  replySignals: RegExp[];

  constructor(name: string, options: SmartConversationOptions = {}) {
    this.name = name;
    this.gatewayUrl = options.gatewayUrl || null;
    this.gatewayToken = options.gatewayToken || null;
    
    // 对话状态追踪
    this.conversations = new Map();
    this.recentMessages = [];
    this.lastCheckTime = 0;
    this.lastReplyTime = {};
    
    // 配置
    this.checkIntervalMs = options.checkIntervalMs || 10000;
    this.botCooldownMs = options.botCooldownMs || 30000;
    this.humanCooldownMs = options.humanCooldownMs || 3000;
    this.maxConversationTurns = options.maxConversationTurns || 5;
    
    // 机器人名单
    this.botNames = ['小琳', '小猪', 'maple-bot', 'lin-bot'];
    
    // 话题终结词
    this.topicEnders = [
      /^收到[！!。.]*$/,
      /^好的[！!。.]*$/,
      /^嗯[！!。.]*$/,
      /^ok[！!。.]*$/i,
      /^明白[！!。.]*$/,
      /^了解[！!。.]*$/,
      /^谢谢[！!。.]*$/,
      /^感谢[！!。.]*$/,
      /^晚安[！!。.]*$/,
      /^拜拜[！!。.]*$/,
      /^再见[！!。.]*$/,
    ];
    
    // 需要回复的信号
    this.replySignals = [
      /@小琳/,
      /@小猪/,
      /\?$/,
      /？$/,
      /怎么/,
      /如何/,
      /为什么/,
      /什么/,
      /帮我/,
      /请/,
      /麻烦/,
      /你觉得/,
      /你认为/,
      /你看/,
    ];
  }

  /**
   * 启动管理器
   */
  async start(): Promise<void> {
    console.log(`[${this.name}] 智能对话管理器启动...`);
    
    // 监听 Redis 消息
    await (redisClient as any).subscribe((config as any).channels.messages, (msg: Message) => this.handleMessage(msg));
    await (redisClient as any).subscribe((config as any).channels.replies, (msg: Message) => this.handleMessage(msg));
    
    // 定时自主检查
    this.startPeriodicCheck();
    
    console.log(`[${this.name}] 智能对话管理器已就绪`);
  }

  /**
   * 定时自主检查未处理消息
   */
  startPeriodicCheck(): void {
    setInterval(async () => {
      try {
        await this.checkUnprocessedMessages();
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`[${this.name}] 自主检查失败:`, err.message);
      }
    }, this.checkIntervalMs);
  }

  /**
   * 检查未处理的消息
   */
  async checkUnprocessedMessages(): Promise<void> {
    const now = Date.now();
    
    // 找出需要处理但还没处理的消息
    this.conversations.forEach((state: ConversationState, convId: string) => {
      // 超过5分钟没活动的对话，清理掉
      if (now - state.lastActivity > 5 * 60 * 1000) {
        this.conversations.delete(convId);
        return;
      }
      
      // 有待处理的消息且没在冷却中
      if (state.pendingMessages.length > 0 && !state.processing) {
        const lastReply = this.lastReplyTime[convId] || 0;
        const cooldown = state.isBot ? this.botCooldownMs : this.humanCooldownMs;
        
        if (now - lastReply >= cooldown) {
          // 异步处理，不等待
          this.processConversation(convId, state).catch(err => {
            console.error(`[${this.name}] 处理对话失败:`, err.message);
          });
        }
      }
    });
  }

  /**
   * 处理收到的消息
   */
  async handleMessage(message: Message): Promise<void> {
    // 不处理自己的消息
    if (message.sender === this.name) return;
    
    const isBot = this.botNames.includes(message.sender);
    const convId = this.getConversationId(message);
    
    // 获取或创建对话状态
    let state = this.conversations.get(convId);
    if (!state) {
      state = {
        id: convId,
        participants: [message.sender],
        pendingMessages: [],
        turns: 0,
        isBot: isBot,
        lastActivity: Date.now(),
        processing: false,
        topicClosed: false
      };
      this.conversations.set(convId, state);
    }
    
    // 更新状态
    state.lastActivity = Date.now();
    state.isBot = isBot;
    
    // 检查是否是话题终结
    if (this.isTopicEnder(message.content)) {
      state.topicClosed = true;
      console.log(`[${this.name}] 话题终结: ${message.content?.slice(0, 20)}`);
      return;
    }
    
    // 检查是否需要回复
    const needsReply = this.shouldReply(message, state);
    if (!needsReply) {
      console.log(`[${this.name}] 无需回复: ${message.content?.slice(0, 30)}`);
      return;
    }
    
    // 添加到待处理队列
    state.pendingMessages.push(message);
    
    // 如果是人类消息，立即处理（带冷却）
    if (!isBot) {
      const lastReply = this.lastReplyTime[convId] || 0;
      if (Date.now() - lastReply >= this.humanCooldownMs) {
        await this.processConversation(convId, state);
      }
    }
    // 机器人消息会在定时检查时处理
  }

  /**
   * 判断是否应该回复
   */
  shouldReply(message: Message, state: ConversationState): boolean {
    const content = message.content || '';
    
    // 话题已关闭，不回复
    if (state.topicClosed) {
      // 但如果有新的请求信号，重新打开话题
      if (this.hasReplySignal(content)) {
        state.topicClosed = false;
        state.turns = 0;
      } else {
        return false;
      }
    }
    
    // 超过最大轮次，不回复（除非明确 @ 我）
    if (state.turns >= this.maxConversationTurns) {
      if (!content.includes(`@${this.name}`)) {
        console.log(`[${this.name}] 超过最大轮次，等待明确指令`);
        return false;
      }
    }
    
    // 重复消息检测
    if (this.isRepetitive(content)) {
      return false;
    }
    
    // 机器人消息：只回复有价值的内容
    if (state.isBot) {
      // 必须有明确的回复信号
      if (!this.hasReplySignal(content)) {
        return false;
      }
    }
    
    // 人类消息：默认回复（除非是无意义的）
    return true;
  }

  /**
   * 检查是否有回复信号
   */
  hasReplySignal(content: string): boolean {
    return this.replySignals.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否是话题终结词
   */
  isTopicEnder(content?: string): boolean {
    const trimmed = (content || '').trim();
    return this.topicEnders.some(pattern => pattern.test(trimmed));
  }

  /**
   * 检查是否是重复消息
   */
  isRepetitive(content: string): boolean {
    const hash = (content || '').slice(0, 50);
    if (this.recentMessages.includes(hash)) {
      return true;
    }
    this.recentMessages.push(hash);
    if (this.recentMessages.length > 10) {
      this.recentMessages.shift();
    }
    return false;
  }

  /**
   * 处理对话
   */
  async processConversation(convId: string, state: ConversationState): Promise<void> {
    if (state.processing || state.pendingMessages.length === 0) return;
    
    state.processing = true;
    
    try {
      // 合并待处理消息
      const messages = state.pendingMessages.splice(0);
      const combined = messages.map(m => `${m.sender}: ${m.content}`).join('\n');
      
      console.log(`[${this.name}] 处理对话: ${combined.slice(0, 50)}...`);
      
      // 触发 OpenClaw
      await this.triggerOpenClaw(combined);
      
      // 更新状态
      state.turns++;
      this.lastReplyTime[convId] = Date.now();
      
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`[${this.name}] 处理失败:`, err.message);
    } finally {
      state.processing = false;
    }
  }

  /**
   * 触发 OpenClaw 处理
   */
  async triggerOpenClaw(text: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const args: string[] = ['system', 'event', '--text', text, '--mode', 'now'];
      
      if (this.gatewayUrl) {
        args.push('--gateway-url', this.gatewayUrl);
      }
      if (this.gatewayToken) {
        args.push('--gateway-token', this.gatewayToken);
      }
      
      const child = spawn('openclaw', args, {
        env: { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.npm-global/bin` }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      child.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`[${this.name}] OpenClaw 触发成功`);
          resolve(stdout);
        } else {
          reject(new Error(`OpenClaw 退出码 ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * 获取对话 ID
   */
  getConversationId(message: Message): string {
    // 简化：用发送者作为对话 ID
    // 实际可以根据群/话题等更复杂的逻辑
    return message.sender;
  }
}

export default SmartConversationManager;