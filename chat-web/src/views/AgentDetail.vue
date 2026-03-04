<!--
  Agent 详情页
  @author 小琳
  @date 2026-03-04
  功能：基本信息、API 配置、能力定义
-->
<template>
  <div class="agent-detail-page">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <div v-else-if="!agent" class="error-container">
      <el-empty description="Agent 不存在">
        <el-button type="primary" @click="$router.push({ name: 'Agents' })">
          返回列表
        </el-button>
      </el-empty>
    </div>

    <div v-else class="detail-container">
      <!-- 头部 -->
      <div class="detail-header">
        <el-button text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <div class="header-actions">
          <el-button type="primary" @click="goToChat">
            <el-icon><ChatDotRound /></el-icon>
            开始对话
          </el-button>
          <el-button v-if="canEdit" @click="showEditDialog = true">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-dropdown v-if="canEdit" trigger="click" @command="handleCommand">
            <el-button text>
              <el-icon><More /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="duplicate">
                  <el-icon><CopyDocument /></el-icon>
                  复制
                </el-dropdown-item>
                <el-dropdown-item command="export">
                  <el-icon><Download /></el-icon>
                  导出配置
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <el-icon><Delete /></el-icon>
                  <span style="color: #f56c6c">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 基本信息 -->
      <el-card class="info-card">
        <div class="agent-header">
          <el-avatar :size="80" :src="agent.avatar">
            {{ agent.nickname?.[0] || agent.name?.[0] || 'A' }}
          </el-avatar>
          <div class="agent-meta">
            <h2>{{ agent.nickname || agent.name }}</h2>
            <div class="meta-tags">
              <el-tag v-if="agent.isPublic" type="success" size="small">公开</el-tag>
              <el-tag v-else type="info" size="small">私有</el-tag>
              <span class="status-badge" :class="statusClass">
                <span class="status-dot"></span>
                {{ statusText }}
              </span>
            </div>
            <p class="agent-description">{{ agent.description || '暂无简介' }}</p>
          </div>
        </div>

        <el-divider />

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-value">{{ agent.chatCount || 0 }}</div>
            <div class="stat-label">对话次数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ agent.starCount || 0 }}</div>
            <div class="stat-label">收藏数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ fDate(agent.createdAt) }}</div>
            <div class="stat-label">创建时间</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatDate(agent.lastUsedAt) || '未使用' }}</div>
            <div class="stat-label">最近使用</div>
          </div>
        </div>
      </el-card>

      <!-- API 配置 -->
      <el-card class="config-card">
        <template #header>
          <div class="card-header">
            <span>API 配置</span>
            <el-icon><Setting /></el-icon>
          </div>
        </template>
     <el-descriptions :column="2" border>
          <el-descriptions-item label="模型">
            {{ agent.model || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="API Endpoint">
            <el-text truncated style="max-width: 300px">
              {{ agent.apiEndpoint || '-' }}
            </el-text>
          </el-descriptions-item>
          <el-descriptions-item label="Temperature">
            {{ agent.temperature ?? 0.7 }}
          </el-descriptions-item>
          <el-descriptions-item label="Max Tokens">
            {{ agent.maxTokens || 4096 }}      </el-descriptions-item>
          <el-descriptions-item label="API Key" :span="2">
            <el-text v-if="agent.apiKey">••••••••••••</el-text>
            <el-text v-else type="info">未配置</el-text>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 能力定义 -->
      <el-card class="capability-card">
        <template #header>
          <div class="card-header">
            <span>能力定义</span>
            <el-icon><MagicStick /></el-icon>
          </div>
        </template>

        <div class="capability-section">
          <h4>System Prompt</h4>
          <el-input
            v-model="agent.systemPrompt"
            type="textarea"
            :rows="8"
            readonly
            class="prompt-display"
          />
        </div>

        <el-divider />

        <div class="capability-section">
          <h4>能力标签</h4>
          <div v-if="agent.capabilities?.length" class="capability-tags">
            <el-tag
              v-for="cap in agent.capabilities"
              :key="cap"
              size="large"
              effect="plain"
            >{{ cap }}</el-tag>
          </div>
          <el-empty v-else description="力" :image-size="60" />
        </div>

        <el-divider />

        <div class="capability-section">
          <h4>启用工具</h4>
          <div v-if="agent.enabledTools?.length" class="tools-list">
            <el-tag
              v-for="tool in agent.enabledTools"
              :key="tool"
              type="success"
              size="large"
            >
              <el-icon><Tools /></el-icon>
              {{ getToolName(tool) }}
            </el-tag>
          </div>
          <el-empty v-else description="未启用工具" :image-size="60" />
        </div>

        <el-divider />

        <div class="capability-section">
          <h4>记忆配置</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="长期记忆">
              <el-tag v-if="agent.enableMemory" type="success">已启用</el-tag>
              <el-tag v-else type="info">未启用</el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="agent.enableMemory" label="记忆检索数量">
              {{ agent.memoryRetrievalCount || 5 }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑 Agent"
      width="700px"
      :close-on-click-modal="false"
    >
      <AgentConfig
        :agent="agent"
        :submitting="submitting"
        @submit="handleUpdate"
        @cancel="showEditDialog = false"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Loading,
  ArrowLeft,
  ChatDotRound,
  Edit,
  More,
  CopyDocument,
  Download,
  Delete,
  Setting,
  MagicStick,
  Tools
} from '@element-plus/icons-vue';
import AgentConfig from '@/components/AgentConfig.vue';
import api from '@/api';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const showEditDialog = ref(false);
const agent = ref(null);

const canEdit = computed(() => {
  const userId = userStore.user?.id;
  return agent.value?.ownerId === userId || agent.value?.userId === userId;
});

const statusClass = computed(() => {
  switch (agent.value?.status) {
    case 'active': return 'status-active';
    case 'inactive': return 'status-inactive';
    case 'error': return 'status-error';
    default: return 'status-inactive';
  }
});

const statusText = computed(() => {
  switch (agent.value?.status) {
    case 'active': return '运行中';
    case 'inactive': return '已停止';
    case 'error': return '异常';
    default: return '未知';
  }
});

async function loadAgent() {
  loading.value = true;
  try {
    const res = await api.get(`/agents/${route.params.id}`);
    if (res.success) {
      agent.value = res.agent;
    } else {
      ElMessage.error('加载失败');
    }
  }atch (error) {
    console.error('加载 Agent 失败:', error);
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

function goToChat() {
  router.push({ name: 'AgentChat', params: { id: agent.value.id } });
}

async function handleUpdate(formData) {
  submitting.value = true;
  try {
    const res = await api.put(`/agents/${agent.value.id}`, formData);
    if (res.success) {
      ElMessage.success('保存成功');
      showEditDialog.value = false;
      loadAgent();
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } catch (error) {
   sole.error('保存失败:', error);
    ElMessage.error');
  } finally {
    submitting.value = false;
  }
}

async function handleCommand(cmd) {
  switch (cmd) {
    case 'duplicate':
      await duplicateAgent();
      break;
    case 'export':
      exportConfig();
      break;
    case 'delete':
      await deleteAgent();
      break;
  }
}

async function duplicateAgent() {
  try {
    const res = await api.post(`/agents/${agent.value.id}/duplicate`);
    if (res.success) {
      ElMessage.success('复制成功');
      if (res.agent) {
        router.push({ name: 'AgentDetail', params: { id: res.agent.id } });
      }
    } else {
      ElMessage.error(res.error || '复制失败');
    }
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败');
  }
}

function exportConfig() {
  const config = {
    name: agent.value.name,
    nickname: agent.value.nickname,
    description: agent.value.description,
    model: agent.value.model,
    apiEndpoint: agent.value.apiEndpoint,
    temperature: agent.value.temperature,
    maxTokens: agent.value.maxTokens,
    systemPrompt: agent.value.systemPrompt,
    capabilities: agent.value.capabilities,
    enabledTools: agent.value.enabledTools,
    enableMemory: agent.value.enableMemory,
    memoryRetrievalCount: agent.value.memoryRetrievalCount
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${agent.value.name || 'agent'}-config.json`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
}

async function deleteAgent() {
  try {
    await ElMessageBox.confirm(
      `确定要删除 Agent "${agent.value.name || agent.value.nickname}" 吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
    const res = await api.delete(`/agents/${agent.value.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      router.push({ name: 'Agents' });
    } else {
      ElMessage.error(res.error || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
}

function getToolNa  const names = {
    web_search: '网络搜索',
    code_interpreter: '代码解释器',
    image_gen: '图片生成',
    file_reader: '文件读取'
  };
  return names[tool] || tool;
}

onMounted(() => loadAgent());
</script>

<style scoped>
.agent-detail-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
.loading-container, .error-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; color: #909399; }
.loading-container p { margin-top: 16px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }er-actions { display: flex; gap: 12px; }
.info-card, .config-card, .capability-card { margin-bottom: 20px; }
.agent-header { display: flex; gap: 20px; }
.agent-meta { flex: 1; }
.agent-meta h2 { margin: 0 0 8px; font-size: 24px; color: #303133; }
.meta-tags { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; padding: 2px 8px; border-radius: 4px; }
.status-badge.status-active { color: #67c23a; background: #f0f9ff; }
.status-badge.status-inactive { color: #909399; backgroun4f4f5; }
.status-badus-error { color: #f56c6c; background: #fef0f0; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.agent-description { color: #606266; line-height: 1.6; margin: 0; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.stat-item { text-align: center; }
.stat-value { font-size: 20px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.stat-label { font-size: 13px; color: #909399; }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.capability-section { margin-bottom: 20px; }
.capability-section:last-child { margin-bottom:n.capability-section h4 { margin: 0 0 12px; font-size: 15px; color: #303133; }
.prompt-display { font-family: 'Courier New', monospace; }
.capability-tags, .tools-list { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 768px) {
  .agent-detail-page { padding: 12px; }
  .agent-header { flex-direction: column; text-align: center; }
  .stats-row { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .header-actions { flex-wrap: wrap; }
}
</style>
