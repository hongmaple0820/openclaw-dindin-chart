<!--
  群聊列表项组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="group-item" :class="{ active: active }" @click="$emit('click')">
    <div class="group-avatar">
      <el-avatar :size="48" :src="group.avatar">
        {{ group.name?.charAt(0) || '群' }}
      </el-avatar>
      <el-badge v-if="group.unreadCount > 0" :value="group.unreadCount" :max="99" class="unread-badge" />
    </div>
    <div class="group-info">
      <div class="group-header">
        <span class="group-name">{{ group.name }}</span>
        <span class="time">{{ formatTime(group.lastMessageTime) }}</span>
      </div>
      <div class="group-footer">
        <span class="last-message">{{ group.lastMessage || '暂无消息' }}</span>
        <span class="member-count">{{ group.memberCount || 0 }}人</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  group: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 172800000) return '昨天';
  
  return date.toLocaleDateString();
}
</script>

<style scoped>
.group-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 8px;
}

.group-item:hover {
  background: #f5f7fa;
}

.group-item.active {
  background: #ecf5ff;
}

.group-avatar {
  position: relative;
  flex-shrink: 0;
}

.group-avatar :deep(.el-avatar) {
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
  color: white;
  font-weight: 600;
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
}

.group-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.group-name {
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  margin-left: 8px;
}

.group-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-message {
  font-size: 13px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.member-count {
  font-size: 12px;
  color: #C0C4CC;
  flex-shrink: 0;
}
</style>