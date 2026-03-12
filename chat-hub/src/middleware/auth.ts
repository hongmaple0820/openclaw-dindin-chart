/**
 * JWT 认证中间件
 * 使用 auth.ts 的 verifyToken 确保数据库一致性
 */
import { Request, Response, NextFunction } from 'express';

const auth = require('../auth');

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
  
  // 使用 auth.ts 的 verifyToken（查询 users.db）
  const result = auth.verifyToken(token);
  
  if (!result.success) {
    res.status(401).json(result);
    return;
  }
  
  req.user = result.user;
  req.userId = result.user.id;
  next();
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const token = authHeader.substring(7);
  
  const result = auth.verifyToken(token);
  if (result.success) {
    req.user = result.user;
    req.userId = result.user.id;
  }
  
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    
    next();
  };
};

export const requireAdmin = requireRole(['admin']);