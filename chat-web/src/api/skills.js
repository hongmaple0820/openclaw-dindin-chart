/**
 * Skills 系统 API
 * @author 小琳
 * @date 2026-03-04
 */
import api from './index';

export const skillApi = {
  /**
   * 获取技能列表
   * @param {Object} params - 查询参数
   * @param {string} params.type - 类型: built-in, my, market
   * @param {string} params.q - 搜索关键词
   * @param {string} params.category - 分类筛选
   */
  getList(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/skills?${query}`);
  },

  /**
   * 获取技能详情
   * @param {string} skillId - 技能 ID
   */
  getDetail(skillId) {
    return api.get(`/skills/${skillId}`);
  },

  /**
   * 安装技能
   * @param {string} skillId - 技能 ID
   * @param {Object} options - 安装选项
   */
  install(skillId, options = {}) {
    return api.post(`/skills/${skillId}/install`, options);
  },

  /**
   * 卸载技能
   * @param {string} skillId - 技能 ID
   */
  uninstall(skillId) {
    return api.delete(`/skills/${skillId}`);
  },

  /**
   * 更新技能配置
   * @param {string} skillId - 技能 ID
   * @param {Object} config - 配置对象
   */
  updateConfig(skillId, config) {
    return api.put(`/skills/${skillId}/config`, config);
  },

  /**
   * 获取技能配置
   * @param {string} skillId - 技能 ID
   */
  getConfig(skillId) {
    return api.get(`/skills/${skillId}/config`);
  },

  /**
   * 启用/禁用技能
   * @param {string} skillId - 技能 ID
   * @param {boolean} enabled - 是否启用
   */
  toggleEnabled(skillId, enabled) {
    return api.put(`/skills/${skillId}/enabled`, { enabled });
  },

  /**
   * 测试技能调用
   * @param {string} skillId - 技能 ID
   * @param {Object} params - 调用参数
   */
  testCall(skillId, params = {}) {
    return api.post(`/skills/${skillId}/test`, params);
  },

  /**
   * 获取技能使用历史
   * @param {string} skillId - 技能 ID
   * @param {Object} params - 分页参数
   */
  getHistory(skillId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return api.get(`/skills/${skillId}/history?${query}`);
  },

  /**
   * 获取 MCP 服务器列表
   */
  getMCPServers() {
    return api.get('/skills/mcp-servers');
  },

  /**
   * 添加 MCP 服务器
   * @param {Object} server - 服务器配置
   */
  addMCPServer(server) {
    return api.post('/skills/mcp-servers', server);
  },

  /**
   * 更新 MCP 服务器
   * @param {string} serverId - 服务器 ID
   * @param {Object} server - 服务器配置
   */
  updateMCPServer(serverId, server) {
    return api.put(`/skills/mcp-servers/${serverId}`, server);
  },

  /**
   * 删除 MCP 服务器
   * @param {string} serverId - 服务器 ID
   */
  deleteMCPServer(serverId) {
    return api.delete(`/skills/mcp-servers/${serverId}`);
  },

  /**
   * 测试 MCP 服务器连接
   * @param {string} serverId - 服务器 ID
   */
  testMCPServer(serverId) {
    return api.post(`/skills/mcp-servers/${serverId}/test`);
  },

  /**
   * 搜索市场技能
   * @param {string} query - 搜索关键词
   */
  searchMarket(query) {
    return api.get(`/skills/market/search?q=${encodeURIComponent(query)}`);
  },

  /**
   * 获取技能分类
   */
  getCategories() {
    return api.get('/skills/categories');
  },

  /**
   * 获取推荐技能
   */
  getRecommended() {
    return api.get('/skills/recommended');
  }
};

export default skillApi;
