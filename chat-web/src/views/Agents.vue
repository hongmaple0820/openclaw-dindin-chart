<!--
  Agent 管理主页面
  @author 小琳
  @date 2026-03-04
  功能：Agent 列表（公开/私有 Tab）、添加按钮、Agent 卡片网格
  更新：2026-03-07 - 添加供应商分组显示、自动接入功能
-->
<template>
  <div class="agents-page">
    <div class="page-header">
      <h2>Agent 管理</h2>
      <div class="header-actions">
        <el-button @click="showAutoConnectDialog = true">
          <el-icon><Link /></el-icon>
          自动接入
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          创建 Agent
        </el-button>
      </div>
    </div>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" class="agents-tabs">
      <el-tab-pane label="我的 Agent" name="private">
        <div class="tab-header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索 Agent..."
            :prefix-icon="Search"
            clearable
            style="max-width: 300px"
          />
          <div class="filter-group">
            <el-select v-model="filterProvider" placeholder="供应商" clearable style="width: 140px">
              <el-option label="全部供应商" value="" />
              <el-option-group label="国际厂商">
                <el-option label="OpenAI" value="openai" />
                <el-option label="Anthropic" value="anthropic" />
                <el-option label="Google" value="google" />
              </el-option-group>
              <el-option-group label="国内厂商">
                <el-option label="阿里云" value="alibaba" />
                <el-option label="智谱 AI" value="zhipu" />
                <el-option label="DeepSeek" value="deepseek" />
                <el-option label="百川" value="baichuan" />
                <el-option label="月之暗面" value="moonshot" />
              </el-option-group>
              <el-option-group label="其他">
                <el-option label="本地模型" value="local" />
                <el-option label="自定义" value="custom" />
              </el-option-group>
            </el-select>
            <el-select v-model="sortBy" placeholder="排序" style="width: 130px">
              <el-option label="最近创建" value="created" />
              <el-option label="最近使用" value="used" />
              <el-option label="对话最多" value="chats" />
              <el-option label="名称" value="name" />
            </el-select>
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="grid">
                <el-icon><Grid /></el-icon>
              </el-radio-button>
              <el-radio-button value="group">
                <el-icon><List /></el-icon>
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>加载中...</p>
        </div>

        <div v-else-if="filteredPrivateAgents.length === 0" class="empty-state">
          <el-empty description="还没有创建 Agent">
            <el-button type="primary" @click="showCreateDialog = true">
              创建第一个 Agent
            </el-button>
          </el-empty>
        </div>

        <!-- 分组视图 -->
        <div v-else-if="viewMode === 'group'" class="agents-grouped">
          <div v-for="group in groupedAgents" :key="group.provider" class="provider-group">
            <div class="group-header">
              <span class="provider-badge" :class="group.provider">
                {{ getProviderIcon(group.provider) }}
              </span>
              <h3>{{ getProviderName(group.provider) }}</h3>
              <el-tag size="small" type="info">{{ group.agents.length }}</el-tag>
            </div>
            <div class="agents-grid compact">
              <AgentCard
                v-for="agent in group.agents"
                :key="agent.id"
                :agent="agent"
                @click="goToDetail(agent)"
                @chat="goToChat(agent)"
                @edit="editAgent(agent)"
                @delete="deleteAgent(agent)"
                @duplicate="duplicateAgent(agent)"
              />
            </div>
          </div>
        </div>

        <!-- 网格视图 -->
        <div v-else class="agents-grid">
          <AgentCard
            v-for="agent in filteredPrivateAgents"
            :key="agent.id"
            :agent="agent"
            @click="goToDetail(agent)"
            @chat="goToChat(agent)"
            @edit="editAgent(agent)"
            @delete="deleteAgent(agent)"
            @duplicate="duplicateAgent(agent)"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="公开 Agent" name="public">
        <div class="tab-header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索公开 Agent..."
            :prefix-icon="Search"
            clearable
            style="max-width: 300px"
          />
          <el-select v-model="sortBy" placeholder="排序" style="width: 150px">
            <el-option label="最热门" value="popular" />
            <el-option label="最新" value="created" />
            <el-option label="对话最多" value="chats" />
            <el-option label="名称" value="name" />
          </el-select>
        </div>

        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>加载中...</p>
        </div>

        <div v-else-if="filteredPublicAgents.length === 0" class="empty-state">
          <el-empty description="暂无公开 Agent" />
        </div>

        <div v-else class="agents-grid">
          <AgentCard
            v-for="agent in filteredPublicAgents"
            :key="agent.id"
            :agent="agent"
            @click="goToDetail(agent)"
            @chat="goToChat(agent)"
            @duplicate="duplicateAgent(agent)"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑 Agent 弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingAgent ? '编辑 Agent' : '创建 Agent'"
      width="700px"
      :close-on-click-modal="false"
    >
      <AgentConfig
        :agent="editingAgent"
        :submitting="submitting"
        @submit="handleSubmit"
        @cancel="showCreateDialog = false"
      />
    </el-dialog>

    <!-- 自动接入弹窗 -->
    <el-dialog
      v-model="showAutoConnectDialog"
      title="自动接入 Agent"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="auto-connect-content">
        <el-alert type="info" :closable="false" show-icon>
          <template #title>自动接入功能</template>
          <template #default>
            从 OpenClaw 自动导入 Agent 配置，并生成专属 Skills 文件
          </template>
        </el-alert>

        <el-form :model="autoConnectForm" label-position="top" class="auto-connect-form">
          <el-form-item label="OpenClaw 服务器地址">
            <el-input 
              v-model="autoConnectForm.serverUrl" 
              placeholder="https://your-openclaw-server.com"
            />
          </el-form-item>

          <el-form-item label="访问令牌">
            <el-input 
              v-model="autoConnectForm.token" 
              type="password"
              placeholder="输入 OpenClaw API Token"
              show-password
            />
          </el-form-item>

          <el-form-item label="选择要接入的 Agent">
            <el-select 
              v-model="autoConnectForm.selectedAgents" 
              multiple 
              placeholder="选择 Agent"
              style="width: 100%"
              :loading="loadingAgents"
              @focus="fetchAvailableAgents"
            >
              <el-option
                v-for="agent in availableAgentsForImport"
                :key="agent.id"
                :label="agent.name"
                :value="agent.id"
              >
                <div class="agent-option">
                  <span>{{ agent.name }}</span>
                  <el-tag size="small" type="info">{{ agent.provider || '未知' }}</el-tag>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="生成 Skills 文件">
            <el-switch v-model="autoConnectForm.generateSkills" />
            <span class="switch-hint">为每个 Agent 生成专属的 Skills 配置文件</span>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showAutoConnectDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleAutoConnect" 
          :loading="autoConnecting"
          :disabled="!autoConnectForm.selectedAgents.length"
        >
          开始接入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Loading, Link, Grid, List } from '@element-plus/icons-vue';
import AgentCard from '@/components/AgentCard.vue';
import AgentConfig from '@/components/AgentConfig.vue';
import api from '@/api';

const router = useRouter();

const activeTab = ref('private');
const searchQuery = ref('');
const sortBy = ref('created');
const filterProvider = ref('');
const viewMode = ref('grid');
const loading = ref(false);
const submitting = ref(false);
const showCreateDialog = ref(false);
const showAutoConnectDialog = ref(false);
const editingAgent = ref(null);
const privateAgents = ref([]);
const publicAgents = ref([]);

// 自动接入相关
const autoConnecting = ref(false);
const loadingAgents = ref(false);
const availableAgentsForImport = ref([]);
const autoConnectForm = ref({
  serverUrl: '',
  token: '',
  selectedAgents: [],
  generateSkills: true
});

// 供应商信息
const providerInfo = {
  openai: { name: 'OpenAI', icon: '🟢' },
  anthropic: { name: 'Anthropic', icon: '🟠' },
  google: { name: 'Google', icon: '🔵' },
  alibaba: { name: '阿里云', icon: '🟣' },
  zhipu: { name: '智谱 AI', icon: '🔴' },
  deepseek: { name: 'DeepSeek', icon: '🟡' },
  baichuan: { name: '百川', icon: '⚪' },
  moonshot: { name: '月之暗面', icon: '🌙' },
  local: { name: '本地模型', icon: '💻' },
  custom: { name: '自定义', icon: '⚙️' }
};

function getProviderName(provider) {
  return providerInfo[provider]?.name || '其他';
}

function getProviderIcon(provider) {
  return providerInfo[provider]?.icon || '❓';
}

const filteredPrivateAgents = computed(() => {
  let result = filterAndSort(privateAgents.value);
  if (filterProvider.value) {
    result = result.filter(a => a.provider === filterProvider.value);
  }
  return result;
});

const filteredPublicAgents = computed(() => filterAndSort(publicAgents.value));

// 按供应商分组
const groupedAgents = computed(() => {
  const groups = {};
  filteredPrivateAgents.value.forEach(agent => {
    const provider = agent.provider || 'custom';
    if (!groups[provider]) {
      groups[provider] = {
        provider,
        agents: []
      };
    }
    groups[provider].agents.push(agent);
  });
  
  // 按供应商顺序排列
  const providerOrder = ['openai', 'anthropic', 'google', 'alibaba', 'zhipu', 'deepseek', 'baichuan', 'moonshot', 'local', 'custom'];
  return providerOrder
    .filter(p => groups[p])
    .map(p => groups[p])
    .concat(
      Object.keys(groups)
        .filter(p => !providerOrder.includes(p))
        .map(p => groups[p])
    );
});

function filterAndSort(agents) {
  let result = [...agents];
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(agent => 
      agent.name?.toLowerCase().includes(query) ||
      agent.nickname?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.capabilities?.some(cap => cap.toLowerCase().includes(query))
    );
  }
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'created': return (b.createdAt || 0) - (a.createdAt || 0);
      case 'used': return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      case 'chats': return (b.chatCount || 0) - (a.chatCount || 0);
      case 'popular': return (b.starCount || 0) - (a.starCount || 0);
      case 'name': return (a.name || '').localeCompare(b.name || '');
      default: return 0;
    }
  });
  return result;
}

async function loadAgents() {
  loading.value = true;
  try {
    const [privateRes, publicRes] = await Promise.all([
      api.get('/agents', { params: { type: 'private' } }),
      api.get('/agents', { params: { type: 'public' } })
    ]);
    if (privateRes.success) privateAgents.value = privateRes.agents || [];
    if (publicRes.success) publicAgents.value = publicRes.agents || [];
  } catch (error) {
    console.error('加载 Agent 列表失败:', error);
    ElMessage.error('加载失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

// 获取可导入的 Agent 列表
async function fetchAvailableAgents() {
  if (availableAgentsForImport.value.length > 0) return;
  
  loadingAgents.value = true;
  try {
    const res = await api.post('/agents/import/available', {
      serverUrl: autoConnectForm.value.serverUrl,
      token: autoConnectForm.value.token
    });
    if (res.success) {
      availableAgentsForImport.value = res.agents || [];
    }
  } catch (error) {
    console.error('获取可用 Agent 失败:', error);
  } finally {
    loadingAgents.value = false;
  }
}

// 处理自动接入
async function handleAutoConnect() {
  if (!autoConnectForm.value.selectedAgents.length) {
    ElMessage.warning('请选择要接入的 Agent');
    return;
  }

  autoConnecting.value = true;
  try {
    const res = await api.post('/agents/import', {
      serverUrl: autoConnectForm.value.serverUrl,
      token: autoConnectForm.value.token,
      agentIds: autoConnectForm.value.selectedAgents,
      generateSkills: autoConnectForm.value.generateSkills
    });
    
    if (res.success) {
      ElMessage.success(`成功接入 ${res.imported?.length || 0} 个 Agent`);
      showAutoConnectDialog.value = false;
      autoConnectForm.value.selectedAgents = [];
      loadAgents();
      
      // 如果生成了 skills，提示用户
      if (res.skillsGenerated?.length) {
        ElMessage.success(`已生成 ${res.skillsGenerated.length} 个 Skills 文件`);
      }
    } else {
      ElMessage.error(res.error || '接入失败');
    }
  } catch (error) {
    console.error('自动接入失败:', error);
    ElMessage.error('接入失败，请检查配置');
  } finally {
    autoConnecting.value = false;
  }
}

function goToDetail(agent) {
  router.push({ name: 'AgentDetail', params: { id: agent.id } });
}

function goToChat(agent) {
  router.push({ name: 'AgentChat', params: { id: agent.id } });
}

function editAgent(agent) {
  editingAgent.value = { ...agent };
  showCreateDialog.value = true;
}

async function deleteAgent(agent) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 Agent "${agent.name || agent.nickname}" 吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
    const res = await api.delete(`/agents/${agent.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadAgents();
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

async function duplicateAgent(agent) {
  try {
    const res = await api.post(`/agents/${agent.id}/duplicate`);
    if (res.success) {
      ElMessage.success('复制成功');
      loadAgents();
      if (res.agent) goToDetail(res.agent);
    } else {
      ElMessage.error(res.error || '复制失败');
    }
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败');
  }
}

async function handleSubmit(formData) {
  submitting.value = true;
  try {
    const res = editingAgent.value 
      ? await api.put(`/agents/${editingAgent.value.id}`, formData)
      : await api.post('/agents', formData);
    if (res.success) {
      ElMessage.success(editingAgent.value ? '保存成功' : '创建成功');
      showCreateDialog.value = false;
      editingAgent.value = null;
      loadAgents();
      if (res.agent) goToDetail(res.agent);
    } else {
      ElMessage.error(res.error || '操作失败');
    }
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('操作失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => loadAgents());
</script>

<style scoped>
.agents-page { 
  height: calc(100vh - 56px);
  padding: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.page-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}
.page-header h2 { 
  margin: 0; 
  font-size: 15px; 
  font-weight: 600;
  color: #303133; 
}
.header-actions {
  display: flex;
  gap: 8px;
}
.agents-tabs { 
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.agents-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  background: #fff;
}
.agents-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}
.agents-tabs :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tab-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 8px 16px;
  gap: 12px; 
  border-bottom: 1px solid #f5f5f5;
  background: #fafafa;
}
.filter-group {
  display: flex;
  gap: 8px;
  align-items: center;
}
.loading-container { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  padding: 60px 20px; 
  color: #909399; 
}
.loading-container p { margin-top: 12px; }
.empty-state { padding: 60px 20px; }
.agents-grid { 
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
  gap: 12px; 
}
.agents-grid.compact {
  padding: 8px 0;
  gap: 8px;
}

/* 分组视图样式 */
.agents-grouped {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.provider-group {
  margin-bottom: 24px;
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
}
.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}
.group-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.provider-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.provider-badge.openai { background: #10a37f20; }
.provider-badge.anthropic { background: #d9770620; }
.provider-badge.google { background: #4285f420; }
.provider-badge.alibaba { background: #ff6a0020; }
.provider-badge.zhipu { background: #e5393520; }
.provider-badge.deepseek { background: #fbbf2420; }
.provider-badge.local { background: #6366f120; }

/* 自动接入弹窗样式 */
.auto-connect-content {
  padding: 8px 0;
}
.auto-connect-form {
  margin-top: 20px;
}
.switch-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
.agent-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

@media (max-width: 768px) {
  .agents-page { padding: 0; }
  .page-header { padding: 12px; flex-wrap: wrap; gap: 8px; }
  .page-header h2 { font-size: 16px; }
  .header-actions { width: 100%; justify-content: flex-end; }
  .tab-header { flex-direction: column; align-items: stretch; padding: 12px; }
  .tab-header .el-input, .tab-header .el-select { max-width: 100% !important; width: 100% !important; }
  .filter-group { flex-wrap: wrap; width: 100%; }
  .agents-grid { grid-template-columns: 1fr; gap: 8px; padding: 12px; }
}
</style>
