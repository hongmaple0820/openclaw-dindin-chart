/**
 * 好友系统路由
 * API 端点：
 * 1. GET /api/friends/search?q= - 搜索用户
 * 2. POST /api/friends/request - 发送好友申请
 * 3. GET /api/friends/requests - 获取好友申请列表
 * 4. PUT /api/friends/requests/:id - 处理申请（同意/拒绝）
 * 5. GET /api/friends - 获取好友列表
 * 6. PUT /api/friends/:id/remark - 设置备注
 * 7. DELETE /api/friends/:id - 删除好友
 * 8. POST /api/friends/:id/block - 拉黑用户
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { UserModel, getDb } = require('../models/user');

// 申请过期时间：7天（毫秒）
const REQUEST_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;

// ==================== 辅助函数 ====================

/**
 * 检查申请是否过期
 */
function isRequestExpired(request) {
  if (!request || request.status !== 'pending') return false;
  return Date.now() - request.created_at > REQUEST_EXPIRE_TIME;
}

/**
 * 获取用户信息（简化版）
 */
async function getUserInfo(userId) {
  const db = await getDb();
  const user = await db.get(`
    SELECT id, username, nickname, avatar, 
           COALESCE(user_type, 'human') as user_type,
           bio, status_message
    FROM users WHERE id = ?
  `, [userId]);
  return user;
}

/**
 * 检查好友关系是否存在
 */
async function getFriendRelation(userId, friendId) {
  const db = await getDb();
  return db.get(`
    SELECT * FROM friends 
    WHERE user_id = ? AND friend_id = ?
  `, [userId, friendId]);
}

/**
 * 检查是否被拉黑
 */
async function isBlockedBy(userId, targetId) {
  const db = await getDb();
  const blocked = await db.get(`
    SELECT * FROM friends 
    WHERE user_id = ? AND friend_id = ? AND status = 'blocked'
  `, [targetId, userId]);
  return !!blocked;
}

// ==================== API 路由 ====================

/**
 * 1. 搜索用户
 * GET /api/friends/search?q=关键词
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: '搜索关键词至少需要2个字符' 
      });
    }
    
    const db = await getDb();
    const keyword = `%${q.trim()}%`;
    
    // 搜索用户名和昵称
    const users = await db.all(`
      SELECT id, username, nickname, avatar, 
             COALESCE(user_type, 'human') as user_type,
             bio, status_message
      FROM users 
      WHERE (username LIKE ? OR nickname LIKE ?)
        AND id != ?
        AND status = 'active'
      LIMIT 20
    `, [keyword, keyword, req.userId]);
    
    // 检查与每个用户的好友状态
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      const relation = await getFriendRelation(req.userId, user.id);
      return {
        ...user,
        friendStatus: relation?.status || null,
        isFriend: relation?.status === 'accepted'
      };
    }));
    
    res.json({ 
      success: true, 
      count: usersWithStatus.length,
      users: usersWithStatus 
    });
  } catch (error) {
    console.error('[Friends] 搜索用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. 发送好友申请
 * POST /api/friends/request
 * Body: { toUserId, message }
 */
router.post('/request', authenticate, async (req, res) => {
  try {
    const { toUserId, message } = req.body;
    
    if (!toUserId) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定要添加的好友' 
      });
    }
    
    // 不能添加自己
    if (toUserId === req.userId) {
      return res.status(400).json({ 
        success: false, 
        error: '不能添加自己为好友' 
      });
    }
    
    // 检查目标用户是否存在
    const targetUser = await getUserInfo(toUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }
    
    // 检查是否被对方拉黑
    if (await isBlockedBy(req.userId, toUserId)) {
      return res.status(403).json({ 
        success: false, 
        error: '对方已将你加入黑名单' 
      });
    }
    
    const db = await getDb();
    
    // 检查是否已经是好友
    const existingRelation = await getFriendRelation(req.userId, toUserId);
    if (existingRelation) {
      if (existingRelation.status === 'accepted') {
        return res.status(400).json({ 
          success: false, 
          error: '已经是好友了' 
        });
      }
      if (existingRelation.status === 'blocked') {
        return res.status(403).json({ 
          success: false, 
          error: '你已将对方加入黑名单，请先解除拉黑' 
        });
      }
    }
    
    // 检查是否有待处理的申请
    const existingRequest = await db.get(`
      SELECT * FROM friend_requests 
      WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
    `, [req.userId, toUserId]);
    
    if (existingRequest) {
      // 检查是否过期
      if (!isRequestExpired(existingRequest)) {
        return res.status(400).json({ 
          success: false, 
          error: '已有待处理的好友申请' 
        });
      }
      // 过期了就删除旧申请
      await db.run('DELETE FROM friend_requests WHERE id = ?', [existingRequest.id]);
    }
    
    // 检查对方是否已经向我发送了申请（双向申请处理）
    const reverseRequest = await db.get(`
      SELECT * FROM friend_requests 
      WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
    `, [toUserId, req.userId]);
    
    if (reverseRequest && !isRequestExpired(reverseRequest)) {
      // 对方已经向我发送了申请，直接同意
      const now = Date.now();
      
      // 更新对方的申请状态
      await db.run(`
        UPDATE friend_requests 
        SET status = 'accepted', handled_at = ?, handled_by = ?
        WHERE id = ?
      `, [now, req.userId, reverseRequest.id]);
      
      // 创建双向好友关系
      const friendshipId1 = uuidv4();
      const friendshipId2 = uuidv4();
      
      await db.run(`
        INSERT INTO friends (id, user_id, friend_id, status, source, created_at, updated_at)
        VALUES (?, ?, ?, 'accepted', 'mutual', ?, ?)
      `, [friendshipId1, req.userId, toUserId, now, now]);
      
      await db.run(`
        INSERT INTO friends (id, user_id, friend_id, status, source, created_at, updated_at)
        VALUES (?, ?, ?, 'accepted', 'mutual', ?, ?)
      `, [friendshipId2, toUserId, req.userId, now, now]);
      
      return res.json({ 
        success: true, 
        message: '对方已向你发送好友申请，已自动同意并成为好友',
        autoAccepted: true,
        friend: targetUser
      });
    }
    
    // 创建新的好友申请
    const requestId = uuidv4();
    const now = Date.now();
    
    await db.run(`
      INSERT INTO friend_requests (id, from_user_id, to_user_id, message, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [requestId, req.userId, toUserId, message || null, now]);
    
    console.log('[Friends] 好友申请已发送:', req.userId, '->', toUserId);
    
    res.json({ 
      success: true, 
      message: '好友申请已发送',
      request: {
        id: requestId,
        toUser: targetUser,
        message,
        status: 'pending',
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Friends] 发送好友申请失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. 获取好友申请列表
 * GET /api/friends/requests?type=sent|received
 */
router.get('/requests', authenticate, async (req, res) => {
  try {
    const { type = 'received' } = req.query;
    const db = await getDb();
    
    let requests;
    const now = Date.now();
    
    if (type === 'sent') {
      // 我发送的申请
      requests = await db.all(`
        SELECT r.*, 
               u.id as to_user_id, u.username as to_username, u.nickname as to_nickname, 
               u.avatar as to_avatar, COALESCE(u.user_type, 'human') as to_user_type
        FROM friend_requests r
        JOIN users u ON r.to_user_id = u.id
        WHERE r.from_user_id = ?
        ORDER BY r.created_at DESC
        LIMIT 50
      `, [req.userId]);
    } else {
      // 我收到的申请
      requests = await db.all(`
        SELECT r.*,
               u.id as from_user_id, u.username as from_username, u.nickname as from_nickname,
               u.avatar as from_avatar, COALESCE(u.user_type, 'human') as from_user_type
        FROM friend_requests r
        JOIN users u ON r.from_user_id = u.id
        WHERE r.to_user_id = ?
        ORDER BY r.created_at DESC
        LIMIT 50
      `, [req.userId]);
    }
    
    // 过滤过期的申请并格式化
    const validRequests = requests.filter(r => {
      if (r.status === 'pending' && isRequestExpired(r)) {
        return false;
      }
      return true;
    }).map(r => {
      const base = {
        id: r.id,
        message: r.message,
        status: r.status,
        createdAt: r.created_at,
        handledAt: r.handled_at
      };
      
      if (type === 'sent') {
        return {
          ...base,
          toUser: {
            id: r.to_user_id,
            username: r.to_username,
            nickname: r.to_nickname,
            avatar: r.to_avatar,
            userType: r.to_user_type
          }
        };
      } else {
        return {
          ...base,
          fromUser: {
            id: r.from_user_id,
            username: r.from_username,
            nickname: r.from_nickname,
            avatar: r.from_avatar,
            userType: r.from_user_type
          }
        };
      }
    });
    
    res.json({ 
      success: true, 
      count: validRequests.length,
      requests: validRequests 
    });
  } catch (error) {
    console.error('[Friends] 获取好友申请列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. 处理好友申请
 * PUT /api/friends/requests/:id
 * Body: { action: 'accept' | 'reject' }
 */
router.put('/requests/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的操作，请使用 accept 或 reject' 
      });
    }
    
    const db = await getDb();
    
    // 获取申请信息
    const request = await db.get(`
      SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ?
    `, [id, req.userId]);
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: '好友申请不存在' 
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: '该申请已经被处理过了' 
      });
    }
    
    // 检查是否过期
    if (isRequestExpired(request)) {
      return res.status(400).json({ 
        success: false, 
        error: '该申请已过期' 
      });
    }
    
    const now = Date.now();
    
    if (action === 'accept') {
      // 同意申请：创建双向好友关系
      const friendshipId1 = uuidv4();
      const friendshipId2 = uuidv4();
      
      await db.run(`
        INSERT INTO friends (id, user_id, friend_id, status, source, created_at, updated_at)
        VALUES (?, ?, ?, 'accepted', 'request', ?, ?)
      `, [friendshipId1, req.userId, request.from_user_id, now, now]);
      
      await db.run(`
        INSERT INTO friends (id, user_id, friend_id, status, source, created_at, updated_at)
        VALUES (?, ?, ?, 'accepted', 'request', ?, ?)
      `, [friendshipId2, request.from_user_id, req.userId, now, now]);
      
      // 更新申请状态
      await db.run(`
        UPDATE friend_requests 
        SET status = 'accepted', handled_at = ?, handled_by = ?
        WHERE id = ?
      `, [now, req.userId, id]);
      
      // 获取好友信息
      const friend = await getUserInfo(request.from_user_id);
      
      console.log('[Friends] 好友申请已同意:', request.from_user_id, '<->', req.userId);
      
      res.json({ 
        success: true, 
        message: '已同意好友申请',
        friend
      });
    } else {
      // 拒绝申请
      await db.run(`
        UPDATE friend_requests 
        SET status = 'rejected', handled_at = ?, handled_by = ?
        WHERE id = ?
      `, [now, req.userId, id]);
      
      console.log('[Friends] 好友申请已拒绝:', request.from_user_id, '->', req.userId);
      
      res.json({ 
        success: true, 
        message: '已拒绝好友申请' 
      });
    }
  } catch (error) {
    console.error('[Friends] 处理好友申请失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. 获取好友列表
 * GET /api/friends
 * Query: group (可选，按分组筛选)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { group } = req.query;
    const db = await getDb();
    
    let sql = `
      SELECT f.id as friendship_id, f.remark, f.friend_group, f.status, f.source,
             f.created_at as friends_since,
             u.id, u.username, u.nickname, u.avatar, 
             COALESCE(u.user_type, 'human') as user_type,
             u.bio, u.status_message
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'accepted'
    `;
    
    const params = [req.userId];
    
    if (group) {
      sql += ' AND f.friend_group = ?';
      params.push(group);
    }
    
    sql += ' ORDER BY f.friend_group, u.nickname, u.username';
    
    const friends = await db.all(sql, params);
    
    // 按分组整理
    const groupedFriends = {};
    friends.forEach(f => {
      const groupName = f.friend_group || '默认';
      if (!groupedFriends[groupName]) {
        groupedFriends[groupName] = [];
      }
      groupedFriends[groupName].push({
        friendshipId: f.friendship_id,
        id: f.id,
        username: f.username,
        nickname: f.nickname,
        avatar: f.avatar,
        userType: f.user_type,
        bio: f.bio,
        statusMessage: f.status_message,
        remark: f.remark,
        friendsSince: f.friends_since
      });
    });
    
    res.json({ 
      success: true, 
      count: friends.length,
      groups: Object.keys(groupedFriends),
      grouped: groupedFriends,
      friends
    });
  } catch (error) {
    console.error('[Friends] 获取好友列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. 设置好友备注
 * PUT /api/friends/:id/remark
 * Body: { remark }
 */
router.put('/:id/remark', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    
    if (remark && remark.length > 30) {
      return res.status(400).json({ 
        success: false, 
        error: '备注不能超过30个字符' 
      });
    }
    
    const db = await getDb();
    
    // 检查好友关系
    const friendship = await db.get(`
      SELECT * FROM friends 
      WHERE id = ? AND user_id = ? AND status = 'accepted'
    `, [id, req.userId]);
    
    if (!friendship) {
      return res.status(404).json({ 
        success: false, 
        error: '好友关系不存在' 
      });
    }
    
    // 更新备注
    const now = Date.now();
    await db.run(`
      UPDATE friends SET remark = ?, updated_at = ? WHERE id = ?
    `, [remark || null, now, id]);
    
    console.log('[Friends] 备注已更新:', req.userId, '->', friendship.friend_id, remark);
    
    res.json({ 
      success: true, 
      message: '备注已更新',
      remark
    });
  } catch (error) {
    console.error('[Friends] 设置备注失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 7. 删除好友
 * DELETE /api/friends/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // 检查好友关系
    const friendship = await db.get(`
      SELECT * FROM friends 
      WHERE id = ? AND user_id = ?
    `, [id, req.userId]);
    
    if (!friendship) {
      return res.status(404).json({ 
        success: false, 
        error: '好友关系不存在' 
      });
    }
    
    // 删除双向好友关系
    await db.run(`
      DELETE FROM friends 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `, [req.userId, friendship.friend_id, friendship.friend_id, req.userId]);
    
    console.log('[Friends] 好友已删除:', req.userId, '<->', friendship.friend_id);
    
    res.json({ 
      success: true, 
      message: '好友已删除' 
    });
  } catch (error) {
    console.error('[Friends] 删除好友失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 8. 拉黑用户
 * POST /api/friends/:id/block
 */
router.post('/:id/block', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // id 可能是 friendship_id 或者 user_id
    // 先检查是否是 friendship_id
    let friendship = await db.get(`
      SELECT * FROM friends WHERE id = ? AND user_id = ?
    `, [id, req.userId]);
    
    let targetUserId;
    if (friendship) {
      targetUserId = friendship.friend_id;
    } else {
      // 当作 user_id 处理
      targetUserId = id;
      
      // 检查目标用户是否存在
      const targetUser = await getUserInfo(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ 
          success: false, 
          error: '用户不存在' 
        });
      }
      
      // 检查现有关系
      friendship = await getFriendRelation(req.userId, targetUserId);
    }
    
    // 不能拉黑自己
    if (targetUserId === req.userId) {
      return res.status(400).json({ 
        success: false, 
        error: '不能拉黑自己' 
      });
    }
    
    const now = Date.now();
    
    if (friendship) {
      // 更新现有关系为拉黑状态
      await db.run(`
        UPDATE friends SET status = 'blocked', updated_at = ? 
        WHERE user_id = ? AND friend_id = ?
      `, [now, req.userId, targetUserId]);
    } else {
      // 创建新的拉黑关系
      const blockId = uuidv4();
      await db.run(`
        INSERT INTO friends (id, user_id, friend_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'blocked', ?, ?)
      `, [blockId, req.userId, targetUserId, now, now]);
    }
    
    // 删除对方的好友关系（如果存在）
    await db.run(`
      DELETE FROM friends WHERE user_id = ? AND friend_id = ?
    `, [targetUserId, req.userId]);
    
    console.log('[Friends] 用户已拉黑:', req.userId, '->', targetUserId);
    
    res.json({ 
      success: true, 
      message: '已将用户加入黑名单' 
    });
  } catch (error) {
    console.error('[Friends] 拉黑用户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 9. 解除拉黑
 * DELETE /api/friends/:id/block
 */
router.delete('/:id/block', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // 查找拉黑记录
    const blockRecord = await db.get(`
      SELECT * FROM friends 
      WHERE id = ? AND user_id = ? AND status = 'blocked'
    `, [id, req.userId]);
    
    if (!blockRecord) {
      // 尝试用 user_id 查找
      const blockByUserId = await db.get(`
        SELECT * FROM friends 
        WHERE user_id = ? AND friend_id = ? AND status = 'blocked'
      `, [req.userId, id]);
      
      if (!blockByUserId) {
        return res.status(404).json({ 
          success: false, 
          error: '未找到拉黑记录' 
        });
      }
      
      // 删除拉黑记录
      await db.run(`
        DELETE FROM friends WHERE id = ?
      `, [blockByUserId.id]);
    } else {
      // 删除拉黑记录
      await db.run(`
        DELETE FROM friends WHERE id = ?
      `, [id]);
    }
    
    console.log('[Friends] 已解除拉黑:', req.userId, '->', id);
    
    res.json({ 
      success: true, 
      message: '已解除拉黑' 
    });
  } catch (error) {
    console.error('[Friends] 解除拉黑失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 10. 获取黑名单列表
 * GET /api/friends/blocked
 */
router.get('/blocked', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    
    const blockedUsers = await db.all(`
      SELECT f.id as block_id, f.created_at as blocked_at,
             u.id, u.username, u.nickname, u.avatar,
             COALESCE(u.user_type, 'human') as user_type
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'blocked'
      ORDER BY f.created_at DESC
    `, [req.userId]);
    
    res.json({ 
      success: true, 
      count: blockedUsers.length,
      blocked: blockedUsers 
    });
  } catch (error) {
    console.error('[Friends] 获取黑名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 11. 设置好友分组
 * PUT /api/friends/:id/group
 * Body: { group }
 */
router.put('/:id/group', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { group } = req.body;
    
    if (!group || group.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '分组名称不能为空' 
      });
    }
    
    if (group.length > 20) {
      return res.status(400).json({ 
        success: false, 
        error: '分组名称不能超过20个字符' 
      });
    }
    
    const db = await getDb();
    
    // 检查好友关系
    const friendship = await db.get(`
      SELECT * FROM friends 
      WHERE id = ? AND user_id = ? AND status = 'accepted'
    `, [id, req.userId]);
    
    if (!friendship) {
      return res.status(404).json({ 
        success: false, 
        error: '好友关系不存在' 
      });
    }
    
    // 更新分组
    const now = Date.now();
    await db.run(`
      UPDATE friends SET friend_group = ?, updated_at = ? WHERE id = ?
    `, [group.trim(), now, id]);
    
    console.log('[Friends] 分组已更新:', req.userId, '->', friendship.friend_id, group);
    
    res.json({ 
      success: true, 
      message: '分组已更新',
      group: group.trim()
    });
  } catch (error) {
    console.error('[Friends] 设置分组失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 12. 获取好友分组列表
 * GET /api/friends/groups
 */
router.get('/groups', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    
    const groups = await db.all(`
      SELECT friend_group, COUNT(*) as count
      FROM friends
      WHERE user_id = ? AND status = 'accepted'
      GROUP BY friend_group
      ORDER BY count DESC
    `, [req.userId]);
    
    res.json({ 
      success: true, 
      groups: groups.map(g => ({
        name: g.friend_group,
        count: g.count
      }))
    });
  } catch (error) {
    console.error('[Friends] 获取分组列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 13. 检查好友状态
 * GET /api/friends/status/:userId
 */
router.get('/status/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = await getDb();
    
    // 检查好友关系
    const relation = await getFriendRelation(req.userId, userId);
    
    // 检查是否有待处理的申请
    const sentRequest = await db.get(`
      SELECT * FROM friend_requests 
      WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
    `, [req.userId, userId]);
    
    const receivedRequest = await db.get(`
      SELECT * FROM friend_requests 
      WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
    `, [userId, req.userId]);
    
    // 检查是否被拉黑
    const blockedByMe = relation?.status === 'blocked';
    const blockedByOther = await isBlockedBy(req.userId, userId);
    
    res.json({
      success: true,
      status: {
        isFriend: relation?.status === 'accepted',
        friendStatus: relation?.status || null,
        hasPendingRequest: !!sentRequest && !isRequestExpired(sentRequest),
        hasReceivedRequest: !!receivedRequest && !isRequestExpired(receivedRequest),
        blockedByMe,
        blockedByOther,
        requestId: sentRequest?.id || receivedRequest?.id || null
      }
    });
  } catch (error) {
    console.error('[Friends] 检查好友状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
