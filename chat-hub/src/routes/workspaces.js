/**
 * 协作空间 API 路由
 * @author 小琳
 * @date 2026-03-05
 * 
 * 功能：
 * - 空间管理（创建、查询、更新、删除）
 * - 成员管理（添加、移除、角色更新）
 * - 消息管理（发送、接收、搜索）
 * - Agent 触发
 * - SSE 实时推送
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'chat-hub.db');
const db = new Database(dbPath);

// SSE 管理器（从 app.locals 获取）
let sseManager = null;
router.setSSEManager = (manager) => {
  sseManager = manager;
};

// 表名常量
const TABLES = {
  spaces: 'collab_spaces',
  members: 'collab_space_members',
  messages: 'collab_space_messages'
};

// ============================================================
// 空间管理
// ============================================================

/**
 * GET /api/workspaces
 * 获取协作空间列表
 */
router.get('/', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { type, limit = 50, offset = 0 } = req.query;
    
    // 查询用户所属的空间
    let sql = `
      SELECT w.*, 
        (SELECT COUNT(*) FROM ${TABLES.members} WHERE space_id = w.id) as member_count,
        (SELECT COUNT(*) FROM ${TABLES.messages} WHERE space_id = w.id) as message_count
      FROM ${TABLES.spaces} w
      LEFT JOIN ${TABLES.members} wm ON w.id = wm.space_id
      WHERE wm.member_id = ? OR w.owner_id = ?
    `;
    const params = [userId, userId];
    
    if (type) {
      sql += ' AND w.type = ?';
      params.push(type);
    }
    
    sql += ' GROUP BY w.id ORDER BY w.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const workspaces = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      count: workspaces.length,
      workspaces
    });
  } catch (error) {
    console.error('[Workspaces] 获取列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspaces
 * 创建协作空间
 */
router.post('/', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { name, description, avatar, type = 'human-ai', members = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    
    const id = 'ws_' + Date.now() + '_' + uuidv4().slice(0, 8);
    const now = Date.now();
    
    // 创建空间
    db.prepare(`
      INSERT INTO collab_spaces (id, name, description, avatar, type, owner_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
    `).run(id, name, description || '', avatar || '', type, userId, now, now);
    
    // 添加创建者为管理员
    db.prepare(`
      INSERT INTO collab_space_members (id, space_id, member_id, member_type, role, joined_at)
      VALUES (?, ?, ?, 'human', 'admin', ?)
    `).run('wm_' + uuidv4().slice(0, 8), id, userId, now);
    
    // 添加其他成员
    for (const member of members) {
      const memberId = member.id || member;
      const memberType = member.type || 'human';
      const role = member.role || 'member';
      
      db.prepare(`
        INSERT INTO collab_space_members (id, space_id, member_id, member_type, role, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('wm_' + uuidv4().slice(0, 8), id, memberId, memberType, role, now);
    }
    
    console.log('[Workspaces] 创建空间: ' + name + ' (' + id + ')');
    
    res.status(201).json({
      success: true,
      workspace: {
        id,
        name,
        description,
        avatar,
        type,
        owner_id: userId,
        created_at: now,
        updated_at: now
      }
    });
  } catch (error) {
    console.error('[Workspaces] 创建失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workspaces/:id
 * 获取空间详情
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    // 获取成员列表
    const members = db.prepare(`
      SELECT * FROM collab_space_members WHERE space_id = ?
    `).all(id);
    
    // 获取最近消息
    const recentMessages = db.prepare(`
      SELECT * FROM collab_space_messages 
      WHERE space_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(id);
    
    res.json({
      success: true,
      workspace: {
        ...workspace,
        settings: workspace.settings ? JSON.parse(workspace.settings) : {},
        members,
        recentMessages: recentMessages.reverse()
      }
    });
  } catch (error) {
    console.error('[Workspaces] 获取详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workspaces/:id
 * 更新空间
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const { name, description, avatar, type, settings } = req.body;
    
    // 检查权限
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    const member = db.prepare(`
      SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
    `).get(id, userId);
    
    if (workspace.owner_id !== userId && member?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // 更新
    const updates = [];
    const params = [];
    
    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (type) { updates.push('type = ?'); params.push(type); }
    if (settings) { updates.push('settings = ?'); params.push(JSON.stringify(settings)); }
    
    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);
    
    db.prepare(`UPDATE collab_spaces SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    console.log('[Workspaces] 更新空间: ' + id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Workspaces] 更新失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workspaces/:id
 * 删除空间
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    if (workspace.owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only owner can delete workspace' });
    }
    
    // 删除空间（级联删除成员和消息）
    db.prepare('DELETE FROM collab_spaces WHERE id = ?').run(id);
    
    console.log('[Workspaces] 删除空间: ' + id);
    
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    console.error('[Workspaces] 删除失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 成员管理
// ============================================================

/**
 * POST /api/workspaces/:id/members
 * 添加成员
 */
router.post('/:id/members', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const { memberId, memberType = 'human', role = 'member' } = req.body;
    
    if (!memberId) {
      return res.status(400).json({ success: false, error: 'memberId is required' });
    }
    
    // 检查空间是否存在
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    // 检查权限
    const member = db.prepare(`
      SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
    `).get(id, userId);
    
    if (workspace.owner_id !== userId && member?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // 检查是否已是成员
    const existingMember = db.prepare(`
      SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
    `).get(id, memberId);
    
    if (existingMember) {
      return res.status(400).json({ success: false, error: 'Already a member' });
    }
    
    // 添加成员
    const now = Date.now();
    db.prepare(`
      INSERT INTO collab_space_members (id, space_id, member_id, member_type, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('wm_' + uuidv4().slice(0, 8), id, memberId, memberType, role, now);
    
    console.log('[Workspaces] 添加成员: ' + memberId + ' -> ' + id);
    
    res.status(201).json({
      success: true,
      member: {
        space_id: id,
        member_id: memberId,
        member_type: memberType,
        role,
        joined_at: now
      }
    });
  } catch (error) {
    console.error('[Workspaces] 添加成员失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workspaces/:id/members/:memberId
 * 移除成员
 */
router.delete('/:id/members/:memberId', (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.headers['x-user-id'];
    
    // 检查权限
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    if (workspace.owner_id !== userId && userId !== memberId) {
      const member = db.prepare(`
        SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
      `).get(id, userId);
      
      if (member?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied' });
      }
    }
    
    db.prepare(`
      DELETE FROM collab_space_members WHERE space_id = ? AND member_id = ?
    `).run(id, memberId);
    
    console.log('[Workspaces] 移除成员: ' + memberId + ' <- ' + id);
    
    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    console.error('[Workspaces] 移除成员失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workspaces/:id/members/:memberId
 * 更新成员角色
 */
router.put('/:id/members/:memberId', (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.headers['x-user-id'];
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ success: false, error: 'role is required' });
    }
    
    // 检查权限
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    if (workspace.owner_id !== userId) {
      const member = db.prepare(`
        SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
      `).get(id, userId);
      
      if (member?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Permission denied' });
      }
    }
    
    db.prepare(`
      UPDATE collab_space_members SET role = ? WHERE space_id = ? AND member_id = ?
    `).run(role, id, memberId);
    
    console.log('[Workspaces] 更新成员角色: ' + memberId + ' -> ' + role);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Workspaces] 更新成员角色失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 消息管理
// ============================================================

/**
 * GET /api/workspaces/:id/messages
 * 获取消息列表
 */
router.get('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, before, after } = req.query;
    
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    let sql = 'SELECT * FROM collab_space_messages WHERE space_id = ?';
    const params = [id];
    
    if (before) {
      sql += ' AND created_at < ?';
      params.push(parseInt(before));
    }
    
    if (after) {
      sql += ' AND created_at > ?';
      params.push(parseInt(after));
    }
    
    sql += ' ORDER BY created_at ASC LIMIT ?';
    params.push(parseInt(limit));
    
    const messages = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('[Workspaces] 获取消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workspaces/:id/messages
 * 发送消息
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { content, replyTo, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    
    const workspace = db.prepare('SELECT * FROM collab_spaces WHERE id = ?').get(id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    // 检查是否是成员
    const member = db.prepare(`
      SELECT * FROM collab_space_members WHERE space_id = ? AND member_id = ?
    `).get(id, userId);
    
    if (!member) {
      return res.status(403).json({ success: false, error: 'Not a member' });
    }
    
    const messageId = 'msg_' + Date.now() + '_' + uuidv4().slice(0, 8);
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO collab_space_messages (id, space_id, sender_id, sender_type, content, reply_to, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      id,
      userId,
      member.member_type,
      content,
      replyTo || null,
      JSON.stringify(metadata || {}),
      now
    );
    
    // 更新空间活跃时间
    db.prepare('UPDATE collab_spaces SET updated_at = ? WHERE id = ?').run(now, id);
    
    console.log('[Workspaces] 发送消息: ' + userId + ' -> ' + id);
    
    // SSE 实时推送给空间成员
    if (sseManager) {
      sseManager.broadcast('workspace_message', {
        space_id: id,
        message: {
          id: messageId,
          space_id: id,
          sender_id: userId,
          sender_type: member.member_type,
          content,
          reply_to: replyTo || null,
          metadata: metadata || {},
          created_at: now
        }
      });
    }
    
    // 异步触发 Agent（不阻塞响应）
    triggerAgentsAsync(id, userId, content);
    
    res.status(201).json({
      success: true,
      message: {
        id: messageId,
        space_id: id,
        sender_id: userId,
        sender_type: member.member_type,
        content,
        reply_to: replyTo || null,
        metadata: metadata || {},
        created_at: now
      }
    });
  } catch (error) {
    console.error('[Workspaces] 发送消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 异步触发 Agent 响应
 */
async function triggerAgentsAsync(spaceId, senderId, content) {
  try {
    // 获取空间中的 Agent 成员
    const agentMembers = db.prepare(`
      SELECT * FROM collab_space_members 
      WHERE space_id = ? AND member_type = 'agent' AND role IN ('assistant', 'admin')
    `).all(spaceId);
    
    if (agentMembers.length === 0) return;
    
    // 检查触发条件
    const mentionPattern = /@(\S+)/g;
    const mentions = content.match(mentionPattern) || [];
    const hasKeywords = ['帮我', '请', '能不能', '可以吗', '帮忙'].some(kw => content.includes(kw));
    
    // 只在 @ 或关键词触发时响应
    if (mentions.length === 0 && !hasKeywords) return;
    
    console.log('[Workspaces] 触发 Agent 响应: ' + agentMembers.length + ' 个 Agent');
    
    // 遍历 Agent，异步调用
    for (const agentMember of agentMembers) {
      const agentId = agentMember.member_id;
      
      // 检查是否被 @ 或全局触发
      const isMentioned = mentions.some(m => m.includes(agentId) || m.toLowerCase().includes('agent'));
      
      if (!isMentioned && !hasKeywords) continue;
      
      // 异步调用 Agent API（不等待响应）
      callAgentAsync(spaceId, agentId, content, senderId).catch(err => {
        console.error('[Workspaces] Agent 调用失败:', err.message);
      });
    }
  } catch (error) {
    console.error('[Workspaces] 触发 Agent 失败:', error);
  }
}

/**
 * 异步调用 Agent API
 */
async function callAgentAsync(spaceId, agentId, content, senderId) {
  // 获取 Agent 配置
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  
  if (!agent || !agent.api_endpoint || !agent.api_key) {
    console.log('[Workspaces] Agent 未配置 API: ' + agentId);
    return;
  }
  
  // 简单的 prompt 构建
  const prompt = `[协作空间消息]
发送者: ${senderId}
内容: ${content}

请回复:`;

  try {
    // 调用 Agent API
    const response = await fetch(agent.api_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent.api_key}`
      },
      body: JSON.stringify({
        model: agent.model || 'gpt-4',
        messages: [
          { role: 'system', content: agent.system_prompt || '你是一个有用的助手' },
          { role: 'user', content: prompt }
        ],
        max_tokens: agent.max_tokens || 500
      })
    });
    
    if (!response.ok) {
      throw new Error('API 调用失败: ' + response.status);
    }
    
    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content;
    
    if (!replyContent) return;
    
    // 保存 Agent 响应消息
    const replyId = 'msg_' + Date.now() + '_' + uuidv4().slice(0, 8);
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO collab_space_messages (id, space_id, sender_id, sender_type, content, reply_to, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      replyId,
      spaceId,
      agentId,
      'agent',
      replyContent,
      null,
      JSON.stringify({ model: agent.model }),
      now
    );
    
    console.log('[Workspaces] Agent 响应已保存: ' + agentId);
  } catch (error) {
    console.error('[Workspaces] Agent API 调用失败:', error);
  }
}

module.exports = router;