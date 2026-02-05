/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { UserModel } = require('../models/user');

/**
 * 验证 JWT Token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = UserModel.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: '账户已被禁用' });
    }
    
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: '令牌已过期', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: '无效的认证令牌' });
  }
};

/**
 * 可选认证（不强制要求登录）
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = UserModel.findById(decoded.userId);
    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user.id;
    }
  } catch (error) {
    // 忽略错误，继续处理
  }
  
  next();
};

/**
 * 管理员权限检查
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
};

/**
 * 生成 JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

/**
 * 生成刷新令牌
 */
const generateRefreshToken = (userId) => {
  const token = jwt.sign({ userId, type: 'refresh' }, config.jwt.secret, { 
    expiresIn: config.jwt.refreshExpiresIn 
  });
  
  // 计算过期时间
  const decoded = jwt.decode(token);
  const expiresAt = decoded.exp * 1000;
  
  return { token, expiresAt };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  generateToken,
  generateRefreshToken
};
