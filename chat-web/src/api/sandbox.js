/**
 * 沙箱 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const sandboxApi = {
  // ==================== 沙箱管理 ====================
  
  /**
   * 获取沙箱列表
   */
  getList: () => api.get('/sandboxes'),

  /**
   * 获取沙箱详情
   */
  getDetail: (id) => api.get(`/sandboxes/${id}`),

  /**
   * 创建沙箱
   */
  create: (data) => api.post('/sandboxes', data),

  /**
   * 停止沙箱
   */
  stop: (id) => api.post(`/sandboxes/${id}/stop`),

  /**
   * 启动沙箱
   */
  start: (id) => api.post(`/sandboxes/${id}/start`),

  /**
   * 重启沙箱
   */
  restart: (id) => api.post(`/sandboxes/${id}/restart`),

  /**
   * 删除沙箱
   */
  delete: (id) => api.delete(`/sandboxes/${id}`),

  // ==================== 文件操作 ====================

  /**
   * 获取沙箱文件列表
   */
  getFiles: (id, path = '/') => api.get(`/sandboxes/${id}/files`, { params: { path } }),

  /**
   * 获取文件内容
   */
  getFileContent: (id, filePath) => api.get(`/sandboxes/${id}/files/content`, { params: { path: filePath } }),

  /**
   * 保存文件内容
   */
  saveFileContent: (id, filePath, content) => api.put(`/sandboxes/${id}/files/content`, { path: filePath, content }),

  /**
   * 创建文件/目录
   */
  createFile: (id, path, type = 'file') => api.post(`/sandboxes/${id}/files`, { path, type }),

  /**
   * 删除文件/目录
   */
  deleteFile: (id, filePath) => api.delete(`/sandboxes/${id}/files`, { params: { path: filePath } }),

  /**
   * 上传文件
   */
  uploadFile: (id, formData) => api.post(`/sandboxes/${id}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  /**
   * 下载文件
   */
  downloadFile: (id, filePath) => api.get(`/sandboxes/${id}/files/download`, { 
    params: { path: filePath },
    responseType: 'blob'
  }),

  // ==================== 终端操作 ====================

  /**
   * 执行命令
   */
  executeCommand: (id, command) => api.post(`/sandboxes/${id}/execute`, { command }),

  /**
   * 获取终端历史
   */
  getTerminalHistory: (id) => api.get(`/sandboxes/${id}/terminal/history`),

  // ==================== 资源监控 ====================

  /**
   * 获取资源使用情况
   */
  getResourceUsage: (id) => api.get(`/sandboxes/${id}/resources`),

  /**
   * 获取历史资源数据
   */
  getResourceHistory: (id, period = '1h') => api.get(`/sandboxes/${id}/resources/history`, { params: { period } }),

  // ==================== 进程管理 ====================

  /**
   * 获取进程列表
   */
  getProcesses: (id) => api.get(`/sandboxes/${id}/processes`),

  /**
   * 终止进程
   */
  killProcess: (id, pid) => api.delete(`/sandboxes/${id}/processes/${pid}`)
};

export default sandboxApi;
