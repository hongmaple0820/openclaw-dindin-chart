/**
 * 私信 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';

export const dmApi = {
  /**
   * 发送私信
   */
  send(data) {
    return api.post('/dm/send', data);
  },

  /**
   * 获取会话列表
   */
  getConversations(params = {}) {
    return api.get('/dm/conversations', { params });
  },

  /**
   * 获取会话消息
   */
  getMessages(conversationId, params = {}) {
    return api.get(`/dm/messages/${conversationId}`, { params });
  },

  /**
   * 标记已读
   */
  markAsRead(conversationId) {
    return api.post(`/dm/read/${conversationId}`);
  },

  /**
   * 删除消息
   */
  deleteMessage(messageId) {
    return api.delete(`/dm/message/${messageId}`);
  },

  /**
   * 获取未读数
   */
  getUnreadCount() {
    return api.get('/dm/unread');
  },

  /**
   * 搜索私信
   */
  search(query, limit = 20) {
    return api.get('/dm/search', { params: { q: query, limit } });
  }
};

export default dmApi;
