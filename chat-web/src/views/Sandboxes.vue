<!--
  沙箱管理页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="sandboxes-page">
    <div class="page-header">
      <h2>沙箱管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        创建沙箱
      </el-button>
    </div>

    <!-- 资源总览 -->
    <div class="resource-overview">
      <el-card>
        <template #header>
          <span>资源使用总览</span>
        </template>
        <div class="resource-stats">
          <div class="stat-item">
            <div class="stat-label">运行中</div>
            <div class="stat-value">{{ sandboxStore.activeSandboxes.length }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">已停止</div>
            <div class="stat-value">{{ sandboxStore.stoppedSandboxes.length }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">CPU 使用</div>
            <div class="stat-value">{{ sandboxStore.totalResources.cpu.toFixed(1) }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">内存使用</div>
            <div class="stat-value">{{ (sandboxStore.totalResources.memory / 1024).toFixed(1) }} GB</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 沙箱列表 -->
    <div class="sandbox-list" v-loading="sandboxStore.loading">
      <SandboxCard
        v-for="sandbox in sandboxStore.sandboxes"
        :key="sandbox.id"
        :sandbox="sandbox"
        @click="goToDetail(sandbox.id)"
        @start="handleStart"
        @stop="handleStop"
        @restart="handleRestart"
        @delete="handleDelete"
      />

      <el-empty v-if="sandboxStore.sandboxes.length === 0 && !sandboxStore.loadinion="暂无沙箱" />
    </div>

    <!-- 创建沙箱对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建沙箱" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="输入沙箱名称" />
        </el-form-item>
        <el-form-item label="镜像">
          <el-select v-model="createForm.image" placeholder="选择镜像">
            <el-option label="Node.js 20" value="node:20" />
            <el-option label="Python 3.11" value="python:3.11" />
            <el-option label="Ubuntu 22.04" value="ubuntu:22.04" />
          </el-select>
        </el-form-item>
        <el-form-item label="CPU 限制">
          <el-input-number v-model="createForm.cpuLimit" :min="1" :max="8" />
          <span style="margin-left: 8px;">核</span>
        </el-form-item>
        <el-form-item label="内存限制">
          <el-input-number v-model="createForm.memoryLimit" :min="512" :max="16384" :step="512" />
          <span style="margin-left: 8px;">MB</span>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useSandboxStore } from '@/stores/sandbox';
import SandboxCard from '@/components/SandboxCard.vue';

const router = useRouter();
const sandboxStore = useSandboxSt
const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  name: '',
  image: 'node:20',
  cpuLimit: 2,
  memoryLimit: 2048
});

onMounted(async () => {
  await sandboxStore.fetchSandboxes();
});

function goToDetail(id) {
  router.push(`/sandboxes/${id}`);
}

async function handleCreate() {
  if (!createForm.value.name) {
    ElMessage.warning('请输入沙箱名称');
    return;
  }

  creating.value = true;
  try {
    const sandbox = await sandboxStore.createSandbox(createForm.value);
    if (sandbox) {
      ElMessage.success('沙箱创建成功');
      showCreateDialog.value = false;
      createForm.value = {
        name: '',
        image: 'node:20',
        cpuLimit: 2,
        memoryLimit: 2048
      };
    } else {
      ElMessage.error(sandboxStore.error || '创建失败');
    }
  } finally {
    creating.value = false;
  }
}

async function handleStart(id) {
  const success = await sandboxStore.startSandbox(id);
  if (success) {
    ElMessage.success('沙箱已启动');
  } else {
    ElMessage.error('启动失败');
  }
}

async function handleStop(id) {
  const success = await sandboxStore.stopSandbox(id);
  if (success) {
    ElMessage.success('沙箱已停止');
  } else {
    ElMessage.error('停止失败');
  }
}

async function handleRestart(id) {
  const success = await sandboxStore.restartSandbox(id);
  if (success) {
    ElMessage.success('沙箱已重启');
  } else {
    ElMessage.error('重启失败');
  }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定要删除这个沙箱吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const success = await sandboxStore.deleteSandbox(id);
    if (success) {
      ElMessage.success('沙箱已删除');
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.sandboxes-page {
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

.resource-overview {
  margin-bottom: 20px;
}

.resource-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
}

.sandbox-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  .sandboxes-page {
    padding: 12px;
  }

  .sandbox-list {
    grid-template-columns: 1fr;
 /style>
