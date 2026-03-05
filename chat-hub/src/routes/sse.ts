/**
 * SSE 路由
 * 
 * 提供服务端推送（Server-Sent Events）API：
 * - GET  /api/sse/connect  - SSE 连接端点
 * - GET  /api/sse/online   - 在线用户列表
 * - POST /api/sse/send     - 发送消息给指定用户
 * - POST /api/sse/broadcast - 广播消息给所有用户
 */

import express, { type Request, type Response } from 'express';
import sseManager from '../sse-manager';

const router = express.Router();

interface ConnectQuery {
  userId?: string;
}

interface SendBody {
  targetUserId?: string;
  event?: string;
  data?: unknown;
}

interface BroadcastBody {
  event?: string;
  data?: unknown;
  excludeUsers?: string[];
}

interface UserDetails {
  userId: string;
  connectedAt: number;
  lastHeartbeat: number;
  metadata: Record<string, unknown>;
  ip?: string;
}

/**
 * SSE 连接端点
 * GET /api/sse/connect?userId=xxx
 * 
 * 返回 SSE 事件流：
 * - event: connected - 连接成功
 * - event: message - 新消息
 * - event: heartbeat - 心跳
 * - event: notification - 通知
 * - event: user-online - 用户上线
 * - event: user-offline - 用户下线
 */
router.get('/connect', (req: Request<object, object, object, ConnectQuery>, res: Response): void => {
  const { userId } = req.query;
  
  if (!userId) {
    res.status(400).json({ 
      success: false, 
      error: 'userId is required' 
    });
    return;
  }

  console.log(`[SSE Routes] 收到连接请求: ${userId}`);
  
  // 使用 SSE 管理器建立连接
  sseManager.connect(userId, res);
});

/**
 * 获取在线用户列表
 * GET /api/sse/online
 * 
 * 返回格式：
 * {
 *   "success": true,
 *   "count": 3,
 *   "users": [
 *     { "userId": "user1", "connectedAt": 1234567890, "lastHeartbeat": 1234567900 }
 *   ]
 * }
 */
router.get('/online', (req: Request, res: Response): void => {
  try {
    const users = sseManager.getOnlineUsersDetails() as UserDetails[];
    const count = sseManager.getOnlineCount();
    
    res.json({
      success: true,
      count,
      users
    });
  } catch (error) {
    console.error('[SSE Routes] 获取在线用户失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 检查用户是否在线
 * GET /api/sse/status/:userId
 */
router.get('/status/:userId', (req: Request<{ userId: string }>, res: Response): void => {
  try {
    const { userId } = req.params;
    const isOnline = sseManager.isOnline(userId);
    const details = sseManager.getUserDetails(userId);
    
    res.json({
      success: true,
      userId,
      isOnline,
      details: isOnline ? details : null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 发送消息给指定用户
 * POST /api/sse/send
 * 
 * Body:
 * {
 *   "targetUserId": "xxx",
 *   "event": "message",  // 可选，默认 message
 *   "data": { ... }
 * }
 */
router.post('/send', (req: Request<object, object, SendBody>, res: Response): void => {
  try {
    const { targetUserId, event = 'message', data } = req.body;
    
    if (!targetUserId) {
      res.status(400).json({ 
        success: false, 
        error: 'targetUserId is required' 
      });
      return;
    }
    
    if (!data) {
      res.status(400).json({ 
        success: false, 
        error: 'data is required' 
      });
      return;
    }
    
    // 检查目标用户是否在线
    if (!sseManager.isOnline(targetUserId)) {
      res.status(404).json({ 
        success: false, 
        error: 'User is not online',
        userId: targetUserId
      });
      return;
    }
    
    // 发送消息
    const sent = sseManager.sendToUser(targetUserId, event, data);
    
    if (sent) {
      console.log(`[SSE Routes] 发送消息到 ${targetUserId}:`, event);
      res.json({ 
        success: true, 
        userId: targetUserId,
        event 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send message' 
      });
    }
  } catch (error) {
    console.error('[SSE Routes] 发送消息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 广播消息给所有用户
 * POST /api/sse/broadcast
 * 
 * Body:
 * {
 *   "event": "message",  // 可选，默认 message
 *   "data": { ... },
 *   "excludeUsers": ["user1"]  // 可选，排除的用户列表
 * }
 */
router.post('/broadcast', (req: Request<object, object, BroadcastBody>, res: Response): void => {
  try {
    const { event = 'message', data, excludeUsers = [] } = req.body;
    
    if (!data) {
      res.status(400).json({ 
        success: false, 
        error: 'data is required' 
      });
      return;
    }
    
    const onlineCount = sseManager.getOnlineCount();
    const excludeCount = excludeUsers.length;
    const sentCount = onlineCount - excludeCount;
    
    // 广播消息
    sseManager.broadcast(event, data, excludeUsers);
    
    console.log(`[SSE Routes] 广播消息: ${event} -> ${sentCount}/${onlineCount} 用户`);
    
    res.json({ 
      success: true, 
      event,
      sentCount,
      onlineCount,
      excluded: excludeCount
    });
  } catch (error) {
    console.error('[SSE Routes] 广播消息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 断开指定用户的连接
 * DELETE /api/sse/disconnect/:userId
 */
router.delete('/disconnect/:userId', (req: Request<{ userId: string }>, res: Response): void => {
  try {
    const { userId } = req.params;
    
    if (!sseManager.isOnline(userId)) {
      res.status(404).json({ 
        success: false, 
        error: 'User is not online',
        userId 
      });
      return;
    }
    
    sseManager.disconnect(userId);
    
    console.log(`[SSE Routes] 断开用户连接: ${userId}`);
    res.json({ 
      success: true, 
      message: `User ${userId} disconnected` 
    });
  } catch (error) {
    console.error('[SSE Routes] 断开连接失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 获取 SSE 服务统计信息
 * GET /api/sse/stats
 */
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const stats = sseManager.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

export = router;