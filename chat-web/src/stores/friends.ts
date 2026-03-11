/**
 * 好友状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { friendApi } from '@/api/friends';

export const useFriendStore = defineStore('friends', () => {
  // 状态
  const friends = ref([]);
  const requests = ref([]);
  const currentFriend = ref(null);
  const loading = ref(false);
  const requestLoading = ref(false);

  // 计算属性
  const friendCount = computed(() => friends.value.length);
  const pendingRequestCount = computed(() => 
    requests.value.filter(r => r.status === 'pending').length
  );

  // 按分组分类好友
  const friendsByGroup = computed(() => {
    const groups = {};
    friends.value.forEach(friend => {
      const group = friend.groupName || '默认分组';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(friend);
    });
    return groups;
  });

  // 获取好友列表
  async function fetchFriends() {
    loading.value = true;
    try {
      const res = await friendApi.getList();
      if (res.success) {
        friends.value = res.friends;
      }
      return res;
    } catch (error) {
      console.error('获取好友列表失败:', error);
      return { success: false, error: error.message };
    } finally {
      loading.value = false;
    }
  }

  // 获取好友申请列表
  async function fetchRequests() {
    requestLoading.value = true;
    try {
      const res = await friendApi.getRequests();
      if (res.success) {
        requests.value = res.requests;
      }
      return res;
    } catch (error) {
      console.error('获取好友申请失败:', error);
      return { success: false, error: error.message };
    } finally {
      requestLoading.value = false;
    }
  }

  // 搜索用户
  async function searchUsers(query) {
    try {
      const res = await friendApi.search(query);
      return res;
    } catch (error) {
      console.error('搜索用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 发送好友申请
  async function sendRequest(data) {
    try {
      const res = await friendApi.sendRequest(data);
      return res;
    } catch (error) {
      console.error('发送好友申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 处理好友申请
  async function handleRequest(requestId, status) {
    try {
      const res = await friendApi.handleRequest(requestId, status);
      if (res.success) {
        // 更新申请列表
        const index = requests.value.findIndex(r => r.id === requestId);
        if (index !== -1) {
          if (status === 'accepted') {
            // 同意后移除申请
            requests.value.splice(index, 1);
            // 刷新好友列表
            await fetchFriends();
          } else {
            requests.value[index].status = status;
          }
        }
      }
      return res;
    } catch (error) {
      console.error('处理好友申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 设置好友备注
  async function setRemark(friendId, remark) {
    try {
      const res = await friendApi.setRemark(friendId, remark);
      if (res.success) {
        // 更新本地状态
        const friend = friends.value.find(f => f.id === friendId);
        if (friend) {
          friend.remark = remark;
        }
      }
      return res;
    } catch (error) {
      console.error('设置备注失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 删除好友
  async function deleteFriend(friendId) {
    try {
      const res = await friendApi.delete(friendId);
      if (res.success) {
        // 从列表中移除
        const index = friends.value.findIndex(f => f.id === friendId);
        if (index !== -1) {
          friends.value.splice(index, 1);
        }
        // 清除当前选中的好友
        if (currentFriend.value?.id === friendId) {
          currentFriend.value = null;
        }
      }
      return res;
    } catch (error) {
      console.error('删除好友失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 拉黑用户
  async function blockUser(friendId) {
    try {
      const res = await friendApi.block(friendId);
      if (res.success) {
        // 从好友列表移除
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
      return { success: false, error: error.message };
    }
  }

  // 选择好友
  function selectFriend(friend) {
    currentFriend.value = friend;
  }

  // 清除选择
  function clearSelection() {
    currentFriend.value = null;
  }

  return {
    // 状态
    friends,
    requests,
    currentFriend,
    loading,
    requestLoading,
    // 计算属性
    friendCount,
    pendingRequestCount,
    friendsByGroup,
    // 方法
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
