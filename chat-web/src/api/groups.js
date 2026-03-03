/**
 * 群聊 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';

export const groupApi = {
  /**
   * 创建群聊
   */
  create(data) {
    return api.post('/groups', data);
  },

  /**
   * 获取群聊列表
   */
  getList() {
    return api.get('/groups');
  },

  /**
   * 获取群详情
   */
  getDetail(id) {
    return api.get(`/groups/${id}`);
  },

  /**
   * 获取群成员列表
   */
  getMembers(id) {
    return api.get(`/groups/${id}/members`);
  },

  /**
   * 邀请成员
   */
  invite(id, data) {
    return api.post(`/groups/${id}/invite`, data);
  },

  /**
   * 移除成员
   */
  removeMember(id, userId) {
    return api.delete(`/groups/${id}/members/${userId}`);
  },

  /**
   * 设置管理员
   */
  setAdmin(id, userId, isAdmin) {
    return api.put(`/groups/${id}/admins/${userId}`, { isAdmin });
  },

  /**
   * 转让群主
   */
  transfer(id, newOwnerId) {
    return api.put(`/groups/${id}/transfer`, { newOwnerId });
  },

  /**
   * 解散群聊
   */
  dismiss(id) {
    return api.delete(`/groups/${id}`);
  },

  /**
   * 退出群聊
   */
  leave(id) {
    return api.post(`/groups/${id}/leave`);
  },

  /**
   * 设置群名片
   */
  setNickname(id, userId, nickname) {
    return api.put(`/groups/${id}/members/${userId}/nickname`, { nickname });
  },

  /**
   * 添加机器人
   */
  addBot(id, botId) {
    return api.post(`/groups/${id}/bots`, { botId });
  },

  /**
   * 移除机器人
   */
  removeBot(id, botId) {
    return api.delete(`/groups/${id}/bots/${botId}`);
  },

  /**
   * 更新群信息
   */
  update(id, data) {
    return api.put(`/groups/${id}`, data);
  },

  /**
   * 获取群消息
   */
  getMessages(id, params = {}) {
    return api.get(`/groups/${id}/messages`, { params });
  },

  /**
   * 发送群消息
   */
  sendMessage(id, data) {
    return api.post(`/groups/${id}/messages`, data);
  }
};

export default groupApi;