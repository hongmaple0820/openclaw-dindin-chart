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
        <!-- 头部 -->
        <div class="sidebar-header">
          <h3>定时任务</h3>
          <el-button type="primary" :icon="Plus" circle @click="showCreateDialog = true" />
        </div>
        
        <!-- 统计卡片 -->
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-value">{{ schedulerStore.taskStats.total }}</div>
            <div class="stat-label">总任务</div>
          </div>
          <div class="stat-card enabled">
            <div class="stat-value">{{ schedulerStore.taskStats.enabled }}</div>
            <div class="stat-label">已启用</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{{ schedulerStore.taskStats.success }}</div>
            <div class="stat-label">成功</div>
          </div>
          <div class="stat-card failed">
            <div class="stat-value">{{ schedulerStore.taskStats.failed }}</div>
            <div class="stat-label">失败</div>
          </div>
        </div>
        
        <!-- 筛选 -->
        <div class="filter-bar">
          <el-radio-group v-model="filterStatus" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="enabled">已启用</el-radio-button>
            <el-radio-button value="disabled">已禁用</el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 任务列表 -->
        <div class="tasks-list" v-loading="schedulerStore.loading">
          <template v-if="filteredTasks.length > 0">
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
                <el-tag :type="taskTypeMap[task.type]?.type" size="small">
                  {{ taskTypeMap[task.type]?.label }}
                </el-tag>
                <span class="cron-text">{{ task.cron }}</span>
              </div>
              <div class="task-status">
                <span v-if="task.lastRunAt" class="last-run">
                  上次: {{ formatTime(task.lastRunAt) }}
                </span>
                <el-tag
                  v-if="task.lastStatus"
      :type="statusTypeMap[task.lastStatus]"
                  size="small"
                >
                  {{ task.lastStatus }}
                </el-tag>
              </div>
            </div>
          </template>
          
          <el-empty
            v-else-if="!schedulerStore.loading"
            description="暂无定时任务"
            :image-size="80"
          >
            <el-button type="primary" @click="showCreateDialog = true">创建任务</el-button>
          </el-empty>
        </div>
      </div>
      
      <!-- 右侧：任务详情 -->
      <div class="scheduler-main">
        <div v-if="currentTask" class="task-detail">
          <!-- 详情头部 -->
          <div class="detail-header">
            <div class="header-left">
              <h2>{{ currentTask.name }}</h2>
              <el-tag :type="taskTypeMap[currentTask.type]?.type" size="small">
                {{ taskTypeMap[currentTask.type]?.label }}
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
          
          <!-- 详情内容 -->
          <div class="detail-content">
            <!-- Cron 配置 -->
            <div class="info-section">
              <label>
                <el-icon><Clock /></el-icon>
                Cron 表达式
              </label>
              <div class="cron-display">
                <code>{{ currentTask.cron }}</code>
                <el-button text :icon="Refresh" @click="loadNextRuns">刷新</el-button>
              </div>
              <div v-if="nextRuns.length > 0" class="next-runs">
                <div class="next-runs-title">下次执行时间：</div>
                <div v-for="(run, index) in nextRuns" :key="index" class="next-run-item">
                  {{ formatDateTime(run) }}
                </div>
              </div>
            </div>
            
            <!-- 任务配置 -->
            <div class="info-section">
              <label>
                <el-icon><Setting /></el-icon>
                任务配置
              </label>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="任务类型">
                  {{ taskTypeMap[currentTask.type]?.label }}
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="currentTask.enabled ? 'success' : 'info'" size="small">
                    {{ currentTask.enabled ? '已启用' : '已禁用' }}
                  </el-tag>
       el-descriptions-item>
                <el-descriptions-item label="创建时间">
                  {{ formatDateTime(currentTask.createdAt) }}
                </el-descriptions-item>
                <el-descriptions-item label="更新时间">
                  {{ formatDateTime(currentTask.updatedAt) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
            
            <!-- 配置详情 -->
            <div class="info-section">
              <label>
                <el-icon><Document /></el-icon>
                配置详情
              </label>
              <pre class="config-display">{{ JSON.stringify(currentTask.config, null, 2) }}</pre>
            </div>
            
            <!-- 执行历史 -->
            <div class="info-section">
              <label>
                <el-icon><List /></el-icon>
                执行历史
              </label>
              <el-table :data="currentTask.history" stripe style="width: 100%">
                <el-table-column prop="startedAt" label="执行时间" width="180">
                  <template #default="{ row }">
                    {{ formatDateTime(row.startedAt) }}
                  </template>
                </el-table-column>
                <el-table-column prop="bel="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="statusTypeMap[row.status]" size="small">
                      {{ row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="duration" label="耗时" width="100">
                  <template #default="{ row }">
                    {{ row.duration ? `${row.duration}ms` : '-' }}
                  </template>
                </el-table-column>
                <el-table-colesult" label="结果" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.result || row.error || '-' }}
                  </template>
                </el-table-column>
              </el-table>
              
              <el-empty
                v-if="!currentTask.history?.length"
                description="暂无执行历史"
                :image-size="60"
              />
            </div>
          </div>
        </div>
        
        <div v-else class="empty-state">
          <el-empty description="选择一个 :image-size="120" />
        </div>
      </div>
    </div>
    
    <!-- 创建/编辑任务对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTask ? '编辑任务' : '创建任务'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入任务名称" maxlength="50" />
        </el-form-item>
        
        <el-form-item label="任务类型" prop="type">
          <elmodel="form.type" placeholder="选择任务类型" style="width: 100%">
            <el-option label="发送消息" value="message" />
            <el-option label="执行命令" value="command" />
            <el-option label="提醒" value="reminder" />
            <el-option label="Webhook" value="webhook" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Cron 表达式" prop="cron">
          <el-input v-model="form.cron" placeholder="例如: 0 9 * * *">
            <template #append>
              <el-button @click="showCronHelper = true">辅助工具</el-button>
            </template>
          </eput>
          <div class="form-tip">
            <el-text size="small" type="info">
              格式: 分 时 日 月 周 (例如: 0 9 * * * 表示每天9点)
            </el-text>
          </div>
        </el-form-item>
        
        <el-form-item label="任务配置" prop="config">
          <el-input
            v-model="configText"
            type="textarea"
            :rows="6"
            placeholder='{"target": "...", "message": "..."}'
          />
          <div class="form-tip">
            <el-text size="small" type="info">JSON 格式配置</el-text>
          </div>
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
    
    <!-- Cron 辅助工具 -->
    <el-dialog v-model="showCronHelper" title="Cron 表达式辅助" width="500px">
      <div class="cron-helper">
        <el-form label-width="80px">
          <el-form-item label="分钟">
            <el-input v-model="cronHelper.minute" placeholder="0-59 或 *" />
          </el-form-item>
          <el-form-item label="小时">
            <el-input v-model="cronHelper.hour" placeholder="0-23 或 *" />
          </el-form-item>
          <el-form-item label="日">
            <el-input v-model="cronHelper.day" placeholder="1-31 或 *" />
          </el-form-item>
          <el-form-item label="月">
            <el-input v-model="cronHelper.month" placeholder="1-12 或 *" />
          </el-form-item>
          <el-form-item label="周">
            <el-input v-model="cronHelper.week" placeholder="0-6 或 *" />
          </el-form-item>
        </el-form>
        
        <div class="cron-result">
          <label>生成的表达式：</label>
          <code>{{ generatedCron }}</code>
        </div>
        
        <div class="cron-examples">
          <div class="example-title">常用示例：</div>
          <div
            v-for="example in cronExamples"
            :key="example.cron"
            class="example-item"
            @click="applyCronExample(example.cron)"
          >
            <code>{{ example.cron }}</code>
            <span>{{ example.desc }}</span>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showCronHelper = false">取消</el-button>
        <el-button type="primary" @click="applyGeneratedCron">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Clock, Refresh, Setting, Document, List, VideoPlay,
  More, Edit, Delete
} from '@element-plus/icons-vue';
import { useSchedulerStore } from '@/stores/scheduler';

const schedulerStore = useSchedulerStore();

const filterStatus = ref('all');
const currentTaskId = ref(null);
const showCreateDialog = ref(false);
const showCronHelper = ref(false);
const editingTask = ref(null);
const submitting = ref(false);
const formRef = ref(null);
const configText = ref('{}');
const nextRuns = ref([]);

const form = ref({
  name: '',
  type: 'message',
  cron: '',
  config: {},
  enabled: true
});

const formRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择任务类型', trigger: 'change' }]n  cron: [{ required: true, message: '请输入 Cron 表达式', trigger: 'blur' }]
};

const cronHelper = ref({
  minute: '*',
  hour: '*',
  day: '*',
  month: '*',
  week: '*'
});

const cronExamples = [
  { cron: '0 9 * * *', desc: '每天 9:00' },
  { cron: '0 */2 * * *', desc: '每 2 小时' },
  { cron: '0 9 * * 1', desc: '每周一 9:00' },
  { cron: '0 9 1 * *', desc: '每月 1 号 9:00' },
  { cron: '*/30 * * * *', desc: '每 30 分钟' }
];

const taskTypeMap = {
  message: { label: '发送消息', type: 'primary' },
  command: { label: '执行命令', type: 'success' },
  reminder: { label: '提醒', type: 'warning' },
  webhook: { label: 'Webhook', type: 'info' }
};

const statusTypeMap = {
  success: 'success',
  failed: 'danger',
  running: 'primary'
};

const filteredTasks = computed(() => {
  if (filterStatus.value === 'all') {
    return schedulerStore.tasks;
  } else if (filterStatus.value === 'enabled') {
    return schedulerStore.enabledTasks;
  } else {
    return schedulerStore.disabledTasks;
  }
});

const currentTask = computed(() => schedulerStore.currentTask);

const generatedCron = computed(() => {
  const { minute, hour, day, month, week } = cronHelper.value;
  return `${minute} ${hour} ${day} ${month} ${week}`;
});

function selectTask(tasurrentTaskId.value = task.id;
  schedulerStore.fetchTaskDetail(task.id);
  loadNextRuns();
}

async function loadNextRuns() {
  if (!currentTask.value) return;
  const runs = await schedulerStore.getNextRuns(currentTask.value.cron, 5);
  nextRuns.value = runs;
}

async function handleToggleTask(taskId) {
  const success = await schedulerStore.toggleTask(taskId);
  if (success) {
    ElMessage.success('状态已更新');
  }
}

async function handleRunNow() {
  if (!currentTaskId.value) return;
  
  const success = await schedulerStore.runNow(currentTaskId.value);
  if (sus) {
    ElMessage.success('任务已开始执行');
    setTime(() => {
      schedulerStore.fetchTaskDetail(currentTaskId.value);
    }, 1000);
  }
}

async function handleCommand(command) {
  if (command === 'edit') {
    editingTask.value = currentTask.value;
    form.value = {
      name: currentTask.value.name,
      type: currentTask.value.type,
      cron: currentTask.value.cron,
      config: currentTask.value.config,
      enabled: currentTask.value.enabled
    };
    configText.value = JSON.stringify(currentTask.value.config, null, 2);
    showCreateDialog.value = true;
  } else if (command === 'delete') {
    try {
      await ElMessageBox.confirm('确定要删除这个定时任务吗？', '删除任务', {
        type: 'warning'
      });
      
      const success = await schedulerStore.deleteTask(currentTaskId.value);
      if (success) {
        ElMessage.success('任务已删除');
        currentTaskId.value = null;
      }
    } catch {
      // 取消删除
    }
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  
  // 验证 JSON 配置
  try {
    form.value.config = JSON.parse(configText.value);
  } catch (e) {
    ElMessage.error('配置格式错误，请输入有效的 JSON');
    return;
  }
  ron 表达式
  const isValid = await schedulerStore.validateCron(form.value.cron);
  if (!isValid) {
    ElMessage.error('Cron 表达式格式错误');
    return;
  }
  
  submitting.value = true;
  try {
    let success;
    if (editingTask.value) {
      success = await schedulerStore.updateTask(editingTask.value.id, form.value);
    } else {
      const task = await schedulerStore.createTask(form.value);
      success = !!task;
    }
    
    if (success) {
      ElMessage.success(editingTask.value ? '任务已更新' : '任务已创建');
      showCreateDialog.value = false;
      resetForm();
    }
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.value = {
    name: '',
    type: 'message',
    cron: '',
    config: {},
    enabled: true
  };
  configText.value = '{}';
  editingTask.value = null;
  formRef.value?.resetFields();
}

function applyCronExample(cron) {
  form.value.cron = cron;
  showCronHelper.value = false;
}

function applyGeneratedCron() {
  form.value.cron = generatedCron.value;
  showCronHelper.value = false;
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  schedulerStore.fetchTasks();
});

watch(showCreateDialog, (val) => {
  if (!val) {
    resetForm();
  }
});
>

<style scoped>
.scheduler-page {
  height: calc(100vh - 120px);
  padding: 20px;
}

.scheduler-container {
  display: flex;
  height: 100%;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.08);
}

.scheduler-sidebar {
  width: 360px;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.sidebar-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0;
  background: white;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2C3E50;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.stat-card {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.stat-card.enabled {
  background: #e1f3d8;
}

.stat-card.success {
  background: #d9ecff;
}

.stat-card.failed {
  background: #fde2e2;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  colo;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.filter-bar {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.task-item {
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.task-item:hover {
  border-color: #C41E3A;
  box-shadow: 0 2px 8px rgba(196, 30, 58, 0.1);
}

.task-item.active {
  border-color: #C  background: #fef0f2;
}

.task-r {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cron-text {
  font-size: 12px;
  font-family: monospace;
  color: #606266;
}

.task-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.last-run {
  color: #909399;
}

.scheduler-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.header-right {
  display: flex;
  gap: 8px;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.info-section {
  margin-bottom: 24px;
}

.info-section label {
  display: flex;
  align-items: center;
  gap: 6px;
nt-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
}

.cron-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.cron-display code {
  flex: 1;
  font-size: 16px;
  font-family: monospace;
  color: #409eff;
}

.next-runs {
  padding: 12px;
  background: #ecf5ff;
  border-radius: 6px;
}

.next-runs-title {
  font-size: 13px;
  font-weight: 500;
  color: #409eff;
  margin-bottom: 8px;
}

.next-run-item {
  font-size: 13px;
  color: #606266;
  padding: 4px 0;
}

.config-display {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  color: #606266;
  overflow-x: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-tip {
  margin-top: 4px;
}

.cron-helper {
  padding: 12px 0;
}

.cron-result {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin: 16px 0;
}

.cron-result label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.cron-result code {
  font-size: 16px;
  color: #409eff;
}

.cron-examples {
  margin-top: 16px;
}

.example-title {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.example-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-item:hover {
  background: #e1f3d8;
}

.example-item code {
  font-size: 13px;
  color: #409eff;
}

.example-item span {
  font-size: 12px;
  color: #909399;
}

@media (max-width: 768px) {
  .scheduler-page {
    padding: 12px;
  }
  
  .scheduler-container {
    flex-direction: column;
  }
  
  .scheduler-sidebar {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .scheduler-main {
    height: 50%;
  }
  
  .stats-cards {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
}
</style>
