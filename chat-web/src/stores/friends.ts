/**
 * 好友状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { friendApi } from '@/api/friends';
import type { Friend, FriendRequest, ApiResponse } from '@/types';

interface FriendWithGroup extends Friend {
  groupName?: string;
  remark?: string;
}

interface ApiResponseWithFriends extends ApiResponse {
  friends?: FriendWithGroup[];
}

interface ApiResponseWithRequests extends ApiResponse {
  requests?: FriendRequest[];
}

export const useFriendStore = defineStore('friends', () => {
  const friends = ref<FriendWithGroup[]>([]);
  const requests = ref<FriendRequest[]>([]);
  const currentFriend = ref<FriendWithGroup | null>(null);
  const loading = ref(false);
  const requestLoading = ref(false);

  const friendCount = computed(() => friends.value.length);
  const pendingRequestCount = computed(() => 
    requests.value.filter(r => r.status === 'pending').length
  );

  const friendsByGroup = computed(() => {
    const groups: Record<string, FriendWithGroup[]> = {};
    friends.value.forEach(friend => {
      const group = friend.groupName || '默认分组';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(friend);
    });
    return groups;
  });

  async function fetchFriends(): Promise<ApiResponseWithFriends> {
    loading.value = true;
    try {
      const res = await friendApi.getList();
      if (res.success && res.friends) {
        friends.value = res.friends;
      }
      return res as ApiResponseWithFriends;
    } catch (error) {
      console.error('获取好友列表失败:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      loading.value = false;
    }
  }

  async function fetchRequests(): Promise<ApiResponseWithRequests> {
    requestLoading.value = true;
    try {
      const res = await friendApi.getRequests();
      if (res.success && res.requests) {
        requests.value = res.requests;
      }
      return res as ApiResponseWithRequests;
    } catch (error) {
      console.error('获取好友申请失败:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      requestLoading.value = false;
    }
  }

  async function searchUsers(query: string): Promise<ApiResponse> {
    try {
      const res = await friendApi.search(query);
      return res;
    } catch (error) {
      console.error('搜索用户失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function sendRequest(data: { userId: string; message?: string }): Promise<ApiResponse> {
    try {
      const res = await friendApi.sendRequest(data);
      return res;
    } catch (error) {
      console.error('发送好友申请失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function handleRequest(requestId: string, status: 'accepted' | 'rejected'): Promise<ApiResponse> {
    try {
      const res = await friendApi.handleRequest(requestId, status);
      if (res.success) {
        const index = requests.value.findIndex(r => r.id === requestId);
        if (index !== -1) {
          if (status === 'accepted') {
            requests.value.splice(index, 1);
            await fetchFriends();
          } else {
            requests.value[index].status = status;
          }
        }
      }
      return res;
    } catch (error) {
      console.error('处理好友申请失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function setRemark(friendId: string, remark: string): Promise<ApiResponse> {
    try {
      const res = await friendApi.setRemark(friendId, remark);
      if (res.success) {
        const friend = friends.value.find(f => f.id === friendId);
        if (friend) {
          friend.remark = remark;
        }
      }
      return res;
    } catch (error) {
      console.error('设置备注失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function deleteFriend(friendId: string): Promise<ApiResponse> {
    try {
      const res = await friendApi.delete(friendId);
      if (res.success) {
        const index = friends.value.findIndex(f => f.id === friendId);
        if (index !== -1) {
          friends.value.splice(index, 1);
        }
        if (currentFriend.value?.id === friendId) {
          currentFriend.value = null;
        }
      }
      return res;
    } catch (error) {
      console.error('删除好友失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function blockUser(friendId: string): Promise<ApiResponse> {
    try {
      const res = await friendApi.block(friendId);
      if (res.success) {
        const index = friends.value.findIndex(f => f.id === friendId);
        if (index !== -1) {
          friends.value.splice(index, 1);
        }
        if (currentFriend.value?.id === friendId) {
          currentFriend.value = null;
        }
      }
      return res;
    } catch (error) {
      console.error('拉黑失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  function selectFriend(friend: FriendWithGroup): void {
    currentFriend.value = friend;
  }

  function clearSelection(): void {
    currentFriend.value = null;
  }

  return {
    friends,
    requests,
    currentFriend,
    loading,
    requestLoading,
    friendCount,
    pendingRequestCount,
    friendsByGroup,
    fetchFriends,
    fetchRequests,
    searchUsers,
    sendRequest,
    handleRequest,
    setRemark,
    deleteFriend,
    blockUser,
    selectFriend,
    clearSelection
  };
});