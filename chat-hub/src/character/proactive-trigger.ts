/**
 * 主动触发器 - ProactiveTrigger
 * 
 * 支持时间触发、事件触发、随机触发
 * 与 CharacterManager、MemoryManager、RelationshipManager 集成
 * 通过 Redis 或 API 发送消息
 */

import EventEmitter from 'events';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import Logger from '../utils/logger';

type SqliteDatabase = ReturnType<typeof Database>;

const logger = new Logger('ProactiveTrigger');

// 类型定义
interface TimeTrigger {
  enabled: boolean;
  timeRange: [string, string];
  messages: string[];
}

interface RandomTrigger {
  enabled: boolean;
  probability: number;
  interval: number;
  messages: string[];
}

interface EventTriggers {
  inactivity: {
    enabled: boolean;
    threshold: number;
    messages: string[];
  };
  emotionSupport: {
    enabled: boolean;
    keywords: string[];
    cooldown: number;
    messages: string[];
  };
}

interface SpecialDate {
  date: string;
  name: string;
  messages: string[];
}

interface SpecialDates {
  enabled: boolean;
  dates: SpecialDate[];
}

interface ProactiveConfig {
  enabled: boolean;
  timeTriggers: Record<string, TimeTrigger>;
  randomTrigger: RandomTrigger;
  eventTriggers: EventTriggers;
  specialDates: SpecialDates;
}

interface Dependencies {
  characterManager?: unknown;
  memoryManager?: unknown;
  relationshipManager?: unknown;
  redisClient?: { isConnected: boolean; publish: (channel: string, payload: unknown) => Promise<void> };
}

interface TriggerHistory {
  id?: number;
  trigger_type: string;
  message?: string;
  user_id?: string;
  character_id?: string;
  timestamp: number;
}

interface SendMessageOptions {
  triggerType?: string;
  dateInfo?: SpecialDate;
  options?: Record<string, unknown>;
}

interface EmotionCheckResult {
  type: string;
  keyword: string;
  message: string;
}

interface InactivityCheckResult {
  type: string;
  elapsed: number;
  message: string;
}

interface StatusResult {
  running: boolean;
  enabled: boolean;
  timeTriggers: { name: string; range: [string, string] }[];
  randomTrigger: { probability: number; interval: number } | null;
  lastTriggers: Record<string, number | null>;
  activeTimers: number;
}

// 默认配置
const DEFAULT_CONFIG: ProactiveConfig = {
  enabled: true,
  timeTriggers: {
    morning: {
      enabled: true,
      timeRange: ['07:00', '09:00'],
      messages: [
        '早安~ 昨晚睡得好吗？',
        '早上好呀！新的一天开始了~',
        '早安！记得吃早餐哦~',
        '早~ 今天有什么计划吗？',
        '早安~ 今天也要元气满满哦！'
      ]
    },
    noon: {
      enabled: true,
      timeRange: ['12:00', '13:00'],
      messages: [
        '中午啦~ 记得休息一下哦',
        '午饭时间到了，别太累了~',
        '午休一下吧，放松放松~',
        '吃午饭了吗？别饿着~',
        '中午好~ 休息一会儿吧'
      ]
    },
    evening: {
      enabled: true,
      timeRange: ['22:00', '23:00'],
      messages: [
        '晚安~ 今天辛苦了',
        '早点休息哦，熬夜对身体不好~',
        '晚安~ 明天继续加油！',
        '睡觉前记得放松一下~',
        '晚安！好梦~'
      ]
    }
  },
  randomTrigger: {
    enabled: true,
    probability: 0.1,
    interval: 3600000, // 1小时
    messages: [
      '刚才看到一个有趣的东西，想跟你分享~',
      '突然想到你，最近怎么样呀？',
      '在忙什么呢？',
      '今天天气不错呢~',
      '心情怎么样？有什么想聊的吗？',
      '最近有什么有趣的事吗？',
      '突然有点想你~',
      '刚刚看到一个好玩的东西，想给你看看'
    ]
  },
  eventTriggers: {
    inactivity: {
      enabled: true,
      threshold: 86400000, // 24小时未互动
      messages: [
        '好久没聊了，最近怎么样呀？',
        '好久不见~ 想你了',
        '最近在忙什么呢？好久没聊了',
        '突然想到你，好久没说话了呢~'
      ]
    },
    emotionSupport: {
      enabled: true,
      keywords: ['难过', '伤心', '累', '烦', '郁闷', '不开心', '心情不好', '压力', '崩溃', '绝望'],
      cooldown: 3600000, // 1小时冷却
      messages: [
        '怎么了？看起来心情不太好，想聊聊吗？',
        '感觉你最近压力挺大的，有什么我能帮忙的吗？',
        '没事的，有什么不开心的可以跟我说说~',
        '抱抱你~ 不要太难过啦',
        '我在这里陪你~ 有什么想说的就说出来吧'
      ]
    }
  },
  specialDates: {
    enabled: true,
    dates: [] // { date: 'MM-DD', name: '生日', messages: [...] }
  }
};

class ProactiveTrigger extends EventEmitter {
  private config: ProactiveConfig;
  private running: boolean = false;
  private timers: NodeJS.Timeout[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private db: SqliteDatabase;
  private lastTriggers: Record<string, number | null>;
  private messageSender: ((message: string, options: SendMessageOptions) => Promise<void>) | null = null;
  private characterManager: unknown = null;
  private memoryManager: unknown = null;
  private relationshipManager: unknown = null;
  private redisClient: Dependencies['redisClient'] = null;

  constructor(config: Partial<ProactiveConfig> = {}) {
    super();
    
    // 合并配置
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    
    // 数据库 - 用于记录触发历史
    const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    this.db = Database(dbPath);
    this.initTables();
    
    // 最后一次触发的记录
    this.lastTriggers = {
      morning: null,
      noon: null,
      evening: null,
      random: null,
      inactivity: null,
      emotion: null
    };
    
    logger.info('ProactiveTrigger 初始化完成', { enabled: this.config.enabled });
  }
  
  /**
   * 合并配置
   */
  private mergeConfig(defaults: ProactiveConfig, overrides: Partial<ProactiveConfig>): ProactiveConfig {
    const result = { ...defaults } as unknown as Record<string, unknown>;
    for (const key of Object.keys(overrides) as (keyof ProactiveConfig)[]) {
      const overrideValue = overrides[key];
      if (overrideValue && typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
        result[key] = this.mergeConfig(
          (defaults as unknown as Record<string, unknown>)[key] as ProactiveConfig, 
          overrideValue as Partial<ProactiveConfig>
        );
      } else if (overrideValue !== undefined) {
        result[key] = overrideValue;
      }
    }
    return result as unknown as ProactiveConfig;
  }
  
  /**
   * 初始化数据库表
   */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proactive_trigger_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_type TEXT NOT NULL,
        message TEXT,
        user_id TEXT,
        character_id TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_trigger_type ON proactive_trigger_history(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_trigger_timestamp ON proactive_trigger_history(timestamp);
    `);
  }
  
  /**
   * 设置消息发送回调
   */
  setMessageSender(sender: (message: string, options: SendMessageOptions) => Promise<void>): void {
    this.messageSender = sender;
  }
  
  /**
   * 设置外部依赖
   */
  setDependencies(deps: Dependencies): void {
    this.characterManager = deps.characterManager;
    this.memoryManager = deps.memoryManager;
    this.relationshipManager = deps.relationshipManager;
    this.redisClient = deps.redisClient || null;
  }
  
  /**
   * 启动触发器
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('ProactiveTrigger 已禁用，跳过启动');
      return;
    }
    
    if (this.running) {
      logger.warn('ProactiveTrigger 已在运行中');
      return;
    }
    
    this.running = true;
    
    // 启动时间触发器
    this.startTimeTriggers();
    
    // 启动随机触发器
    this.startRandomTrigger();
    
    // 启动特殊日期检查
    this.startSpecialDateCheck();
    
    // 发射启动事件
    this.emit('started');
    
    logger.info('ProactiveTrigger 已启动', {
      timeTriggers: Object.keys(this.config.timeTriggers).filter(k => this.config.timeTriggers[k].enabled),
      randomTrigger: this.config.randomTrigger.enabled,
      eventTriggers: Object.keys(this.config.eventTriggers).filter(k => {
        const trigger = (this.config.eventTriggers as unknown as Record<string, { enabled?: boolean }>)[k];
        return trigger && trigger.enabled;
      })
    });
  }
  
  /**
   * 停止触发器
   */
  async stop(): Promise<void> {
    this.running = false;
    
    // 清除所有定时器
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
    
    // 清除随机触发器
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.emit('stopped');
    logger.info('ProactiveTrigger 已停止');
  }
  
  /**
   * 启动时间触发器
   */
  private startTimeTriggers(): void {
    const now = new Date();
    
    for (const [triggerName, trigger] of Object.entries(this.config.timeTriggers)) {
      if (!trigger.enabled) continue;
      
      const [startHour, startMin] = trigger.timeRange[0].split(':').map(Number);
      const [endHour, endMin] = trigger.timeRange[1].split(':').map(Number);
      
      // 计算今天下一次触发时间（在范围内随机）
      const nextTrigger = this.getNextRandomTime(startHour, startMin, endHour, endMin);
      
      if (nextTrigger > now) {
        this.scheduleTimeTrigger(triggerName, nextTrigger);
      } else {
        // 如果时间已过，安排到明天
        const tomorrow = new Date(nextTrigger);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.scheduleTimeTrigger(triggerName, tomorrow);
      }
    }
  }
  
  /**
   * 获取下一个随机时间
   */
  private getNextRandomTime(startHour: number, startMin: number, endHour: number, endMin: number): Date {
    const now = new Date();
    const start = new Date(now);
    start.setHours(startHour, startMin, 0, 0);
    
    const end = new Date(now);
    end.setHours(endHour, endMin, 0, 0);
    
    // 计算时间范围（毫秒）
    const range = end.getTime() - start.getTime();
    
    // 在范围内随机选择一个时间
    const randomOffset = Math.random() * range;
    const triggerTime = new Date(start.getTime() + randomOffset);
    
    return triggerTime;
  }
  
  /**
   * 安排时间触发器
   */
  private scheduleTimeTrigger(triggerName: string, triggerTime: Date): void {
    const now = new Date();
    const delay = triggerTime.getTime() - now.getTime();
    
    if (delay < 0) {
      logger.warn('时间触发器延迟为负，跳过', { triggerName });
      return;
    }
    
    const self = this;
    const timer = setTimeout(async function() {
      if (!self.running) return;
      
      await self.executeTimeTrigger(triggerName);
      
      // 安排明天的触发
      const trigger = self.config.timeTriggers[triggerName];
      const [startHour, startMin] = trigger.timeRange[0].split(':').map(Number);
      const [endHour, endMin] = trigger.timeRange[1].split(':').map(Number);
      
      const nextTrigger = self.getNextRandomTime(startHour, startMin, endHour, endMin);
      self.scheduleTimeTrigger(triggerName, nextTrigger);
      
    }, delay);
    
    self.timers.push(timer);
    logger.debug('时间触发器已安排', { 
      triggerName,
      triggerTime: triggerTime.toISOString(),
      delayMinutes: Math.round(delay / 60000)
    });
  }
  
  /**
   * 执行时间触发
   */
  private async executeTimeTrigger(triggerName: string): Promise<void> {
    const trigger = this.config.timeTriggers[triggerName];
    if (!trigger || !trigger.enabled) return;
    
    // 检查今天是否已触发
    if (this.hasTriggeredToday(triggerName)) {
      logger.debug('时间触发器今天已触发，跳过', { triggerName });
      return;
    }
    
    // 随机选择一条消息
    const message = trigger.messages[Math.floor(Math.random() * trigger.messages.length)];
    
    // 记录触发
    this.recordTrigger(triggerName, message);
    
    // 发射事件
    this.emit('timeTrigger', { type: triggerName, message });
    
    // 发送消息
    await this.sendMessage(message, { triggerType: triggerName });
    
    logger.info('时间触发器执行完成', { triggerName, message });
  }
  
  /**
   * 启动随机触发器
   */
  private startRandomTrigger(): void {
    if (!this.config.randomTrigger.enabled) return;
    
    const interval = this.config.randomTrigger.interval;
    const self = this;
    
    this.intervalId = setInterval(function() {
      if (!self.running) return;
      self.maybeTriggerRandom();
    }, interval);
    
    logger.debug('随机触发器已启动', { intervalMinutes: interval / 60000 });
  }
  
  /**
   * 随机触发检查
   */
  private async maybeTriggerRandom(): Promise<void> {
    const probability = this.config.randomTrigger.probability;
    const messages = this.config.randomTrigger.messages;
    
    // 概率检查
    if (Math.random() > probability) {
      return;
    }
    
    // 冷却检查 - 避免频繁触发
    if (this.lastTriggers.random) {
      const elapsed = Date.now() - this.lastTriggers.random;
      if (elapsed < 3600000) { // 至少间隔1小时
        return;
      }
    }
    
    // 随机选择一条消息
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    // 记录触发
    this.recordTrigger('random', message);
    this.lastTriggers.random = Date.now();
    
    // 发射事件
    this.emit('randomTrigger', { message });
    
    // 发送消息
    await this.sendMessage(message, { triggerType: 'random' });
    
    logger.info('随机触发器执行完成', { message });
  }
  
  /**
   * 检查时间触发
   */
  checkTimeTriggers(): { trigger: string; inRange: boolean; remaining: number }[] {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;
    
    const result: { trigger: string; inRange: boolean; remaining: number }[] = [];
    
    for (const [triggerName, trigger] of Object.entries(this.config.timeTriggers)) {
      if (!trigger.enabled) continue;
      
      const [startHour, startMin] = trigger.timeRange[0].split(':').map(Number);
      const [endHour, endMin] = trigger.timeRange[1].split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentTime >= startTime && currentTime <= endTime) {
        result.push({
          trigger: triggerName,
          inRange: true,
          remaining: endTime - currentTime
        });
      }
    }
    
    return result;
  }
  
  /**
   * 检查事件触发
   */
  checkEventTriggers(context: { message?: string; lastInteraction?: number }): (EmotionCheckResult | InactivityCheckResult)[] {
    const results: (EmotionCheckResult | InactivityCheckResult)[] = [];
    
    // 情绪支持检查
    if (this.config.eventTriggers.emotionSupport && this.config.eventTriggers.emotionSupport.enabled) {
      const emotionTrigger = this.checkEmotionTrigger(context);
      if (emotionTrigger) {
        results.push(emotionTrigger);
      }
    }
    
    // 不活跃检查
    if (this.config.eventTriggers.inactivity && this.config.eventTriggers.inactivity.enabled) {
      const inactivityTrigger = this.checkInactivityTrigger(context);
      if (inactivityTrigger) {
        results.push(inactivityTrigger);
      }
    }
    
    return results;
  }
  
  /**
   * 检查情绪触发
   */
  private checkEmotionTrigger(context: { message?: string }): EmotionCheckResult | null {
    const emotionConfig = this.config.eventTriggers.emotionSupport;
    const keywords = emotionConfig.keywords;
    const cooldown = emotionConfig.cooldown;
    const messages = emotionConfig.messages;
    
    // 冷却检查
    if (this.lastTriggers.emotion) {
      const elapsed = Date.now() - this.lastTriggers.emotion;
      if (elapsed < cooldown) {
        return null;
      }
    }
    
    // 关键词检查
    const text = (context && context.message) ? context.message.toLowerCase() : '';
    let matchedKeyword: string | null = null;
    
    for (let i = 0; i < keywords.length; i++) {
      if (text.includes(keywords[i])) {
        matchedKeyword = keywords[i];
        break;
      }
    }
    
    if (matchedKeyword) {
      const message = messages[Math.floor(Math.random() * messages.length)];
      this.lastTriggers.emotion = Date.now();
      
      return {
        type: 'emotionSupport',
        keyword: matchedKeyword,
        message: message
      };
    }
    
    return null;
  }
  
  /**
   * 检查不活跃触发
   */
  private checkInactivityTrigger(context: { lastInteraction?: number }): InactivityCheckResult | null {
    const inactivityConfig = this.config.eventTriggers.inactivity;
    const threshold = inactivityConfig.threshold;
    const messages = inactivityConfig.messages;
    
    const lastInteraction = (context && context.lastInteraction) ? context.lastInteraction : 0;
    const elapsed = Date.now() - lastInteraction;
    
    if (elapsed >= threshold) {
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      return {
        type: 'inactivity',
        elapsed: elapsed,
        message: message
      };
    }
    
    return null;
  }
  
  /**
   * 启动特殊日期检查
   */
  private startSpecialDateCheck(): void {
    if (!this.config.specialDates || !this.config.specialDates.enabled) return;
    
    const self = this;
    
    // 每天凌晨检查一次
    const checkDaily = function(): void {
      if (!self.running) return;
      
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = month + '-' + day;
      
      const dates = self.config.specialDates.dates;
      if (!dates) return;
      
      let specialDate: SpecialDate | null = null;
      for (let i = 0; i < dates.length; i++) {
        if (dates[i].date === dateStr) {
          specialDate = dates[i];
          break;
        }
      }
      
      if (specialDate) {
        self.emit('specialDate', specialDate);
        
        if (specialDate.messages && specialDate.messages.length > 0) {
          const message = specialDate.messages[Math.floor(Math.random() * specialDate.messages.length)];
          self.sendMessage('今天是' + specialDate.name + '！' + message, { 
            triggerType: 'specialDate', 
            dateInfo: specialDate 
          });
        }
      }
    };
    
    // 立即检查一次
    checkDaily();
    
    // 每天凌晨检查
    const scheduleNextCheck = function(): void {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 5, 0, 0); // 00:05 检查
      
      const delay = tomorrow.getTime() - now.getTime();
      
      const timer = setTimeout(function() {
        checkDaily();
        scheduleNextCheck();
      }, delay);
      
      self.timers.push(timer);
    };
    
    scheduleNextCheck();
  }
  
  /**
   * 执行触发
   */
  async executeTrigger(type: string, message: string, options?: Record<string, unknown>): Promise<void> {
    options = options || {};
    
    // 记录触发
    this.recordTrigger(type, message);
    
    // 发射事件
    this.emit('trigger', { type: type, message: message, options: options });
    
    // 发送消息
    await this.sendMessage(message, { triggerType: type, options: options });
    
    logger.info('触发器执行完成', { type: type, message: message });
  }
  
  /**
   * 发送消息
   */
  async sendMessage(message: string, options: SendMessageOptions = {}): Promise<boolean> {
    try {
      // 1. 尝试使用消息发送回调
      if (this.messageSender) {
        await this.messageSender(message, options);
        return true;
      }
      
      // 2. 尝试使用 Redis 发布
      if (this.redisClient && this.redisClient.isConnected) {
        const payload = {
          type: 'proactive',
          content: message,
          timestamp: Date.now(),
          ...options
        };
        
        await this.redisClient.publish('chat:proactive', payload);
        logger.debug('消息已发布到 Redis', { message: message });
        return true;
      }
      
      // 3. 发射事件供外部处理
      this.emit('message', { message: message, options: options });
      logger.warn('未配置消息发送方式，消息已发射为事件');
      return false;
      
    } catch (error) {
      logger.error('发送消息失败', error as Error);
      return false;
    }
  }
  
  /**
   * 记录触发历史
   */
  private recordTrigger(type: string, message: string, userId?: string, characterId?: string): void {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO proactive_trigger_history (trigger_type, message, user_id, character_id, timestamp) VALUES (?, ?, ?, ?, ?)'
      );
      
      stmt.run(type, message, userId || null, characterId || null, Date.now());
      
      this.lastTriggers[type] = Date.now();
      
    } catch (error) {
      logger.error('记录触发历史失败', error as Error);
    }
  }
  
  /**
   * 检查今天是否已触发
   */
  private hasTriggeredToday(type: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastTrigger = this.lastTriggers[type];
    if (!lastTrigger) return false;
    
    const triggerDate = new Date(lastTrigger);
    triggerDate.setHours(0, 0, 0, 0);
    
    return today.getTime() === triggerDate.getTime();
  }
  
  /**
   * 获取触发历史
   */
  getTriggerHistory(options: { type?: string; limit?: number; since?: number } = {}): TriggerHistory[] {
    const { type, limit = 50, since } = options;
    
    let query = 'SELECT * FROM proactive_trigger_history';
    const params: (string | number)[] = [];
    
    const conditions: string[] = [];
    
    if (type) {
      conditions.push('trigger_type = ?');
      params.push(type);
    }
    
    if (since) {
      conditions.push('timestamp >= ?');
      params.push(since);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    return this.db.prepare(query).all(...params) as TriggerHistory[];
  }
  
  /**
   * 手动触发（用于测试或手动调用）
   */
  async triggerManually(type: string, message: string, options?: Record<string, unknown>): Promise<void> {
    logger.info('手动触发', { type: type, message: message });
    return this.executeTrigger(type, message, options);
  }
  
  /**
   * 获取状态
   */
  getStatus(): StatusResult {
    const enabledTimeTriggers: { name: string; range: [string, string] }[] = [];
    const entries = Object.entries(this.config.timeTriggers);
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0];
      const value = entries[i][1];
      if (value.enabled) {
        enabledTimeTriggers.push({ name: key, range: value.timeRange });
      }
    }
    
    return {
      running: this.running,
      enabled: this.config.enabled,
      timeTriggers: enabledTimeTriggers,
      randomTrigger: this.config.randomTrigger.enabled ? {
        probability: this.config.randomTrigger.probability,
        interval: this.config.randomTrigger.interval
      } : null,
      lastTriggers: this.lastTriggers,
      activeTimers: this.timers.length
    };
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ProactiveConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);
    logger.info('配置已更新', { config: this.config });
    this.emit('configUpdated', this.config);
  }
  
  /**
   * 添加特殊日期
   */
  addSpecialDate(dateConfig: SpecialDate): void {
    if (!this.config.specialDates.dates) {
      this.config.specialDates.dates = [];
    }
    this.config.specialDates.dates.push(dateConfig);
    logger.info('特殊日期已添加', { dateConfig });
  }
}

export default ProactiveTrigger;
export type { 
  ProactiveConfig, TimeTrigger, RandomTrigger, EventTriggers, SpecialDate, SpecialDates, 
  Dependencies, TriggerHistory, SendMessageOptions, StatusResult 
};