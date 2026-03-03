const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const dbPath = path.join(process.env.HOME, '.openclaw/chat-data/messages.db');
const db = new Database(dbPath);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

// ==================== 权限检查 ====================

/**
 * 检查用户是否为群主
 */
function isGroupOwner(groupId, userId) {
  const group = db.prepare('SELECT owner_id FROM chat_groups WHERE id = ? AND status = ?').get(groupId, 'active');
  return group && group.owner_id === userId;
}

/**
 * 检查用户是否为管理员（包括群主）
 */
function isGroupAdmin(groupId, userId) {
  const member = db.prepare(`
    SELECT gm.role, cg.owner_id 
    FROM group_members gm
    JOIN chat_groups cg ON gm.group_id = cg.id
    WHERE gm.group_id = ? AND gm.user_id = ? AND gm.status = ?
  `).get(groupId, userId, 'active');
  
  if (!member) return false;
  return member.role === 'admin' || member.owner_id === userId;
}

/**
 * 检查用户是否为群成员
 */
function isGroupMember(groupId, userId) {
  const member = db.prepare(`
    SELECT * FROM group_members 
    WHERE group_id = ? AND user_id = ? AND status = ?
  `).get(groupId, userId, 'active');
  return !!member;
}

/**
 * 获取群成员数量
 */
function getMemberCount(groupId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM group_members 
    WHERE group_id = ? AND status = ?
  `).get(groupId, 'active');
  return result.count;
}

// ==================== API 路由 ====================

/**
 * 认证中间件（简化版）
 */
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  const userType = req.headers['x-user-type'] || req.query.userType || req.body?.userType || 'human';
  
  if (!userId) {
    return res.status(401).json({ success: false, message: '未授权：缺少用户ID' });
  }
  
  req.userId = userId;
  req.userType = userType;
  next();
}

/**
 * 1. 创建群聊
 * POST /api/groups
 * 
 * 权限：群主必须是人类 (user_type === 'human')
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, avatar, description, maxMembers = 500 } = req.body;
    const ownerId = req.userId;
    const ownerType = req.userType;

    // 验证群主必须是人类
    if (ownerType !== 'human') {
      return res.status(403).json({ 
        success: false, 
        message: '群主必须是人类用户' 
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '群名称不能为空' });
    }

    const groupId = uuidv4();
    const now = Date.now();

    // 创建群组
    db.prepare(`
      INSERT INTO chat_groups (id, name, avatar, description, owner_id, owner_type, created_at, updated_at, max_members)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, name.trim(), avatar, description, ownerId, ownerType, now, now, maxMembers);

    // 群主自动成为成员
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, user_type, role, joined_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(memberId, groupId, ownerId, ownerType, 'owner', now, 'active');

    res.json({
      success: true,
      group: {
        id: groupId,
        name: name.trim(),
        avatar,
        description,
        ownerId,
        ownerType,
        createdAt: now,
        maxMembers,
        memberCount: 1
      }
    });
  } catch (error) {
    console.error('[Groups] 创建群聊失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

/**
 * 2. 获取我的群聊列表
 * GET /api/groups
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    const groups = db.prepare(`
      SELECT 
        cg.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = cg.id AND status = 'active') as member_count
      FROM chat_groups cg
      JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.user_id = ? AND gm.status = ? AND cg.status = ?
      ORDER BY cg.updated_at DESC
    `).all(userId, 'active', 'active');

    res.json({ success: true, groups });
  } catch (error) {
    console.error('[Groups] 获取群聊列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * 3. 获取群详情
 * GET /api/groups/:id
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const group = db.prepare(`
      SELECT 
        cg.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = cg.id AND status = 'active') as member_count
      FROM chat_groups cg
      WHERE cg.id = ? AND cg.status = ?
    `).get(id, 'active');

    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 检查是否为群成员
    const isMember = isGroupMember(id, userId);

    // 获取当前用户的角色
    const member = db.prepare(`
      SELECT role, nickname FROM group_members 
      WHERE group_id = ? AND user_id = ? AND status = ?
    `).get(id, userId, 'active');

    res.json({
      success: true,
      group: {
        ...group,
        isMember,
        myRole: member?.role || null,
        myNickname: member?.nickname || null
      }
    });
  } catch (error) {
    console.error('[Groups] 获取群详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * 11. 获取群成员列表
 * GET /api/groups/:id/members
 */
router.get('/:id/members', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 检查是否为群成员
    if (!isGroupMember(id, userId)) {
      return res.status(403).json({ success: false, message: '无权查看群成员' });
    }

    const members = db.prepare(`
      SELECT id, group_id, user_id, user_type, nickname, role, joined_at, status
      FROM group_members
      WHERE group_id = ? AND status = ?
      ORDER BY 
        CASE role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          ELSE 3 
        END,
        joined_at ASC
    `).all(id, 'active');

    res.json({ success: true, members });
  } catch (error) {
    console.error('[Groups] 获取群成员失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * 4. 邀请成员
 * POST /api/groups/:id/invite
 */
router.post('/:id/invite', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { inviteeId, inviteeType = 'human' } = req.body;
    const inviterId = req.userId;

    if (!inviteeId) {
      return res.status(400).json({ success: false, message: '缺少被邀请者ID' });
    }

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 检查邀请者是否为群成员
    if (!isGroupMember(id, inviterId)) {
      return res.status(403).json({ success: false, message: '只有群成员才能邀请他人' });
    }

    // 检查被邀请者是否已在群中
    if (isGroupMember(id, inviteeId)) {
      return res.status(400).json({ success: false, message: '该用户已在群中' });
    }

    // 检查群人数限制
    const currentCount = getMemberCount(id);
    if (currentCount >= group.max_members) {
      return res.status(400).json({ success: false, message: '群人数已达上限' });
    }

    // 检查是否有待处理的邀请
    const existingInvite = db.prepare(`
      SELECT * FROM group_invites 
      WHERE group_id = ? AND invitee_id = ? AND status = ?
    `).get(id, inviteeId, 'pending');

    if (existingInvite) {
      return res.status(400).json({ success: false, message: '该用户已有待处理的邀请' });
    }

    const now = Date.now();
    const inviteId = uuidv4();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7天后过期

    // 创建邀请记录
    db.prepare(`
      INSERT INTO group_invites (id, group_id, inviter_id, invitee_id, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(inviteId, id, inviterId, inviteeId, 'pending', now, expiresAt);

    // 直接添加成员（简化流程，跳过确认）
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, user_type, role, joined_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(memberId, id, inviteeId, inviteeType, 'member', now, 'active');

    // 更新邀请状态
    db.prepare(`UPDATE group_invites SET status = ? WHERE id = ?`).run('accepted', inviteId);

    // 更新群组时间
    db.prepare(`UPDATE chat_groups SET updated_at = ? WHERE id = ?`).run(now, id);

    res.json({
      success: true,
      message: '邀请成功',
      member: {
        id: memberId,
        groupId: id,
        userId: inviteeId,
        userType: inviteeType,
        role: 'member',
        joinedAt: now
      }
    });
  } catch (error) {
    console.error('[Groups] 邀请成员失败:', error);
    res.status(500).json({ success: false, message: '邀请失败', error: error.message });
  }
});

/**
 * 5. 移除成员
 * DELETE /api/groups/:id/members/:userId
 */
router.delete('/:id/members/:targetUserId', authMiddleware, (req, res) => {
  try {
    const { id, targetUserId } = req.params;
    const operatorId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 群主不能被移除
    if (targetUserId === group.owner_id) {
      return res.status(403).json({ success: false, message: '群主不能被移除' });
    }

    // 检查操作者权限
    const isOwner = isGroupOwner(id, operatorId);
    const isAdmin = isGroupAdmin(id, operatorId);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: '只有群主或管理员才能移除成员' });
    }

    // 检查目标成员是否存在
    const targetMember = db.prepare(`
      SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?
    `).get(id, targetUserId, 'active');

    if (!targetMember) {
      return res.status(404).json({ success: false, message: '该用户不在群中' });
    }

    // 管理员不能移除其他管理员（只有群主可以）
    if (!isOwner && targetMember.role === 'admin') {
      return res.status(403).json({ success: false, message: '管理员不能移除其他管理员' });
    }

    // 移除成员（软删除）
    const now = Date.now();
    db.prepare(`
      UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ?
    `).run('removed', id, targetUserId);

    // 更新群组时间
    db.prepare(`UPDATE chat_groups SET updated_at = ? WHERE id = ?`).run(now, id);

    res.json({ success: true, message: '成员已移除' });
  } catch (error) {
    console.error('[Groups] 移除成员失败:', error);
    res.status(500).json({ success: false, message: '移除失败', error: error.message });
  }
});

/**
 * 6. 设置管理员
 * PUT /api/groups/:id/admins/:userId
 */
router.put('/:id/admins/:targetUserId', authMiddleware, (req, res) => {
  try {
    const { id, targetUserId } = req.params;
    const { action = 'set' } = req.body; // 'set' or 'unset'
    const operatorId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只有群主可以设置管理员
    if (!isGroupOwner(id, operatorId)) {
      return res.status(403).json({ success: false, message: '只有群主才能设置管理员' });
    }

    // 不能修改群主的角色
    if (targetUserId === group.owner_id) {
      return res.status(400).json({ success: false, message: '不能修改群主的角色' });
    }

    // 检查目标成员是否存在
    const targetMember = db.prepare(`
      SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?
    `).get(id, targetUserId, 'active');

    if (!targetMember) {
      return res.status(404).json({ success: false, message: '该用户不在群中' });
    }

    const now = Date.now();
    const newRole = action === 'set' ? 'admin' : 'member';

    db.prepare(`
      UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?
    `).run(newRole, id, targetUserId);

    // 更新群组时间
    db.prepare(`UPDATE chat_groups SET updated_at = ? WHERE id = ?`).run(now, id);

    res.json({ 
      success: true, 
      message: action === 'set' ? '已设置为管理员' : '已取消管理员',
      role: newRole
    });
  } catch (error) {
    console.error('[Groups] 设置管理员失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: error.message });
  }
});

/**
 * 7. 转让群主
 * PUT /api/groups/:id/transfer
 */
router.put('/:id/transfer', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { newOwnerId } = req.body;
    const currentOwnerId = req.userId;

    if (!newOwnerId) {
      return res.status(400).json({ success: false, message: '缺少新群主ID' });
    }

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只有群主可以转让
    if (!isGroupOwner(id, currentOwnerId)) {
      return res.status(403).json({ success: false, message: '只有群主才能转让群主身份' });
    }

    // 不能转让给自己
    if (newOwnerId === currentOwnerId) {
      return res.status(400).json({ success: false, message: '不能转让给自己' });
    }

    // 检查新群主是否在群中
    const newOwnerMember = db.prepare(`
      SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?
    `).get(id, newOwnerId, 'active');

    if (!newOwnerMember) {
      return res.status(404).json({ success: false, message: '新群主不在群中' });
    }

    // 新群主必须是人类
    if (newOwnerMember.user_type !== 'human') {
      return res.status(400).json({ success: false, message: '群主必须是人类用户' });
    }

    const now = Date.now();

    // 更新群组所有者
    db.prepare(`UPDATE chat_groups SET owner_id = ?, updated_at = ? WHERE id = ?`).run(newOwnerId, now, id);

    // 更新原群主角色为普通成员
    db.prepare(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`).run('member', id, currentOwnerId);

    // 更新新群主角色为 owner
    db.prepare(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`).run('owner', id, newOwnerId);

    res.json({ 
      success: true, 
      message: '群主已转让',
      newOwnerId
    });
  } catch (error) {
    console.error('[Groups] 转让群主失败:', error);
    res.status(500).json({ success: false, message: '转让失败', error: error.message });
  }
});

/**
 * 8. 解散群聊
 * DELETE /api/groups/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只有群主可以解散群
    if (!isGroupOwner(id, userId)) {
      return res.status(403).json({ success: false, message: '只有群主才能解散群聊' });
    }

    const now = Date.now();

    // 软删除群组
    db.prepare(`UPDATE chat_groups SET status = ?, updated_at = ? WHERE id = ?`).run('deleted', now, id);

    // 软删除所有成员
    db.prepare(`UPDATE group_members SET status = ? WHERE group_id = ?`).run('removed', id);

    res.json({ success: true, message: '群聊已解散' });
  } catch (error) {
    console.error('[Groups] 解散群聊失败:', error);
    res.status(500).json({ success: false, message: '解散失败', error: error.message });
  }
});

/**
 * 9. 设置群昵称
 * PUT /api/groups/:id/members/:userId/nickname
 */
router.put('/:id/members/:targetUserId/nickname', authMiddleware, (req, res) => {
  try {
    const { id, targetUserId } = req.params;
    const { nickname } = req.body;
    const userId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只能设置自己的昵称（群主和管理员可以设置其他人的）
    const canModify = targetUserId === userId || isGroupAdmin(id, userId);
    if (!canModify) {
      return res.status(403).json({ success: false, message: '无权设置他人的群昵称' });
    }

    // 检查目标成员是否存在
    const targetMember = db.prepare(`
      SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?
    `).get(id, targetUserId, 'active');

    if (!targetMember) {
      return res.status(404).json({ success: false, message: '该用户不在群中' });
    }

    const now = Date.now();

    // 更新昵称
    db.prepare(`
      UPDATE group_members SET nickname = ? WHERE group_id = ? AND user_id = ?
    `).run(nickname?.trim() || null, id, targetUserId);

    res.json({ 
      success: true, 
      message: '昵称已更新',
      nickname: nickname?.trim() || null
    });
  } catch (error) {
    console.error('[Groups] 设置群昵称失败:', error);
    res.status(500).json({ success: false, message: '设置失败', error: error.message });
  }
});

/**
 * 10. 添加机器人
 * POST /api/groups/:id/bots
 */
router.post('/:id/bots', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { botId, botName } = req.body;
    const userId = req.userId;

    if (!botId) {
      return res.status(400).json({ success: false, message: '缺少机器人ID' });
    }

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只有群主或管理员可以添加机器人
    if (!isGroupAdmin(id, userId)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员才能添加机器人' });
    }

    // 检查机器人是否已在群中
    if (isGroupMember(id, botId)) {
      return res.status(400).json({ success: false, message: '该机器人已在群中' });
    }

    // 检查群人数限制
    const currentCount = getMemberCount(id);
    if (currentCount >= group.max_members) {
      return res.status(400).json({ success: false, message: '群人数已达上限' });
    }

    const now = Date.now();
    const memberId = uuidv4();

    // 添加机器人为成员
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, user_type, nickname, role, joined_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(memberId, id, botId, 'bot', botName || botId, 'member', now, 'active');

    // 更新群组时间
    db.prepare(`UPDATE chat_groups SET updated_at = ? WHERE id = ?`).run(now, id);

    res.json({
      success: true,
      message: '机器人已添加',
      member: {
        id: memberId,
        groupId: id,
        userId: botId,
        userType: 'bot',
        nickname: botName || botId,
        role: 'member',
        joinedAt: now
      }
    });
  } catch (error) {
    console.error('[Groups] 添加机器人失败:', error);
    res.status(500).json({ success: false, message: '添加失败', error: error.message });
  }
});

/**
 * 退出群聊
 * POST /api/groups/:id/leave
 */
router.post('/:id/leave', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 群主不能退出群
    if (group.owner_id === userId) {
      return res.status(400).json({ success: false, message: '群主不能退出群聊，请先转让群主身份或解散群聊' });
    }

    // 检查是否为群成员
    if (!isGroupMember(id, userId)) {
      return res.status(400).json({ success: false, message: '您不在该群中' });
    }

    const now = Date.now();

    // 软删除成员
    db.prepare(`UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ?`).run('left', id, userId);

    // 更新群组时间
    db.prepare(`UPDATE chat_groups SET updated_at = ? WHERE id = ?`).run(now, id);

    res.json({ success: true, message: '已退出群聊' });
  } catch (error) {
    console.error('[Groups] 退出群聊失败:', error);
    res.status(500).json({ success: false, message: '退出失败', error: error.message });
  }
});

/**
 * 更新群信息
 * PUT /api/groups/:id
 */
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar, description, maxMembers } = req.body;
    const userId = req.userId;

    // 检查群是否存在
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND status = ?').get(id, 'active');
    if (!group) {
      return res.status(404).json({ success: false, message: '群聊不存在' });
    }

    // 只有群主可以修改群信息
    if (!isGroupOwner(id, userId)) {
      return res.status(403).json({ success: false, message: '只有群主才能修改群信息' });
    }

    const now = Date.now();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (maxMembers !== undefined) {
      updates.push('max_members = ?');
      values.push(maxMembers);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的内容' });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE chat_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '群信息已更新' });
  } catch (error) {
    console.error('[Groups] 更新群信息失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  }
});

module.exports = router;
