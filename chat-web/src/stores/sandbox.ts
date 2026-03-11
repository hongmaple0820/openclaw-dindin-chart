/**
 * 沙箱状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { sandboxApi } from '@/api/sandbox';
import type { Sandbox } from '@/types';

interface SandboxWithResources extends Sandbox {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
}

interface SandboxFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface TerminalEntry {
  command: string;
  output: string;
  timestamp: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  timestamp: number;
}

interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export const useSandboxStore = defineStore('sandboxes', () => {
  const sandboxes = ref<SandboxWithResources[]>([]);
  const currentSandbox = ref<SandboxWithResources | null>(null);
  const currentFiles = ref<SandboxFile[]>([]);
  const currentFileContent = ref('');
  const terminalHistory = ref<TerminalEntry[]>([]);
  const resourceHistory = ref<ResourceUsage[]>([]);
  const processes = ref<Process[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  async function fetchSandboxes(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.getList();
      if (res.success && res.sandboxes) {
        sandboxes.value = res.sandboxes as SandboxWithResources[];
      } else {
        error.value = res.error || '加载沙箱列表失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载沙箱列表失败';
    } finally {
      loading.value = false;
    }
  }

  async function fetchSandboxDetail(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.getDetail(id);
      if (res.success && res.sandbox) {
        currentSandbox.value = res.sandbox as SandboxWithResources;
      } else {
        error.value = res.error || '加载沙箱详情失败';
      }
    } catch (err) {
      error.value = (err as Error).message || '加载沙箱详情失败';
    } finally {
      loading.value = false;
    }
  }

  async function createSandbox(data: { name: string; image?: string }): Promise<SandboxWithResources | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await sandboxApi.create(data);
      if (res.success && res.sandbox) {
        const sandbox = res.sandbox as SandboxWithResources;
        sandboxes.value.unshift(sandbox);
        return sandbox;
      } else {
        error.value = res.error || '创建沙箱失败';
        return null;
      }
    } catch (err) {
      error.value = (err as Error).message || '创建沙箱失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function stopSandbox(id: string): Promise<boolean> {
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

  async function restartSandbox(id: string): Promise<boolean> {
    try {
      const res = await sandboxApi.restart(id);
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

  async function deleteSandbox(id: string): Promise<boolean> {
    try {
      const res = await sandboxApi.delete(id);
      if (res.success) {
        sandboxes.value = sandboxes.value.filter(s => s.id !== id);
        if (currentSandbox.value?.id === id) {
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

  async function fetchFiles(id: string, path = '/'): Promise<void> {
    try {
      const res = await sandboxApi.getFiles(id, path);
      if (res.success && res.files) {
        currentFiles.value = res.files as SandboxFile[];
      }
    } catch (err) {
      console.error('加载文件列表失败:', err);
    }
  }

  async function fetchFileContent(id: string, filePath: string): Promise<string | null> {
    try {
      const res = await sandboxApi.getFileContent(id, filePath);
      if (res.success && res.content) {
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
      const res = await sandboxApi.saveFileContent(id, filePath, content);
      return res.success;
    } catch (err) {
      console.error('保存文件失败:', err);
      return false;
    }
  }

  async function executeCommand(id: string, command: string): Promise<string | null> {
    try {
      const res = await sandboxApi.executeCommand(id, command);
      if (res.success && res.output) {
        terminalHistory.value.push({
          command,
          output: res.output as string,
          timestamp: Date.now()
        });
        return res.output as string;
      }
      return null;
    } catch (err) {
      console.error('执行命令失败:', err);
      return null;
    }
  }

  async function fetchTerminalHistory(id: string): Promise<void> {
    try {
      const res = await sandboxApi.getTerminalHistory(id);
      if (res.success && res.history) {
        terminalHistory.value = res.history as TerminalEntry[];
      }
    } catch (err) {
      console.error('加载终端历史失败:', err);
    }
  }

  async function fetchResourceUsage(id: string): Promise<void> {
    try {
      const res = await sandboxApi.getResourceUsage(id);
      if (res.success && res.usage) {
        const usage = res.usage as ResourceUsage;
        resourceHistory.value.push({
          ...usage,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('获取资源使用失败:', err);
    }
  }

  async function fetchResourceHistory(id: string, period = '1h'): Promise<void> {
    try {
      const res = await sandboxApi.getResourceHistory(id, period);
      if (res.success && res.history) {
        resourceHistory.value = res.history as ResourceUsage[];
      }
    } catch (err) {
      console.error('获取资源历史失败:', err);
    }
  }

  async function fetchProcesses(id: string): Promise<void> {
    try {
      const res = await sandboxApi.getProcesses(id);
      if (res.success && res.processes) {
        processes.value = res.processes as Process[];
      }
    } catch (err) {
      console.error('获取进程列表失败:', err);
    }
  }

  async function killProcess(id: string, pid: number): Promise<boolean> {
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

  function clearCurrentSandbox(): void {
    currentSandbox.value = null;
    currentFiles.value = [];
    currentFileContent.value = '';
    terminalHistory.value = [];
    resourceHistory.value = [];
    processes.value = [];
  }

  return {
    sandboxes,
    currentSandbox,
    currentFiles,
    currentFileContent,
    terminalHistory,
    resourceHistory,
    processes,
    loading,
    error,
    activeSandboxes,
    stoppedSandboxes,
    totalResources,
    fetchSandboxes,
    fetchSandboxDetail,
    createSandbox,
    stopSandbox,
    restartSandbox,
    deleteSandbox,
    fetchFiles,
    fetchFileContent,
    saveFileContent,
    executeCommand,
    fetchTerminalHistory,
    fetchResourceUsage,
    fetchResourceHistory,
    fetchProcesses,
    killProcess,
    clearCurrentSandbox
  };
});