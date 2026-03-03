/**
 * 邮箱 API 路由
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const express = require('express');
const router = express.Router();
const { getEmailChannel, initEmailChannel, EmailChannelPlugin } = require('../plugins/channels/email-channel');
const config = require('../config');

// 认证中间件
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: '未授权', code: 'UNAUTHORIZED' });
  }
  req.userId = userId;
  next();
}

// 管理员中间件
function adminMiddleware(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (adminKey !== (process.env.ADMIN_KEY || 'admin123')) {
    return res.status(403).json({ success: false, error: '需要管理员权限', code: 'FORBIDDEN' });
  }
  next();
}

/**
 * 初始化邮箱插件
 * POST /api/email/init
 */
router.post('/init', adminMiddleware, async (req, res) => {
  try {
    const emailConfig = req.body;
    
    // 验证必要参数
    if (!emailConfig.smtp_host || !emailConfig.smtp_user || !emailConfig.smtp_password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：smtp_host, smtp_user, smtp_password',
        code: 'BAD_REQUEST'
      });
    }

    const plugin = await initEmailChannel(emailConfig);
    
    res.json({
      success: true,
      message: '邮箱插件初始化成功',
      status: plugin.getStatus()
    });
  } catch (error) {
    console.error('[Email] 初始化失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INIT_ERROR'
    });
  }
});

/**
 * 发送邮件
 * POST /api/email/send
 */
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化，请先调用 /api/email/init',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to, subject, text, html, attachments, cc, bcc } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to 和 subject',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.send({
      to,
      subject,
      text,
      html,
      attachments,
      cc,
      bcc
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Email] 发送失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SEND_ERROR'
    });
  }
});

/**
 * 发送简单文本邮件
 * POST /api/email/send-text
 */
router.post('/send-text', authMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to, subject, text',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendText(to, subject, text);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送 HTML 邮件
 * POST /api/email/send-html
 */
router.post('/send-html', authMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to, subject, html, text } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to, subject, html',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendHtml(to, subject, html, text);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 测试连接
 * GET /api/email/test
 */
router.get('/test', adminMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const result = await plugin.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取插件状态
 * GET /api/email/status
 */
router.get('/status', authMiddleware, (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.json({
        success: true,
        initialized: false,
        message: '邮箱插件未初始化'
      });
    }

    res.json({
      success: true,
      initialized: true,
      status: plugin.getStatus()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取未读邮件数量（需要 IMAP 配置）
 * GET /api/email/unread
 */
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const result = await plugin.getUnreadCount();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取最近邮件（需要 IMAP 配置）
 * GET /api/email/recent
 */
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '邮箱插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const emails = await plugin.getRecentEmails(limit);
    res.json({ success: true, count: emails.length, emails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 关闭连接
 * POST /api/email/close
 */
router.post('/close', adminMiddleware, async (req, res) => {
  try {
    const plugin = getEmailChannel();
    
    if (plugin) {
      await plugin.close();
    }

    res.json({ success: true, message: '邮箱插件已关闭' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
