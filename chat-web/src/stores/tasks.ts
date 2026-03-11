/**
 * 任务系统状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { taskApi } from '@/api/tasks';
import type { Task } from '@/types';

interface TaskWithExtras extends Task {
  pinned?: boolean;
  assignees?: { id: string; name: string }[];
  logs?: { id: string; content: string; createdAt: string }[];
  comments?: { id: string; content: string; author: string; createdAt: string }[];
}

interface TaskFilters {
  status: string;
  priority: string;
  assignee: string;
  search: string;
  pinned: boolean;
}

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<TaskWithExtras[]>([]);
  const currentTask = ref<TaskWithExtras | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<TaskFilters>({
    status: '',
    priority: '',
    assignee: '',
    search: '',
    pinned: false
  });

  const pendingTasks = computed(() => 
    tasks.value.filter(t => t.status === 'todo')
  );

  const inProgressTasks = computed(() => 
    tasks.value.filter(t => t.status === 'in_progress')
  );

  const completedTasks = computed(() => 
    tasks.value.filter(t => t.status === 'done')
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

  async function fetchTasks(params: Record<string, unknown> = {}): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getList(params);
      if (res.success && res.tasks) {
        tasks.value = res.tasks as TaskWithExtras[];
      } else {
        error.value = res.error || '加载任务列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载任务列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchPinnedTasks(): Promise<void> {
    try {
      const res = await taskApi.getPinned();
      if (res.success && res.tasks) {
        (res.tasks as TaskWithExtras[]).forEach(task => {
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

  async function fetchTaskDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.getDetail(id);
      if (res.success && res.task) {
        currentTask.value = res.task as TaskWithExtras;
      } else {
        error.value = res.error || '加载任务详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载任务详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data: { title: string; description?: string; priority?: 'low' | 'medium' | 'high' }): Promise<TaskWithExtras | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.create(data);
      if (res.success && res.task) {
        const task = res.task as TaskWithExtras;
        tasks.value.unshift(task);
        return task;
      } else {
        error.value = res.error || '创建任务失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建任务失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(id: string, data: Partial<Task>): Promise<boolean> {
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

  async function deleteTask(id: string): Promise<boolean> {
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

  async function updateStatus(id: string, status: Task['status']): Promise<boolean> {
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

  async function togglePin(id: string): Promise<boolean> {
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

  async function addAssignee(taskId: string, userId: string): Promise<boolean> {
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

  async function removeAssignee(taskId: string, userId: string): Promise<boolean> {
    try {
      const res = await taskApi.removeAssignee(taskId, userId);
      if (res.success) {
        if (currentTask.value?.id === taskId && currentTask.value.assignees) {
          currentTask.value.assignees = currentTask.value.assignees.filter(a => a.id !== userId);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('移除执行者失败:', err);
      return false;
    }
  }

  async function setAssignees(taskId: string, userIds: string[]): Promise<boolean> {
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

  async function addLog(taskId: string, content: string): Promise<{ id: string; content: string; createdAt: string } | null> {
    try {
      const res = await taskApi.addLog(taskId, content);
      if (res.success && res.log) {
        const log = res.log as { id: string; content: string; createdAt: string };
        if (currentTask.value?.id === taskId) {
          if (!currentTask.value.logs) currentTask.value.logs = [];
          currentTask.value.logs.push(log);
        }
        return log;
      }
      return null;
    } catch (err) {
      console.error('添加日志失败:', err);
      return null;
    }
  }

  async function addComment(taskId: string, content: string): Promise<{ id: string; content: string; author: string; createdAt: string } | null> {
    try {
      const res = await taskApi.addComment(taskId, content);
      if (res.success && res.comment) {
        const comment = res.comment as { id: string; content: string; author: string; createdAt: string };
        if (currentTask.value?.id === taskId) {
          if (!currentTask.value.comments) currentTask.value.comments = [];
          currentTask.value.comments.push(comment);
        }
        return comment;
      }
      return null;
    } catch (err) {
      console.error('添加评论失败:', err);
      return null;
    }
  }

  async function deleteComment(taskId: string, commentId: string): Promise<boolean> {
    try {
      const res = await taskApi.deleteComment(taskId, commentId);
      if (res.success) {
        if (currentTask.value?.id === taskId && currentTask.value.comments) {
          currentTask.value.comments = currentTask.value.comments.filter(c => c.id !== commentId);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除评论失败:', err);
      return false;
    }
  }

  async function batchUpdateStatus(taskIds: string[], status: Task['status']): Promise<boolean> {
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

  async function batchDelete(taskIds: string[]): Promise<boolean> {
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

  function setFilter(key: keyof TaskFilters, value: string | boolean): void {
    (filters.value as Record<string, string | boolean>)[key] = value;
  }

  function clearFilters(): void {
    filters.value = {
      status: '',
      priority: '',
      assignee: '',
      search: '',
      pinned: false
    };
  }

  function clearCurrentTask(): void {
    currentTask.value = null;
  }

  return {
    tasks,
    currentTask,
    loading,
    error,
    filters,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    pinnedTasks,
    filteredTasks,
    fetchTasks,
    fetchPinnedTasks,
    fetchTaskDetail,
    createTask,
    updateTask,
    deleteTask,
    updateStatus,
    togglePin,
    addAssignee,
    removeAssignee,
    setAssignees,
    addLog,
    addComment,
    deleteComment,
    batchUpdateStatus,
    batchDelete,
    setFilter,
    clearFilters,
    clearCurrentTask
  };
});