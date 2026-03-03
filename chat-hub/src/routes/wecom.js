/**
 * 企业微信 API 路由
 * 
 * @author 小琳
 * @date 2026-03-03
 */

const express = require('express');
const router = express.Router();
const { getWecomChannel, initWecomChannel, WecomChannelPlugin } = require('../plugins/channels/wecom-channel');

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
 * 初始化企业微信插件
 * POST /api/wecom/init
 */
router.post('/init', adminMiddleware, async (req, res) => {
  try {
    const wecomConfig = req.body;
    
    // 验证必要参数
    if (!wecomConfig.corp_id || !wecomConfig.agent_id || !wecomConfig.secret) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：corp_id, agent_id, secret',
        code: 'BAD_REQUEST'
      });
    }

    const plugin = await initWecomChannel(wecomConfig);
    
    res.json({
      success: true,
      message: '企业微信插件初始化成功',
      status: plugin.getStatus()
    });
  } catch (error) {
    console.error('[Wecom] 初始化失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INIT_ERROR'
    });
  }
});

/**
 * 发送消息（通用接口）
 * POST /api/wecom/send
 */
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化，请先调用 /api/wecom/init',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, to_party, to_tag, msgtype, content } = req.body;

    if (!msgtype || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：msgtype, content',
        code: 'BAD_REQUEST'
      });
    }

    // 构建消息体
    const message = {
      touser: to_user,
      toparty: to_party,
      totag: to_tag,
      msgtype,
      agentid: parseInt(plugin.agentId),
      [msgtype]: typeof content === 'string' ? { content } : content
    };

    const result = await plugin.sendRaw(message);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Wecom] 发送失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SEND_ERROR'
    });
  }
});

/**
 * 发送文本消息
 * POST /api/wecom/send-text
 */
router.post('/send-text', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, content, safe, to_party, to_tag } = req.body;

    if (!to_user || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to_user, content',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendText(to_user, content, { toParty: to_party, toTag: to_tag, safe });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送图片消息
 * POST /api/wecom/send-image
 */
router.post('/send-image', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, media_id, safe, to_party, to_tag } = req.body;

    if (!to_user || !media_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to_user, media_id',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendImage(to_user, media_id, { toParty: to_party, toTag: to_tag, safe });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送文件消息
 * POST /api/wecom/send-file
 */
router.post('/send-file', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, media_id, to_party, to_tag } = req.body;

    if (!to_user || !media_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to_user, media_id',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendFile(to_user, media_id, { toParty: to_party, toTag: to_tag });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送 Markdown 消息
 * POST /api/wecom/send-markdown
 */
router.post('/send-markdown', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, content } = req.body;

    if (!to_user || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to_user, content',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendMarkdown(to_user, content);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 发送文本卡片消息
 * POST /api/wecom/send-card
 */
router.post('/send-card', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { to_user, title, description, url, btntxt } = req.body;

    if (!to_user || !title || !url) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：to_user, title, url',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.sendTextCard(to_user, { title, description, url, btntxt });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 上传临时素材
 * POST /api/wecom/upload
 */
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const { file, type = 'file', filename } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：file',
        code: 'BAD_REQUEST'
      });
    }

    const result = await plugin.uploadMedia(file, type, filename);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 接收消息回调
 * POST /api/wecom/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    // URL 验证（首次配置回调）
    const { msg_signature, timestamp, nonce, echostr } = req.query;
    
    if (echostr) {
      if (!plugin) {
        return res.status(503).send('Plugin not initialized');
      }
      
      const result = plugin.verifyCallback(msg_signature, timestamp, nonce, echostr);
      if (result.valid) {
        return res.send(result.echostr);
      }
      return res.status(400).send('Invalid signature');
    }

    // 解析回调消息
    if (!plugin) {
      return res.status(503).json({ success: false, error: '插件未初始化' });
    }

    // 获取请求体（可能是 XML 或 JSON）
    let body = req.body;
    
    // 如果是 Buffer，转成字符串
    if (Buffer.isBuffer(body)) {
      body = body.toString('utf8');
    }

    // 解析消息
    const message = await plugin.parseCallback(typeof body === 'string' ? body : JSON.stringify(body));
    
    console.log('[Wecom] 收到回调消息:', message);

    // 触发消息事件
    plugin._emitMessage({
      direction: 'received',
      ...message
    });

    // 返回成功（企业微信要求）
    res.send('success');
  } catch (error) {
    console.error('[Wecom] 回调处理失败:', error.message);
    res.status(500).send('error');
  }
});

/**
 * 回调 URL 验证（GET 请求）
 * GET /api/wecom/webhook
 */
router.get('/webhook', async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).send('Plugin not initialized');
    }

    const { msg_signature, timestamp, nonce, echostr } = req.query;
    
    if (!echostr) {
      return res.send('Wecom webhook endpoint');
    }

    const result = plugin.verifyCallback(msg_signature, timestamp, nonce, echostr);
    
    if (result.valid) {
      return res.send(result.echostr);
    }
    
    res.status(400).send('Invalid signature');
  } catch (error) {
    console.error('[Wecom] 回调验证失败:', error.message);
    res.status(500).send('error');
  }
});

/**
 * 测试连接
 * GET /api/wecom/test
 */
router.get('/test', adminMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
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
 * 获取 access_token（调试用）
 * GET /api/wecom/token
 */
router.get('/token', adminMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.status(503).json({
        success: false,
        error: '企业微信插件未初始化',
        code: 'NOT_INITIALIZED'
      });
    }

    const token = await plugin.getAccessToken();
    
    res.json({
      success: true,
      access_token: token,
      expire_time: new Date(plugin.tokenExpireTime).toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取插件状态
 * GET /api/wecom/status
 */
router.get('/status', authMiddleware, (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (!plugin) {
      return res.json({
        success: true,
        initialized: false,
        message: '企业微信插件未初始化'
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
 * 关闭插件
 * POST /api/wecom/close
 */
router.post('/close', adminMiddleware, async (req, res) => {
  try {
    const plugin = getWecomChannel();
    
    if (plugin) {
      await plugin.close();
    }

    res.json({ success: true, message: '企业微信插件已关闭' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
