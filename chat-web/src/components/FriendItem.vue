<!--
  好友列表项组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div 
    class="friend-item"
    :class="{ active: isActive }"
    @click="$emit('click')"
  >
    <div class="avatar-wrapper">
      <el-avatar :size="40" :src="friend.avatar">
        {{ friend.nickname?.charAt(0) || friend.username?.charAt(0) || '?' }}
      </el-avatar>
      <span class="status-dot" :class="friend.online ? 'online' : 'offline'"></span>
    </div>
    
    <div class="friend-info">
      <div class="friend-name">
        <span class="nickname">{{ friend.remark || friend.nickname || friend.username }}</span>
        <el-tag v-if="friend.userType === 'bot'" type="warning" size="small" class="user-type-tag">
          🤖 机器人
        </el-tag>
      </div>
      <div class="friend-status">
        <span v-if="friend.status" class="status-text">{{ friend.status }}</span>
        <span v-else class="status-text offline">离线</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  friend: {
    type: Object,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);
</script>

<style scoped>
.friend-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: 4px 8px;
}

.friend-item:hover {
  background: rgba(196, 30, 58, 0.05);
}

.friend-item.active {
  background: rgba(196, 30, 58, 0.1);
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid white;
}

.status-dot.online {
  background: #67c23a;
}

.status-dot.offline {
  background: #909399;
}

.friend-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.friend-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nickname {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-type-tag {
  font-size: 10px;
  padding: 0 4px;
  height: 18px;
  line-height: 16px;
}

.friend-status {
  margin-top: 2px;
}

.status-text {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.status-text.offline {
  color: #909399;
}
</style>
