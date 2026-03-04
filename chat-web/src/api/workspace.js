/**
 * 工作区 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const workspaceApi = {
  // ==================== 工作区管理 ====================
  
  /**
   * 获取工作区列表
   */
  getList: (params) => api.get('/workspaces', { params }),

  /**
   * 获取工作区详情
   */
  getDetail: (id) => api.get(`/workspaces/${id}`),

  /**
   * 创建工作区
   */
  create: (data) => api.post('/workspaces', data),

  /**
   * 更新工作区
   */
  update: (id, data) => api.put(`/workspaces/${id}`, data),

  /**
   * 删除工作区
   */
  delete: (id) => api.delete(`/workspaces/${id}`),

  /**
   * 获取工作区统计
   */
  getStats: (id) => api.get(`/workspaces/${id}/stats`),

  // ==================== 文件操作 ====================

  /**
   * 获取文件树
   */
  getFileTree: (id, path = '/') => api.get(`/workspaces/${id}/files/tree`, { params: { path } }),

  /**
   * 获取文件列表
   */
  getFiles: (id, params) => api.get(`/workspaces/${id}/files`, { params }),

  /**
   * 获取文件内容
   */
  getFileContent: (id, filePath) => api.get(`/workspaces/${id}/files/content`, { params: { path: filePath } }),

  /**
   * 保存文件内容
   */
  saveFileContent: (id, filePath, content) => api.put(`/workspaces/${id}/files/content`, { path: filePath, content }),

  /**
   * 创建文件/目录
   */
  createFile: (id, path, type = 'file', content = '') => api.post(`/workspaces/${id}/files`, { path, type, content }),

  /**
   * 删除文件/目录
   */
  deleteFile: (id, filePath) => api.delete(`/workspaces/${id}/files`, { params: { path: filePath } }),

  /**
   * 重命名文件/目录
   */
  renameFile: (id, oldPath, newPath) => api.put(`/workspaces/${id}/files/rename`, { oldPath, newPath }),

  /**
   * 移动文件/目录
   */
  moveFile: (id, sourcePath, targetPath) => api.put(`/workspaces/${id}/files/move`, { sourcePath, targetPath }),

  /**
   * 复制文件/目录
   */
  copyFile: (id, sourcePath, targetPath) => api.post(`/workspaces/${id}/files/copy`, { sourcePath, targetPath }),

  /**
   * 上传文件
   */
  uploadFile: (id, formData, onProgress) => api.post(`/workspaces/${id}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  }),

  /**
   * 下载文件
   */
  downloadFile: (id, filePath) => api.get(`/workspaces/${id}/files/download`, { 
    params: { path: filePath },
    responseType: 'blob'
  }),

  /**
   * 批量下载
   */
  downloadMultiple: (id, paths) => api.post(`/workspaces/${id}/files/download-multiple`, { paths }, {
    responseType: 'blob'
  }),

  // ==================== 搜索 ====================

  /**
   * 搜索文件
   */
  searchFiles: (id, query, options) => api.get(`/workspaces/${id}/files/search`, { 
    params: { query, ...options } 
  }),

  /**
   * 搜索内容
   */
  searchContent: (id, query, options) => api.get(`/workspaces/${id}/files/search-content`, { 
    params: { query, ...options } 
  })
};

export default workspaceApi;
