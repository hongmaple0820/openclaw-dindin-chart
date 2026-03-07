<!--
  任务详情页面
  @author 小琳
  @date 2026-03-04
  @update 移除优先级，添加标题编辑功能，实时状态显示
-->
<template>
  <div class="task-detail" v-loading="loading">
    <div v-if="task" class="detail-container">
      <!-- 头部操作栏 -->
      <div class="detail-header">
        <div class="header-left">
          <el-button text :icon="ArrowLeft" @click="$emit('close')">返回</el-button>
        </div>
        <div class="header-right">
          <el-button :icon="Star" :type="task.pinned ? 'warning' : ''" @click="handleTogglePin">
            {{ task.pinned ? '取消置顶' : '置顶' }}
          </el-button>
          <el-dropdown trigger="click" @command="handleCommand">
            <el-button :icon="More">更多</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="delete" :icon="Delete">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      
      <!-- 任务信息 -->
      <div class="detail-content">
        <!-- 标题和状态 -->
        <div class="title-section">
          <div class="title-row">
            <template v-if="isEditingTitle">
              <el-input
                ref="titleInputRef"
                v-model="editingTitle"
                placeholder="输入任务标题"
                class="title-input"
                @blur="handleSaveTitle"
                @keyup.enter="handleSaveTitle"
                @keyup.escape="cancelEditTitle"
              />
            </template>
            <template v-else>
              <h2 class="task-title">{{ task.title }}</h2>
              <el-button text :icon="Edit" @click="startEditTitle" size="small">编辑</el-button>
            </template>
          </div>
          
          <div class="status-actions">
            <!-- 实时状态选择 -->
            <div class="status-selector">
              <span class="status-label">状态：</span>
              <el-select 
                v-model="currentStatus" 
                @change="handleStatusChange" 
                size="small"
                :class="'status-' + currentStatus"
              >
                <el-option label="待处理" value="pending">
                  <div class="status-option">
                    <span class="status-dot pending"></span>
                    待处理
                  </div>
                </el-option>
                <el-option label="进行中" value="in_progress">
                  <div class="status-option">
                    <span class="status-dot in_progress"></span>
                    进行中
                  </div>
                </el-option>
                <el-option label="已完成" value="completed">
                  <div class="status-option">
                    <span class="status-dot completed"></span>
                    已完成
                  </div>
                </el-option>
              </el-select>
              
              <!-- 状态变更提示 -->
              <transition name="fade">
                <span v-if="statusChanged" class="status-changed-hint">
                  <el-icon><Check /></el-icon>
                  已更新
                </span>
              </transition>
            </div>
          </div>
        </div>
        
        <!-- 描述 -->
        <div class="info-section">
          <label>描述</label>
          <p class="description">{{ task.description || '暂无描述' }}</p>
        </div>
        
        <!-- 执行者列表 -->
        <div class="info-section">
          <label>
            <el-icon><User /></el-icon>
            执行者
          </label>
          <div class="assignees-list">
            <div v-for="assignee in task.assignees" :key="assignee.id" class="assignee-item">
              <el-avatar :size="32" :src="assignee.avatar">
                {{ assignee.nickname?.[0] }}
              </el-avatar>
              <div class="assignee-info">
                <span class="name">{{ assignee.remark || assignee.nickname }}</span>
                <span class="role">{{ assignee.userType === 'bot' ? '🤖 机器人' : '👤 用户' }}</span>
              </div>
              <el-button
                text
                type="danger"
                :icon="Close"
                size="small"
                @click="handleRemoveAssignee(assignee.id)"
              />
            </div>
            
            <el-button
              class="add-assignee-btn"
              text
              :icon="Plus"
              @click="showAssigneeDialog = true"
            >
              添加执行者
            </el-button>
          </div>
        </div>
        
        <!-- 时间信息 -->
        <div class="info-section">
          <label>
            <el-icon><Clock /></el-icon>
            时间信息
          </label>
          <div class="time-info">
            <div class="time-item">
              <span class="label">创建时间：</span>
              <span>{{ formatDateTime(task.createdAt) }}</span>
            </div>
            <div class="time-item">
              <span class="label">更新时间：</span>
              <span>{{ formatDateTime(task.updatedAt) }}</span>
            </div>
            <div v-if="task.dueDate" class="time-item">
              <span class="label">截止时间：</span>
              <span :class="{ overdue: isOverdue }">{{ formatDateTime(task.dueDate) }}</span>
            </div>
          </div>
        </div>
        
        <!-- 上下文 -->
        <div class="info-section">
          <label>
            <el-icon><Document /></el-icon>
            上下文
          </label>
          <el-input
            v-model="contextText"
            type="textarea"
            :rows="4"
            placeholder="添加任务上下文信息..."
            @blur="handleUpdateContext"
          />
        </div>
        
        <!-- 日志 -->
        <div class="info-section">
          <label>
            <el-icon><List /></el-icon>
            执行日志
          </label>
          <div class="logs-list">
            <div v-for="log in task.logs" :key="log.id" class="log-item">
              <div class="log-time">{{ formatDateTime(log.createdAt) }}</div>
              <div class="log-content">{{ log.content }}</div>
            </div>
            <el-empty v-if="!task.logs?.length" description="暂无日志" :image-size="60" />
          </div>
          
          <div class="add-log">
            <el-input
              v-model="newLog"
              placeholder="添加日志..."
              @keyup.enter="handleAddLog"
            >
              <template #append>
                <el-button :icon="Plus" @click="handleAddLog">添加</el-button>
              </template>
            </el-input>
          </div>
        </div>
        
        <!-- 评论 -->
        <div class="info-section">
          <label>
            <el-icon><ChatDotRound /></el-icon>
            评论 ({{ task.comments?.length || 0 }})
          </label>
          <div class="comments-list">
            <div v-for="comment in task.comments" :key="comment.id" class="comment-item">
              <el-avatar :size="32" :src="comment.user?.avatar">
                {{ comment.user?.nickname?.[0] }}
              </el-avatar>
              <div class="comment-content">
                <div class="comment-header">
                  <span class="author">{{ comment.user?.nickname }}</span>
                  <span class="time">{{ formatDateTime(comment.createdAt) }}</span>
                </div>
                <p>{{ comment.content }}</p>
              </div>
              <el-button
                v-if="comment.user?.id === currentUserId"
                text
                type="danger"
                :icon="Delete"
                size="small"
                @click="handleDeleteComment(comment.id)"
              />
            </div>
            <el-empty v-if="!task.comments?.length" description="暂无评论" :image-size="60" />
          </div>
          
          <div class="add-comment">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="2"
              placeholder="添加评论..."
              @keyup.enter.ctrl="handleAddComment"
            />
            <el-button type="primary" :icon="Plus" @click="handleAddComment">
              发表评论
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加执行者对话框 -->
    <el-dialog v-model="showAssigneeDialog" title="添加执行者" width="400px">
      <el-select
        v-model="selectedAssignees"
        multiple
        filterable
        placeholder="选择执行者"
        style="width: 100%"
      >
        <el-option
          v-for="friend in availableFriends"
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
      
      <template #footer>
        <el-button @click="showAssigneeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddAssignees">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ArrowLeft, Star, More, Edit, Delete, User, Clock, Document,
  List, ChatDotRound, Plus, Close, Check
} from '@element-plus/icons-vue';
import { useTaskStore } from '@/stores/tasks';
import { useFriendStore } from '@/stores/friends';
import { useUserStore } from '@/stores/user';

const props = defineProps({
  taskId: {
    type: [String, Number],
    required: true
  }
});

const emit = defineEmits(['close', 'updated', 'deleted']);

const taskStore = useTaskStore();
const friendStore = useFriendStore();
const userStore = useUserStore();

const loading = ref(false);
const currentStatus = ref('');
const contextText = ref('');
const newLog = ref('');
const newComment = ref('');
const showAssigneeDialog = ref(false);
const selectedAssignees = ref([]);

// 标题编辑相关
const isEditingTitle = ref(false);
const editingTitle = ref('');
const titleInputRef = ref(null);

// 状态变更提示
const statusChanged = ref(false);

const task = computed(() => taskStore.currentTask);
const currentUserId = computed(() => userStore.user?.id);

const isOverdue = computed(() => {
  if (!task.value?.dueDate) return false;
  return new Date(task.value.dueDate) < new Date();
});

const availableFriends = computed(() => {
  const assigneeIds = task.value?.assignees?.map(a => a.id) || [];
  return friendStore.friends.filter(f => !assigneeIds.includes(f.id));
});

// 加载任务详情
async function loadTask() {
  loading.value = true;
  try {
    await taskStore.fetchTaskDetail(props.taskId);
    if (task.value) {
      currentStatus.value = task.value.status;
      contextText.value = task.value.context || '';
    }
  } finally {
    loading.value = false;
  }
}

// 开始编辑标题
function startEditTitle() {
  editingTitle.value = task.value?.title || '';
  isEditingTitle.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
  });
}

// 保存标题
async function handleSaveTitle() {
  const newTitle = editingTitle.value.trim();
  if (!newTitle) {
    ElMessage.warning('标题不能为空');
    return;
  }
  
  if (newTitle === task.value?.title) {
    isEditingTitle.value = false;
    return;
  }
  
  const success = await taskStore.updateTask(props.taskId, { title: newTitle });
  if (success) {
    ElMessage.success('标题已更新');
    emit('updated');
  }
  isEditingTitle.value = false;
}

// 取消编辑标题
function cancelEditTitle() {
  isEditingTitle.value = false;
  editingTitle.value = '';
}

// 切换置顶
async function handleTogglePin() {
  const success = await taskStore.togglePin(props.taskId);
  if (success) {
    ElMessage.success(task.value.pinned ? '已取消置顶' : '已置顶');
    emit('updated');
  }
}

// 更新状态
async function handleStatusChange(status) {
  const success = await taskStore.updateStatus(props.taskId, status);
  if (success) {
    // 显示更新提示
    statusChanged.value = true;
    setTimeout(() => {
      statusChanged.value = false;
    }, 2000);
    emit('updated');
  } else {
    currentStatus.value = task.value.status;
  }
}

// 更新上下文
async function handleUpdateContext() {
  if (contextText.value === task.value.context) return;
  
  const success = await taskStore.updateTask(props.taskId, {
    context: contextText.value
  });
  
  if (success) {
    ElMessage.success('上下文已更新');
  }
}

// 添加日志
async function handleAddLog() {
  if (!newLog.value.trim()) return;
  
  const log = await taskStore.addLog(props.taskId, newLog.value);
  if (log) {
    newLog.value = '';
    ElMessage.success('日志已添加');
  }
}

// 添加评论
async function handleAddComment() {
  if (!newComment.value.trim()) return;
  
  const comment = await taskStore.addComment(props.taskId, newComment.value);
  if (comment) {
    newComment.value = '';
    ElMessage.success('评论已发表');
  }
}

// 删除评论
async function handleDeleteComment(commentId) {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除评论', {
      type: 'warning'
    });
    
    const success = await taskStore.deleteComment(props.taskId, commentId);
    if (success) {
      ElMessage.success('评论已删除');
    }
  } catch {
    // 取消删除
  }
}

// 移除执行者
async function handleRemoveAssignee(userId) {
  const success = await taskStore.removeAssignee(props.taskId, userId);
  if (success) {
    ElMessage.success('执行者已移除');
    emit('updated');
  }
}

// 添加执行者
async function handleAddAssignees() {
  if (selectedAssignees.value.length === 0) {
    ElMessage.warning('请选择执行者');
    return;
  }
  
  const currentIds = task.value.assignees?.map(a => a.id) || [];
  const newIds = [...currentIds, ...selectedAssignees.value];
  
  const success = await taskStore.setAssignees(props.taskId, newIds);
  if (success) {
    ElMessage.success('执行者已添加');
    showAssigneeDialog.value = false;
    selectedAssignees.value = [];
    emit('updated');
  }
}

// 更多操作
async function handleCommand(command) {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm('确定要删除这个任务吗？', '删除任务', {
        type: 'warning'
      });
      
      const success = await taskStore.deleteTask(props.taskId);
      if (success) {
        ElMessage.success('任务已删除');
        emit('deleted');
      }
    } catch {
      // 取消删除
    }
  }
}

// 格式化日期时间
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

// 监听任务 ID 变化
watch(() => props.taskId, loadTask, { immediate: true });

onMounted(() => {
  if (!friendStore.friends.length) {
    friendStore.fetchFriends();
  }
});
</script>

<style scoped>
.task-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--fenlin-surface, #fff);
}

.detail-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--fenlin-border, #f0f0f0);
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

.title-section {
  margin-bottom: 24px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.task-title {
  margin: 0;
  font-size: 24px;
  color: var(--fenlin-text-primary, #303133);
  flex: 1;
}

.title-input {
  flex: 1;
}

.status-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
  color: var(--fenlin-text-secondary, #606266);
}

.status-changed-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #67c23a;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.pending {
  background: #e6a23c;
}

.status-dot.in_progress {
  background: #409eff;
}

.status-dot.completed {
  background: #67c23a;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.info-section {
  margin-bottom: 24px;
}

.info-section label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fenlin-text-secondary, #606266);
  margin-bottom: 12px;
}

.description {
  margin: 0;
  font-size: 14px;
  color: var(--fenlin-text-secondary, #606266);
  line-height: 1.6;
  white-space: pre-wrap;
}

.assignees-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assignee-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--fenlin-bg-secondary, #f5f7fa);
  border-radius: 6px;
}

.assignee-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assignee-info .name {
  font-size: 14px;
  font-weight: 500;
  color: var(--fenlin-text-primary, #303133);
}

.assignee-info .role {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
}

.add-assignee-btn {
  justify-content: flex-start;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-item {
  font-size: 14px;
  color: var(--fenlin-text-secondary, #606266);
}

.time-item .label {
  color: var(--fenlin-text-tertiary, #909399);
}

.time-item .overdue {
  color: #f56c6c;
  font-weight: 500;
}

.logs-list,
.comments-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.log-item {
  padding: 8px;
  border-left: 2px solid #409eff;
  background: var(--fenlin-bg-secondary, #f5f7fa);
  margin-bottom: 8px;
  border-radius: 4px;
}

.log-time {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
  margin-bottom: 4px;
}

.log-content {
  font-size: 14px;
  color: var(--fenlin-text-secondary, #606266);
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--fenlin-border, #f0f0f0);
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.comment-header .author {
  font-size: 14px;
  font-weight: 500;
  color: var(--fenlin-text-primary, #303133);
}

.comment-header .time {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #909399);
}

.comment-content p {
  margin: 0;
  font-size: 14px;
  color: var(--fenlin-text-secondary, #606266);
  line-height: 1.5;
}

.add-comment {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-comment .el-button {
  align-self: flex-end;
}

.assignee-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .detail-content {
    padding: 12px;
  }
  
  .task-title {
    font-size: 20px;
  }
}
</style>