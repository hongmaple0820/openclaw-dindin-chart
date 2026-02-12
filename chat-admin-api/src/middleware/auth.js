/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { UserModel } = require('../models/user');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await UserModel.findById(decoded.userId);
    
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

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await UserModel.findById(decoded.userId);
    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user.id;
    }
  } catch (error) {
  }
  
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

const generateRefreshToken = (userId) => {
  const token = jwt.sign({ userId, type: 'refresh' }, config.jwt.secret, { 
    expiresIn: config.jwt.refreshExpiresIn 
  });
  
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
