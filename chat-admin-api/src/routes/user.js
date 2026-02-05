/**
 * 用户路由 - 个人信息维护
 */
const express = require('express');
const router = express.Router();
const { UserModel, LoginLogModel } = require('../models/user');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * 获取个人信息
 * GET /api/user/profile
 */
router.get('/profile', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * 更新个人信息
 * PUT /api/user/profile
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nickname, avatar, email, phone } = req.body;
    
    const user = UserModel.update(req.userId, { nickname, avatar, email, phone });
    
    res.json({ success: true, message: '个人信息更新成功', user });
  } catch (error) {
    console.error('[User] 更新个人信息失败:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取登录历史
 * GET /api/user/login-history
 */
router.get('/login-history', authenticate, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = LoginLogModel.findByUserId(req.userId, limit);
    
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 管理员接口 ==========

/**
 * 获取用户列表（管理员）
 * GET /api/user/list
 */
router.get('/list', authenticate, requireAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { role, status } = req.query;
    
    const result = UserModel.findAll({ page, limit, role, status });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户详情（管理员）
 * GET /api/user/:id
 */
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const user = UserModel.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户角色（管理员）
 * PUT /api/user/:id/role
 */
router.put('/:id/role', authenticate, requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: '无效的角色' });
    }
    
    // 不能修改自己的角色
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能修改自己的角色' });
    }
    
    const user = UserModel.updateRole(req.params.id, role);
    
    res.json({ success: true, message: '用户角色更新成功', user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户状态（管理员）
 * PUT /api/user/:id/status
 */
router.put('/:id/status', authenticate, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'disabled', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态' });
    }
    
    // 不能禁用自己
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能禁用自己' });
    }
    
    const user = UserModel.updateStatus(req.params.id, status);
    
    res.json({ success: true, message: '用户状态更新成功', user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除用户（管理员）
 * DELETE /api/user/:id
 */
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    // 不能删除自己
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能删除自己' });
    }
    
    const user = UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    UserModel.delete(req.params.id);
    
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 重置用户密码（管理员）
 * POST /api/user/:id/reset-password
 */
router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
    }
    
    const user = UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    await UserModel.updatePassword(req.params.id, newPassword);
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
