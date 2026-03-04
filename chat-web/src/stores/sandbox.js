/**
 * 沙箱状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { sandboxApi } from '@/api/sandbox';

export const useSandboxStore = defineStore('sandboxes', () => {
  // ==================== 状态 ====================
  const sandboxes = ref([]);
  const currentSandbox = ref(null);
  const currentFiles = ref([]);
  const currentFileContent = ref('');
  const terminalHistory = ref([]);
  const resourceHistory = ref([]);
  const processes = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // ==================== 计算属性 ====================
  const activeSandboxes = computed(() => 
    sandboxes.value.filter(s => s.status === 'running')
  );

  const stoppedSandboxes = computed(() => 
    sandboxes.value.filter(s => s.status === 'stopped')
  );

  const totalResources = computed(() => {
    return sandboxes.value.reduce((acc, s) => {
      acc.cpu += s.cpuUsage || 0;
      acc.memory += s.memoryUsage || 0;
      acc.disk += s.diskUsage || 0;
      return acc;
    }, { cpu: 0, memory: 0, disk: 0 });
  });

  // ==================== 沙箱操作 ====================
  
  async function fetchSandboxes() {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.getList();
      if (res.success) {
        sandboxes.value = res.sandboxes || [];
      } else {
        error.value = res.error || '加载沙箱列表失败';
      }
    } catch (err) {
      error.value = err.message || '加载沙箱列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchSandboxDetail(id) {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.getDetail(id);
      if (res.success) {
        currentSandbox.value = res.sandbox;
      } else {
        error.value = res.error || '加载沙箱详情失败';
      }
    } catch (err) {
      error.value = err.message || '加载沙箱详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createSandbox(data) {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.create(data);
      if (res.success) {
        sandboxes.value.unshift(res.sandbox);
        return res.sandbox;
      } else {
        error.value = res.error || '创建沙箱失败';
        return null;
      }
    } catch (err) {
      error.value = err.message || '创建沙箱失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function startSandbox(id) {
    try {
      const res = await sandboxApi.start(id);
      if (res.success) {
        const sandbox = sandboxes.value.find(s => s.id === id);
        if (sandbox) {
          sandbox.status = 'running';
        }
        if (currentSandbox.value?.id === id) {
          currentSandbox.value.status = 'running';
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('启动沙箱失败:', err);
      return false;
    }
  }

  async function stopSandbox(id) {
    try {
      const res = await sandboxApi.stop(id);
      if (res.success) {
        const sandbox = sandboxes.value.find(s => s.id === id);
        if (sandbox) {
          sandbox.status = 'stopped';
        }
        if (currentSandbox.value?.id === id) {
          currentSandbox.value.status = 'stopped';
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('停止沙箱失败:', err);
      return false;
    }
  }

  async function restartSandbox(id) {
    try {
      const res = await si.restart(id);
      if (res.success) {
        const sandbox = sandboxes.value.find(s => s.id === id);
        if (sandbox) {
          sandbox.status = 'running';
        }
        if (currentSandbox.value?.id === id) {
          currentSandbox.value.status = 'running';
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('重启沙箱失败:', err);
      return false;
    }
  }

  async function deleteSandbox(id) {
    try {
      const res = await sandboxApi.delete(id);
      if (res.success) {
        sandboxes.value = sandboxes.value.filter(s => s.id !==        if (currentSandbox.value?.id === id) {
          clearCurrentSandbox();
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除沙箱失败:', err);
      return false;
    }
  }

  // ==================== 文件操作 ====================

  async function fetchFiles(id, path = '/') {
    try {
      const res = await sandboxApi.getFiles(id, path);
      if (res.success) {
        currentFiles.value = res.files || [];
      }
    } catch (err) {
      console.error('加载文件列表失败:', err);
    }
  }

  async function fetchFileContent(id, filePath) {
    try {
      const res = await sandboxApi.getFileContent(id, filePath);
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
      const res = await sandboxApi.saveFileContent(id, filePath, content);
      return res.success;
    } catch (err) {
      console.error('保存文件失败:', err);
      return false;
    }
  }

  // ==================== 终端操作 ====================

  async function executeCommand(id, command) {
    try {
      const res = await sandboxApi.executeCommand(id, command);
      if (res.success) {
        terminalHistory.value.push({
          command,
          output: res.output,
          timestamp: new Date().toISOString()
        });
        return res.output;
      }
      return null;
    } catch (err) {
      console.error('执行命令失败:', err);
      return null;
    }
  }

  async function fetchTerminalHistory(id) {
    try {
      const res = await sandboxApi.getTerminalHistory(id);
      if (res.success) {
        terminalHistory.value = res.history || [];
      }
    } catch (err) {
      console.error('加载终端历史失败:', err);
    }
  }

  // ==================== 资源监控 ====================

  async function fetchResourceUsage(id) {
    try {
      const res = await sandboxApi.getResourceUsage(id);
      if (res.success && currentSandbox.value?.id === id) {
        currentSandbox.value = {
          ...currentSandbox.value,
          ...res.usage
        };
      }
      return res.usage;
    } catch (err) {
      console.error('获取资源使用情况失败:', err);
      return null;
    }
  }

  async function fetchResourceHistory(id, period = '1h') {
    try {
      const res = await sandboxApi.getResourceHistory(id, period);
      if (res.success) {
        resourceHistory.value = res.history || [];
      }
    } catch (err) {
      console.error('获取资源历史失败:', err);
    }
  }

  // ==================== 进程管理 ====================

  async function fetchProcesses(id) {
    try {
      const res = await sandboxApi.getProcesses(id);
      if (res.success) {
        processes.value = res.processes || [];
      }
    } catch (err) {
      console.error('获取进程列表失败:', err);
    }
  }

  async function killProcess(id, pid) {
    try {
      const res = await sandboxApi.killProcess(id, pid);
      if (res.success) {
        processes.value = processes.value.filter(p => p.pid !== pid);
        return true;
      }
      return false;
    } catch (err) {
      console.error('终止进程失败:', err);
      return false;
    }
  }

  // ==================== 工具方法 ====================

  function clearCurrentSandbox() {
    currentSandbox.value = null;
    currentFiles.value = [];
    currentFileContent.value = '';
    terminalHistory.value = [];
    resourceHistory.value = [];
    processes.value = [];
  }

  return {
    // 状态
    sandboxes,
    currentSandbox,
    currentFiles,
    currentFileContent,
    terminalHistory,
    resourceHistory,
    processes,
    loading,
    error,
    // 计算属性
    activeSandboxes,
    stoppedSandboxes,
    totalResources,
    // 沙箱方法
    fetchSandboxes,
    fetchSandboxDetail,
    createSandbox,
    startSandbox,
    stopSandbox,
    restartSandbox,
    deleteSandbox,
    // 文件方法
    fetchFiles,
    fetchFileContent,
    saveFileContent,
    // 终端方法
    executeCommand,
    fetchTerminalHistory,
    // 资源方法
    fetchResourceUsage,
    fetchResourceHistory,
    // 进程方法
    fetchProcesses,
    killProcess,
    // 工具方法
    clearCurrentSandbox
  };
});
