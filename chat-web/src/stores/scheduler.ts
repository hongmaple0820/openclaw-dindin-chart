/**
 * 定时任务状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { schedulerApi } from '@/api/scheduler';

export const useSchedulerStore = defineStore('scheduler', () => {
  // ==================== 状态 ====================
  const tasks = ref([]);
  const currentTask = ref(null);
  const history = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0
  });

  // ==================== 计算属性 ====================
  
  const enabledTasks = computed(() => 
    tasks.value.filter(t => t.enabled)
  );

  const disabledTasks = computed(() => 
    tasks.value.filter(t => !t.enabled)
  );

  const taskStats = computed(() => {
    const stats = {
      total: tasks.value.length,
      enabled: 0,
      disabled: 0,
      success: 0,
      failed: 0
    };
    
    tasks.value.forEach(t => {
      if (t.enabled) stats.enabled++;
      else stats.disabled++;
      if (t.lastStatus === 'success') stats.success++;
      if (t.lastStatus === 'failed') stats.failed++;
    });
    
    return stats;
  });

  // ==================== 任务列表操作 ====================
  
  async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.getList();
      if (res.success) {
        tasks.value = res.tasks || [];
      } else {
        error.value = res.error || '加载定时任务列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载定时任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  // ==================== 任务详情操作 ====================

  async function fetchTaskDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.getDetail(id);
      if (res.success) {
        currentTask.value = res.task;
      } else {
        error.value = res.error || '加载定时任务详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载定时任务详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.create(data);
      if (res.success) {
        tasks.value.unshift(res.task);
        return res.task;
      } else {
        error.value = res.error || '创建定时任务失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建定时任务失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(id, data) {
    try {
      const res = await schedulerApi.update(id, data);
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
      console.error('更新定时任务失败:', err);
      return false;
    }
  }

  async function deleteTask(id) {
    try {
      const res = await schedulerApi.delete(id);
      if (res.success) {
        tasks.value = tasks.value.filter(t => t.id !== id);
        if (currentTask.value?.id === id) {
          currentTask.value = null;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除定时任务失败:', err);
      return false;
    }
  }

  // ==================== 任务状态操作 ====================

  async function toggleTask(id) {
    try {
      const res = await schedulerApi.toggle(id);
      if (res.success) {
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx].enabled = !tasks.value[idx].enabled;
        }
        if (currentTask.value?.id === id) {
          currentTask.value.enabled = !currentTask.value.enabled;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('切换任务状态失败:', err);
      return false;
    }
  }

  async function runNow(id) {
    try {
      const res = await schedulerApi.runNow(id);
      if (res.success) {
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx].lastRunAt = new Date().toISOString();
          tasks.value[idx].lastStatus = 'running';
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('立即执行失败:', err);
      return false;
    }
  }

  // ==================== 执行历史操作 ====================

  async function fetchHistory(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.getHistory({
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...params
      });
      if (res.success) {
        history.value = res.history || [];
        pagination.value.total = res.total || 0;
      } else {
        error.value = res.error || '加载执行历史失败';
      }
    } catch (err) {
      error.value = err.message || '加载执行历史失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchTaskHistory(taskId, params = {}) {
    try {
      const res = await schedulerApi.getTaskHistory(taskId, params);
      if (res.success) {
        if (currentTask.value?.id === taskId) {
          currentTask.value.history = res.history || [];
        }
        return res.history || [];
      }
      return [];
    } catch (err) {
      console.error('加载任务执行历史失败:', err);
      return [];
    }
  }

  // ==================== Cron 工具 ====================

  async function validateCron(cron) {
    try {
      const res = await schedulerApi.validateCron(cron);
      return res.success && res.valid;
    } catch (err) {
      return false;
    }
  }

  async function getNextRuns(cron, count = 5) {
    try {
      const res = await schedulerApi.getNextRuns(cron, count);
      if (res.success) {
        return res.runs || [];
      }
      return [];
    } catch (err) {
      console.error('获取下次执行时间失败:', err);
      return [];
    }
  }

  // ==================== 工具方法 ====================

  function setPage(page) {
    pagination.value.page = page;
  }

  function clearCurrentTask() {
    currentTask.value = null;
  }

  return {
    // 状态
    tasks,
    currentTask,
    history,
    loading,
    error,
    pagination,
    // 计算属性
    enabledTasks,
    disabledTasks,
    taskStats,
    // 任务列表方法
    fetchTasks,
    // 任务详情方法
    fetchTaskDetail,
    createTask,
    updateTask,
    deleteTask,
    // 任务状态方法
    toggleTask,
    runNow,
    // 执行历史方法
    fetchHistory,
    fetchTaskHistory,
    // Cron 工具方法
    validateCron,
    getNextRuns,
    // 工具方法
    setPage,
    clearCurrentTask
  };
});
