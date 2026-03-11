/**
 * 工作区状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { workspaceApi } from '@/api/workspace';

interface CreateWorkspaceData {
  name: string;
  description?: string;
}

interface WorkspaceItem {
  id: string;
  name: string;
  type: string;
  totalSize?: number;
  fileCount?: number;
  [key: string]: unknown;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

interface SearchResult {
  id: string;
  name: string;
  path: string;
  content?: string;
  relevance: number;
}

export const useWorkspaceStore = defineStore('workspaces', () => {
  // ==================== 状态 ====================
  const workspaces = ref<WorkspaceItem[]>([]);
  const currentWorkspace = ref<WorkspaceItem | null>(null);
  const currentFileTree = ref<FileTreeItem[]>([]);
  const currentFiles = ref<FileItem[]>([]);
  const currentFileContent = ref('');
  const currentStats = ref<Record<string, unknown> | null>(null);
  const searchResults = ref<SearchResult[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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
  
  async function fetchWorkspaces(params: Record<string, unknown> = {}): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.getList(params);
      if (res.success) {
        workspaces.value = (res.workspaces || []) as WorkspaceItem[];
      } else {
        error.value = res.error || '加载工作区列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载工作区列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchWorkspaceDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.getDetail(id);
      if (res.success) {
        currentWorkspace.value = res.workspace as WorkspaceItem;
      } else {
        error.value = res.error || '加载工作区详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载工作区详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createWorkspace(data: CreateWorkspaceData): Promise<WorkspaceItem | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await workspaceApi.create(data);
      if (res.success) {
        const ws = res.workspace as WorkspaceItem;
        workspaces.value.unshift(ws);
        return ws;
      } else {
        error.value = res.error || '创建工作区失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建工作区失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateWorkspace(id: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await workspaceApi.update(id, data);
      if (res.success) {
        if (currentWorkspace.value?.id === id) {
          currentWorkspace.value = { ...currentWorkspace.value, ...data } as WorkspaceItem;
        }
        const idx = workspaces.value.findIndex(w => w.id === id);
        if (idx !== -1) {
          workspaces.value[idx] = { ...workspaces.value[idx], ...data } as WorkspaceItem;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新工作区失败:', err);
      return false;
    }
  }

  async function deleteWorkspace(id: string): Promise<boolean> {
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

  async function fetchStats(id: string): Promise<void> {
    try {
      const res = await workspaceApi.getStats(id);
      if (res.success) {
        currentStats.value = res.stats as Record<string, unknown>;
      }
    } catch (err) {
      console.error('获取工作区统计失败:', err);
    }
  }

  // ==================== 文件操作 ====================

  async function fetchFileTree(id: string, path = '/'): Promise<void> {
    try {
      const res = await workspaceApi.getFileTree(id, path);
      if (res.success) {
        currentFileTree.value = (res.tree || []) as FileTreeItem[];
      }
    } catch (err) {
      console.error('加载文件树失败:', err);
    }
  }

  async function fetchFiles(id: string, params?: Record<string, unknown>): Promise<void> {
    try {
      const res = await workspaceApi.getFiles(id, params);
      if (res.success) {
        currentFiles.value = (res.files || []) as FileItem[];
      }
    } catch (err) {
      console.error('加载文件列表失败:', err);
    }
  }

  async function fetchFileContent(id: string, filePath: string): Promise<string | null> {
    try {
      const res = await workspaceApi.getFileContent(id, filePath);
      if (res.success) {
        currentFileContent.value = res.content as string;
        return res.content as string;
      }
      return null;
    } catch (err) {
      console.error('加载文件内容失败:', err);
      return null;
    }
  }

  async function saveFileContent(id: string, filePath: string, content: string): Promise<boolean> {
    try {
      const res = await workspaceApi.saveFileContent(id, filePath, content);
      return res.success;
    } catch (err) {
      console.error('保存文件失败:', err);
      return false;
    }
  }

  async function createFile(id: string, path: string, type: 'file' | 'directory' = 'file', content = ''): Promise<boolean> {
    try {
      const res = await workspaceApi.createFile(id, path, type, content);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('创建文件失败:', err);
      return false;
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

  async function uploadFile(id: string, formData: FormData, onProgress?: unknown): Promise<boolean> {
    try {
      const res = await workspaceApi.uploadFile(id, formData, onProgress);
      if (res.success) {
        await fetchFileTree(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('上传文件失败:', err);
      return false;
    }
  }

  // ==================== 搜索操作 ====================

  async function searchFiles(id: string, query: string, options: Record<string, unknown> = {}): Promise<void> {
    try {
      const res = await workspaceApi.searchFiles(id, query, options);
      if (res.success) {
        const files = res.files as FileItem[];
        searchResults.value = (files || []).map(f => ({
          id: f.id,
          name: f.name,
          path: f.path,
          relevance: 1
        }));
      }
    } catch (err) {
      console.error('搜索文件失败:', err);
    }
  }

  async function searchContent(id: string, query: string, options: Record<string, unknown> = {}): Promise<void> {
    try {
      const res = await workspaceApi.searchContent(id, query, options);
      if (res.success) {
        searchResults.value = (res.results || []) as SearchResult[];
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
