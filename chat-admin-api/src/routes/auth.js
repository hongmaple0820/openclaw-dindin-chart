/**
 * 认证路由 - 注册、登录、密码重置
 */
const express = require('express');
const router = express.Router();
const { UserModel, VerificationCodeModel, RefreshTokenModel, LoginLogModel } = require('../models/user');
const { authenticate, generateToken, generateRefreshToken } = require('../middleware/auth');
const config = require('../config');

router.post('/register', async (req, res) => {
  try {
    const { username, password, email, phone, nickname } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码为必填项' });
    }
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名只能包含字母、数字、下划线，长度3-20位' 
      });
    }
    
    if (password.length < config.password.minLength) {
      return res.status(400).json({ 
        success: false, 
        error: `密码长度不能少于${config.password.minLength}位` 
      });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: '邮箱格式不正确' });
    }
    
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' });
    }
    
    const user = await UserModel.create({ username, password, email, phone, nickname });
    
    const accessToken = generateToken(user.id);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user.id);
    await RefreshTokenModel.create(user.id, refreshToken, expiresAt);
    
    res.json({
      success: true,
      message: '注册成功',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('[Auth] 注册失败:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码为必填项' });
    }
    
    let user = await UserModel.findByUsername(username);
    if (!user && username.includes('@')) {
      user = await UserModel.findByEmail(username);
    }
    if (!user && /^1[3-9]\d{9}$/.test(username)) {
      user = await UserModel.findByPhone(username);
    }
    
    if (!user) {
      await LoginLogModel.create({ userId: 'unknown', ip, userAgent, success: false });
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: '账户已被禁用' });
    }
    
    const isValid = await UserModel.verifyPassword(user, password);
    if (!isValid) {
      await LoginLogModel.create({ userId: user.id, ip, userAgent, success: false });
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    await LoginLogModel.create({ userId: user.id, ip, userAgent, success: true });
    await UserModel.updateLastLogin(user.id);
    
    const accessToken = generateToken(user.id);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user.id);
    await RefreshTokenModel.create(user.id, refreshToken, expiresAt);
    
    delete user.password_hash;
    
    res.json({
      success: true,
      message: '登录成功',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('[Auth] 登录失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: '刷新令牌为必填项' });
    }
    
    const tokenRecord = await RefreshTokenModel.findByToken(refreshToken);
    if (!tokenRecord) {
      return res.status(401).json({ success: false, error: '无效的刷新令牌' });
    }
    
    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, error: '用户不存在或已被禁用' });
    }
    
    await RefreshTokenModel.delete(refreshToken);
    
    const accessToken = generateToken(user.id);
    const { token: newRefreshToken, expiresAt } = generateRefreshToken(user.id);
    await RefreshTokenModel.create(user.id, newRefreshToken, expiresAt);
    
    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('[Auth] 刷新令牌失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken, logoutAll } = req.body;
    
    if (logoutAll) {
      await RefreshTokenModel.deleteByUserId(req.userId);
    } else if (refreshToken) {
      await RefreshTokenModel.delete(refreshToken);
    }
    
    res.json({ success: true, message: '登出成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: '邮箱为必填项' });
    }
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.json({ success: true, message: '如果邮箱存在，验证码已发送' });
    }
    
    const { code, expiresAt } = await VerificationCodeModel.create({
      userId: user.id,
      type: 'password_reset',
      target: email
    });
    
    console.log(`[Auth] 密码重置验证码: ${email} -> ${code}`);
    
    res.json({ 
      success: true, 
      message: '验证码已发送到邮箱',
      ...(process.env.NODE_ENV !== 'production' && { code })
    });
  } catch (error) {
    console.error('[Auth] 发送验证码失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: '邮箱、验证码和新密码为必填项' });
    }
    
    if (newPassword.length < config.password.minLength) {
      return res.status(400).json({ 
        success: false, 
        error: `密码长度不能少于${config.password.minLength}位` 
      });
    }
    
    const verification = await VerificationCodeModel.verify(email, 'password_reset', code);
    if (!verification) {
      return res.status(400).json({ success: false, error: '验证码无效或已过期' });
    }
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    
    await UserModel.updatePassword(user.id, newPassword);
    await RefreshTokenModel.deleteByUserId(user.id);
    
    res.json({ success: true, message: '密码重置成功，请重新登录' });
  } catch (error) {
    console.error('[Auth] 重置密码失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码为必填项' });
    }
    
    if (newPassword.length < config.password.minLength) {
      return res.status(400).json({ 
        success: false, 
        error: `密码长度不能少于${config.password.minLength}位` 
      });
    }
    
    const user = await UserModel.findByUsername(req.user.username);
    
    const isValid = await UserModel.verifyPassword(user, oldPassword);
    if (!isValid) {
      return res.status(400).json({ success: false, error: '旧密码错误' });
    }
    
    await UserModel.updatePassword(req.userId, newPassword);
    
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('[Auth] 修改密码失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
