/**
 * 钉钉通道 API
 */
const express = require('express');
const router = express.Router();

let dingtalkChannel = null;

function setChannel(channel) { dingtalkChannel = channel; }
function ensureChannel(req, res, next) {
  if (!dingtalkChannel) return res.status(500).json({ success: false, error: '钉钉通道未初始化' });
  next();
}

router.post('/init', async (req, res) => {
  try {
    const DingTalkChannel = require('../plugins/channels/dingtalk-channel');
    dingtalkChannel = new DingTalkChannel(req.body);
    res.json(await dingtalkChannel.init());
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.post('/send', ensureChannel, async (req, res) => {
  try {
    const { to, content, ...options } = req.body;
    res.json(await dingtalkChannel.sendMessage(to, content, options));
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.post('/text', ensureChannel, async (req, res) => {
  try {
    const { text, webhook, at, atAll } = req.body;
    const wh = dingtalkChannel.webhooks[webhook || dingtalkChannel.defaultWebhook];
    res.json(await dingtalkChannel.sendText(wh, text, { at, atAll }));
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.post('/markdown', ensureChannel, async (req, res) => {
  try {
    const { title, text, webhook, at, atAll } = req.body;
    const wh = dingtalkChannel.webhooks[webhook || dingtalkChannel.defaultWebhook];
    res.json(await dingtalkChannel.sendMarkdown(wh, { title, text }, { at, atAll }));
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.post('/webhook', async (req, res) => {
  try { res.json(await dingtalkChannel.parseWebhook(req.body)); }
  catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.get('/test', ensureChannel, async (req, res) => {
  try { res.json(await dingtalkChannel.testConnection(req.query.webhook)); }
  catch (e) { res.status(500).json({ success: false, error: (e as Error).message }); }
});

router.get('/status', ensureChannel, (req, res) => {
  res.json({ success: true, data: dingtalkChannel.getInfo() });
});

module.exports = { router, setChannel };

// Make this a module
export {};
