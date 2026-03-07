<!--
  任务系统页面 - IM 风格交互
  @author 小琳
  @date 2026-03-07
-->
<template>
  <div class="tasks-page">
    <!-- 左侧竖排状态筛选抽屉 -->
    <div class="status-drawer" :class="{ collapsed: drawerCollapsed }">
      <div class="drawer-toggle" @click="drawerCollapsed = !drawerCollapsed">
        <el-icon><Operation /></el-icon>
      </div>
      <transition name="slide">
        <div v-show="!drawerCollapsed" class="drawer-content">
          <div class="drawer-title">状态筛选</div>
          <div
            v-for="status in statusOptions"
            :key="status.value"
            :class="['status-item', { active: activeStatus === status.value }]"
            @click="activeStatus = status.value"
          >
            <div class="status-dot" :style="{ background: status.color }"></div>
            <span class="status-label">{{ status.label }}</span>
            <el-badge :value="getCountByStatus(status.value)" :max="99" />
          </div>
          <el-divider />
          <div class="drawer-title">优先级</div>
          <div
            v-for="priority in priorityOptions"
            :key="priority.value"
            :class="['status-item', { active: activePriority === priority.value }]"
            @click="activePriority = priority.value"
          >
            <el-tag :type="priority.type" size="small" effect="dark">{{ priority.label }}</el-tag>
          </div>
        </div>
      </transition>
    </div>

    <!-- 任务列表区域 -->
    <div class="tasks-sidebar">
      <div class="sidebar-header">
        <h3>任务</h3>
        <el-button type="primary" :icon="Plus" circle size="small" @click="showCreateDialog = true" />
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
      
      <!-- 置顶任务 -->
      <div v-if="taskStore.pinnedTasks.length > 0" class="pinned-section">
        <div class="section-header" @click="showPinned = !showPinned">
          <el-icon><Star /></el-icon>
          <span>置顶</span>
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
        <el-empty v-else-if="!taskStore.loading" description="暂无任务" :image-size="80" />
      </div>
    </div>

    <!-- 任务详情区域 -->
    <div class="tasks-main">
      <template v-if="currentTask">
        <!-- 任务头部 -->
        <div class="task-header">
          <div class="header-left">
            <el-tag :type="getStatusType(currentTask.status)" size="small">
              {{ getStatusLabel(currentTask.status) }}
            </el-tag>
            <h3>{{ currentTask.title }}</h3>
          </div>
          <div class="header-right">
            <el-dropdown trigger="click" @command="handleTaskCommand">
              <el-button :icon="More" circle />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit" :icon="Edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="pin" :icon="Star">
                    {{ currentTask.pinned ? '取消置顶' : '置顶' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" :icon="Delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 任务内容区域 -->
        <div class="task-content" ref="contentRef">
          <!-- 任务进度动画 -->
          <div v-if="currentTask.status === 'in_progress'" class="task-progress">
            <div class="progress-bar">
              <div class="progress-inner" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              <el-icon class="progress-icon"><Loading /></el-icon>
              <span>任务进行中... {{ progressPercent }}%</span>
            </div>
          </div>

          <!-- 任务信息 -->
          <div class="task-info">
            <p class="task-description">{{ currentTask.description || '暂无描述' }}</p>
            
            <!-- 执行者头像 -->
            <div class="assignees-section">
              <span class="section-label">执行者：</span>
              <div class="assignees-avatars">
                <el-avatar
                  v-for="assignee in currentTask.assignees"
                  :key="assignee.id"
                  :size="28"
                  :src="assignee.avatar"
                >
                  {{ assignee.nickname?.[0] }}
                </el-avatar>
                <el-tooltip content="添加执行者" placement="top">
                  <el-avatar :size="28" class="add-assignee" @click="showAssigneeDialog = true">
                    <el-icon><Plus /></el-icon>
                  </el-avatar>
                </el-tooltip>
              </div>
            </div>

            <!-- 截止时间 -->
            <div v-if="currentTask.dueDate" class="due-date-section">
              <span class="section-label">截止时间：</span>
              <span :class="{ overdue: isOverdue }">{{ formatDateTime(currentTask.dueDate) }}</span>
            </div>
          </div>

          <!-- 消息/日志列表 -->
          <div class="messages-area">
            <div class="messages-header">
              <span>动态</span>
            </div>
            <div class="messages-list">
              <!-- 日志 -->
              <div v-for="log in currentTask.logs" :key="log.id" class="message-item log-item">
                <div class="message-time">{{ formatDateTime(log.createdAt) }}</div>
                <div class="message-content">
                  <el-icon><Document /></el-icon>
                  <span>{{ log.content }}</span>
                </div>
              </div>
              
              <!-- 评论 -->
              <div v-for="comment in currentTask.comments" :key="comment.id" class="message-item comment-item">
                <el-avatar :size="32" :src="comment.user?.avatar">
                  {{ comment.user?.nickname?.[0] }}
                </el-avatar>
                <div class="message-body">
                  <div class="message-header">
                    <span class="author">{{ comment.user?.nickname }}</span>
                    <span class="time">{{ formatDateTime(comment.createdAt) }}</span>
                  </div>
                  <div class="message-text">{{ comment.content }}</div>
                </div>
                <el-button
                  v-if="comment.user?.id === currentUserId"
                  text
                  type="danger"
                  size="small"
                  @click="deleteComment(comment.id)"
                >
                  删除
                </el-button>
              </div>
              
              <el-empty v-if="!hasMessages" description="暂无动态" :image-size="60" />
            </div>
          </div>
        </div>

        <!-- 底部聊天输入框 -->
        <div class="chat-input-area">
          <div class="input-wrapper">
            <!-- @ 成员选择器 -->
            <el-popover
              v-model:visible="showMentionPopover"
              placement="top-start"
              :width="280"
              trigger="manual"
            >
              <template #reference>
                <div class="input-box" @click="focusInput">
                  <div class="mention-tags">
                    <el-tag
                      v-for="m in selectedMentions"
                      :key="m.id"
                      closable
                      size="small"
                      @close="removeMention(m)"
                    >
                      @{{ m.name }}
                    </el-tag>
                  </div>
                  <el-input
                    ref="inputRef"
                    v-model="inputText"
                    type="textarea"
                    :rows="1"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    placeholder="输入消息，@ 成员..."
                    @keydown.enter="handleKeyDown"
                    @input="handleInputChange"
                  />
                </div>
              </template>
              
              <!-- @ 成员列表 -->
              <div class="mention-list">
                <div class="mention-header">
                  <span>@成员</span>
                </div>
                <el-input
                  v-model="mentionSearch"
                  placeholder="搜索成员..."
                  size="small"
                  clearable
                />
                <div class="mention-options">
                  <!-- @ 全部 -->
                  <div
                    class="mention-option all"
                    @click="addMention({ id: 'all', name: '全部成员', type: 'all' })"
                  >
                    <el-icon><UserFilled /></el-icon>
                    <span>@全部成员</span>
                  </div>
                  
                  <!-- 好友分组 -->
                  <div class="mention-group">
                    <div class="group-title">
                      <el-icon><User /></el-icon>
                      我的好友
                    </div>
                    <div
                      v-for="friend in filteredFriends"
                      :key="friend.id"
                      class="mention-option"
                      @click="addMention({ id: friend.id, name: friend.remark || friend.nickname, type: 'friend', avatar: friend.avatar })"
                    >
                      <el-avatar :size="24" :src="friend.avatar">
                        {{ friend.nickname?.[0] }}
                      </el-avatar>
                      <span>{{ friend.remark || friend.nickname }}</span>
                    </div>
                  </div>
                  
                  <!-- 我的智能体分组 -->
                  <div class="mention-group">
                    <div class="group-title">
                      <el-icon><Cpu /></el-icon>
                      我的智能体
                    </div>
                    <div
                      v-for="agent in filteredMyAgents"
                      :key="agent.id"
                      class="mention-option"
                      @click="addMention({ id: agent.id, name: agent.name, type: 'agent', avatar: agent.avatar })"
                    >
                      <el-avatar :size="24" :src="agent.avatar">
                        {{ agent.name?.[0] }}
                      </el-avatar>
                      <span>{{ agent.name }}</span>
                    </div>
                  </div>
                  
                  <!-- 公开智能体分组 -->
                  <div class="mention-group">
                    <div class="group-title">
                      <el-icon><Collection /></el-icon>
                      公开智能体
                    </div>
                    <div
                      v-for="agent in filteredPublicAgents"
                      :key="agent.id"
                      class="mention-option"
                      @click="addMention({ id: agent.id, name: agent.name, type: 'public_agent', avatar: agent.avatar })"
                    >
                      <el-avatar :size="24" :src="agent.avatar">
                        {{ agent.name?.[0] }}
                      </el-avatar>
                      <span>{{ agent.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-popover>
          </div>
          
          <div class="input-actions">
            <el-tooltip content="@ 成员" placement="top">
              <el-button :icon="User" circle @click="showMentionPopover = !showMentionPopover" />
            </el-tooltip>
            <el-button type="primary" :loading="sending" @click="sendMessage">
              发送
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-empty description="选择一个任务查看详情" :image-size="120">
          <el-button type="primary" @click="showCreateDialog = true">创建任务</el-button>
        </el-empty>
      </div>
    </div>

    <!-- 创建任务弹窗 -->
    <el-dialog v-model="showCreateDialog" title="创建任务" width="480px" :close-on-click-modal="false">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" placeholder="任务标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="任务描述（可选）" maxlength="500" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="createForm.priority" placeholder="选择优先级" style="width: 100%">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行者">
          <el-select v-model="createForm.assigneeIds" multiple filterable placeholder="@ 选择执行者" style="width: 100%">
            <el-option-group label="我的好友">
              <el-option v-for="friend in friendsList" :key="friend.id" :label="friend.remark || friend.nickname" :value="friend.id">
                <div class="member-option">
                  <el-avatar :size="20" :src="friend.avatar">{{ friend.nickname?.[0] }}</el-avatar>
                  <span>{{ friend.remark || friend.nickname }}</span>
                </div>
              </el-option>
            </el-option-group>
            <el-option-group label="我的智能体">
              <el-option v-for="agent in myAgentsList" :key="agent.id" :label="agent.name" :value="'agent:' + agent.id">
                <div class="member-option">
                  <el-avatar :size="20" :src="agent.avatar">{{ agent.name?.[0] }}</el-avatar>
                  <span>{{ agent.name }}</span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="createForm.dueDate" type="datetime" placeholder="选择截止日期" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateTask">创建</el-button>
      </template>
    </el-dialog>

    <!-- 添加执行者弹窗 -->
    <el-dialog v-model="showAssigneeDialog" title="添加执行者" width="400px">
      <el-select v-model="newAssigneeIds" multiple filterable placeholder="选择执行者" style="width: 100%">
        <el-option-group label="我的好友">
          <el-option v-for="friend in availableFriends" :key="friend.id" :label="friend.remark || friend.nickname" :value="friend.id">
            <div class="member-option">
              <el-avatar :size="20" :src="friend.avatar">{{ friend.nickname?.[0] }}</el-avatar>
              <span>{{ friend.remark || friend.nickname }}</span>
            </div>
          </el-option>
        </el-option-group>
        <el-option-group label="我的智能体">
          <el-option v-for="agent in myAgentsList" :key="agent.id" :label="agent.name" :value="'agent:' + agent.id">
            <div class="member-option">
              <el-avatar :size="20" :src="agent.avatar">{{ agent.name?.[0] }}</el-avatar>
              <span>{{ agent.name }}</span>
            </div>
          </el-option>
        </el-option-group>
      </el-select>
      <template #footer>
        <el-button @click="showAssigneeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddAssignees">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Search, Star, ArrowDown, More, Edit, Delete, Operation,
  User, UserFilled, Cpu, Collection, Document, Loading
} from '@element-plus/icons-vue';
import { useTaskStore } from '@/stores/tasks';
import { useFriendStore } from '@/stores/friends';
import { useAgentsStore } from '@/stores/agents';
import { useUserStore } from '@/stores/user';
import TaskCard from '@/components/TaskCard.vue';

const router = useRouter();
const route = useRoute();
const taskStore = useTaskStore();
const friendStore = useFriendStore();
const agentsStore = useAgentsStore();
const userStore = useUserStore();

// ==================== 状态 ====================
const drawerCollapsed = ref(false);
const activeStatus = ref('');
const activePriority = ref('');
const searchQuery = ref('');
const showPinned = ref(true);
const currentTaskId = ref(null);
const showCreateDialog = ref(false);
const showAssigneeDialog = ref(false);
const creating = ref(false);
const sending = ref(false);
const createFormRef = ref(null);
const inputRef = ref(null);
const contentRef = ref(null);

// 进度条
const progressPercent = ref(0);

// 输入相关
const inputText = ref('');
const showMentionPopover = ref(false);
const mentionSearch = ref('');
const selectedMentions = ref([]);

// 表单
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

const newAssigneeIds = ref([]);

// ==================== 配置 ====================
const statusOptions = [
  { label: '全部', value: '', color: '#909399' },
  { label: '待处理', value: 'pending', color: '#E6A23C' },
  { label: '进行中', value: 'in_progress', color: '#409EFF' },
  { label: '已完成', value: 'completed', color: '#67C23A' }
];

const priorityOptions = [
  { label: '全部', value: '', type: 'info' },
  { label: '高', value: 'high', type: 'danger' },
  { label: '中', value: 'medium', type: 'warning' },
  { label: '低', value: 'low', type: 'info' }
];

// ==================== 计算属性 ====================
const currentTask = computed(() => taskStore.currentTask);
const currentUserId = computed(() => userStore.user?.id);

const friendsList = computed(() => friendStore.friends);
const myAgentsList = computed(() => agentsStore.myAgents);
const publicAgentsList = computed(() => agentsStore.publicAgents);

const filteredTasks = computed(() => {
  let result = taskStore.tasks;
  
  // 状态筛选
  if (activeStatus.value) {
    result = result.filter(t => t.status === activeStatus.value);
  }
  
  // 优先级筛选
  if (activePriority.value) {
    result = result.filter(t => t.priority === activePriority.value);
  }
  
  // 搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }
  
  // 排除置顶
  result = result.filter(t => !t.pinned);
  
  return result;
});

const hasMessages = computed(() => {
  return (currentTask.value?.logs?.length > 0) || (currentTask.value?.comments?.length > 0);
});

const isOverdue = computed(() => {
  if (!currentTask.value?.dueDate) return false;
  return new Date(currentTask.value.dueDate) < new Date();
});

// @ 成员筛选
const filteredFriends = computed(() => {
  if (!mentionSearch.value) return friendsList.value.slice(0, 5);
  return friendsList.value.filter(f =>
    (f.remark || f.nickname).toLowerCase().includes(mentionSearch.value.toLowerCase())
  ).slice(0, 5);
});

const filteredMyAgents = computed(() => {
  if (!mentionSearch.value) return myAgentsList.value.slice(0, 5);
  return myAgentsList.value.filter(a =>
    a.name.toLowerCase().includes(mentionSearch.value.toLowerCase())
  ).slice(0, 5);
});

const filteredPublicAgents = computed(() => {
  if (!mentionSearch.value) return publicAgentsList.value.slice(0, 5);
  return publicAgentsList.value.filter(a =>
    a.name.toLowerCase().includes(mentionSearch.value.toLowerCase())
  ).slice(0, 5);
});

const availableFriends = computed(() => {
  const assigneeIds = currentTask.value?.assignees?.map(a => a.id) || [];
  return friendsList.value.filter(f => !assigneeIds.includes(f.id));
});

// ==================== 方法 ====================
function getCountByStatus(status) {
  if (!status) return taskStore.tasks.length;
  return taskStore.tasks.filter(t => t.status === status).length;
}

function getStatusType(status) {
  const map = { pending: 'warning', in_progress: '', completed: 'success' };
  return map[status] || 'info';
}

function getStatusLabel(status) {
  const map = { pending: '待处理', in_progress: '进行中', completed: '已完成' };
  return map[status] || status;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function selectTask(task) {
  currentTaskId.value = task.id;
  await taskStore.fetchTaskDetail(task.id);
  
  // 模拟进度
  if (task.status === 'in_progress') {
    simulateProgress();
  } else {
    progressPercent.value = 0;
  }
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
}

function simulateProgress() {
  progressPercent.value = 0;
  const interval = setInterval(() => {
    if (progressPercent.value >= 95 || currentTask.value?.status !== 'in_progress') {
      clearInterval(interval);
      return;
    }
    progressPercent.value += Math.random() * 10;
    if (progressPercent.value > 95) progressPercent.value = 95;
  }, 1000);
}

function scrollToBottom() {
  if (contentRef.value) {
    const messagesArea = contentRef.value.querySelector('.messages-area');
    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }
}

function focusInput() {
  inputRef.value?.focus();
}

function handleKeyDown(e) {
  if (e.shiftKey) return;
  e.preventDefault();
  sendMessage();
}

function handleInputChange(val) {
  // 检测 @ 输入
  if (val.includes('@')) {
    showMentionPopover.value = true;
  }
}

function addMention(member) {
  if (!selectedMentions.value.find(m => m.id === member.id)) {
    selectedMentions.value.push(member);
  }
  showMentionPopover.value = false;
  mentionSearch.value = '';
}

function removeMention(member) {
  selectedMentions.value = selectedMentions.value.filter(m => m.id !== member.id);
}

async function sendMessage() {
  if (!inputText.value.trim() && selectedMentions.value.length === 0) return;
  
  sending.value = true;
  try {
    // 构建消息内容
    let content = inputText.value;
    if (selectedMentions.value.length > 0) {
      const mentions = selectedMentions.value.map(m => `@${m.name}`).join(' ');
      content = mentions + ' ' + content;
    }
    
    // 如果是日志
    if (content.startsWith('##')) {
      await taskStore.addLog(currentTaskId.value, content.replace('##', '').trim());
    } else {
      await taskStore.addComment(currentTaskId.value, content);
    }
    
    inputText.value = '';
    selectedMentions.value = [];
    
    // 刷新任务详情
    await taskStore.fetchTaskDetail(currentTaskId.value);
    scrollToBottom();
  } finally {
    sending.value = false;
  }
}

async function deleteComment(commentId) {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除评论', { type: 'warning' });
    await taskStore.deleteComment(currentTaskId.value, commentId);
    ElMessage.success('评论已删除');
  } catch {
    // 取消
  }
}

async function handleTaskCommand(command) {
  if (command === 'edit') {
    ElMessage.info('编辑功能开发中');
  } else if (command === 'pin') {
    const success = await taskStore.togglePin(currentTaskId.value);
    if (success) {
      ElMessage.success(currentTask.value.pinned ? '已取消置顶' : '已置顶');
    }
  } else if (command === 'delete') {
    try {
      await ElMessageBox.confirm('确定要删除这个任务吗？', '删除任务', { type: 'warning' });
      await taskStore.deleteTask(currentTaskId.value);
      ElMessage.success('任务已删除');
      currentTaskId.value = null;
    } catch {
      // 取消
    }
  }
}

async function handleCreateTask() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  
  creating.value = true;
  try {
    const task = await taskStore.createTask({
      ...createForm.value,
      status: 'pending'
    });
    
    if (task) {
      ElMessage.success('任务创建成功');
      showCreateDialog.value = false;
      resetCreateForm();
      selectTask(task);
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

async function handleAddAssignees() {
  if (newAssigneeIds.value.length === 0) {
    ElMessage.warning('请选择执行者');
    return;
  }
  
  const currentIds = currentTask.value.assignees?.map(a => a.id) || [];
  const allIds = [...currentIds, ...newAssigneeIds.value];
  
  const success = await taskStore.setAssignees(currentTaskId.value, allIds);
  if (success) {
    ElMessage.success('执行者已添加');
    showAssigneeDialog.value = false;
    newAssigneeIds.value = [];
  }
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await Promise.all([
    taskStore.fetchTasks(),
    friendStore.fetchFriends(),
    agentsStore.fetchMyAgents(),
    agentsStore.fetchPublicAgents()
  ]);
  
  if (route.params.id) {
    selectTask({ id: route.params.id });
  }
});

watch(() => route.params.id, (id) => {
  if (id) {
    selectTask({ id });
  }
});
</script>

<style scoped>
.tasks-page {
  display: flex;
  height: calc(100vh - 56px);
  background: #f5f7fa;
}

/* ========== 状态筛选抽屉 ========== */
.status-drawer {
  width: 48px;
  background: white;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.status-drawer.collapsed {
  width: 48px;
}

.drawer-toggle {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-bottom: 1px solid #e4e7ed;
  color: #606266;
}

.drawer-toggle:hover {
  background: #f5f7fa;
  color: #C41E3A;
}

.drawer-content {
  padding: 12px;
  min-width: 160px;
}

.drawer-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
}

.status-item:hover {
  background: #f5f7fa;
}

.status-item.active {
  background: #ecf5ff;
  color: #409eff;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-label {
  flex: 1;
  font-size: 13px;
}

/* ========== 任务列表侧边栏 ========== */
.tasks-sidebar {
  width: 320px;
  background: white;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.search-bar {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.pinned-section {
  border-bottom: 1px solid #e4e7ed;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 500;
  color: #e6a23c;
  background: #fdf6ec;
}

.section-header:hover {
  background: #faecd8;
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

/* ========== 任务主区域 ========== */
.tasks-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.task-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ========== 任务进度 ========== */
.task-progress {
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #e8f4fd 0%, #d4e8fc 100%);
  border-radius: 8px;
}

.progress-bar {
  height: 6px;
  background: rgba(64, 158, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-inner {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #67c23a);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #409eff;
}

.progress-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ========== 任务信息 ========== */
.task-info {
  margin-bottom: 20px;
}

.task-description {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 16px;
}

.assignees-section,
.due-date-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.section-label {
  font-size: 13px;
  color: #909399;
}

.assignees-avatars {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-assignee {
  cursor: pointer;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
}

.add-assignee:hover {
  background: #ecf5ff;
  border-color: #409eff;
}

.overdue {
  color: #f56c6c;
  font-weight: 500;
}

/* ========== 消息区域 ========== */
.messages-area {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  min-height: 200px;
}

.messages-header {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.messages-list {
  max-height: 300px;
  overflow-y: auto;
}

.message-item {
  margin-bottom: 12px;
}

.log-item {
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.log-item .message-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.log-item .message-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 4px;
}

.message-body {
  flex: 1;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-header .author {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.message-header .time {
  font-size: 12px;
  color: #909399;
}

.message-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.5;
}

/* ========== 聊天输入框 ========== */
.chat-input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  background: white;
}

.input-wrapper {
  flex: 1;
}

.input-box {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 8px 12px;
}

.mention-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.input-actions {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* ========== @ 成员列表 ========== */
.mention-list {
  max-height: 300px;
}

.mention-header {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.mention-options {
  max-height: 200px;
  overflow-y: auto;
}

.mention-group {
  margin-top: 8px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
  padding: 8px 0 4px;
}

.mention-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.mention-option:hover {
  background: #f5f7fa;
}

.mention-option.all {
  background: #fdf6ec;
  color: #e6a23c;
}

.mention-option.all:hover {
  background: #faecd8;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* ========== 成员选择选项 ========== */
.member-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ========== 过渡动画 ========== */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  .status-drawer {
    display: none;
  }
  
  .tasks-sidebar {
    width: 100%;
    position: absolute;
    z-index: 10;
    background: white;
  }
}
</style>