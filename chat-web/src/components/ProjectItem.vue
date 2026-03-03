<!--
  项目列表项组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="project-item" :class="{ active }" @click="$emit('click')">
    <div class="project-icon">
      <el-avatar :size="40" :style="{ backgroundColor: getStatusColor(project.status) }">
        {{ project.name?.[0] || 'P' }}
      </el-avatar>
    </div>
    <div class="project-info">
      <div class="project-name">
        {{ project.name }}
        <el-tag v-if="project.status" :type="statusMap[project.status]?.type" size="small">
          {{ statusMap[project.status]?.label }}
        </el-tag>
      </div>
      <div class="project-meta">
        <span class="description">{{ project.description || '暂无描述' }}</span>
        <span class="task-count" v-if="project.taskCount !== undefined">
          {{ project.taskCount }} 任务
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  project: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);

const statusMap = {
  active: { label: '进行中', type: 'success' },
  completed: { label: '已完成', type: 'info' },
  paused: { label: '已暂停', type: 'warning' }
};

function getStatusColor(status) {
  const colors = {
    active: '#67c23a',
    completed: '#909399',
    paused: '#e6a23c'
  };
  return colors[status] || '#409eff';
}
</script>

<style scoped>
.project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.project-item:hover {
  background-color: #f5f7fa;
}

.project-item.active {
  background-color: #ecf5ff;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.project-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.description {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.task-count {
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}
</style>
