/**
 * 项目群状态管理
 * @author 小琳
 * @date 2026-03-03
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { projectApi } from '@/api/projects';

export const useProjectStore = defineStore('projects', () => {
  // ==================== 状态 ====================
  const projects = ref([]);
  const currentProject = ref(null);
  const currentMembers = ref([]);
  const currentSkills = ref([]);
  const currentTasks = ref([]);
  const currentBoards = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // ==================== 计算属性 ====================
  const activeProjects = computed(() => 
    projects.value.filter(p => p.status === 'active')
  );

  const completedProjects = computed(() => 
    projects.value.filter(p => p.status === 'completed')
  );

  const tasksByStatus = computed(() => {
    const result = {};
    currentBoards.value.forEach(board => {
      result[board.id] = currentTasks.value.filter(t => t.boardId === board.id);
    });
    return result;
  });

  // ==================== 项目群操作 ====================
  
  async function fetchProjects() {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.getList();
      if (res.success) {
        projects.value = res.projects || [];
      } else {
        error.value = res.error || '加载项目群列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载项目群列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchProjectDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.getDetail(id);
      if (res.success) {
        currentProject.value = res.project;
      } else {
        error.value = res.error || '加载项目群详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载项目群详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createProject(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await projectApi.create(data);
      if (res.success) {
        projects.value.unshift(res.project);
        return res.project;
      } else {
        error.value = res.error || '创建项目群失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建项目群失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateProject(id, data) {
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

  async function deleteProject(id) {
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

  // ==================== 成员操作 ====================

  async function fetchMembers(id) {
    try {
      const res = await projectApi.getMembers(id);
      if (res.success) {
        currentMembers.value = res.members || [];
      }
    } catch (err) {
      console.error('加载成员列表失败:', err);
    }
  }

  async function addMember(projectId, userId) {
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

  async function removeMember(projectId, userId) {
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

  // ==================== 技能操作 ====================

  async function fetchSkills(id) {
    try {
      const res = await projectApi.getSkills(id);
      if (res.success) {
        currentSkills.value = res.skills || [];
      }
    } catch (err) {
      console.error('加载技能列表失败:', err);
    }
  }

  async function createSkill(projectId, data) {
    try {
      const res = await projectApi.createSkill(projectId, data);
      if (res.success) {
        currentSkills.value.push(res.skill);
        return res.skill;
      }
      return null;
    } catch (err) {
      console.error('创建技能失败:', err);
      return null;
    }
  }

  async function updateSkill(projectId, skillId, data) {
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

  async function deleteSkill(projectId, skillId) {
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

  // ==================== 任务操作 ====================

  async function fetchTasks(id) {
    try {
      const res = await projectApi.getTasks(id);
      if (res.success) {
        currentTasks.value = res.tasks || [];
      }
    } catch (err) {
      console.error('加载任务列表失败:', err);
    }
  }

  async function createTask(projectId, data) {
    try {
      const res = await projectApi.createTask(projectId, data);
      if (res.success) {
        currentTasks.value.push(res.task);
        return res.task;
      }
      return null;
    } catch (err) {
      console.error('创建任务失败:', err);
      return null;
    }
  }

  async function updateTask(projectId, taskId, data) {
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

  async function deleteTask(projectId, taskId) {
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

  async function addComment(projectId, taskId, content) {
    try {
      const res = await projectApi.addComment(projectId, taskId, content);
      if (res.success) {
        const task = currentTasks.value.find(t => t.id === taskId);
        if (task) {
          if (!task.comments) task.comments = [];
          task.comments.push(res.comment);
        }
        return res.comment;
      }
      return null;
    } catch (err) {
      console.error('添加评论失败:', err);
      return null;
    }
  }

  // ==================== 看板操作 ====================

  async function fetchBoards(id) {
    try {
      const res = await projectApi.getBoards(id);
      if (res.success) {
        currentBoards.value = res.boards || [];
      }
    } catch (err) {
      console.error('加载看板列表失败:', err);
    }
  }

  async function createBoard(projectId, data) {
    try {
      const res = await projectApi.createBoard(projectId, data);
      if (res.success) {
        currentBoards.value.push(res.board);
        return res.board;
      }
      return null;
    } catch (err) {
      console.error('创建看板列失败:', err);
      return null;
    }
  }

  async function reorderBoards(projectId, data) {
    try {
      const res = await projectApi.reorderBoards(projectId, data);
      if (res.success) {
        currentBoards.value = res.boards || currentBoards.value;
        return true;
      }
      return false;
    } catch (err) {
      console.error('重排序看板失败:', err);
      return false;
    }
  }

  // ==================== 工具方法 ====================

  function clearCurrentProject() {
    currentProject.value = null;
    currentMembers.value = [];
    currentSkills.value = [];
    currentTasks.value = [];
    currentBoards.value = [];
  }

  return {
    // 状态
    projects,
    currentProject,
    currentMembers,
    currentSkills,
    currentTasks,
    currentBoards,
    loading,
    error,
    // 计算属性
    activeProjects,
    completedProjects,
    tasksByStatus,
    // 项目群方法
    fetchProjects,
    fetchProjectDetail,
    createProject,
    updateProject,
    deleteProject,
    // 成员方法
    fetchMembers,
    addMember,
    removeMember,
    // 技能方法
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    // 任务方法
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    // 看板方法
    fetchBoards,
    createBoard,
    reorderBoards,
    // 工具方法
    clearCurrentProject
  };
});
