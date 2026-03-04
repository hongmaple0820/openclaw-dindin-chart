/**
 * 任务状态管理 Store
 * @author 小琳
 * @date 2026-03-04
 */
import { taskApi, Task } from '@/api/tasks'

interface TaskState {
  tasks: Task[]
  pendingTasks: Task[]
  inProgressTasks: Task[]
  completedTasks: Task[]
  pinnedTasks: Task[]
  currentTask: Task | null
  loading: boolean
}

export const useTaskStore = {
  state: {
    tasks: [],
    pendingTasks: [],
    inProgressTasks: [],
    completedTasks: [],
    pinnedTasks: [],
    currentTask: null,
    loading: false
  } as TaskState,

  // 获取任务列表
  async fetchTasks(params?: { status?: string; priority?: string; search?: string }) {
    try {
      this.state.loading = true
      const res = await taskApi.getList(params) as any
      
      if (res.success || res.data) {
        this.state.tasks = res.data || res.tasks || []
        
        // 分类任务
        this.state.pendingTasks = this.state.tasks.filter(t => t.status === 'pending')
        this.state.inProgressTasks = this.state.tasks.filter(t => t.status === 'in_progress')
        this.state.completedTasks = this.state.tasks.filter(t => t.status === 'completed')
        this.state.pinnedTasks = this.state.tasks.filter(t => t.pinned)
      }
      return this.state.tasks
    } catch (error) {
      console.error('获取任务列表失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 获取置顶任务
  async fetchPinnedTasks() {
    try {
      const res = await taskApi.getPinned() as any
      
      if (res.success || res.data) {
        this.state.pinnedTasks = res.data || res.tasks || []
      }
      return this.state.pinnedTasks
    } catch (error) {
      console.error('获取置顶任务失败:', error)
      throw error
    }
  },

  // 获取任务详情
  async fetchTaskDetail(id: string) {
    try {
      const res = await taskApi.getDetail(id) as any
      const task = res.data || res.task || null
      this.state.currentTask = task
      return task
    } catch (error) {
      console.error('获取任务详情失败:', error)
      throw error
    }
  },

  // 选择任务
  selectTask(task: Task | null) {
    this.state.currentTask = task
  },

  // 创建任务
  async createTask(data: Partial<Task>) {
    try {
      this.state.loading = true
      const res = await taskApi.create(data) as any
      
      if (res.success || res.data) {
        const newTask = res.data || res.task
        this.state.tasks.push(newTask)
        
        // 更新分类列表
        if (newTask.status === 'pending') {
          this.state.pendingTasks.push(newTask)
        } else if (newTask.status === 'in_progress') {
          this.state.inProgressTasks.push(newTask)
        } else if (newTask.status === 'completed') {
          this.state.completedTasks.push(newTask)
        }
        
        return newTask
      }
      throw new Error(res.message || '创建失败')
    } catch (error) {
      console.error('创建任务失败:', error)
      throw error
    } finally {
      this.state.loading = false
    }
  },

  // 更新任务
  async updateTask(id: string, data: Partial<Task>) {
    try {
      const res = await taskApi.update(id, data) as any
      
      if (res.success || res.data) {
        const updatedTask = res.data || res.task
        
        // 更新列表中的任务
        const updateTaskInList = (list: Task[]) => {
          const index = list.findIndex(t => t.id === id)
          if (index > -1) {
            list[index] = { ...list[index], ...updatedTask }
          }
        }
        
        updateTaskInList(this.state.tasks)
        updateTaskInList(this.state.pendingTasks)
        updateTaskInList(this.state.inProgressTasks)
        updateTaskInList(this.state.completedTasks)
        updateTaskInList(this.state.pinnedTasks)
        
        // 如果更新的是当前任务，同步更新
        if (this.state.currentTask?.id === id) {
          this.state.currentTask = { ...this.state.currentTask, ...updatedTask }
        }
        
        return updatedTask
      }
      throw new Error(res.message || '更新失败')
    } catch (error) {
      console.error('更新任务失败:', error)
      throw error
    }
  },

  // 删除任务
  async deleteTask(id: string) {
    try {
      const res = await taskApi.delete(id) as any
      
      if (res.success) {
        // 从列表中移除
        const removeFromList = (list: Task[]) => {
          const index = list.findIndex(t => t.id === id)
          if (index > -1) {
            list.splice(index, 1)
          }
        }
        
        removeFromList(this.state.tasks)
        removeFromList(this.state.pendingTasks)
        removeFromList(this.state.inProgressTasks)
        removeFromList(this.state.completedTasks)
        removeFromList(this.state.pinnedTasks)
        
        // 如果删除的是当前任务，清空
        if (this.state.currentTask?.id === id) {
          this.state.currentTask = null
        }
        
        return true
      }
      throw new Error(res.message || '删除失败')
    } catch (error) {
      console.error('删除任务失败:', error)
      throw error
    }
  },

  // 更新任务状态
  async updateStatus(id: string, status: string) {
    try {
      const res = await taskApi.updateStatus(id, status) as any
      
      if (res.success || res.data) {
        // 重新获取任务列表以更新分类
        await this.fetchTasks()
        return true
      }
      return false
    } catch (error) {
      console.error('更新任务状态失败:', error)
      throw error
    }
  },

  // 切换置顶状态
  async togglePin(id: string) {
    try {
      const res = await taskApi.togglePin(id) as any
      
      if (res.success || res.data) {
        await this.fetchTasks()
        return true
      }
      return false
    } catch (error) {
      console.error('切换置顶状态失败:', error)
      throw error
    }
  }
}

export default useTaskStore