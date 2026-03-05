/**
 * MapleClaw Gateway 网关层
 * 
 * 职责：
 * 1. 连接管理 - 管理各种 IM 平台的连接
 * 2. 协议转换 - 统一不同平台的消息格式
 * 3. 消息路由 - 将消息路由到正确的处理程序
 * 4. 会话管理 - 维护用户会话状态
 * 
 * @author 小琳
 * @date 2026-03-05
 */

import { EventEmitter } from 'events';

// ============================================================
// 类型定义
// ============================================================

/** 平台类型 */
export type Platform = 'dingtalk' | 'wecom' | 'feishu' | 'slack' | 'discord' | 'webchat';

/** 消息类型 */
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'markdown' | 'action';

/** 消息方向 */
export type MessageDirection = 'inbound' | 'outbound';

/** 连接状态 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/** 统一消息格式 */
export interface UnifiedMessage {
  id: string;
  platform: Platform;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  sender: MessageSender;
  recipient: MessageRecipient;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/** 消息发送者 */
export interface MessageSender {
  id: string;
  name: string;
  type: 'human' | 'agent' | 'system';
  avatar?: string;
}

/** 消息接收者 */
export interface MessageRecipient {
  id: string;
  type: 'user' | 'group' | 'channel';
  name?: string;
}

/** 连接配置 */
export interface ConnectionConfig {
  platform: Platform;
  enabled: boolean;
  credentials: Record<string, string>;
  options?: Record<string, unknown>;
}

/** 连接接口 */
export interface IConnection {
  platform: Platform;
  status: ConnectionStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: UnifiedMessage): Promise<void>;
  onMessage(callback: (message: UnifiedMessage) => void): void;
}

/** Gateway 配置 */
export interface GatewayConfig {
  connections: ConnectionConfig[];
  messageQueue: {
    enabled: boolean;
    maxSize: number;
  };
  rateLimit: {
    enabled: boolean;
    maxPerMinute: number;
  };
}

// ============================================================
// 基础连接类
// ============================================================

/**
 * 连接基类
 * 所有平台连接都需要继承此类
 */
export abstract class BaseConnection extends EventEmitter implements IConnection {
  public platform: Platform;
  public status: ConnectionStatus = 'disconnected';
  protected config: ConnectionConfig;
  protected messageCallback?: (message: UnifiedMessage) => void;

  constructor(config: ConnectionConfig) {
    super();
    this.platform = config.platform;
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: UnifiedMessage): Promise<void>;

  /**
   * 注册消息回调
   */
  onMessage(callback: (message: UnifiedMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * 触发消息事件
   */
  protected emitMessage(message: UnifiedMessage): void {
    if (this.messageCallback) {
      this.messageCallback(message);
    }
    this.emit('message', message);
  }

  /**
   * 更新连接状态
   */
  protected updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emit('status', status);
  }
}

// ============================================================
// Gateway 主类
// ============================================================

/**
 * Gateway 网关
 * 
 * 管理所有平台连接，提供统一的消息路由
 */
export class Gateway extends EventEmitter {
  private connections: Map<Platform, IConnection> = new Map();
  private config: GatewayConfig;
  private messageQueue: UnifiedMessage[] = [];
  private isRunning: boolean = false;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
  }

  /**
   * 注册连接
   */
  registerConnection(connection: IConnection): void {
    this.connections.set(connection.platform, connection);
    
    // 监听消息
    connection.onMessage((message) => {
      this.handleIncomingMessage(message);
    });

    console.log(`[Gateway] 注册连接: ${connection.platform}`);
  }

  /**
   * 启动网关
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Gateway] 网关已在运行');
      return;
    }

    console.log('[Gateway] 启动网关...');
    
    // 连接所有已启用的平台
    for (const [platform, connection] of this.connections) {
      try {
        await connection.connect();
        console.log(`[Gateway] ${platform} 连接成功`);
      } catch (error) {
        console.error(`[Gateway] ${platform} 连接失败:`, error);
      }
    }

    this.isRunning = true;
    this.emit('started');
    console.log('[Gateway] 网关已启动');
  }

  /**
   * 停止网关
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[Gateway] 停止网关...');

    for (const [platform, connection] of this.connections) {
      try {
        await connection.disconnect();
        console.log(`[Gateway] ${platform} 已断开`);
      } catch (error) {
        console.error(`[Gateway] ${platform} 断开失败:`, error);
      }
    }

    this.isRunning = false;
    this.emit('stopped');
    console.log('[Gateway] 网关已停止');
  }

  /**
   * 发送消息
   */
  async send(message: UnifiedMessage): Promise<void> {
    const connection = this.connections.get(message.platform);
    
    if (!connection) {
      throw new Error(`未找到平台连接: ${message.platform}`);
    }

    if (connection.status !== 'connected') {
      // 加入队列
      if (this.config.messageQueue.enabled && this.messageQueue.length < this.config.messageQueue.maxSize) {
        this.messageQueue.push(message);
        console.log(`[Gateway] 消息已加入队列: ${message.id}`);
        return;
      }
      throw new Error(`平台未连接: ${message.platform}`);
    }

    await connection.send(message);
    this.emit('message:sent', message);
  }

  /**
   * 处理接收到的消息
   */
  private handleIncomingMessage(message: UnifiedMessage): void {
    console.log(`[Gateway] 收到消息: ${message.platform} - ${message.id}`);
    
    // 消息预处理
    const processedMessage = this.preprocessMessage(message);
    
    // 发送到路由
    this.emit('message:received', processedMessage);
  }

  /**
   * 消息预处理
   */
  private preprocessMessage(message: UnifiedMessage): UnifiedMessage {
    // 添加处理时间
    return {
      ...message,
      metadata: {
        ...message.metadata,
        processedAt: Date.now()
      }
    };
  }

  /**
   * 获取连接状态
   */
  getStatus(): Record<Platform, ConnectionStatus> {
    const status: Partial<Record<Platform, ConnectionStatus>> = {};
    
    for (const [platform, connection] of this.connections) {
      status[platform] = connection.status;
    }

    return status as Record<Platform, ConnectionStatus>;
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.messageQueue.length;
  }
}

// ============================================================
// 消息路由器
// ============================================================

/**
 * 消息路由器
 * 
 * 根据消息内容决定路由目标
 */
export class MessageRouter {
  private handlers: Map<string, (message: UnifiedMessage) => Promise<void>> = new Map();
  private defaultHandler?: (message: UnifiedMessage) => Promise<void>;

  /**
   * 注册处理器
   */
  register(pattern: string | RegExp, handler: (message: UnifiedMessage) => Promise<void>): void {
    const key = typeof pattern === 'string' ? pattern : pattern.source;
    this.handlers.set(key, handler);
    console.log(`[MessageRouter] 注册处理器: ${key}`);
  }

  /**
   * 设置默认处理器
   */
  setDefaultHandler(handler: (message: UnifiedMessage) => Promise<void>): void {
    this.defaultHandler = handler;
  }

  /**
   * 路由消息
   */
  async route(message: UnifiedMessage): Promise<void> {
    // 遍历所有处理器查找匹配
    for (const [pattern, handler] of this.handlers) {
      if (this.matchPattern(pattern, message)) {
        await handler(message);
        return;
      }
    }

    // 使用默认处理器
    if (this.defaultHandler) {
      await this.defaultHandler(message);
    } else {
      console.warn(`[MessageRouter] 未找到处理器: ${message.id}`);
    }
  }

  /**
   * 匹配模式
   */
  private matchPattern(pattern: string, message: UnifiedMessage): boolean {
    // 简单匹配：检查消息类型或内容
    if (pattern.startsWith('type:')) {
      return message.type === pattern.slice(5);
    }
    
    // 内容匹配
    return message.content.includes(pattern);
  }
}

// ============================================================
// 导出
// ============================================================

export default Gateway;