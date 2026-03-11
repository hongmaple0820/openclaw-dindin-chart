/**
 * 群聊状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupApi } from '@/api/groups';
import type { Group, GroupMember } from '@/types';

interface GroupWithUnread extends Group {
  unreadCount?: number;
}

interface CreateGroupData {
  name: string;
  description?: string;
  avatar?: string;
  memberIds?: string[];
}

export const useGroupStore = defineStore('groups', () => {
  const groups = ref<GroupWithUnread[]>([]);
  const currentGroup = ref<Group | null>(null);
  const currentMembers = ref<GroupMember[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const totalUnread = computed(() => {
    return groups.value.reduce((sum, g) => sum + (g.unreadCount || 0), 0);
  });

  async function fetchGroups(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.getList();
      if (res.success) {
        groups.value = (res.groups as GroupWithUnread[]) || [];
      } else {
        error.value = res.error || '加载群聊列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载群聊列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchGroupDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.getDetail(id);
      if (res.success) {
        currentGroup.value = res.group as Group;
      } else {
        error.value = res.error || '加载群详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载群详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchMembers(id: string): Promise<void> {
    try {
      const res = await groupApi.getMembers(id);
      if (res.success) {
        currentMembers.value = (res.members as GroupMember[]) || [];
      }
    } catch (err) {
      console.error('加载成员列表失败:', err);
    }
  }

  async function createGroup(data: CreateGroupData): Promise<Group | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await groupApi.create(data);
      if (res.success && res.group) {
        const group = res.group as Group;
        groups.value.unshift(group);
        return group;
      } else {
        error.value = res.error || '创建群聊失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建群聊失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function inviteMembers(groupId: string, userIds: string[]): Promise<boolean> {
    try {
      const res = await groupApi.invite(groupId, { userIds });
      if (res.success) {
        await fetchMembers(groupId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('邀请成员失败:', err);
      return false;
    }
  }

  async function removeMember(groupId: string, userId: string): Promise<boolean> {
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

  async function setAdmin(groupId: string, userId: string, isAdmin: boolean): Promise<boolean> {
    try {
      const res = await groupApi.setAdmin(groupId, userId, isAdmin);
      if (res.success) {
        const member = currentMembers.value.find(m => m.userId === userId);
        if (member) {
          member.role = isAdmin ? 'admin' : 'member';
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('设置管理员失败:', err);
      return false;
    }
  }

  async function transferOwner(groupId: string, newOwnerId: string): Promise<boolean> {
    try {
      const res = await groupApi.transfer(groupId, newOwnerId);
      if (res.success) {
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

  async function leaveGroup(groupId: string): Promise<boolean> {
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

  async function dismissGroup(groupId: string): Promise<boolean> {
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

  async function setNickname(groupId: string, userId: string, nickname: string): Promise<boolean> {
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

  async function updateGroup(groupId: string, data: Partial<Group>): Promise<boolean> {
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

  function clearCurrentGroup(): void {
    currentGroup.value = null;
    currentMembers.value = [];
  }

  return {
    groups,
    currentGroup,
    currentMembers,
    loading,
    error,
    totalUnread,
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