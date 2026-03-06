/**
 * 统一媒体 API 路由
 * 
 * 端点：
 * - POST /api/media/image - 生成图片
 * - POST /api/media/video - 生成视频
 * - GET /api/media/providers - 获取可用供应商
 * - PUT /api/media/providers/:name - 更新供应商配置
 * - GET /api/media/history - 获取生成历史
 */

const express = require('express');
const router = express.Router();
const MediaGenerator = require('../media/media-generator');

// 初始化 MediaGenerator 实例
let mediaGenerator = null;

function getMediaGenerator() {
  if (!mediaGenerator) {
    mediaGenerator = new MediaGenerator();
  }
  return mediaGenerator;
}

/**
 * 生成图片
 * POST /api/media/image
 */
router.post('/image', async (req, res) => {
  try {
    const { type, characterId, provider, prompt, style, ...options } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required (e.g., selfie, casual, outfit)'
      });
    }

    const generator = getMediaGenerator();
    const generateOptions = { provider, characterId, prompt, style, ...options };

    console.log('[MediaAPI] 生成图片请求:', { type, provider: provider || 'default', characterId });

    const result = await generator.generateImage(type, generateOptions);

    if (result.ok) {
      res.json({
        success: true,
        type: 'image',
        provider: result.provider,
        imageUrl: result.imageUrl,
        filePath: result.filePath,
        metadata: { type, characterId, prompt, style, generatedAt: Date.now() }
      });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Image generation failed' });
    }
  } catch (error) {
    console.error('[MediaAPI] 图片生成失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 生成视频
 * POST /api/media/video
 */
router.post('/video', async (req, res) => {
  try {
    const { type, prompt, characterId, provider, duration, style, ...options } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required (e.g., short, greeting, story)'
      });
    }

    const generator = getMediaGenerator();
    const generateOptions = { provider, characterId, prompt, duration: duration || 5, style, ...options };

    console.log('[MediaAPI] 生成视频请求:', { type, provider: provider || 'default' });

    const result = await generator.generateVideo(type, generateOptions);

    if (result.ok) {
      res.json({
        success: true,
        type: 'video',
        provider: result.provider,
        videoUrl: result.videoUrl,
        duration: result.duration,
        metadata: { type, characterId, prompt, style, generatedAt: Date.now() }
      });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Video generation failed' });
    }
  } catch (error) {
    console.error('[MediaAPI] 视频生成失败:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 获取可用供应商列表
 * GET /api/media/providers
 */
router.get('/providers', (req, res) => {
  try {
    const { type } = req.query;
    const generator = getMediaGenerator();
    const providers = generator.getAvailableProviders(type || null);
    
    res.json({
      success: true,
      count: providers.length,
      providers,
      defaultProviders: {
        image: generator.config.defaultProviders.image,
        video: generator.config.defaultProviders.video
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 获取单个供应商详情
 * GET /api/media/providers/:name
 */
router.get('/providers/:name', (req, res) => {
  try {
    const { name } = req.params;
    const generator = getMediaGenerator();
    const provider = generator.config.providers[name];
    
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    
    const safeConfig = { ...provider };
    if (safeConfig.apiKey) safeConfig.apiKey = '***configured***';
    
    res.json({ success: true, name, type: provider.type, config: safeConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 更新供应商配置
 * PUT /api/media/providers/:name
 */
router.put('/providers/:name', (req, res) => {
  try {
    const { name } = req.params;
    const config = req.body;
    const generator = getMediaGenerator();
    
    if (!generator.config.providers[name] && !config.type) {
      return res.status(400).json({
        success: false,
        error: 'Provider does not exist. Specify "type" to create.'
      });
    }
    
    if (!generator.config.providers[name]) {
      generator.config.providers[name] = { type: config.type };
    }
    
    const { type: _, ...configWithoutType } = config;
    generator.config.providers[name] = { ...generator.config.providers[name], ...configWithoutType };
    
    console.log('[MediaAPI] 更新供应商配置:', name);
    res.json({ success: true, provider: name, config: generator.config.providers[name] });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 删除供应商
 * DELETE /api/media/providers/:name
 */
router.delete('/providers/:name', (req, res) => {
  try {
    const { name } = req.params;
    const generator = getMediaGenerator();
    
    if (!generator.config.providers[name]) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    
    delete generator.config.providers[name];
    res.json({ success: true, message: 'Provider deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 获取生成历史
 * GET /api/media/history
 */
router.get('/history', (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    const generator = getMediaGenerator();
    
    try {
      const db = generator.db;
      let sql = 'SELECT * FROM media_history ORDER BY created_at DESC LIMIT ?';
      const params = [parseInt(limit)];
      
      if (type) {
        sql = 'SELECT * FROM media_history WHERE type = ? ORDER BY created_at DESC LIMIT ?';
        params.unshift(type);
      }
      
      const stmt = db.prepare(sql);
      const history = stmt.all(...params);
      res.json({ success: true, count: history.length, history });
    } catch (dbError) {
      res.json({ success: true, count: 0, history: [], note: 'History table not initialized' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 批量生成图片
 * POST /api/media/image/batch
 */
router.post('/image/batch', async (req, res) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ success: false, error: 'requests must be a non-empty array' });
    }

    const generator = getMediaGenerator();
    const results = [];

    for (const request of requests) {
      try {
        const result = await generator.generateImage(request.type, request);
        results.push({ request, result });
      } catch (error) {
        results.push({ request, result: { ok: false, error: (error as Error).message } });
      }
    }

    res.json({
      success: true,
      total: results.length,
      succeeded: results.filter(r => r.result.ok).length,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

module.exports = router;

// Make this a module
export {};
