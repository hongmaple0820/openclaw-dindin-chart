/**
 * 私信 API
 * @author 小琳
 * @date 2026-02-06
 */
import api from './index';
import type { ApiResponse, Message, PaginatedResponse } from '@/types';

interface SendDmData {
  recipientId: string;
  content: string;
  type?: 'text' | 'image' | 'file';
}

interface Conversation {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

interface GetMessagesParams {
  page?: number;
  limit?: number;
  before?: string;
}

export const dmApi = {
  send(data: SendDmData): Promise<ApiResponse<{ message: Message }>> {
    return api.post('/dm/send', data);
  },

  getConversations(params = {}): Promise<ApiResponse<{ conversations: Conversation[] }>> {
    return api.get('/dm/conversations', { params });
  },

  getMessages(conversationId: string, params: GetMessagesParams = {}): Promise<ApiResponse<{ messages: Message[] }>> {
    return api.get(`/dm/messages/${conversationId}`, { params });
  },

  markAsRead(conversationId: string): Promise<ApiResponse> {
    return api.post(`/dm/read/${conversationId}`);
  },

  deleteMessage(messageId: string): Promise<ApiResponse> {
    return api.delete(`/dm/message/${messageId}`);
  },

  getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return api.get('/dm/unread');
  },

  search(query: string, limit = 20): Promise<ApiResponse<{ messages: Message[] }>> {
    return api.get('/dm/search', { params: { q: query, limit } });
  }
};

export default dmApi;