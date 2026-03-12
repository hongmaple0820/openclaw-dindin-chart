/**
 * WebSocket 客户端
 * @author 小琳
 * @date 2026-02-06
 * @updated 2026-03-12 - 添加心跳机制、指数退避重连、连接状态通知
 */

type EventCallback = (data: unknown) => void;

class ChatWebSocket {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private listeners: Map<string, EventCallback[]> = new Map();
  public isConnected = false;

  // 心跳机制
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private missedHeartbeats = 0;
  private readonly maxMissedHeartbeats = 3;

  constructor() {
    this.ws = null;
    this.clientId = null;
    this.reconnectAttempts = 0;
    this.listeners = new Map();
    this.isConnected = false;
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;

      console.log('[WS] 连接中...', url);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] 已连接');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.missedHeartbeats = 0;

        // 发送认证信息
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
          this.send({ type: 'auth', user });
        }

        // 启动心跳
        this.startHeartbeat();

        // 通知连接状态
        this.emit('connection_status', { connected: true });

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('[WS] 消息解析错误:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] 连接断开', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();

        // 通知连接状态
        this.emit('connection_status', { connected: false, code: event.code });

        // 非正常关闭才重连
        if (event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] 连接错误:', error);
        this.emit('error', error);
        reject(error);
      };
    });
  }

  /**
   * 处理收到的消息
   */
  handleMessage(data: { type: string; clientId?: string; message?: unknown; user?: unknown }): void {
    // 心跳响应
    if (data.type === 'pong') {
      this.missedHeartbeats = 0;
      this.resetHeartbeatTimeout();
      return;
    }

    console.log('[WS] 收到:', data.type);

    switch (data.type) {
      case 'connected':
        this.clientId = data.clientId;
        this.emit('connected', data);
        break;

      case 'new_message':
        this.emit('message', data.message);
        break;

      case 'user_online':
        this.emit('user_online', data.user);
        break;

      case 'user_offline':
        this.emit('user_offline', data.user);
        break;

      default:
        this.emit(data.type, data);
    }
  }

  /**
   * 发送消息
   */
  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // 每 30 秒发送心跳
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.missedHeartbeats++;

        if (this.missedHeartbeats > this.maxMissedHeartbeats) {
          console.log('[WS] 心跳超时，重连');
          this.ws.close();
          return;
        }

        this.send({ type: 'ping' });

        // 设置心跳超时
        this.heartbeatTimeout = setTimeout(() => {
          console.log('[WS] 心跳响应超时');
        }, 10000);
      }
    }, 30000);
  }

  /**
   * 重置心跳超时
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.resetHeartbeatTimeout();
  }

  /**
   * 重连调度（指数退避）
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] 达到最大重连次数');
      this.emit('reconnect_failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;

    // 指数退避：1s, 2s, 4s, 8s, 16s, 30s...
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WS] ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * 事件监听
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除监听
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// 单例
const chatWS = new ChatWebSocket();

export default chatWS;