/**
 * 配置文件
 */
const path = require('path');
const os = require('os');

// 数据目录
const dataDir = process.env.DATA_DIR || path.join(os.homedir(), '.openclaw/chat-data');

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3001
  },
  
  // 数据库配置
  database: {
    path: path.join(dataDir, 'admin.db')
  },
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'maple-chat-room-secret-key-2026',
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },
  
  // 邮件配置（密码找回）
  email: {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: process.env.SMTP_FROM || 'MapleChatRoom <noreply@example.com>'
  },
  
  // 密码配置
  password: {
    minLength: 6,
    saltRounds: 10
  },
  
  // 验证码配置
  verification: {
    codeLength: 6,
    expiresIn: 10 * 60 * 1000  // 10 分钟
  }
};
