<!--
  好友申请卡片组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="friend-request-card">
    <div class="request-header">
      <el-avatar :size="40" :src="request.fromUser?.avatar">
        {{ request.fromUser?.nickname?.charAt(0) || request.fromUser?.username?.charAt(0) || '?' }}
      </el-avatar>
      <div class="request-info">
        <div class="request-name">
          {{ request.fromUser?.nickname || request.fromUser?.username }}
          <el-tag v-if="request.fromUser?.userType === 'bot'" type="warning" size="small" class="user-type-tag">
            🤖
          </el-tag>
        </div>
        <div class="request-time">{{ formatTime(request.createdAt) }}</div>
      </div>
      <el-tag 
        :type="statusTag.type" 
        size="small"
        effect="light"
      >
        {{ statusTag.text }}
      </el-tag>
    </div>
    
    <div v-if="request.message" class="request-message">
      <el-icon><ChatLineRound /></el-icon>
      <span>{{ request.message }}</span>
    </div>
    
    <div v-if="request.status === 'pending'" class="request-actions">
      <el-button type="primary" size="small" @click="handleAccept" :loading="loading">
        同意
      </el-button>
      <el-button size="small" @click="handleReject" :loading="loading">
        拒绝
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ChatLineRound } from '@element-plus/icons-vue';

const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['accept', 'reject']);

const loading = ref(false);

const statusTag = computed(() => {
  switch (props.request.status) {
    case 'pending':
      return { type: 'warning', text: '待处理' };
    case 'accepted':
      return { type: 'success', text: '已同意' };
    case 'rejected':
      return { type: 'info', text: '已拒绝' };
    default:
      return { type: 'info', text: '未知' };
  }
});

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  
  return date.toLocaleDateString();
}

async function handleAccept() {
  loading.value = true;
  try {
    await emit('accept', props.request.id);
  } finally {
    loading.value = false;
  }
}

async function handleReject() {
  loading.value = true;
  try {
    await emit('reject', props.request.id);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.friend-request-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.friend-request-card:hover {
  box-shadow: 0 4px 12px rgba(196, 30, 58, 0.1);
  border-color: rgba(196, 30, 58, 0.2);
}

.request-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.request-info {
  flex: 1;
  min-width: 0;
}

.request-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-type-tag {
  padding: 0 4px;
  height: 16px;
  line-height: 14px;
  font-size: 10px;
}

.request-time {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  margin-top: 2px;
}

.request-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 13px;
  color: var(--fenlin-text-secondary, #5A6C7D);
}

.request-message .el-icon {
  color: #C41E3A;
  flex-shrink: 0;
  margin-top: 2px;
}

.request-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.request-actions .el-button--primary {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
}
</style>
