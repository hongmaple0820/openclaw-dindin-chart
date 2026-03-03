<!--
  任务卡片组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="task-card" @click="$emit('click')">
    <div class="card-header">
      <span class="task-title">{{ task.title }}</span>
      <el-tag :type="priorityMap[task.priority]?.type" size="small">
        {{ priorityMap[task.priority]?.label || '普通' }}
      </el-tag>
    </div>
    
    <p class="task-description" v-if="task.description">
      {{ task.description }}
    </p>
    
    <div class="card-footer">
      <div class="assignee">
        <el-avatar v-if="task.assignee" :size="20" :src="task.assignee.avatar">
          {{ task.assignee.nickname?.[0] }}
        </el-avatar>
        <span v-else class="unassigned">未分配</span>
      </div>
      <div class="due-date" v-if="task.dueDate" :class="{ overdue: isOverdue }">
        <el-icon><Clock /></el-icon>
        {{ formatDate(task.dueDate) }}
      </div>
    </div>
    
    <div class="card-indicators">
      <span v-if="task.comments?.length" class="indicator">
        <el-icon><ChatDotRound /></el-icon>
        {{ task.comments.length }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Clock, ChatDotRound } from '@element-plus/icons-vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});

defineEmits(['click']);

const priorityMap = {
  high: { label: '高', type: 'danger' },
  medium: { label: '中', type: 'warning' },
  low: { label: '低', type: 'info' }
};

const isOverdue = computed(() => {
  if (!props.task.dueDate) return false;
  return new Date(props.task.dueDate) < new Date();
});

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  if (days === -1) return '昨天';
  if (days < 0) return `${Math.abs(days)}天前`;
  if (days <= 7) return `${days}天后`;
  
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.task-card {
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

.task-card:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  margin-right: 8px;
  word-break: break-word;
}

.task-description {
  font-size: 12px;
  color: #606266;
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.assignee {
  display: flex;
  align-items: center;
}

.unassigned {
  font-size: 12px;
  color: #c0c4cc;
}

.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}

.due-date.overdue {
  color: #f56c6c;
}

.card-indicators {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
