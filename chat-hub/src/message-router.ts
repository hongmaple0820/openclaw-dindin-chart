const sessionManager = require('./session-manager');
const sseManager = require('./sse-manager');
const redisClient = require('./redis-client');
const config = require('./config');

// 路由选项类型
interface RouteOptions {
  conversationId?: string;
  sessionId?: string;
  type?: string;
}

class MessageRouter {
  transportManager: any;
  messageHandlers: Map<string, any>;
  sessionSubscriptions: Map<string, any>;

  constructor() {
    this.transportManager = null;
    this.messageHandlers = new Map();
    this.sessionSubscriptions = new Map();
  }

  setTransportManager(transportManager: any): void {
    this.transportManager = transportManager;
  }

  async routeMessage(message: any, options: RouteOptions = {}): Promise<boolean> {
    const { conversationId, sessionId, type = 'private' } = options;

    if (!conversationId && !sessionId) {
      return this.broadcast(message);
    }

    const targetId = conversationId || sessionId;

    if (type === 'group' || sessionId) {
      return this.routeToGroup(message, targetId);
    } else {
      return this.routeToPrivate(message, targetId);
    }
  }

  async routeToPrivate(message, conversationId) {
    const participants = this._parseConversationId(conversationId);
    if (!participants || participants.length !== 2) {
      console.error(`[MessageRouter] 无效的会话ID: ${conversationId}`);
      return false;
    }

    const [user1Id, user2Id] = participants;
    const senderId = message.senderId || message.sender_id || message.sender;

    let delivered = false;

    if (sseManager.isUserConnected(user1Id)) {
      sseManager.pushMessage(user1Id, {
        type: 'private_message',
        conversationId,
        message
      });
      delivered = true;
    }

    if (sseManager.isUserConnected(user2Id)) {
      sseManager.pushMessage(user2Id, {
        type: 'private_message',
        conversationId,
        message
      });
      delivered = true;
    }

    if (this.transportManager) {
      const status = this.transportManager.getStatus();
      if (status.connected) {
        const SSECloudTransport = require('./transport/sse-cloud-transport');
        const transport = this.transportManager.currentTransport;

        if (transport instanceof SSECloudTransport) {
          await transport.sendToConversation(message, conversationId);
        } else {
          await this.transportManager.send({
            type: 'private_message',
            conversationId,
            message
          }, `conversation:${conversationId}`);
        }
      }
    }

    if (!delivered) {
      await redisClient.publish(`dm:${conversationId}`, JSON.stringify({
        type: 'private_message',
        conversationId,
        message
      }));
    }

    sessionManager.updateLastMessage(conversationId, 
      typeof message.content === 'string' ? message.content.substring(0, 100) : '[媒体消息]',
      message.timestamp || Date.now()
    );

    sessionManager.incrementUnreadCount(conversationId, senderId);

    console.log(`[MessageRouter] 私聊消息路由: ${conversationId}`);
    return true;
  }

  async routeToGroup(message, sessionId) {
    const participants = sessionManager.getSessionParticipants(sessionId);
    if (!participants || participants.length === 0) {
      console.error(`[MessageRouter] 群聊不存在或无成员: ${sessionId}`);
      return false;
    }

    const senderId = message.senderId || message.sender_id || message.sender;
    let deliveredCount = 0;

    for (const participant of participants) {
      if (participant.userId === senderId) continue;

      if (sseManager.isUserConnected(participant.userId)) {
        sseManager.pushMessage(participant.userId, {
          type: 'group_message',
          sessionId,
          message
        });
        deliveredCount++;
      }
    }

    if (this.transportManager) {
      await this.transportManager.send({
        type: 'group_message',
        sessionId,
        message
      }, `session:${sessionId}`);
    }

    sessionManager.updateLastMessage(sessionId,
      typeof message.content === 'string' ? message.content.substring(0, 100) : '[媒体消息]',
      message.timestamp || Date.now()
    );

    sessionManager.incrementUnreadCount(sessionId, senderId);

    console.log(`[MessageRouter] 群聊消息路由: ${sessionId} (送达 ${deliveredCount} 人)`);
    return true;
  }

  async broadcast(message) {
    sseManager.broadcast('message', message);

    if (this.transportManager) {
      await this.transportManager.send(message, 'broadcast');
    }

    await redisClient.publish('chat:messages', JSON.stringify(message));

    console.log(`[MessageRouter] 广播消息`);
    return true;
  }

  _parseConversationId(conversationId) {
    if (!conversationId) return null;
    const parts = conversationId.split('_');
    if (parts.length !== 2) return null;
    return parts;
  }

  async subscribeToConversation(userId, conversationId) {
    const subscriptions = this.sessionSubscriptions.get(userId) || new Set();
    subscriptions.add(conversationId);
    this.sessionSubscriptions.set(userId, subscriptions);

    if (this.transportManager) {
      const SSECloudTransport = require('./transport/sse-cloud-transport');
      const transport = this.transportManager.currentTransport;

      if (transport instanceof SSECloudTransport) {
        await transport.subscribeConversation(conversationId);
      }
    }

    console.log(`[MessageRouter] 用户订阅会话: ${userId} -> ${conversationId}`);
    return true;
  }

  async unsubscribeFromConversation(userId, conversationId) {
    const subscriptions = this.sessionSubscriptions.get(userId);
    if (subscriptions) {
      subscriptions.delete(conversationId);
    }

    if (this.transportManager) {
      const SSECloudTransport = require('./transport/sse-cloud-transport');
      const transport = this.transportManager.currentTransport;

      if (transport instanceof SSECloudTransport) {
        await transport.unsubscribeConversation(conversationId);
      }
    }

    console.log(`[MessageRouter] 用户取消订阅: ${userId} -> ${conversationId}`);
    return true;
  }

  getUserSubscriptions(userId) {
    return Array.from(this.sessionSubscriptions.get(userId) || []);
  }

  clearUserSubscriptions(userId) {
    this.sessionSubscriptions.delete(userId);
  }

  registerMessageHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  async processIncomingMessage(message) {
    const type = message.type || 'default';
    const handler = this.messageHandlers.get(type);

    if (handler) {
      return handler(message);
    }

    if (message.conversationId) {
      return this.routeToPrivate(message, message.conversationId);
    }

    if (message.sessionId) {
      return this.routeToGroup(message, message.sessionId);
    }

    return this.broadcast(message);
  }

  getStats() {
    return {
      activeSubscriptions: this.sessionSubscriptions.size,
      totalSubscriptions: Array.from(this.sessionSubscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      registeredHandlers: this.messageHandlers.size
    };
  }
}

module.exports = new MessageRouter();

export {};
