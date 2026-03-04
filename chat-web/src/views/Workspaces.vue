<!--
  工作区管理页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="workspaces-page">
    <div class="page-header">
      <h2>工作区管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建工作区
      </el-button>
    </div>

    <!-- 筛选标签 -->
    <div class="filter-tabs">
      <el-radio-group v-model="typeFilter" @change="handleFilterChange">
        <el-radio-button label="">全部 ({{ workspaceStore.workspaces.length }})</el-radio-button>
        <el-radio-button label="group">群聊 ({{ workspaceStore.groupWorkspaces.length }})</el-radio-button>
        <el-radio-button label="dm">私聊 ({{ workspaceStore.dmWorkspaces.length }})</el-radio-button>
        <el-radio-button label="task">任务 ({{ workspaceStore.taskWorkspaces.length }})</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 工作区列表 -->
    <div class="workspace-list" v-loading="workspaceStore.loading">
      <WorkspaceCard
        v-for="workspace in filteredWorkspaces"
        :key="workspace.id"
        :workspace="workspace"
        @click="goToFiles(workspace.id)"
        @delete="handleDelete"
      />

      <el-empty v-if="filteredWorkspaces.length === 0 && !workspaceStore.loading" description="暂无工作区" />
    </div>

    <!-- 创建工作区对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建工作区" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="输入工作区名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="createForm.type" placeholder="选择类型">
            <el-option label="群聊工作区" value="group" />
            <el-option label="私聊工作区" value="dm" />
            <el-option label="任务工作区" value="task" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="输入描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useWorkspaceStore } from '@/stores/workspace';
import WorkspaceCard from '@/components/WorkspaceCard.vue';

const router = useRouter();
const workspaceStore = useWorkspaceStore();

const typeFilter = ref('');
const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  name: '',
  type: 'group',
  description: ''
});

const filteredWorkspaces = computed(() => {
  if (!typeFilter.value) {
    return workspaceStore.workspaces;
  }
  return workspaceStore.workspaces.filter(w => w.type === typeFilter.value);
});

onMounted(async () => {
  await workspaceStore.fetchWorkspaces();
});

function handleFilterChange() {
  // 筛选变化时的处理
}

function goToFiles(id) {
  router.push(`/workspaces/${id}/files`);
}

async function handleCreate() {
  if (!createForm.value.name) {
    ElMessage.warning('请输入工作区名称');
    return;
  }

  creating.value = true;
  try {
    const workspace = await workspaceStore.createWorkspace(createForm.value);
    if (workspace) {
      ElMessage.success('工作区创建成功');
      showCreateDialog.value = false;
      createForm.value = {
        name: '',
        type: 'group',
        description: ''
      };
    } else {
      ElMessage.error(workspaceStore.error || '创建失败');
    }
  } finally {
    creating.value = false;
  }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定要删除这个工作区吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const success = await workspaceStore.deleteWorkspace(id);
    if (success) {
      ElMessage.success('工作区已删除');
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.workspaces-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
}

.filter-tabs {
  margin-bottom: 20px;
}

.workspace-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  .workspaces-page {
    padding: 12px;
  }

  .workspace-list {
    grid-template-columns: 1fr;
  }
}
</style>
