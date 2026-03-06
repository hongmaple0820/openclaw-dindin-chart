/**
 * 用户路由 - 个人信息维护
 */
const express = require('express');
const router = express.Router();
const { UserModel, LoginLogModel } = require('../models/user');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/profile', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nickname, avatar, email, phone } = req.body;
    
    const user = await UserModel.update(req.userId, { nickname, avatar, email, phone });
    
    res.json({ success: true, message: '个人信息更新成功', user });
  } catch (error) {
    console.error('[User] 更新个人信息失败:', (error as Error).message);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.get('/login-history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = await LoginLogModel.findByUserId(req.userId, limit);
    
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { role, status } = req.query;
    
    const result = await UserModel.findAll({ page, limit, role, status });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: '无效的角色' });
    }
    
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能修改自己的角色' });
    }
    
    const user = await UserModel.updateRole(req.params.id, role);
    
    res.json({ success: true, message: '用户角色更新成功', user });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'disabled', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态' });
    }
    
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能禁用自己' });
    }
    
    const user = await UserModel.updateStatus(req.params.id, status);
    
    res.json({ success: true, message: '用户状态更新成功', user });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, error: '不能删除自己' });
    }
    
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    await UserModel.delete(req.params.id);
    
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
    }
    
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    await UserModel.updatePassword(req.params.id, newPassword);
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = router;

// Make this a module
export {};
