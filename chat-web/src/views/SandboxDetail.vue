<!--
  沙箱详情页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="sandbox-detail-page">
    <div class="page-header">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/sandboxes' }">沙箱</el-breadcrumb-item>
        <el-breadcrumb-item>{{ sandboxStore.currentSandbox?.name || '加载中...' }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
        <el-button v-if="sandboxStore.currentSandbox?.status === 'stopped'" size="small" type="success" @click="handleStart">
          启动
        </el-button>
        <el-button v-if="sandboxStore.currentSandbox?.status === 'running'" size="small" type="warning" @click="handleStop">
          停止
        </el-button>
        <el-button v-if="sandboxStore.currentSandbox?.status === 'running'" size="small" @click="handleRestart">
          重启
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <!-- 终端 -->
      <el-tab-pane label="终端" name="terminal">
        <div class="terminal-panel">
          <div class="terminal-output" ref="terminalOutputRef">
            <div v-for="(item, index) in sandboxStore.terminalHistory" :key="index" class="terminal-line">
              <div class="terminal-command">$ {{ item.command }}</div>
              <div class="terminal-result">{{ item.output }}</div>
            </div>
          </div>
          <div class="terminal-input">
            <span class="terminal-prompt">$</span>
            <el-input
              v-model="command"
              placeholder="输入命令..."
              @keyup.enter="handleExecuteCommand"
              :disabled="sandboxStore.currentSandbox?.status !== 'running'"
            />
            <el-button type="primary" @click="handleExecuteCommand" :disabled="sandboxStore.currentSandbox?.status !== 'running'">
              执行
         </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 文件浏览 -->
      <el-tab-pane label="文件" name="files">
        <div class="files-panel">
          <div class="files-toolbar">
            <el-button size="small" @click="handleRefreshFiles">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
          <FileTree
            :data="sandboxStore.currentFiles"
            @node-click="handleFileClick"
          />
        </div>
      </el-tab-pane>

      <!-- 资源监控 -->
      <el-tab-pane label="资源监控" name="monitor">
        <ResourceMonitor
          :data="sandboxStore.resourceHistory"
          @period-change="handlePeriodChange"
        />
      </el-tab-pane>

      <!-- 进程管理 -->
      <el-tab-pane label="进程" name="processes">
        <div class="processes-panel">
          <el-table :data="sandboxStore.processes" style="width: 100%">
            <el-table-column prop="pid" label="PID" width="80" />
            <el-table-column prop="name" label="进程名" />
            <el-table-column prop="cpu" label="CPU" width="100">
              <template #default="{ row }">
                {{ row.cpu }}%
              </template>
            </el-table-column>
            <el-table-column prop="memory" label="内存" width="120">
              <template #default="{ row }">
                {{ (row.memory / 1024).toFixed(2) }} MB
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="handleKillProcess(row.pid)">
                  终止
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { useSandboxStore } from '@/stores/sandbox';
import FileTree from '@/components/FileTree.vue';
import ResourceMonitor from '@/components/ResourceMonitor.vue';

const route = useRoute();
const sandboxStore = useSandboxStore();

const activeTab = ref('terminal');
const command = ref('');
const terminalOutputRef = ref();
const sandboxId = ref(route.params.id);

const statusLabel = computed(() => {
  const labels = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    stopping: '停止中'
  };
  return labels[sandboxStore.currentSandbox?.status] || '未知';
});

const statusTagType = computed(() => {
  const types = {
    running: 'success',
    stopped: 'info',
    starting: 'warning',
    stopping: 'warning'
  };
  return types[sandboxStore.currentSandbox?.status] || 'info';
});

onMounted(async () => {
  await sandboxStore.fetchSandboxDetail(sandboxId.value);
  await sandboxStore.fetchTerminalHistory(sandboxId.value);
  await sandboxStore.fetchFiles(sandboxId.value);
  await sandboxStore.fetchProcesses(sandboxId.value);
  await sandboxStore.fetchResourceHistory(sandboxId.value);
  
  // 定时刷新资源使用情况
  setInterval(() => {
    if (sandboxStore.currentSandbox?.status === 'running') {
      sandboxStore.fetchResourceUsage(sandboxId.value);
      sandboxStore.fetchProcesses(sandboxId.value);
    }
  }, 5000);
});

watch(() => sandboxStore.terminalHistory, async () => {
  await nextTick();
  if (terminalOutputRef.value) {
    terminalOutputRef.value.scrollTop = terminalOutputRef.value.scrollHeight;
  }
}, { deep: true });

async function handleExecuteCommand() {
  if (!command.value.trim()) return;
  
  await sandboxStore.executeCommand(sandboxId.value, command.value);
  command.value = '';
}

async function handleStart() {
  const success = await sandboxStore.startSandbox(sandboxId.value);
  if (success) {
    ElMessage.success('沙箱已启动');
  } else {
    ElMessage.error('启动失败');
  }
}

async function handleStop() {
  const success = await sandboxStore.stopSandbox(sandboxId.value);
  if (success) {
    ElMessage.success('沙箱已停止');
  } else {
    ElMessage.error('停止失败');
  }
}

async function handleRestart() {
  const success = await sandboxStore.restartSandbox(sandboxId.value);
  if (success) {
    ElMessage.success('沙箱已重启');
  } else {
    ElMessage.error('重启失败');
  }
}

async function handleRefreshFiles() {
  await sandboxStore.fetchFiles(sandboxId.value);
  ElMessage.success('文件列表已刷新');
}

function handleFileClick(data) {
  // 处理文件点击
  console.log('File clicked:', data);
}

async function handlePeriodChange(period) {
  await sandboxStore.fetchResourceHistory(sandboxId.value, period);
}

async function handleKillProcess(pid) {
  try {
    await ElMessageBox.confirm('确定要终止这个进程吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const success = await sandboxStore.killProcess(sandboxId.value, pid);
    if (success) {
      ElMessage.success('进程已终止');
    } else {
      ElMessage.error('终止失败');
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.sandbox-detail-page {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  padding: 20px;
}

ader {
  display: flex;
  justify-content: space-between;
  align-i: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.detail-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.detail-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.terminal-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 16px;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: #d4d4d4;
  margin-bottom: 1;
}

.terminal-line {
  margin-bottom: 12px;
}

.terminal-command {
  color: #4ec9b0;
  margin-bottom: 4px;
}

.terminal-result {
  color: #d4d4d4;
  white-space: pre-wrap;
}

.terminal-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.terminal-prompt {
  color: #4ec9b0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
}

.terminal-input :deep(.el-input__wrapper) {
  background: #2d2d2d;
  box-shadow: none;
}

.terminal-input :deep(.el-input__inner) {
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.files-panel,
.processes-panel {
  height: 100%;
  overflow-y: auto;
}

.files-toolbar {
  margin-bottom: 12px;
}

@media (max-width: 768px) {
  .sandbox-detail-page {
    padding: 12px;
  }
}
</style>
