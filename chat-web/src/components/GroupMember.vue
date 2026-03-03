<!--
  群成员卡片组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="member-card" :class="{ 'is-self': isSelf }">
    <el-avatar :size="size" :src="member.avatar">
      {{ member.nickname?.charAt(0) || member.username?.charAt(0) || '?' }}
    </el-avatar>
    <div class="member-info">
      <div class="member-name">
        <span class="nickname">{{ member.nickname || member.username }}</span>
        <el-tag v-if="isOwner" size="small" type="warning" class="role-tag">群主</el-tag>
        <el-tag v-else-if="member.isAdmin" size="small" type="success" class="role-tag">管理员</el-tag>
      </div>
      <div v-if="showActions && canManage" class="member-actions">
        <el-button
          v-if="!isOwner && !member.isAdmin"
          size="small"
          text
          type="primary"
          @click="$emit('setAdmin', member)"
        >
          设为管理员
        </el-button>
        <el-button
          v-if="member.isAdmin && !isOwner"
          size="small"
          text
          type="warning"
          @click="$emit('removeAdmin', member)"
        >
          取消管理员
        </el-button>
        <el-button
          v-if="canRemove"
          size="small"
          text
          type="danger"
          @click="$emit('remove', member)"
        >
          移出群聊
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useUserStore } from '@/stores/user';

const props = defineProps({
  member: {
    type: Object,
    required: true
  },
  ownerId: {
    type: [String, Number],
    default: null
  },
  currentUserId: {
    type: [String, Number],
    default: null
  },
  currentUserIsAdmin: {
    type: Boolean,
    default: false
  },
  showActions: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 40
  }
});

defineEmits(['setAdmin', 'removeAdmin', 'remove']);

const userStore = useUserStore();

const isOwner = computed(() => props.member.userId === props.ownerId);
const isSelf = computed(() => props.member.userId === (props.currentUserId || userStore.user?.id));

const canManage = computed(() => {
  // 不能管理自己
  if (isSelf.value) return false;
  // 群主可以管理所有人
  if (props.currentUserId === props.ownerId) return true;
  // 管理员只能管理普通成员
  if (props.currentUserIsAdmin && !isOwner.value && !props.member.isAdmin) return true;
  return false;
});

const canRemove = computed(() => {
  // 不能移出群主
  if (isOwner.value) return false;
  // 不能移出自己
  if (isSelf.value) return false;
  // 群主可以移出所有人
  if (props.currentUserId === props.ownerId) return true;
  // 管理员只能移出普通成员
  if (props.currentUserIsAdmin && !props.member.isAdmin) return true;
  return false;
});
</script>

<style scoped>
.member-card {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.member-card:hover {
  background: #f5f7fa;
}

.member-card.is-self {
  background: #fff7e6;
}

.member-card.is-self:hover {
  background: #fff1d6;
}

.member-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.member-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nickname {
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  font-size: 11px;
}

.member-actions {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.member-actions :deep(.el-button) {
  padding: 2px 8px;
  font-size: 12px;
}
</style>