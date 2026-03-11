/**
 * 好友系统 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';
import type { ApiResponse, Friend, FriendRequest, User } from '@/types';

interface SendRequestData {
  userId: string;
  message?: string;
}

export const friendApi = {
  search(q: string): Promise<ApiResponse<{ users: User[] }>> {
    return api.get(`/friends/search?q=${encodeURIComponent(q)}`);
  },

  sendRequest(data: SendRequestData): Promise<ApiResponse> {
    return api.post('/friends/request', data);
  },

  getRequests(): Promise<ApiResponse<{ requests: FriendRequest[] }>> {
    return api.get('/friends/requests');
  },

  handleRequest(id: string, status: 'accepted' | 'rejected'): Promise<ApiResponse> {
    return api.put(`/friends/requests/${id}`, { status });
  },

  getList(): Promise<ApiResponse<{ friends: Friend[] }>> {
    return api.get('/friends');
  },

  setRemark(id: string, remark: string): Promise<ApiResponse> {
    return api.put(`/friends/${id}/remark`, { remark });
  },

  delete(id: string): Promise<ApiResponse> {
    return api.delete(`/friends/${id}`);
  },

  block(id: string): Promise<ApiResponse> {
    return api.post(`/friends/${id}/block`);
  }
};

export default friendApi;