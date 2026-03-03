/**
 * 群聊状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupApi } from '@/api/groups';

export const useGroupStore = defineStore('groups', () => {
  // 状态
  const groups = ref([]);
  const currentGroup = ref(null);
  const currentMembers = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // 计算属性
  const totalUnread = computed(() => {
    return groups.value.reduce((sum, g) => sum + (g.unreadCount || 0), 0);
  });

  // 加载群聊列表
  async function fetchGroups() {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.getList();
      if (res.success) {
        groups.value = res.groups || [];
      } else {
        error.value = res.error || '加载群聊列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载群聊列表失败';
    } finally {
      loading.value = false;
    }
  }

  // 加载群详情
  async function fetchGroupDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.getDetail(id);
      if (res.success) {
        currentGroup.value = res.group;
      } else {
        error.value = res.error || '加载群详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载群详情失败';
    } finally {
      loading.value = false;
    }
  }

  // 加载群成员
  async function fetchMembers(id) {
    try {
      const res = await groupApi.getMembers(id);
      if (res.success) {
        currentMembers.value = res.members || [];
      }
    } catch (err) {
      console.error('加载成员列表失败:', err);
    }
  }

  // 创建群聊
  async function createGroup(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.create(data);
      if (res.success) {
        groups.value.unshift(res.group);
        return res.group;
      } else {
        error.value = res.error || '创建群聊失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建群聊失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // 邀请成员
  async function inviteMembers(groupId, userIds) {
    try {
      const res = await groupApi.invite(groupId, { userIds });
      if (res.success) {
        // 刷新成员列表
        await fetchMembers(groupId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('邀请成员失败:', err);
      return false;
    }
  }

  // 移除成员
  async function removeMember(groupId, userId) {
    try {
      const res = await groupApi.removeMember(groupId, userId);
      if (res.success) {
        currentMembers.value = currentMembers.value.filter(m => m.userId !== userId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('移除成员失败:', err);
      return false;
    }
  }

  // 设置管理员
  async function setAdmin(groupId, userId, isAdmin) {
    try {
      const res = await groupApi.setAdmin(groupId, userId, isAdmin);
      if (res.success) {
        const member = currentMembers.value.find(m => m.userId === userId);
        if (member) {
          member.isAdmin = isAdmin;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('设置管理员失败:', err);
      return false;
    }
  }

  // 转让群主
  async function transferOwner(groupId, newOwnerId) {
    try {
      const res = await groupApi.transfer(groupId, newOwnerId);
      if (res.success) {
        // 刷新群详情和成员
        await fetchGroupDetail(groupId);
        await fetchMembers(groupId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('转让群主失败:', err);
      return false;
    }
  }

  // 退出群聊
  async function leaveGroup(groupId) {
    try {
      const res = await groupApi.leave(groupId);
      if (res.success) {
        groups.value = groups.value.filter(g => g.id !== groupId);
        if (currentGroup.value?.id === groupId) {
          currentGroup.value = null;
          currentMembers.value = [];
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('退出群聊失败:', err);
      return false;
    }
  }

  // 解散群聊
  async function dismissGroup(groupId) {
    try {
      const res = await groupApi.dismiss(groupId);
      if (res.success) {
        groups.value = groups.value.filter(g => g.id !== groupId);
        if (currentGroup.value?.id === groupId) {
          currentGroup.value = null;
          currentMembers.value = [];
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('解散群聊失败:', err);
      return false;
    }
  }

  // 设置群名片
  async function setNickname(groupId, userId, nickname) {
    try {
      const res = await groupApi.setNickname(groupId, userId, nickname);
      if (res.success) {
        const member = currentMembers.value.find(m => m.userId === userId);
        if (member) {
          member.nickname = nickname;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('设置群名片失败:', err);
      return false;
    }
  }

  // 更新群信息
  async function updateGroup(groupId, data) {
    try {
      const res = await groupApi.update(groupId, data);
      if (res.success) {
        if (currentGroup.value?.id === groupId) {
          currentGroup.value = { ...currentGroup.value, ...data };
        }
        const idx = groups.value.findIndex(g => g.id === groupId);
        if (idx !== -1) {
          groups.value[idx] = { ...groups.value[idx], ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新群信息失败:', err);
      return false;
    }
  }

  // 清除当前群
  function clearCurrentGroup() {
    currentGroup.value = null;
    currentMembers.value = [];
  }

  return {
    // 状态
    groups,
    currentGroup,
    currentMembers,
    loading,
    error,
    // 计算属性
    totalUnread,
    // 方法
    fetchGroups,
    fetchGroupDetail,
    fetchMembers,
    createGroup,
    inviteMembers,
    removeMember,
    setAdmin,
    transferOwner,
    leaveGroup,
    dismissGroup,
    setNickname,
    updateGroup,
    clearCurrentGroup
  };
});