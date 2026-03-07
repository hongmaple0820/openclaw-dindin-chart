<!--
  项目群任务看板页面
  @author 小琳
  @date 2026-03-03
  @update 移除优先级筛选，添加底部快速添加任务输入框
-->
<template>
  <div class="project-tasks">
    <!-- 工具栏 -->
    <div class="tasks-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchQuery"
          placeholder="搜索任务"
          :prefix-icon="Search"
          clearable
          style="width: 200px"
        />
        <el-select v-model="statusFilter" placeholder="状态" clearable size="small" style="width: 120px">
          <el-option label="待处理" value="pending" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="showCreateTask = true">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </div>

    <!-- 看板 -->
    <div class="tasks-board" v-loading="loading">
      <div
        v-for="board in boards"
        :key="board.id"
        class="board-column"
        @dragover.prevent
        @drop="handleDrop($event, board.id)"
      >
        <div class="column-header" :style="{ borderTopColor: board.color || '#409eff' }">
          <div class="header-left">
            <span class="column-dot" :style="{ background: board.color || '#409eff' }"></span>
            <h4>{{ board.name }}</h4>
          </div>
          <span class="task-count">{{ getTasksByBoard(board.id).length }}</span>
        </div>
        <div class="column-content">
          <TaskCard
            v-for="task in getTasksByBoard(board.id)"
            :key="task.id"
            :task="task"
            draggable="true"
            @dragstart="handleDragStart($event, task)"
            @click="openTaskDetail(task)"
          />
        </div>
      </div>
    </div>

    <!-- 底部快速添加任务 -->
    <div class="quick-add-task">
      <el-input
        v-model="quickTaskTitle"
        placeholder="输入任务标题，按 Enter 快速创建..."
        @keyup.enter="handleQuickAddTask"
        clearable
      >
        <template #prepend>
          <el-select v-model="quickTaskBoard" style="width: 120px" size="small">
            <el-option
              v-for="board in boards"
              :key="board.id"
              :label="board.name"
              :value="board.id"
            />
          </el-select>
        </template>
        <template #append>
          <el-button type="primary" @click="handleQuickAddTask" :loading="quickAdding">
            添加
          </el-button>
        </template>
      </el-input>
    </div>

    <!-- 创建任务弹窗 -->
    <CreateTask
      v-model="showCreateTask"
      :project-id="projectId"
      :boards="boards"
      :members="members"
      @created="handleTaskCreated"
    />

    <!-- 任务详情抽屉 -->
    <el-drawer v-model="showTaskDetail" title="任务详情" size="450px">
      <TaskDetail
        v-if="currentTask"
        :task-id="currentTask.id"
        @close="showTaskDetail = false"
        @updated="handleTaskUpdated"
        @deleted="handleTaskDeleted"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/projects';
import TaskCard from '@/components/TaskCard.vue';
import CreateTask from '@/components/CreateTask.vue';
import TaskDetail from './TaskDetail.vue';

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  }
});

const projectStore = useProjectStore();

const searchQuery = ref('');
const statusFilter = ref('');
const showCreateTask = ref(false);
const showTaskDetail = ref(false);
const currentTask = ref(null);
const draggedTask = ref(null);

// 快速添加任务相关
const quickTaskTitle = ref('');
const quickTaskBoard = ref('');
const quickAdding = ref(false);

const boards = computed(() => projectStore.currentBoards);
const tasks = computed(() => projectStore.currentTasks);
const members = computed(() => projectStore.currentMembers);
const loading = computed(() => projectStore.loading);

function getTasksByBoard(boardId) {
  let result = tasks.value.filter(t => t.boardId === boardId);
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(query));
  }
  
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value);
  }
  
  return result;
}

function openTaskDetail(task) {
  currentTask.value = task;
  showTaskDetail.value = true;
}

function handleTaskCreated() {
  showCreateTask.value = false;
}

function handleTaskUpdated() {
  // 刷新任务列表
  projectStore.fetchTasks(props.projectId);
}

function handleTaskDeleted() {
  showTaskDetail.value = false;
  currentTask.value = null;
  projectStore.fetchTasks(props.projectId);
}

async function handleDragStart(event, task) {
  draggedTask.value = task;
  event.dataTransfer.effectAllowed = 'move';
}

async function handleDrop(event, boardId) {
  if (!draggedTask.value) return;
  
  const task = draggedTask.value;
  if (task.boardId === boardId) {
    draggedTask.value = null;
    return;
  }
  
  const success = await projectStore.updateTask(props.projectId, task.id, { boardId });
  if (success) {
    ElMessage.success('任务已移动');
  }
  draggedTask.value = null;
}

// 快速添加任务
async function handleQuickAddTask() {
  if (!quickTaskTitle.value.trim()) {
    ElMessage.warning('请输入任务标题');
    return;
  }
  
  if (!quickTaskBoard.value && boards.value.length > 0) {
    quickTaskBoard.value = boards.value[0].id;
  }
  
  quickAdding.value = true;
  
  try {
    const task = await projectStore.createTask(props.projectId, {
      title: quickTaskTitle.value.trim(),
      boardId: quickTaskBoard.value
    });
    
    if (task) {
      ElMessage.success('任务创建成功');
      quickTaskTitle.value = '';
    }
  } finally {
    quickAdding.value = false;
  }
}

async function loadData() {
  await Promise.all([
    projectStore.fetchBoards(props.projectId),
    projectStore.fetchTasks(props.projectId),
    projectStore.fetchMembers(props.projectId)
  ]);
  
  // 设置默认看板
  if (boards.value.length > 0 && !quickTaskBoard.value) {
    quickTaskBoard.value = boards.value[0].id;
  }
}

watch(() => props.projectId, loadData, { immediate: true });
</script>

<style scoped>
.project-tasks {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--fenlin-bg, #f5f7fa);
}

.tasks-toolbar {
  padding: 12px 16px;
  background: var(--fenlin-surface, #fff);
  border-bottom: 1px solid var(--fenlin-border, #e4e7ed);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.tasks-board {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  overflow-y: auto;
}

.board-column {
  flex: 0 0 280px;
  background: var(--fenlin-surface, #fff);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.column-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 3px solid #409eff;
  border-radius: 8px 8px 0 0;
  background: var(--fenlin-surface, #fff);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.column-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #303133);
}

.task-count {
  background: var(--fenlin-bg-secondary, #e4e7ed);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--fenlin-text-secondary, #606266);
  font-weight: 500;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
}

/* 底部快速添加任务 */
.quick-add-task {
  padding: 12px 16px;
  background: var(--fenlin-surface, #fff);
  border-top: 1px solid var(--fenlin-border, #e4e7ed);
}

.quick-add-task :deep(.el-input-group__prepend) {
  background: var(--fenlin-bg-secondary, #f5f7fa);
}

.quick-add-task :deep(.el-input__wrapper) {
  background: var(--fenlin-bg, #f5f7fa);
}

/* 暗黑模式 */
[data-theme="dark"] .project-tasks {
  background: var(--fenlin-bg);
}

[data-theme="dark"] .tasks-toolbar,
[data-theme="dark"] .quick-add-task {
  background: var(--fenlin-surface);
  border-color: var(--fenlin-border);
}

[data-theme="dark"] .board-column {
  background: var(--fenlin-surface);
}
</style>