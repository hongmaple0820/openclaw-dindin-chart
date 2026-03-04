/**
 * 工作区状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { workspaceApi } from '@/api/workspace';

export const useWorkspaceStore = defineStore('workspaces', () => {
  // ==================== 状态 ====================
  const workspaces = ref([]);
  const currentWorkspace = ref(null);
  const currentFileTree = ref([]);
  const currentFiles = ref([]);
  const currentFileContent = ref('');
  const currentStats = ref(null);
  const searchResults = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // ==================== 计算属性 ====================
  const groupWorkspaces = computed(() => 
    workspaces.value.filter(w => w.type === 'group')
  );

  const dmWorkspaces = computed(() => 
    workspaces.value.filter(w => w.type === 'dm')
  );

  const taskWorkspaces = computed(() => 
    workspaces.value.filter(w => w.type === 'task')
  );

  const totalFileSize = computed(() => {
    return workspaces.value.reduce((acc, w) => {
      acc += w.totalSize || 0;
      return acc;
    }, 0);
  });

  const totalFileCount = computed(() => {
    return workspaces.value.reduce((acc, w) => {
      acc += w.fileCount || 0;
      return acc;
    }, 0);
  });

  // ==================== 工作区操作 ====================
  
  async function fetchWorkspaces(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.getList(params);
      if (res.success) {
        workspaces.value = res.workspaces || [];
      } else {
        error.value = res.error || '加载工作区列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载工作区列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchWorkspaceDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.getDetail(id);
      if (res.success) {
        currentWorkspace.value = res.workspace;
      } else {
        error.value = res.error || '加载工作区详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载工作区详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createWorkspace(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.create(data);
      if (res.success) {
        workspaces.value.unshift(res.workspace);
        return res.workspace;
      } else {
        error.value = res.error || '创建工作区失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建工作区失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateWorkspace(id, data) {
    try {
      const res = await workspaceApi.update(id, data);
      if (res.success) {
        if (currentWorkspace.value?.id === id) {
          currentWorkspace.value = { ...currentWorkspace.value, ...data };
        }
        const idx = workspaces.value.findIndex(w => w.id === id);
        if (idx !== -1) {
          workspaces.value[idx] = { ...workspaces.value[idx], ...data };
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新工作区失败:', err);
      return false;
    }
  }

  async function deleteWorkspace(id) {
    try {
      const res = await workspaceApi.delete(id);
      if (res.success) {
        workspaces.value = workspaces.value.filter(w => w.id !== id);
        if (currentWorkspace.value?.id === id) {
          clearCurrentWorkspace();
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除工作区失败:', err);
      return false;
    }
  }

  async function fetchStats(id) {
    try {
      const res = await workspaceApi.getStats(id);
      if (res.success) {
        currentStats.value = res.stats;
      }
    } catch (err) {
      console.error('获取工作区统计失败:', err);
    }
  }

  // ==================== 文件操作 ====================

  async function fetchFileTree(id, path = '/') {
    try {
      const res = await workspaceApi.getFileTree(id, path);
      if (res.success) {
        currentFileTree.value = res.tree || [];
      }
    } catch (err) {
      console.error('加载文件树失败:', err);
    }
  }

  async function fetchFiles(id, params) {
    try {
      const res = await workspaceApi.getFiles(id, params);
      if (res.success) {
        currentFiles.value = res.files || [];
      }
    } catch (err) {
      console.error('加载文件列表失败:', err);
    }
  }

  async function fetchFileContent(id, filePath) {
    try {
      const res = await workspaceApi.getFileContent(id, filePath);
      if (res.success) {
        currentFileContent.value = res.content;
        return res.content;
      }
      return null;
    } catch (err) {
      console.error('加载文件内容失败:', err);
      return null;
    }
  }

  async function saveFileContent(id, filePath, content) {
    try {
      const res = await workspaceApi.saveFileContent(id, filePath, content);
      return res.success;
    } catch (err) {
      console.error('保存文件失败:', err);
      return false;
    }
  }

  async function createFile(id, path, type = 'file', content = '') {
    try {
      const res = await workspaceApi.createFile(id, path, type, content);
      if (res.success) {
        await fetchFileTree(id);
        return res.file;
      }
      return null;
    } catch (err) {
      console.error('创建文件失败:', err);
      return null;
    }
  }

  async function deleteFile(id, filePath) {
    try {
      const res = await workspaceApi.deleteFile(id, filePath);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除文件失败:', err);
      return false;
    }
  }

  async function renameFile(id, oldPath, newPath) {
    try {
      const res = await workspaceApi.renameFile(id, oldPath, newPath);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('重命名文件失败:', err);
      return false;
    }
  }

  async function moveFile(id, sourcePath, targetPath) {
    try {
      const res = await workspaceApi.moveFile(id, sourcePath, targetPath);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('移动文件失败:', err);
      return false;
    }
  }

  async function copyFile(id, sourcePath, targetPath) {
    try {
      const res = await workspaceApi.copyFile(id, sourcePath, targetPath);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('复制文件失败:', err);
      return false;
    }
  }

  async function uploadFile(id, formData, onProgress) {
    try {
      const res = await workspaceApi.uploadFile(id, formData, onProgress);
      if (res.success) {
        await fetchFileTree(id);
        return res.file;
      }
      return null;
    } catch (err) {
      console.error('上传文件失败:', err);
      return null;
    }
  }

  // ==================== 搜索操作 ====================

  async function searchFiles(id, query, options = {}) {
    try {
      const res = await workspaceApi.searchFiles(id, query, options);
      if (res.success) {
        searchResults.value = res.results || [];
      }
    } catch (err) {
      console.error('搜索文件失败:', err);
    }
  }

  async function searchContent(id, query, options = {}) {
    try {
      const res = await workspaceApi.searchContent(id, query, options);
      if (res.success) {
        searchResults.value = res.results || [];
      }
    } catch (err) {
      console.error('搜索内容失败:', err);
    }
  }

  // ==================== 工具方法 ====================

  function clearCurrentWorkspace() {
    currentWorkspace.value = null;
    currentFileTree.value = [];
    currentFiles.value = [];
    currentFileContent.value = '';
    currentStats.value = null;
    searchResults.value = [];
  }

  return {
    // 状态
    workspaces,
    currentWorkspace,
    currentFileTree,
    currentFiles,
    currentFileContent,
    currentStats,
    searchResults,
    loading,
    error,
    // 计算属性
    groupWorkspaces,
    dmWorkspaces,
    taskWorkspaces,
    totalFileSize,
    totalFileCount,
    // 工作区方法
    fetchWorkspaces,
    fetchWorkspaceDetail,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    fetchStats,
    // 文件方法
    fetchFileTree,
    fetchFiles,
    fetchFileContent,
    saveFileContent,
    createFile,
    deleteFile,
    renameFile,
    moveFile,
    copyFile,
    uploadFile,
    // 搜索方法
    searchFiles,
    searchContent,
    // 工具方法
    clearCurrentWorkspace
  };
});
