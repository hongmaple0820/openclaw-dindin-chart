<!--
  Agent 卡片组件
  @author 小琳
  @date 2026-03-04
  显示：头像、昵称、状态、能力标签、简介
-->
<template>
  <div class="agent-card" @click="$emit('click', agent)">
    <div class="card-header">
      <el-avatar :size="48" :src="agent.avatar" class="agent-avatar">
        {{ agent.nickname?.[0] || agent.name?.[0] || 'A' }}
      </el-avatar>
      <div class="agent-info">
        <div class="agent-name">
          {{ agent.nickname || agent.name }}
          <el-tag 
            v-if="agent.isPublic" 
            size="small" 
            type="success"
            class="public-tag"
          >公开</el-tag>
        </div>
        <div class="agent-status">
          <span class="status-dot" :class="statusClass"></span>
          {{ statusText }}
        </div>
      </div>
    </div>
    
    <p class="agent-desc">{{ agent.description || '暂无简介' }}</p>
    
    <!-- 能力标签 -->
    <div class="capabilities" v-if="agent.capabilities?.length">
      <el-tag 
        v-for="cap in displayedCapabilities" 
        :key="cap"
        size="small"
        class="capability-tag"
        effect="plain"
      >{{ cap }}</el-tag>
      <el-tag 
        v-if="remainingCount > 0" 
        size="small" 
        type="info"
        class="more-tag"
      >+{{ remainingCount }}</el-tag>
    </div>
    
    <!-- 统计信息 -->
    <div class="agent-stats">
      <span class="stat-item">
        <el-icon><ChatDotRound /></el-icon>
        {{ formatNumber(agent.chatCount || 0) }} 对话
      </span>
      <span class="stat-item">
        <el-icon><Star /></el-icon>
        {{ formatNumber(agent.starCount || 0) }}
      </span>
      <span class="stat-item" v-if="agent.provider">
        <span class="provider-tag" :class="agent.provider">
          {{ getProviderIcon(agent.provider) }}
        </span>
        {{ getProviderShortName(agent.provider) }}
      </span>
      <span class="stat-item" v-else-if="agent.model">
        <el-icon><Cpu /></el-icon>
        {{ formatModel(agent.model) }}
      </span>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions" @click.stop>
      <el-button type="primary" size="small" @click="$emit('chat', agent)">
        <el-icon><ChatDotRound /></el-icon>
        对话
      </el-button>
      <el-dropdown trigger="click" @command="handleCommand">
        <el-button size="small" text>
          <el-icon><More /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="detail">
              <el-icon><View /></el-icon>
              查看详情
            </el-dropdown-item>
            <el-dropdown-item command="duplicate" v-if="agent.isPublic">
              <el-icon><CopyDocument /></el-icon>
              复制
            </el-dropdown-item>
            <el-dropdown-item command="edit" v-if="canEdit">
              <el-icon><Edit /></el-icon>
              编辑
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided v-if="canEdit">
              <el-icon><Delete /></el-icon>
              <span style="color: #f56c6c">删除</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { 
  ChatDotRound, 
  Star, 
  Cpu, 
  More, 
  View, 
  Edit, 
  Delete,
  CopyDocument 
} from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';

const props = defineProps({
  agent: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['click', 'chat', 'edit', 'delete', 'duplicate']);

const userStore = useUserStore();

// 计算状态样式
const statusClass = computed(() => {
  switch (props.agent.status) {
    case 'active': return 'active';
    case 'inactive': return 'inactive';
    case 'error': return 'error';
    default: return 'inactive';
  }
});

const statusText = computed(() => {
  switch (props.agent.status) {
    case 'active': return '运行中';
    case 'inactive': return '已停止';
    case 'error': return '异常';
    default: return '未知';
  }
});

// 显示的能力标签（最多3个）
const displayedCapabilities = computed(() => {
  const caps = props.agent.capabilities || [];
  return caps.slice(0, 3);
});

const remainingCount = computed(() => {
  const caps = props.agent.capabilities || [];
  return Math.max(0, caps.length - 3);
});

// 是否可编辑
const canEdit = computed(() => {
  const userId = userStore.user?.id;
  return props.agent.ownerId === userId || props.agent.userId === userId;
});

// 格式化数字
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num;
}

// 供应商信息
const providerInfo = {
  openai: { name: 'OpenAI', shortName: 'OpenAI', icon: '🟢' },
  anthropic: { name: 'Anthropic', shortName: 'Claude', icon: '🟠' },
  google: { name: 'Google', shortName: 'Gemini', icon: '🔵' },
  alibaba: { name: '阿里云', shortName: '通义', icon: '🟣' },
  zhipu: { name: '智谱 AI', shortName: 'GLM', icon: '🔴' },
  deepseek: { name: 'DeepSeek', shortName: 'DeepSeek', icon: '🟡' },
  baichuan: { name: '百川', shortName: '百川', icon: '⚪' },
  moonshot: { name: '月之暗面', shortName: 'Kimi', icon: '🌙' },
  local: { name: '本地模型', shortName: '本地', icon: '💻' },
  custom: { name: '自定义', shortName: '自定义', icon: '⚙️' }
};

function getProviderIcon(provider) {
  return providerInfo[provider]?.icon || '❓';
}

function getProviderShortName(provider) {
  return providerInfo[provider]?.shortName || provider;
}

function formatModel(model) {
  // 截断过长的模型名称
  if (model && model.length > 15) {
    return model.substring(0, 12) + '...';
  }
  return model;
}

// 处理命令
function handleCommand(cmd) {
  switch (cmd) {
    case 'detail':
      emit('click', props.agent);
      break;
    case 'edit':
      emit('edit', props.agent);
      break;
    case 'delete':
      emit('delete', props.agent);
      break;
    case 'duplicate':
      emit('duplicate', props.agent);
      break;
  }
}
</script>

<style scoped>
.agent-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e4e7ed;
}

.agent-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #409eff;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.public-tag {
  font-size: 10px;
  height: 18px;
  line-height: 18px;
  padding: 0 4px;
}

.agent-status {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.active {
  background: #67c23a;
  box-shadow: 0 0 4px #67c23a;
}

.status-dot.inactive {
  background: #909399;
}

.status-dot.error {
  background: #f56c6c;
}

.agent-desc {
  font-size: 13px;
  color: #606266;
  margin: 12px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.capability-tag {
  font-size: 11px;
}

.more-tag {
  font-size: 11px;
}

.agent-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.provider-tag {
  font-size: 10px;
}

.provider-tag.openai { color: #10a37f; }
.provider-tag.anthropic { color: #d97706; }
.provider-tag.google { color: #4285f4; }
.provider-tag.alibaba { color: #ff6a00; }
.provider-tag.zhipu { color: #e53935; }
.provider-tag.deepseek { color: #f59e0b; }
.provider-tag.local { color: #6366f1; }

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .agent-card {
    padding: 12px;
  }
  
  .agent-stats {
    gap: 12px;
  }
}
</style>
