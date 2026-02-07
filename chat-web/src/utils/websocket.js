/**
 * WebSocket 客户端
 * @author 小琳
 * @date 2026-02-06
 */

class ChatWebSocket {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.isConnected = false;
  }

  /**
   * 连接 WebSocket
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;

      console.log('[WS] 连接中...', url);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] 已连接');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // 发送认证信息
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
          this.send({ type: 'auth', user });
        }
        
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

      this.ws.onclose = () => {
        console.log('[WS] 连接断开');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] 连接错误:', error);
        reject(error);
      };
    });
  }

  /**
   * 处理收到的消息
   */
  handleMessage(data) {
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

      case 'pong':
        // 心跳响应
        break;

      default:
        this.emit(data.type, data);
    }
  }

  /**
   * 发送消息
   */
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * 重连调度
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] 达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`[WS] ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除监听
   */
  off(event, callback) {
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
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 单例
const chatWS = new ChatWebSocket();

export default chatWS;
