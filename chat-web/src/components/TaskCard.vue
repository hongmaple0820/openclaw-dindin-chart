<!--
  任务卡片组件 - IM 风格
  @author 小琳
  @date 2026-03-07
  @update 移除任务优先级（优先级仅用于项目群）
-->
<template>
  <div class="task-card" :class="cardClass" @click="$emit('click')">
    <!-- 进度条背景动画 -->
    <div v-if="task.status === 'in_progress'" class="progress-bg">
      <div class="progress-line"></div>
    </div>
    
    <!-- 卡片内容 -->
    <div class="card-content">
      <div class="card-header">
        <span class="task-title">{{ task.title }}</span>
        <div class="header-actions">
          <!-- 状态标签 -->
          <el-tag :type="statusMap[task.status]?.type" size="small" effect="light">
            {{ statusMap[task.status]?.label || '待处理' }}
          </el-tag>
        </div>
      </div>
      
      <p class="task-description" v-if="task.description">
        {{ task.description }}
      </p>
      
      <div class="card-footer">
        <div class="assignees">
          <template v-if="task.assignees?.length">
            <el-avatar
              v-for="(assignee, idx) in task.assignees.slice(0, 3)"
              :key="assignee.id"
              :size="22"
              :src="assignee.avatar"
              :style="{ marginLeft: idx > 0 ? '-6px' : '0' }"
            >
              {{ assignee.nickname?.[0] }}
            </el-avatar>
            <span v-if="task.assignees.length > 3" class="more-count">
              +{{ task.assignees.length - 3 }}
            </span>
          </template>
          <span v-else class="unassigned">未分配</span>
        </div>
        
        <div class="card-meta">
          <div v-if="task.dueDate" class="due-date" :class="{ overdue: isOverdue }">
            <el-icon><Clock /></el-icon>
            <span>{{ formatDate(task.dueDate) }}</span>
          </div>
          
          <span v-if="task.comments?.length" class="comment-count">
            <el-icon><ChatDotRound /></el-icon>
            {{ task.comments.length }}
          </span>
        </div>
      </div>
    </div>
    
    <!-- 状态指示条 -->
    <div class="status-indicator" :class="task.status"></div>
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

// 状态映射（用于标签显示）
const statusMap = {
  pending: { label: '待处理', type: 'warning' },
  in_progress: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' }
};

const cardClass = computed(() => ({
  'is-progress': props.task.status === 'in_progress',
  'is-completed': props.task.status === 'completed',
  'is-pinned': props.task.pinned
}));

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
  position: relative;
  background: var(--fenlin-surface, #fff);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--fenlin-border, #ebeef5);
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.task-card.is-pinned {
  border-color: #e6a23c;
  background: linear-gradient(to right, #fdf6ec, var(--fenlin-surface, #fff));
}

.task-card.is-completed {
  opacity: 0.75;
}

/* 进度背景动画 */
.progress-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #e4e7ed;
  overflow: hidden;
}

.progress-line {
  height: 100%;
  width: 30%;
  background: linear-gradient(90deg, transparent, #409eff, transparent);
  animation: progress-slide 1.5s infinite;
}

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.card-content {
  padding: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #303133);
  flex: 1;
  margin-right: 8px;
  line-height: 1.4;
}

.task-card.is-completed .task-title {
  text-decoration: line-through;
  color: var(--fenlin-text-tertiary, #909399);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.task-description {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assignees {
  display: flex;
  align-items: center;
}

.assignees .el-avatar {
  border: 2px solid var(--fenlin-surface, white);
}

.more-count {
  margin-left: 4px;
  font-size: 11px;
  color: var(--fenlin-text-tertiary, #909399);
  background: var(--fenlin-bg-secondary, #f0f2f5);
  padding: 2px 6px;
  border-radius: 10px;
}

.unassigned {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #c0c4cc);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.due-date {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
}

.due-date.overdue {
  color: #f56c6c;
}

.comment-count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
}

/* 状态指示条 */
.status-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.status-indicator.pending {
  background: #E6A23C;
}

.status-indicator.in_progress {
  background: #409EFF;
}

.status-indicator.completed {
  background: #67C23A;
}
</style>