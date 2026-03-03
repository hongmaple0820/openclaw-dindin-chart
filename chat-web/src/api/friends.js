/**
 * 好友系统 API
 * @author 小琳
 * @date 2026-03-03
 */
import api from './index';

export const friendApi = {
  /**
   * 搜索用户
   */
  search(q) {
    return api.get(`/friends/search?q=${encodeURIComponent(q)}`);
  },

  /**
   * 发送好友申请
   */
  sendRequest(data) {
    return api.post('/friends/request', data);
  },

  /**
   * 获取好友申请列表
   */
  getRequests() {
    return api.get('/friends/requests');
  },

  /**
   * 处理好友申请（同意/拒绝）
   */
  handleRequest(id, status) {
    return api.put(`/friends/requests/${id}`, { status });
  },

  /**
   * 获取好友列表
   */
  getList() {
    return api.get('/friends');
  },

  /**
   * 设置好友备注
   */
  setRemark(id, remark) {
    return api.put(`/friends/${id}/remark`, { remark });
  },

  /**
   * 删除好友
   */
  delete(id) {
    return api.delete(`/friends/${id}`);
  },

  /**
   * 拉黑用户
   */
  block(id) {
    return api.post(`/friends/${id}/block`);
  }
};

export default friendApi;
