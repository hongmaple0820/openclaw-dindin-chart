/**
 * 任务系统状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { taskApi } from '@/api/tasks';

export const useTaskStore = defineStore('tasks', () => {
  // ==================== 状态 ====================
  const tasks = ref([]);
  const currentTask = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const filters = ref({
    status: '',
    priority: '',
    assignee: '',
    search: '',
    pinned: false
  });

  // ==================== 计算属性 ====================
  
  const pendingTasks = computed(() => 
    tasks.value.filter(t => t.status === 'pending')
  );

  const inProgressTasks = computed(() => 
    tasks.value.filter(t => t.status === 'in_progress')
  );

  const completedTasks = computed(() => 
    tasks.value.filter(t => t.status === 'completed')
  );

  const pinnedTasks = computed(() => 
    tasks.value.filter(t => t.pinned)
  );

  const filteredTasks = computed(() => {
    let result = [...tasks.value];
    
    if (filters.value.status) {
      result = result.filter(t => t.status === filters.value.status);
    }
    if (filters.value.priority) {
      result = result.filter(t => t.priority === filters.value.priority);
    }
    if (filters.value.assignee) {
      result = result.filter(t => 
        t.assignees?.some(a => a.id === filters.value.assignee)
      );
    }
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }
    if (filters.value.pinned) {
      result = result.filter(t => t.pinned);
    }
    
    return result;
  });

  // ==================== 任务列表操作 ====================
  
  async function fetchTasks(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getList(params);
      if (res.success) {
        tasks.value = res.tasks || [];
      } else {
        error.value = res.error || '加载任务列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchPinnedTasks() {
    try {
      const res = await taskApi.getPinned();
      if (res.success) {
        res.tasks?.forEach(task => {
          const idx = tasks.value.findIndex(t => t.id === task.id);
          if (idx !== -1) {
            tasks.value[idx] = task;
          }
        });
      }
    } catch (err) {
      console.error('加载置顶任务失败:', err);
    }
  }

  // ==================== 任务详情操作 ====================

  async function fetchTaskDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getDetail(id);
      if (res.success) {
        currentTask.value = res.task;
      } else {
        error.value = res.error || '加载任务详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载任务详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.create(data);
      if (res.success) {
        tasks.value.unshift(res.task);
        return res.task;
      } else {
        error.value = res.error || '创建任务失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建任务失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(id, data) {
    try {
      const res = await taskApi.update(id, data);
      if (res.success) {
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx] = { ...tasks.value[idx], ...data };
        }
        if (currentTask.value?.id === id) {
          currentTask.value = { ...currentTask.value, ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新任务失败:', err);
      return false;
    }
  }

  async function deleteTask(id) {
    try {
      const res = await taskApi.delete(id);
      if (res.success) {
        tasks.value = tasks.value.filter(t => t.id !== id);
        if (currentTask.value?.id === id) {
          currentTask.value = null;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除任务失败:', err);
      return false;
    }
  }

  // ==================== 状态操作 ====================

  async function updateStatus(id, status) {
    try {
      const res = await taskApi.updateStatus(id, status);
      if (res.success) {
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx].status = status;
        }
        if (currentTask.value?.id === id) {
          currentTask.value.status = status;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新任务状态失败:', err);
      return false;
    }
  }

  async function togglePin(id) {
    try {
      const res = await taskApi.togglePin(id);
      if (res.success) {
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx].pinned = !tasks.value[idx].pinned;
        }
        if (currentTask.value?.id === id) {
          currentTask.value.pinned = !currentTask.value.pinned;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('切换置顶失败:', err);
      return false;
    }
  }

  // ==================== 执行者操作 ====================

  async function addAssignee(taskId, userId) {
    try {
      const res = await taskApi.addAssignee(taskId, userId);
      if (res.success) {
        await fetchTaskDetail(taskId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('添加执行者失败:', err);
      return false;
    }
  }

  async function removeAssignee(taskId, userId) {
    try {
      const res = await taskApi.removeAssignee(taskId, userId);
      if (res.success) {
        if (currentTask.value?.id === taskId) {
          currentTask.value.assignees = currentTask.value.assignees?.filter(
            a => a.id !== userId
          );
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('移除执行者失败:', err);
      return false;
    }
  }

  async function setAssignees(taskId, userIds) {
    try {
      const res = await taskApi.setAssignees(taskId, userIds);
      if (res.success) {
        await fetchTaskDetail(taskId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('设置执行者失败:', err);
      return false;
    }
  }

  // ==================== 日志操作 ====================

  async function addLog(taskId, content) {
    try {
      const res = await taskApi.addLog(taskId, content);
      if (res.success) {
        if (currentTask.value?.id === taskId) {
          if (!currentTask.value.logs) currentTask.value.logs = [];
          currentTask.value.logs.push(res.log);
        }
        return res.log;
      }
      return null;
    } catch (err) {
      console.error('添加日志失败:', err);
      return null;
    }
  }

  // ==================== 评论操作 ====================

  async function addComment(taskId, content) {
    try {
      const res = await taskApi.addComment(taskId, content);
      if (res.success) {
        if (currentTask.value?.id === taskId) {
          if (!currentTask.value.comments) currentTask.value.comments = [];
          currentTask.value.comments.push(res.comment);
        }
        return res.comment;
      }
      return null;
    } catch (err) {
      console.error('添加评论失败:', err);
      return null;
    }
  }

  async function deleteComment(taskId, commentId) {
    try {
      const res = await taskApi.deleteComment(taskId, commentId);
      if (res.success) {
        if (currentTask.value?.id === taskId) {
          currentTask.value.comments = currentTask.value.comments?.filter(
            c => c.id !== commentId
          );
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除评论失败:', err);
      return false;
    }
  }

  // ==================== 批量操作 ====================

  async function batchUpdateStatus(taskIds, status) {
    try {
      const res = await taskApi.batchUpdateStatus(taskIds, status);
      if (res.success) {
        taskIds.forEach(id => {
          const idx = tasks.value.findIndex(t => t.id === id);
          if (idx !== -1) {
            tasks.value[idx].status = status;
          }
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('批量更新状态失败:', err);
      return false;
    }
  }

  async function batchDelete(taskIds) {
    try {
      const res = await taskApi.batchDelete(taskIds);
      if (res.success) {
        tasks.value = tasks.value.filter(t => !taskIds.includes(t.id));
        if (currentTask.value && taskIds.includes(currentTask.value.id)) {
          currentTask.value = null;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('批量删除失败:', err);
      return false;
    }
  }

  // ==================== 工具方法 ====================

  function setFilter(key, value) {
    filters.value[key] = value;
  }

  function clearFilters() {
    filters.value = {
      status: '',
      priority: '',
      assignee: '',
      search: '',
      pinned: false
    };
  }

  function clearCurrentTask() {
    currentTask.value = null;
  }

  return {
    // 状态
    tasks,
    currentTask,
    loading,
    error,
    filters,
    // 计算属性
    pendingTasks,
    inProgressTasks,
    completedTasks,
    pinnedTasks,
    filteredTasks,
    // 任务列表方法
    fetchTasks,
    fetchPinnedTasks,
    // 任务详情方法
    fetchTaskDetail,
    createTask,
    updateTask,
    deleteTask,
    // 状态方法
    updateStatus,
    togglePin,
    // 执行者方法
    addAssignee,
    removeAssignee,
    setAssignees,
    // 日志方法
    addLog,
    // 评论方法
    addComment,
    deleteComment,
    // 批量操作方法
    batchUpdateStatus,
    batchDelete,
    // 工具方法
    setFilter,
    clearFilters,
    clearCurrentTask
  };
});
