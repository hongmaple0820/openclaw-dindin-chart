/**
 * JWT 认证中间件
 */
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const config = require('../config');
const { UserModel } = require('../models/user');

interface JwtPayload {
  userId: string;
  type?: string;
  exp?: number;
}

interface User {
  id: string;
  role: string;
  status: string;
}

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供认证令牌' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }
    
    if (user.status !== 'active') {
      res.status(403).json({ success: false, error: '账户已被禁用' });
      return;
    }
    
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: '令牌已过期', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, error: '无效的认证令牌' });
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await UserModel.findById(decoded.userId);
    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user.id;
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: '需要管理员权限' });
    return;
  }
  next();
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

export const generateRefreshToken = (userId: string): { token: string; expiresAt: number } => {
  const token = jwt.sign({ userId, type: 'refresh' }, config.jwt.secret, { 
    expiresIn: config.jwt.refreshExpiresIn 
  });
  
  const decoded = jwt.decode(token) as JwtPayload;
  const expiresAt = (decoded?.exp || 0) * 1000;
  
  return { token, expiresAt };
};