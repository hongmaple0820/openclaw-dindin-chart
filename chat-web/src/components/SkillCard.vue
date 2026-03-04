<!--
  技能卡片组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div 
    class="skill-card"
    :class="{ active: isActive, disabled: !skill.enabled }"
    @click="$emit('click')"
  >
    <div class="skill-icon">
      <span class="icon-emoji">{{ skill.icon || '🔧' }}</span>
    </div>
    
    <div class="skill-info">
      <div class="skill-header">
        <span class="skill-name">{{ skill.name }}</span>
        <el-tag 
          v-if="skill.installed" 
          type="success" 
          size="small"
          class="status-tag"
        >
          已安装
        </el-tag>
        <el-tag 
          v-else-if="skill.type === 'built-in'" 
          type="info" 
          size="small"
          class="status-tag"
        >
          内置
        </el-tag>
        <el-tag 
          v-if="!skill.enabled && skill.installed" 
          type="warning" 
          size="small"
          class="status-tag"
        >
          已禁用
        </el-tag>
      </div>
      
      <div class="skill-desc">{{ skill.description || '暂无描述' }}</div>
      
      <div class="skill-meta">
        <span v-if="skill.category" class="meta-item">
          <el-icon><Folder /></el-icon>
          {{ skill.category }}
        </span>
        <span v-if="skill.version" class="meta-item">
          <el-icon><Collection /></el-icon>
          v{{ skill.version }}
        </span>
        <span v-if="skill.downloads" class="meta-item">
          <el-icon><Download /></el-icon>
          {{ formatNumber(skill.downloads) }}
        </span>
      </div>
    </div>
    
    <div class="skill-actions" @click.stop>
      <el-switch
        v-if="skill.installed"
        :model-value="skill.enabled"
        @change="handleToggle"
        size="small"
      />
      <el-button
        v-else-if="skill.type === 'market'"
        type="primary"
        size="small"
        :loading="installing"
        @click="handleInstall"
      >
        安装
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Folder, Collection, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  skill: {
    type: Object,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['click', 'toggle', 'install']);

const installing = ref(false);

// 格式化数字
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num;
}

// 切换启用状态
async function handleToggle(enabled) {
  emit('toggle', props.skill.id, enabled);
}

// 安装技能
async function handleInstall() {
  installing.value = true;
  try {
    emit('install', props.skill.id);
  } finally {
    installing.value = false;
  }
}
</script>

<style scoped>
.skill-card {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12px;
  margin: 8px;
  background: var(--fenlin-card-bg, #fff);
  border: 1px solid var(--fenlin-border-light, #f0f0f0);
}

.skill-card:hover {
  background: var(--fenlin-card-hover, rgba(196, 30, 58, 0.05));
  border-color: var(--fenlin-primary, #C41E3A);
}

.skill-card.active {
  background: var(--fenlin-card-active, rgba(196, 30, 58, 0.1));
  border-color: var(--fenlin-primary, #C41E3A);
}

.skill-card.disabled {
  opacity: 0.6;
}

.skill-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--fenlin-primary-light, rgba(196, 30, 58, 0.1)) 0%, var(--fenlin-primary-lighter, rgba(196, 30, 58, 0.05)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.icon-emoji {
  line-height: 1;
}

.skill-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--fenlin-text-primary, #2C3E50);
}

.status-tag {
  font-size: 10px;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
}

.skill-desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--fenlin-text-secondary, #5D6D7E);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.meta-item .el-icon {
  font-size: 12px;
}

.skill-actions {
  flex-shrink: 0;
  margin-left: 12px;
}

/* 暗色主题 */
@media (prefers-color-scheme: dark) {
  .skill-card {
    background: var(--fenlin-card-bg-dark, #1a1a1a);
    border-color: var(--fenlin-border-dark, #333);
  }
  
  .skill-card:hover {
    background: var(--fenlin-card-hover-dark, rgba(196, 30, 58, 0.15));
  }
  
  .skill-name {
    color: var(--fenlin-text-primary-dark, #e0e0e0);
  }
  
  .skill-desc {
    color: var(--fenlin-text-secondary-dark, #a0a0a0);
  }
}
</style>
