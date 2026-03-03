<!--
  技能卡片组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="skill-item">
    <div class="skill-header">
      <div class="skill-icon" :style="{ backgroundColor: typeColors[skill.type] }">
        <el-icon v-if="skill.type === 'rule'"><Document /></el-icon>
        <el-icon v-else-if="skill.type === 'tool'"><Tools /></el-icon>
        <el-icon v-else><Connection /></el-icon>
      </div>
      <div class="skill-title">
        <h4>{{ skill.name }}</h4>
        <el-tag :type="typeMap[skill.type]?.tagType" size="small">
          {{ typeMap[skill.type]?.label }}
        </el-tag>
      </div>
      <el-dropdown trigger="click">
        <el-button text size="small">
          <el-icon><More /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="$emit('edit', skill)">编辑</el-dropdown-item>
            <el-dropdown-item @click="$emit('delete', skill)">删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    
    <p class="skill-description">
      {{ skill.description || '暂无描述' }}
    </p>
    
    <div class="skill-meta">
      <span class="meta-item">
        <el-icon><Clock /></el-icon>
        {{ formatDate(skill.updatedAt || skill.createdAt) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { Document, Tools, Connection, More, Clock } from '@element-plus/icons-vue';

defineProps({
  skill: {
    type: Object,
    required: true
  }
});

defineEmits(['edit', 'delete']);

const typeMap = {
  rule: { label: '规则', tagType: 'info' },
  tool: { label: '工具', tagType: 'success' },
  workflow: { label: '工作流', tagType: 'warning' }
};

const typeColors = {
  rule: '#909399',
  tool: '#67c23a',
  workflow: '#e6a23c'
};

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.skill-item {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}

.skill-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.skill-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.skill-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-title h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.skill-description {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
