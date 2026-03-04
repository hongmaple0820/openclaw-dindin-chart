<!--
  Agent 管理主页面
  @author 小琳
  @date 2026-03-04
  功能：Agent 列表（公开/私有 Tab）、添加按钮、Agent 卡片网格
-->
<template>
  <div class="agents-page">
    <div class="page-header">
      <h2>Agent 管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建 Agent
      </el-button>
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
          <el-select v-model="sortBy" placeholder="排序" style="width: 150px">
            <el-option label="最近创建" value="created" />
            <el-option label="最近使用" value="used" />
            <el-option label="对话最多" value="chats" />
            <el-option label="名称" value="name" />
          </el-select>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Loading } from '@element-plus/icons-vue';
import AgentCard from '@/components/AgentCard.vue';
import AgentConfig from '@/components/AgentConfig.vue';
import api from '@/api';

const router = useRouter();

const activeTab = ref('private');
const searchQuery = ref('');
const sortBy = ref('created');
const loading = ref(false);
const submitting = ref(false);
const showCreateDialog = ref(false);
const editingAgent = ref(null);
const privateAgents = ref([]);
const publicAgents = ref([]);

const filteredPrivateAgents = computed(() => filterAndSort(privateAgents.value));
const filteredPublicAgents = computed(() => filterAndSort(publicAgents.value));

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
    if (resss) {
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
.agents-page { padding: 20px; max-width: 1400px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { margin: 0; font-size: 24px; color: #303133; }
.agents-tabs { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 12px; }
.loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #909399; }
.loading-container p { margin-top: 12px; }
.empty-state { padding: 60px 20px; }
.agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
@media (max-width: 768px) {
  .agents-page { padding: 12px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .page-header h2 { font-size: 20px; }
  .tab-header { flex-direction: column; align-items: stretch; }
  .tab-header .el-input, .tab-header .el-select { max-width: 100% !important; width: 100% !important; }
  .agents-grid { grid-template-columns: 1fr; gap: 12px; }
}
</style>
