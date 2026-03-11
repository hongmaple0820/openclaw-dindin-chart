/**
 * 项目群状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { projectApi } from '@/api/projects';
import type { Project, Task, Skill } from '@/types';

interface ProjectWithStatus extends Project {
  status?: string;
}

interface ProjectMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

interface Board {
  id: string;
  name: string;
  order: number;
}

interface TaskWithBoard extends Task {
  boardId?: string;
  comments?: { id: string; content: string; author: string; createdAt: string }[];
}

interface SkillWithConfig extends Skill {
  projectId?: string;
}

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<ProjectWithStatus[]>([]);
  const currentProject = ref<ProjectWithStatus | null>(null);
  const currentMembers = ref<ProjectMember[]>([]);
  const currentSkills = ref<SkillWithConfig[]>([]);
  const currentTasks = ref<TaskWithBoard[]>([]);
  const currentBoards = ref<Board[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const activeProjects = computed(() => 
    projects.value.filter(p => p.status === 'active')
  );

  const completedProjects = computed(() => 
    projects.value.filter(p => p.status === 'completed')
  );

  const tasksByStatus = computed(() => {
    const result: Record<string, TaskWithBoard[]> = {};
    currentBoards.value.forEach(board => {
      result[board.id] = currentTasks.value.filter(t => t.boardId === board.id);
    });
    return result;
  });

  async function fetchProjects(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.getList();
      if (res.success) {
        projects.value = (res.projects as ProjectWithStatus[]) || [];
      } else {
        error.value = res.error || '加载项目群列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载项目群列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchProjectDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.getDetail(id);
      if (res.success && res.project) {
        currentProject.value = res.project as ProjectWithStatus;
      } else {
        error.value = res.error || '加载项目群详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载项目群详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createProject(data: { name: string; description?: string }): Promise<ProjectWithStatus | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.create(data);
      if (res.success && res.project) {
        const project = res.project as ProjectWithStatus;
        projects.value.unshift(project);
        return project;
      } else {
        error.value = res.error || '创建项目群失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建项目群失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateProject(id: string, data: Partial<Project>): Promise<boolean> {
    try {
      const res = await projectApi.update(id, data);
      if (res.success) {
        if (currentProject.value?.id === id) {
          currentProject.value = { ...currentProject.value, ...data };
        }
        const idx = projects.value.findIndex(p => p.id === id);
        if (idx !== -1) {
          projects.value[idx] = { ...projects.value[idx], ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新项目群失败:', err);
      return false;
    }
  }

  async function deleteProject(id: string): Promise<boolean> {
    try {
      const res = await projectApi.delete(id);
      if (res.success) {
        projects.value = projects.value.filter(p => p.id !== id);
        if (currentProject.value?.id === id) {
          clearCurrentProject();
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除项目群失败:', err);
      return false;
    }
  }

  async function fetchMembers(id: string): Promise<void> {
    try {
      const res = await projectApi.getMembers(id);
      if (res.success && res.members) {
        currentMembers.value = res.members as ProjectMember[];
      }
    } catch (err) {
      console.error('加载成员列表失败:', err);
    }
  }

  async function addMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const res = await projectApi.addMember(projectId, userId);
      if (res.success) {
        await fetchMembers(projectId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('添加成员失败:', err);
      return false;
    }
  }

  async function removeMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const res = await projectApi.removeMember(projectId, userId);
      if (res.success) {
        currentMembers.value = currentMembers.value.filter(m => m.userId !== userId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('移除成员失败:', err);
      return false;
    }
  }

  async function fetchSkills(id: string): Promise<void> {
    try {
      const res = await projectApi.getSkills(id);
      if (res.success && res.skills) {
        currentSkills.value = res.skills as SkillWithConfig[];
      }
    } catch (err) {
      console.error('加载技能列表失败:', err);
    }
  }

  async function createSkill(projectId: string, data: { name: string; description?: string }): Promise<SkillWithConfig | null> {
    try {
      const res = await projectApi.createSkill(projectId, data);
      if (res.success && res.skill) {
        const skill = res.skill as SkillWithConfig;
        currentSkills.value.push(skill);
        return skill;
      }
      return null;
    } catch (err) {
      console.error('创建技能失败:', err);
      return null;
    }
  }

  async function updateSkill(projectId: string, skillId: string, data: Partial<Skill>): Promise<boolean> {
    try {
      const res = await projectApi.updateSkill(projectId, skillId, data);
      if (res.success) {
        const idx = currentSkills.value.findIndex(s => s.id === skillId);
        if (idx !== -1) {
          currentSkills.value[idx] = { ...currentSkills.value[idx], ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新技能失败:', err);
      return false;
    }
  }

  async function deleteSkill(projectId: string, skillId: string): Promise<boolean> {
    try {
      const res = await projectApi.deleteSkill(projectId, skillId);
      if (res.success) {
        currentSkills.value = currentSkills.value.filter(s => s.id !== skillId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除技能失败:', err);
      return false;
    }
  }

  async function fetchTasks(id: string): Promise<void> {
    try {
      const res = await projectApi.getTasks(id);
      if (res.success && res.tasks) {
        currentTasks.value = res.tasks as TaskWithBoard[];
      }
    } catch (err) {
      console.error('加载任务列表失败:', err);
    }
  }

  async function createTask(projectId: string, data: { title: string; description?: string; priority?: 'low' | 'medium' | 'high' }): Promise<TaskWithBoard | null> {
    try {
      const res = await projectApi.createTask(projectId, data);
      if (res.success && res.task) {
        const task = res.task as TaskWithBoard;
        currentTasks.value.push(task);
        return task;
      }
      return null;
    } catch (err) {
      console.error('创建任务失败:', err);
      return null;
    }
  }

  async function updateTask(projectId: string, taskId: string, data: Partial<Task>): Promise<boolean> {
    try {
      const res = await projectApi.updateTask(projectId, taskId, data);
      if (res.success) {
        const idx = currentTasks.value.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          currentTasks.value[idx] = { ...currentTasks.value[idx], ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新任务失败:', err);
      return false;
    }
  }

  async function deleteTask(projectId: string, taskId: string): Promise<boolean> {
    try {
      const res = await projectApi.deleteTask(projectId, taskId);
      if (res.success) {
        currentTasks.value = currentTasks.value.filter(t => t.id !== taskId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除任务失败:', err);
      return false;
    }
  }

  async function addComment(projectId: string, taskId: string, content: string): Promise<{ id: string; content: string; author: string; createdAt: string } | null> {
    try {
      const res = await projectApi.addComment(projectId, taskId, content);
      if (res.success && res.comment) {
        const comment = res.comment as { id: string; content: string; author: string; createdAt: string };
        const task = currentTasks.value.find(t => t.id === taskId);
        if (task) {
          if (!task.comments) task.comments = [];
          task.comments.push(comment);
        }
        return comment;
      }
      return null;
    } catch (err) {
      console.error('添加评论失败:', err);
      return null;
    }
  }

  async function fetchBoards(id: string): Promise<void> {
    try {
      const res = await projectApi.getBoards(id);
      if (res.success && res.boards) {
        currentBoards.value = res.boards as Board[];
      }
    } catch (err) {
      console.error('加载看板列表失败:', err);
    }
  }

  async function createBoard(projectId: string, data: { name: string }): Promise<Board | null> {
    try {
      const res = await projectApi.createBoard(projectId, data);
      if (res.success && res.board) {
        const board = res.board as Board;
        currentBoards.value.push(board);
        return board;
      }
      return null;
    } catch (err) {
      console.error('创建看板列失败:', err);
      return null;
    }
  }

  async function reorderBoards(projectId: string, data: { boardIds: string[] }): Promise<boolean> {
    try {
      const res = await projectApi.reorderBoards(projectId, data);
      if (res.success && res.boards) {
        currentBoards.value = res.boards as Board[];
        return true;
      }
      return false;
    } catch (err) {
      console.error('重排序看板失败:', err);
      return false;
    }
  }

  function clearCurrentProject(): void {
    currentProject.value = null;
    currentMembers.value = [];
    currentSkills.value = [];
    currentTasks.value = [];
    currentBoards.value = [];
  }

  return {
    projects,
    currentProject,
    currentMembers,
    currentSkills,
    currentTasks,
    currentBoards,
    loading,
    error,
    activeProjects,
    completedProjects,
    tasksByStatus,
    fetchProjects,
    fetchProjectDetail,
    createProject,
    updateProject,
    deleteProject,
    fetchMembers,
    addMember,
    removeMember,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    fetchBoards,
    createBoard,
    reorderBoards,
    clearCurrentProject
  };
});