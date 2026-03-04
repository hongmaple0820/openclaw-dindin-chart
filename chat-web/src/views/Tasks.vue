<!--
  任务管理页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="tasks-page">
    <div class="tasks-container">
      <!-- 左侧：任务列表 -->
      <div class="tasks-sidebar">
        <!-- 头部 -->
        <div class="sidebar-header">
          <h3>任务</h3>
          <el-button type="primary" :icon="Plus" circle @click="showCreateTask = true" />
        </div>
        
        <!-- 搜索栏 -->
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            placeholder="搜索任务..."
            :prefix-icon="Search"
            clearable
            size="small"
          />
        </div>
        
        <!-- 状态 Tab -->
        <div class="status-tabs">
          <div
            v-for="tab in statusTabs"
            :key="tab.value"
            :class="['tab-item', { active: activeTab === tab.value }]"
            @click="activeTab = tab.value"
          >
            <span class="tab-label">{{ tab.label }}</span>
            <el-badge :value="getCountByStatus(tab.value)" :max="99" type="primary" />
          </div>
        </div>
        
        <!-- 置顶任务区域 -->
        <div v-if="taskStore.pinnedTasks.length > 0" class="pinned-section">
          <div class="section-header" @click="showPinned = !showPinned">
            <el-icon><Star /></el-icon>
            <span>置顶任务</span>
            <el-badge :value="taskStore.pinnedTasks.length" type="warning" />
            <el-icon :class="['toggle-icon', { rotated: !showPinned }]"><ArrowDown /></el-icon>
          </div>
          <transition name="collapse">
            <div v-show="showPinned" class="pinned-list">
              <TaskCard
                v-for="task in taskStore.pinnedTasks"
                :key="task.id"
                :task="task"
                :class="{ active: currentTaskId === task.id }"
                @click="selectTask(task)"
              />
            </div>
          </transition>
        </div>
        
        <!-- 任务列表 -->
        <div class="tasks-list" v-loading="taskStore.loading">
          <template v-if="filteredTasks.length > 0">
            <TaskCard
              v-for="task in filteredTasks"
              :key="task.id"
              :task="task"
              :class="{ active: currentTaskId === task.id }"
              @click="selectTask(task)"
            />
          </template>
          
          <el-empty
            v-else-if="!taskStore.loading"
            description="暂无任务"
            :image-size="80"
          >
            <el-button type="primary" @click="showCreateTask = true">创建任务</el-button>
          </el-empty>
        </div>
      </div>
      
      <!-- 右侧：看板视图/详情 -->
      <div class="tasks-main">
        <!-- 视图切换 -->
        <div class="view-switcher">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="list">
              <el-icon><List /></el-icon>
              列表
            </el-radio-button>
            <el-radio-button value="board">
              <el-icon><Grid /></el-icon>
              看板
            </el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 列表视图 -->
        <div v-if="viewMode === 'list'" class="list-view">
          <TaskDetail
            v-if="currentTaskId"
            :task-id="currentTaskId"
            @close="currentTaskId = null"
            @updated="handleTaskUpdated"
            @deleted="handleTaskDeleted"
          />
          <div v-else class="empty-state">
            <el-empty description="选择一个任务查看详情" :image-size="120" />
          </div>
        </div>
        
        <!-- 看板视图 -->
        <div v-else class="board-view">
          <TaskBoard
            :boards="kanbanBoards"
            :tasks="kanbanTasks"
            :editable="false"
            @task-click="selectTask"
            @move-task="handleMoveTask"
          />
        </div>
      </div>
    </div>
    
    <!-- 创建任务弹窗 -->
    <el-dialog
      v-model="showCreateTask"
      title="创建任务"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" placeholder="请输入任务标题" maxlength="100" />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="任务描述（可选）"
            maxlength="500"
          />
        </el-form-item>
        
        <el-form-item label="优先级">
          <el-select v-model="createForm.priority" placeholder="选择优先级">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="执行者">
          <el-select
            v-model="createForm.assigneeIds"
            multiple
            filterable
            placeholder="@好友 选择执行者"
            style="width: 100%"
          >
            <el-option
              v-for="friend in friendsList"
              :key="friend.id"
              :label="friend.remark || friend.nickname"
              :value="friend.id"
            >
              <div class="assignee-option">
                <el-avatar :size="20" :src="friend.avatar">
                  {{ friend.nickname?.[0] }}
                </el-avatar>
                <span>{{ friend.remark || friend.nickname }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="截止日期">
          <el-date-picker
            v-model="createForm.dueDate"
            type="datetime"
            placeholder="选择截止日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateTask = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateTask">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Search, Star, ArrowDown, List, Grid } from '@element-plus/icons-vue';
import { useTaskStore } from '@/stores/tasks';
import { useFriendStore } from '@/stores/friends';
import TaskCard from '@/components/TaskCard.vue';
import TaskBoard from '@/components/TaskBoard.vue';
import TaskDetail from './TaskDetail.vue';

const router = useRouter();
const route = useRoute();
const taskStore = useTaskStore();
const friendStore = useFriendStore();

const activeTab = ref('pending');
const searchQuery = ref('');
const showPinned = ref(true);
const showCreateTask = ref(false);
const currentTaskId = ref(null);
const viewMode = ref('list');
const creating = ref(false);
const createFormRef = ref(null);

const createForm = ref({
  title: '',
  description: '',
  priority: 'medium',
  assigneeIds: [],
  dueDate: null
});

const createRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }]
};

const statusTabs = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
];

const kanbanBoards = [
  { id: 'pending', name: '待处理', color: '#909399' },
  { id: 'in_progress', name: '进行中', color: '#409eff' },
  { id: 'completed', name: '已完成', color: '#67c23a' }
];

const friendsList = computed(() => friendStore.friends);

const filteredTasks = computed(() => {
  let result = [];
  
  if (activeTab.value === 'pending') {
    result = taskStore.pendingTasks;
  } else if (activeTab.value === 'in_progress') {
    result = taskStore.inProgressTasks;
  } else {
    result = taskStore.completedTasks;
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }
  
  result = result.filter(t => !t.pinned);
  
  return result;
});

const kanbanTasks = computed(() => taskStore.tasks.map(t => ({
  ...t,
  boardId: t.status
})));

function getCountByStatus(status) {
  if (status === 'pending') return taskStore.pendingTasks.length;
  if (status === 'in_progress') return taskStore.inProgressTasks.length;
  return taskStore.completedTasks.length;
}

function selectTask(task) {
  currentTaskId.value = task.id;
  if (viewMode.value === 'board') {
    viewMode.value = 'list';
  }
}

async function handleCreateTask() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  
 alue = true;
  try {
    const task = await taskStore.createTask({
      ...createForm.value,
      status: 'pending'
    });
    
    if (task) {
      ElMessage.success('任务创建成功');
      showCreateTask.value = false;
      resetCreateForm();
      currentTaskId.value = task.id;
    }
  } finally {
    creating.value = false;
  }
}

function resetCreateForm() {
  createForm.value = {
    title: '',
    description: '',
    priority: 'medium',
    assigneeIds: [],
    dueDate: null
  };
  createFormRef.value?.resetFields();
}

function handleTaskUpdated() {
  taskStore.fetchTasks();
}

function handleTaskDeleted() {
  currentTaskId.value = null;
  taskStore.fetchTasks();
}

async function handleMoveTask({ task, toBoardId }) {
  const success = await taskStore.updateStatus(task.id, toBoardId);
  if (success) {
    ElMessage.success('任务状态已更新');
  }
}

onMounted(async () => {
  await Promise.all([
    taskStore.fetchTasks(),
    friendStore.fetchFriends()
  ]);
  
  if (route.params.id) {
    currentTaskId.value = route.params.id;
  }
});

watch(() => route.params.id, (id) => {
  if (id) {
    currentTaskId.value = id;
  }
});
</script>

<style scoped>
.tasks-page {
  height: calc(100vh - 120px);
  padding: 20px;
}

.tasks-container {
  display: flex;
  height: 100%;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.08);
}

.tasks-sidebar {
  width: 320px;
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
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2C3E50;
}

.search-bar {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.status-tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-item:hover {
  background: #f5f7fa;
}

.tab-item.active {
  border-bottom-color: #C41E3A;
  color: #C41E3A;
}

.pinned-section {
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 500;
  color: #e6a23c;
}

.section-header:hover {
  background: #fdf6ec;
}

.toggle-icon {
  margin-left: auto;
  transition: transform 0.3s;
}

.toggle-icon.rotated {
  transform: rotate(-90deg);
}

.pinned-list {
  padding: 8px;
  background: #fdf6ec;
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tasks-list :deep(.task-card.active) {
  border-left: 3px solid #C41E3A;
  background: #fff5f5;
}

.tasks-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-switcher {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}

.list-view {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.board-view {
  flex: 1;
  padding: 16px;
  overflow-x: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.assignee-option {
  display: flex;
  align-items: center;
: 8px;
}

@media (max-width: 768px) {
  .tasks-page {
    padding: 12px;
  }
  
  .tasks-container {
    flex-direction: column;
  }
  
  .tasks-sidebar {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .tasks-main {
    height: 50%;
  }
}
</style>
