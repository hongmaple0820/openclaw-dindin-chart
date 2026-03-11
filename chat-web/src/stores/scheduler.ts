/**
 * 定时任务状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { schedulerApi } from '@/api/scheduler';
import type { SchedulerJob, ApiResponse } from '@/types';

type SchedulerJobType = 'message' | 'command' | 'reminder' | 'webhook';

interface SchedulerTask extends SchedulerJob {
  lastStatus?: 'success' | 'failed' | 'running';
}

interface ExecutionHistory {
  id: string;
  jobId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export const useSchedulerStore = defineStore('scheduler', () => {
  const tasks = ref<SchedulerTask[]>([]);
  const currentTask = ref<SchedulerTask | null>(null);
  const history = ref<ExecutionHistory[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref<Pagination>({
    page: 1,
    limit: 20,
    total: 0
  });

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

  async function fetchTasks(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.getList();
      if (res.success && res.jobs) {
        tasks.value = res.jobs as SchedulerTask[];
      } else {
        error.value = res.error || '加载定时任务列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载定时任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchTaskDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.getDetail(id);
      if (res.success && res.job) {
        currentTask.value = res.job as SchedulerTask;
      } else {
        error.value = res.error || '加载定时任务详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载定时任务详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data: { name: string; cron: string; type: SchedulerJobType; config: Record<string, unknown>; enabled?: boolean }): Promise<SchedulerTask | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await schedulerApi.create(data);
      if (res.success && res.job) {
        const task = res.job as SchedulerTask;
        tasks.value.unshift(task);
        return task;
      } else {
        error.value = res.error || '创建定时任务失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建定时任务失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(id: string, data: Partial<SchedulerTask>): Promise<boolean> {
    try {
      const res = await schedulerApi.update(id, data);
      if (res.success && res.job) {
        const task = res.job as SchedulerTask;
        const idx = tasks.value.findIndex(t => t.id === id);
        if (idx !== -1) {
          tasks.value[idx] = task;
        }
        if (currentTask.value?.id === id) {
          currentTask.value = task;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新定时任务失败:', err);
      return false;
    }
  }

  async function deleteTask(id: string): Promise<boolean> {
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

  async function toggleTask(id: string): Promise<boolean> {
    try {
      const res = await schedulerApi.toggle(id);
      if (res.success) {
        const enabled = (res as ApiResponse & { enabled?: boolean }).enabled;
        const task = tasks.value.find(t => t.id === id);
        if (task && enabled !== undefined) {
          task.enabled = enabled;
        }
        if (currentTask.value?.id === id && enabled !== undefined) {
          currentTask.value.enabled = enabled;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('切换任务状态失败:', err);
      return false;
    }
  }

  async function runTaskNow(id: string): Promise<string | null> {
    try {
      const res = await schedulerApi.runNow(id);
      if (res.success && res.executionId) {
        return res.executionId as string;
      }
      return null;
    } catch (err) {
      console.error('立即执行失败:', err);
      return null;
    }
  }

  async function fetchHistory(params: { page?: number; limit?: number; status?: string } = {}): Promise<void> {
    try {
      const res = await schedulerApi.getHistory(params);
      if (res.success && res.history) {
        history.value = res.history as ExecutionHistory[];
      }
    } catch (err) {
      console.error('获取执行历史失败:', err);
    }
  }

  async function fetchTaskHistory(id: string, params: Record<string, unknown> = {}): Promise<void> {
    try {
      const res = await schedulerApi.getTaskHistory(id, params);
      if (res.success && res.history) {
        history.value = res.history as ExecutionHistory[];
      }
    } catch (err) {
      console.error('获取任务执行历史失败:', err);
    }
  }

  async function validateCron(cron: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await schedulerApi.validateCron(cron);
      return { valid: (res as ApiResponse & { valid?: boolean }).valid || false, error: res.error };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  async function getNextRuns(cron: string, count = 5): Promise<string[]> {
    try {
      const res = await schedulerApi.getNextRuns(cron, count);
      if (res.success && res.runs) {
        return res.runs as string[];
      }
      return [];
    } catch (err) {
      console.error('获取下次执行时间失败:', err);
      return [];
    }
  }

  function clearCurrentTask(): void {
    currentTask.value = null;
  }

  return {
    tasks,
    currentTask,
    history,
    loading,
    error,
    pagination,
    enabledTasks,
    disabledTasks,
    taskStats,
    fetchTasks,
    fetchTaskDetail,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    runTaskNow,
    fetchHistory,
    fetchTaskHistory,
    validateCron,
    getNextRuns,
    clearCurrentTask
  };
});