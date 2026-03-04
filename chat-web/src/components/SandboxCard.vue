<!--
  沙箱卡片组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <el-card class="sandbox-card" :body-style="{ padding: '20px' }" shadow="hover">
    <div class="card-header">
      <div class="sandbox-info">
        <el-icon :size="24" :color="statusColor">
          <component :is="statusIcon" />
        </el-icon>
        <div class="sandbox-name">{{ sandbox.name }}</div>
      </div>
      <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
    </div>

    <div class="sandbox-image">
      <el-icon><Box /></el-icon>
      <span>{{ sandbox.image }}</span>
    </div>

    <div class="resource-usage">
      <div class="usage-item">
        <div class="usage-label">CPU</div>
        <el-progress :percentage="sandbox.cpuUsage || 0" :color="getProgressColor(sandbox.cpuUsage)" />
      </div>
      <div class="usage-item">
        <div class="usage-label">内存</div>
        <el-progress :percentage="getMemoryPercentage()" :color="getProgressColor(getMemoryPercentage())" />
      </div>
    </div>

    <div class="sandbox-footer">
      <div class="create-time">
        创建于 {{ formatTime(sandbox.createdAt) }}
      </div>
      <div class="card-actions">
        <el-button v-if="sandbox.status === 'stopped'" size="small" type="success" @click.stop="$emit('start', sandbox.id)">
          启动
        </el-button>
        <el-button v-if="sandbox.status === 'running'" size="small" type="warning" @click.stop="$emit('stop', sandbox.id)">
          停止
        </el-button>
        <el-button v-if="sandbox.status === 'running'" size="small" @click.stop="$emit('restart', sandbox.id)">
          重启
        </el-button>
        <el-button size="small" type="primary" @click.stop="$emit('click')">
          详情
        </el-button>
        <el-button size="small" type="danger" @click.stop="$emit('delete', sandbox.id)">
          删除
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';
import { VideoPlay, VideoPause, Box } from '@element-plus/icons-vue';

const props = defineProps({
  sandbox: {
    type: Object,
    required: true
  }
});

defineEmits(['click', 'start', 'stop', 'restart', 'delete']);

const statusIcon = computed(() => {
  return props.sandbox.status === 'running' ? VideoPlay : VideoPause;
});

const statusColor = computed(() => {
  return props.sandbox.status === 'running' ? '#67c23a' : '#909399';
});

const statusLabel = computed(() => {
  const labels = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    stopping: '停止中'
  };
  return labels[props.sandbox.status] || '未知';
});

const statusTagType = computed(() => {
  const types = {
    running: 'success',
    stopped: 'info',
    starting: 'warning',
    stopping: 'warning'
  };
  return types[props.sandbox.status] || 'info';
});

function getMemoryPercentage() {
  if (!props.sandbox.memoryUsage || !props.sandbox.memoryLimit) return 0;
  return Math.round((props.sandbox.memoryUsage / props.sandbox.memoryLimit) * 100);
}

function getProgressColor(percentage) {
  if (percentage < 60) return '#67c23a';
  if (percentage < 80) return '#e6a23c';
  return '#f56c6c';
}

function formatTime(dateString) {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.sandbox-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.sandbox-card:hover {
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sandbox-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.sandbox-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.sandbox-image {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  margin-bottom: 16px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.resource-usage {
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
}

.usage-item {
  margin-bottom: 12px;
}

.usage-item:last-child {
  margin-bottom: 0;
}

.usage-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.sandbox-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.create-time {
  font-size: 12px;
  color: #c0c4cc;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
