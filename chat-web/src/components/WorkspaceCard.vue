<!--
  工作区卡片组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <el-card class="workspace-card" :body-style="{ padding: '20px' }" shadow="hover">
    <div class="card-header">
      <div class="workspace-info">
        <el-icon :size="24" :color="typeColor">
          <component :is="typeIcon" />
        </el-icon>
        <div class="workspace-name">{{ workspace.name }}</div>
      </div>
      <el-tag :type="typeTagType" size="small">{{ typeLabel }}</el-tag>
    </div>

    <div class="workspace-description" v-if="workspace.description">
      {{ workspace.description }}
    </div>

    <div class="workspace-stats">
      <div class="stat-item">
        <el-icon><Document /></el-icon>
        <span>{{ workspace.fileCount || 0 }} 文件</span>
      </div>
      <div class="stat-item">
        <el-icon><FolderOpened /></el-icon>
        <span>{{ formatSize(workspace.totalSize || 0) }}</span>
      </div>
    </div>

    <div class="workspace-footer">
      <div class="update-time">
        更新于 {{ formatTime(workspace.updatedAt) }}
      </div>
      <div class="card-actions">
        <el-button size="small" type="primary" @click.stop="$emit('click')">
          查看文件
        </el-button>
        <el-button size="small" type="danger" @click.stop="$emit('delete', workspace.id)">
          删除
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';
import { Document, FolderOpened, ChatDotRound, User, Tickets } from '@element-plus/icons-vue';

const props = defineProps({
  workspace: {
    type: Object,
    required: true
  }
});

defineEmits(['click', 'delete']);

const typeIcon = computed(() => {
  const icons = {
    group: ChatDotRound,
    dm: User,
    task: Tickets
  };
  return icons[props.workspace.type] || Document;
});

const typeColor = computed(() => {
  const colors = {
    group: '#409eff',
    dm: '#67c23a',
    task: '#e6a23c'
  };
  return colors[props.workspace.type] || '#909399';
});

const typeLabel = computed(() => {
  const labels = {
    group: '群聊',
    dm: '私聊',
    task: '任务'
  };
  return labels[props.workspace.type] || '未知';
});

const typeTagType = computed(() => {
  const types = {
    group: 'primary',
    dm: 'success',
    task: 'warning'
  };
  return types[props.workspace.type] || 'info';
});

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(dateString) {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  
  return date.toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.workspace-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.workspace-card:hover {
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.workspace-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.workspace-description {
  font-size: 14px;
  color: #606266;
  margin-bottom: 16px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.workspace-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #909399;
}

.workspace-footer {
  display: flex;
  justify-content: space-between;
  align-items: cenupdate-time {
  font-size: 12px;
  color: #c0c4cc;
}

.card-actions {
  display: flex;
  gap: 8px;
}
</style>
