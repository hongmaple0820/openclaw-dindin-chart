/**
 * SSE 路由
 * 
 * 提供服务端推送（Server-Sent Events）API：
 * - GET  /api/sse/connect  - SSE 连接端点
 * - GET  /api/sse/online   - 在线用户列表
 * - POST /api/sse/send     - 发送消息给指定用户
 * - POST /api/sse/broadcast - 广播消息给所有用户
 */

const express = require('express');
const router = express.Router();
const sseManager = require('../sse-manager');

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
router.get('/connect', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'userId is required' 
    });
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
router.get('/online', (req, res) => {
  try {
    const users = sseManager.getOnlineUsersDetails();
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
router.get('/status/:userId', (req, res) => {
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
router.post('/send', (req, res) => {
  try {
    const { targetUserId, event = 'message', data } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'targetUserId is required' 
      });
    }
    
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        error: 'data is required' 
      });
    }
    
    // 检查目标用户是否在线
    if (!sseManager.isOnline(targetUserId)) {
      return res.status(404).json({ 
        success: false, 
        error: 'User is not online',
        userId: targetUserId
      });
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
router.post('/broadcast', (req, res) => {
  try {
    const { event = 'message', data, excludeUsers = [] } = req.body;
    
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        error: 'data is required' 
      });
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
router.delete('/disconnect/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!sseManager.isOnline(userId)) {
      return res.status(404).json({ 
        success: false, 
        error: 'User is not online',
        userId 
      });
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
router.get('/stats', (req, res) => {
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

module.exports = router;

// Make this a module
export {};
