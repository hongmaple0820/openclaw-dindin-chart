<!--
  定时任务管理页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="scheduler-page">
    <div class="scheduler-container">
      <!-- 左侧：任务列表 -->
      <div class="scheduler-sidebar">
        <div class="sidebar-header">
          <h3>定时任务</h3>
          <el-button type="primary" :icon="Plus" circle @click="openCreateDialog" />
        </div>
        
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-value">{{ taskStats.total }}</div>
            <div class="stat-label">总任务</div>
          </div>
          <div class="stat-card enabled">
            <div class="stat-value">{{ taskStats.enabled }}</div>
            <div class="stat-label">已启用</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{{ taskStats.success }}</div>
            <div class="stat-label">成功</div>
          </div>
          <div class="stat-card failed">
            <div class="stat-value">{{ taskStats.failed }}</div>
            <div class="stat-label">失败</div>
          </div>
        </div>
        
        <div class="filter-bar">
          <el-radio-group v-model="filterStatus" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="enabled">已启用</el-radio-button>
            <el-radio-button value="disabled">已禁用</el-radio-button>
          </el-radio-group>
        </div>
        
        <div class="tasks-list" v-loading="loading">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            :class="['task-item', { active: currentTaskId === task.id }]"
            @click="selectTask(task)"
          >
            <div class="task-header">
              <span class="task-name">{{ task.name }}</span>
              <el-switch
                v-model="task.enabled"
                size="small"
                @change="handleToggleTask(task.id)"
                @click.stop
              />
            </div>
            <div class="task-meta">
              <el-tag :type="getTaskType(task.type).type" size="small">
                {{ getTaskType(task.type).label }}
              </el-tag>
              <span class="cron-text">{{ task.cron }}</span>
            </div>
          </div>
          
          <el-empty v-if="filteredTasks.length === 0 && !loading" description="暂无任务" :image-size="80">
            <el-button type="primary" @click="openCreateDialog">创建任务</el-button>
          </el-empty>
        </div>
      </div>
      
      <!-- 右侧：详情 -->
      <div class="scheduler-main">
        <div v-if="currentTask" class="task-detail">
          <div class="detail-header">
            <div class="header-left">
              <h2>{{ currentTask.name }}</h2>
              <el-tag :type="getTaskType(currentTask.type).type" size="small">
                {{ getTaskType(currentTask.type).label }}
              </el-tag>
            </div>
            <div class="header-right">
              <el-button :icon="VideoPlay" @click="handleRunNow">立即执行</el-button>
              <el-dropdown trigger="click" @command="handleCommand">
                <el-button :icon="More">更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" :icon="Edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" :icon="Delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          
          <div class="detail-content">
            <div class="info-section">
              <label>
                <el-icon><Clock /></el-icon>
                Cron 表达式
              </label>
              <div class="cron-display">
                <code>{{ currentTask.cron }}</code>
              </div>
            </div>
            
            <div class="info-section">
              <label>
                <el-icon><Setting /></el-icon>
                任务配置
              </label>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="任务类型">
                  {{ getTaskType(currentTask.type).label }}
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="currentTask.enabled ? 'success' : 'info'" size="small">
                    {{ currentTask.enabled ? '已启用' : '已禁用' }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">
                  {{ formatDateTime(currentTask.createdAt) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
            
            <div class="info-section">
              <label>
                <el-icon><Document /></el-icon>
                配置详情
              </label>
              <pre class="config-display">{{ JSON.stringify(currentTask.config, null, 2) }}</pre>
            </div>
          </div>
        </div>
        
        <div v-else class="empty-state">
          <el-empty description="选择一个任务查看详情" :image-size="120" />
        </div>
      </div>
    </div>
    
    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTask ? '编辑任务' : '创建任务'"
      width="600px"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入任务名称" />
        </el-form-item>
        
        <el-form-item label="任务类型" prop="type">
          <el-select v-model="form.type" placeholder="选择任务类型" style="width: 100%">
            <el-option label="发送消息" value="message" />
            <el-option label="执行命令" value="command" />
            <el-option label="提醒" value="reminder" />
            <el-option label="Webhook" value="webhook" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Cron 表达式" prop="cron">
          <el-input v-model="form.cron" placeholder="例如: 0 9 * * *" />
        </el-form-item>
        
        <el-form-item label="任务配置" prop="config">
          <el-input
            v-model="configText"
            type="textarea"
            :rows="4"
            placeholder='{"target": "...", "message": "..."}'
          />
        </el-form-item>
        
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ editingTask ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Clock, Setting, Document, VideoPlay, More, Edit, Delete
} from '@element-plus/icons-vue';
import api from '@/api';

const loading = ref(false);
const tasks = ref([]);
const currentTaskId = ref(null);
const showCreateDialog = ref(false);
const editingTask = ref(null);
const submitting = ref(false);
const formRef = ref(null);
const filterStatus = ref('all');
const configText = ref('{}');

const form = ref({
  name: '',
  type: 'message',
  cron: '',
  config: {},
  enabled: true
});

const formRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择任务类型', trigger: 'change' }],
  cron: [{ required: true, message: '请输入 Cron 表达式', trigger: 'blur' }]
};

const taskStats = computed(() => {
  const total = tasks.value.length;
  const enabled = tasks.value.filter(t => t.enabled).length;
  return { total, enabled, success: 0, failed: 0 };
});

const filteredTasks = computed(() => {
  if (filterStatus.value === 'all') return tasks.value;
  if (filterStatus.value === 'enabled') return tasks.value.filter(t => t.enabled);
  return tasks.value.filter(t => !t.enabled);
});

const currentTask = computed(() => tasks.value.find(t => t.id === currentTaskId.value));

function getTaskType(type) {
  const types = {
    message: { label: '发送消息', type: 'primary' },
    command: { label: '执行命令', type: 'success' },
    reminder: { label: '提醒', type: 'warning' },
    webhook: { label: 'Webhook', type: 'info' }
  };
  return types[type] || { label: type, type: 'info' };
}

async function loadTasks() {
  loading.value = true;
  try {
    const res = await api.get('/scheduler/tasks');
    if (res.success) tasks.value = res.tasks || [];
  } catch (e) {
    console.error('加载任务失败:', e);
  } finally {
    loading.value = false;
  }
}

function selectTask(task) {
  currentTaskId.value = task.id;
}

async function handleToggleTask(taskId) {
  try {
    await api.patch(`/scheduler/tasks/${taskId}/toggle`);
    ElMessage.success('状态已更新');
  } catch (e) {
    ElMessage.error('操作失败');
  }
}

async function handleRunNow() {
  if (!currentTaskId.value) return;
  try {
    await api.post(`/scheduler/tasks/${currentTaskId.value}/run`);
    ElMessage.success('任务已开始执行');
  } catch (e) {
    ElMessage.error('执行失败');
  }
}

async function handleCommand(cmd) {
  if (cmd === 'edit') {
    editingTask.value = currentTask.value;
    form.value = { ...currentTask.value };
    configText.value = JSON.stringify(currentTask.value.config || {}, null, 2);
    showCreateDialog.value = true;
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm('确定要删除这个任务吗？', '删除确认', { type: 'warning' });
      await api.delete(`/scheduler/tasks/${currentTaskId.value}`);
      ElMessage.success('任务已删除');
      currentTaskId.value = null;
      loadTasks();
    } catch {}
  }
}

function openCreateDialog() {
  editingTask.value = null;
  form.value = { name: '', type: 'message', cron: '', config: {}, enabled: true };
  configText.value = '{}';
  showCreateDialog.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    form.value.config = JSON.parse(configText.value || '{}');
    
    submitting.value = true;
    const res = editingTask.value
      ? await api.put(`/scheduler/tasks/${editingTask.value.id}`, form.value)
      : await api.post('/scheduler/tasks', form.value);
    
    if (res.success) {
      ElMessage.success(editingTask.value ? '已更新' : '已创建');
      showCreateDialog.value = false;
      loadTasks();
    }
  } catch (e) {
    if (e !== false) ElMessage.error('操作失败');
  } finally {
    submitting.value = false;
  }
}

function formatDateTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

onMounted(loadTasks);
</script>

<style scoped>
.scheduler-page { height: calc(100vh - 120px); padding: 20px; }
.scheduler-container { display: flex; height: 100%; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.scheduler-sidebar { width: 360px; border-right: 1px solid #f0f0f0; display: flex; flex-direction: column; background: #fafafa; }
.sidebar-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; background: white; }
.sidebar-header h3 { margin: 0; font-size: 18px; }
.stats-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; background: white; border-bottom: 1px solid #f0f0f0; }
.stat-card { padding: 12px; background: #f5f7fa; border-radius: 8px; text-align: center; }
.stat-card.enabled { background: #e1f3d8; }
.stat-card.success { background: #d9ecff; }
.stat-card.failed { background: #fde2e2; }
.stat-value { font-size: 24px; font-weight: 600; color: #303133; }
.stat-label { font-size: 12px; color: #909399; margin-top: 4px; }
.filter-bar { padding: 12px 16px; background: white; border-bottom: 1px solid #f0f0f0; }
.tasks-list { flex: 1; overflow-y: auto; padding: 8px; }
.task-item { padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
.task-item:hover { border-color: #409eff; }
.task-item.active { border-color: #409eff; background: #ecf5ff; }
.task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.task-name { font-size: 14px; font-weight: 500; }
.task-meta { display: flex; align-items: center; gap: 8px; }
.cron-text { font-size: 12px; font-family: monospace; color: #606266; }
.scheduler-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.task-detail { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h2 { margin: 0; font-size: 20px; }
.header-right { display: flex; gap: 8px; }
.detail-content { flex: 1; overflow-y: auto; padding: 20px; }
.info-section { margin-bottom: 24px; }
.info-section label { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 12px; }
.cron-display { padding: 12px; background: #f5f7fa; border-radius: 6px; }
.cron-display code { font-size: 16px; font-family: monospace; color: #409eff; }
.config-display { padding: 12px; background: #f5f7fa; border-radius: 6px; font-size: 13px; font-family: monospace; overflow-x: auto; }
.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; }
@media (max-width: 768px) {
  .scheduler-container { flex-direction: column; }
  .scheduler-sidebar { width: 100%; height: 50%; border-right: none; border-bottom: 1px solid #f0f0f0; }
}
</style>