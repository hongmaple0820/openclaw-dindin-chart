<!--
  任务看板组件 - 简洁版
  @author 小琳
  @date 2026-03-07
-->
<template>
  <div class="task-board">
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
        <span class="count">{{ getTaskCount(board.id) }}</span>
      </div>
      
      <div class="column-body">
        <div class="task-list">
          <TaskCard
            v-for="task in getTasks(board.id)"
            :key="task.id"
            :task="task"
            draggable="true"
            @dragstart="handleDragStart($event, task)"
            @click="$emit('task-click', task)"
          />
        </div>
        
        <el-button
          v-if="showAddTask"
          class="add-task-btn"
          text
          @click="$emit('add-task', board.id)"
        >
          <el-icon><Plus /></el-icon>
          添加任务
        </el-button>
      </div>
    </div>
    
    <div v-if="editable" class="add-column" @click="$emit('add-board')">
      <el-icon><Plus /></el-icon>
      添加列
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import TaskCard from './TaskCard.vue';

const props = defineProps({
  boards: {
    type: Array,
    default: () => []
  },
  tasks: {
    type: Array,
    default: () => []
  },
  editable: {
    type: Boolean,
    default: false
  },
  showAddTask: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['task-click', 'add-task', 'add-board', 'edit-board', 'delete-board', 'move-task']);

const draggedTask = ref(null);

function getTasks(boardId) {
  return props.tasks.filter(t => t.boardId === boardId);
}

function getTaskCount(boardId) {
  return getTasks(boardId).length;
}

function handleDragStart(event, task) {
  draggedTask.value = task;
  event.dataTransfer.effectAllowed = 'move';
}

function handleDrop(event, targetBoardId) {
  if (!draggedTask.value) return;
  
  if (draggedTask.value.boardId !== targetBoardId) {
    emit('move-task', {
      task: draggedTask.value,
      fromBoardId: draggedTask.value.boardId,
      toBoardId: targetBoardId
    });
  }
  
  draggedTask.value = null;
}
</script>

<style scoped>
.task-board {
  display: flex;
  gap: 16px;
  height: 100%;
  overflow-x: auto;
  padding: 0 0 16px;
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
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 3px solid #409eff;
  border-radius: 8px 8px 0 0;
  background: #fff;
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
  color: #303133;
}

.column-header .count {
  background: #e4e7ed;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.column-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.task-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.add-task-btn {
  margin-top: 8px;
  width: 100%;
  justify-content: flex-start;
  color: #909399;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
}

.add-task-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.add-column {
  flex: 0 0 280px;
  background: #f5f7fa;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}

.add-column:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
</style>