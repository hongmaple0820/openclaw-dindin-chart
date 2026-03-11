/**
 * 群聊 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';
import type { ApiResponse, Group, GroupMember, Message, PaginatedResponse } from '@/types';

interface CreateGroupData {
  name: string;
  description?: string;
  avatar?: string;
  memberIds?: string[];
}

interface InviteData {
  userIds: string[];
}

interface GetMessagesParams {
  page?: number;
  limit?: number;
  before?: string;
}

interface SendMessageData {
  content: string;
  type?: 'text' | 'image' | 'file';
}

export const groupApi = {
  create(data: CreateGroupData): Promise<ApiResponse<{ group: Group }>> {
    return api.post('/groups', data);
  },

  getList(): Promise<ApiResponse<{ groups: Group[] }>> {
    return api.get('/groups');
  },

  getDetail(id: string): Promise<ApiResponse<{ group: Group }>> {
    return api.get(`/groups/${id}`);
  },

  getMembers(id: string): Promise<ApiResponse<{ members: GroupMember[] }>> {
    return api.get(`/groups/${id}/members`);
  },

  invite(id: string, data: InviteData): Promise<ApiResponse> {
    return api.post(`/groups/${id}/invite`, data);
  },

  removeMember(id: string, userId: string): Promise<ApiResponse> {
    return api.delete(`/groups/${id}/members/${userId}`);
  },

  setAdmin(id: string, userId: string, isAdmin: boolean): Promise<ApiResponse> {
    return api.put(`/groups/${id}/admins/${userId}`, { isAdmin });
  },

  transfer(id: string, newOwnerId: string): Promise<ApiResponse> {
    return api.put(`/groups/${id}/transfer`, { newOwnerId });
  },

  dismiss(id: string): Promise<ApiResponse> {
    return api.delete(`/groups/${id}`);
  },

  leave(id: string): Promise<ApiResponse> {
    return api.post(`/groups/${id}/leave`);
  },

  setNickname(id: string, userId: string, nickname: string): Promise<ApiResponse> {
    return api.put(`/groups/${id}/members/${userId}/nickname`, { nickname });
  },

  addBot(id: string, botId: string): Promise<ApiResponse> {
    return api.post(`/groups/${id}/bots`, { botId });
  },

  removeBot(id: string, botId: string): Promise<ApiResponse> {
    return api.delete(`/groups/${id}/bots/${botId}`);
  },

  update(id: string, data: Partial<CreateGroupData>): Promise<ApiResponse<{ group: Group }>> {
    return api.put(`/groups/${id}`, data);
  },

  getMessages(id: string, params: GetMessagesParams = {}): Promise<ApiResponse<{ messages: Message[] }>> {
    return api.get(`/groups/${id}/messages`, { params });
  },

  sendMessage(id: string, data: SendMessageData): Promise<ApiResponse<{ message: Message }>> {
    return api.post(`/groups/${id}/messages`, data);
  }
};

export default groupApi;