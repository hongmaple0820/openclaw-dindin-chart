/**
 * 配置文件
 * @author 小琳
 * @date 2026-02-28
 */

// API 基础地址
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'http://your-server.com:8273'  // 生产环境
  : 'http://localhost:8273'         // 开发环境

// 应用配置
export const APP_CONFIG = {
  name: 'chat-mobile',
  version: '1.0.0',
  timeout: 10000,  // 请求超时时间（毫秒）
}

export default {
  API_BASE_URL,
  APP_CONFIG
}
