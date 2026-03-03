<!--
  项目群任务看板页面
  @author 小琳
  @date 2026-03-03
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
        <el-select v-model="priorityFilter" placeholder="优先级" clearable size="small" style="width: 100px">
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
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
        <div class="column-header">
          <h4>{{ board.name }}</h4>
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

    <!-- 创建任务弹窗 -->
    <CreateTask
      v-model="showCreateTask"
      :project-id="projectId"
      :boards="boards"
      @created="handleTaskCreated"
    />

    <!-- 任务详情抽屉 -->
    <el-drawer v-model="showTaskDetail" title="任务详情" size="400px">
      <div class="task-detail" v-if="currentTask">
        <div class="detail-section">
          <h3>{{ currentTask.title }}</h3>
          <el-tag :type="priorityMap[currentTask.priority]?.type" size="small">
            {{ priorityMap[currentTask.priority]?.label }}
          </el-tag>
        </div>

        <div class="detail-section">
          <label>描述</label>
          <p>{{ currentTask.description || '暂无描述' }}</p>
        </div>

        <div class="detail-section">
          <label>负责人</label>
          <div class="assignee">
            <el-avatar :size="24" :src="currentTask.assignee?.avatar">
              {{ currentTask.assignee?.nickname?.[0] }}
            </el-avatar>
            <span>{{ currentTask.assignee?.nickname || '未分配' }}</span>
          </div>
        </div>

        <div class="detail-section">
          <label>截止日期</label>
          <p>{{ currentTask.dueDate ? formatDate(currentTask.dueDate) : '未设置' }}</p>
        </div>

        <div class="detail-section">
          <label>评论</label>
          <div class="comments">
            <div v-for="comment in currentTask.comments" :key="comment.id" class="comment">
              <el-avatar :size="24" :src="comment.user?.avatar">
                {{ comment.user?.nickname?.[0] }}
              </el-avatar>
              <div class="comment-content">
                <span class="author">{{ comment.user?.nickname }}</span>
                <span class="time">{{ formatDate(comment.createdAt) }}</span>
                <p>{{ comment.content }}</p>
              </div>
            </div>
          </div>
          <el-input
            v-model="newComment"
            placeholder="添加评论"
            @keyup.enter="handleAddComment"
          >
            <template #append>
              <el-button @click="handleAddComment">发送</el-button>
            </template>
          </el-input>
        </div>

        <div class="detail-actions">
          <el-button @click="handleEditTask">编辑</el-button>
          <el-button type="danger" @click="handleDeleteTask">删除</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/projects';
import TaskCard from '@/components/TaskCard.vue';
import CreateTask from '@/components/CreateTask.vue';

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  }
});

const projectStore = useProjectStore();

const searchQuery = ref('');
const priorityFilter = ref('');
const showCreateTask = ref(false);
const showTaskDetail = ref(false);
const currentTask = ref(null);
const newComment = ref('');
const draggedTask = ref(null);

const boards = computed(() => projectStore.currentBoards);
const tasks = computed(() => projectStore.currentTasks);
const loading = computed(() => projectStore.loading);

const priorityMap = {
  high: { label: '高优先级', type: 'danger' },
  medium: { label: '中优先级', type: 'warning' },
  low: { label: '低优先级', type: 'info' }
};

function getTasksByBoard(boardId) {
  let result = tasks.value.filter(t => t.boardId === boardId);
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(query));
  }
  
  if (priorityFilter.value) {
    result = result.filter(t => t.priority === priorityFilter.value);
  }
  
  return result;
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('zh-CN');
}

function openTaskDetail(task) {
  currentTask.value = task;
  showTaskDetail.value = true;
}

function handleTaskCreated() {
  showCreateTask.value = false;
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

function handleEditTask() {
  // TODO: 打开编辑任务弹窗
}

async function handleDeleteTask() {
  try {
    await ElMessageBox.confirm('确定要删除这个任务吗？', '删除任务', { type: 'warning' });
    const success = await projectStore.deleteTask(props.projectId, currentTask.value.id);
    if (success) {
      ElMessage.success('任务已删除');
      showTaskDetail.value = false;
    }
  } catch {
    // 取消
  }
}

async function handleAddComment() {
  if (!newComment.value.trim()) return;
  
  const comment = await projectStore.addComment(props.projectId, currentTask.value.id, newComment.value);
  if (comment) {
    newComment.value = '';
  }
}

async function loadData() {
  await Promise.all([
    projectStore.fetchBoards(props.projectId),
    projectStore.fetchTasks(props.projectId)
  ]);
}

watch(() => props.projectId, loadData, { immediate: true });
</script>

<style scoped>
.project-tasks {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tasks-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
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
}

.board-column {
  flex: 0 0 280px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.column-header {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
}

.column-header h4 {
  margin: 0;
  font-size: 14px;
  color: #303133;
}

.task-count {
  background: #e4e7ed;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: #606266;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-detail {
  padding: 0 16px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #303133;
}

.detail-section label {
  display: block;
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.detail-section p {
  margin: 0;
  font-size: 14px;
  color: #303133;
}

.assignee {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comments {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.comment {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.comment-content {
  flex: 1;
}

.comment-content .author {
  font-weight: 500;
  color: #303133;
}

.comment-content .time {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.comment-content p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #606266;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
</style>

.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
}
</style>
