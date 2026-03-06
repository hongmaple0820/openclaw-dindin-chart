/**
 * TTS API Routes - 文本转语音接口
 */
import express from 'express';
import ttsService, { TTSConfig, EDGE_VOICES } from '../services/tts-service';

const router = express.Router();

/**
 * POST /api/tts/generate
 * 生成语音文件
 * 
 * Body:
 * - text: 要转换的文本
 * - provider: tts 提供商 (edge | openai | elevenlabs)
 * - voice: 语音名称
 * - speed: 语速 (0.5 - 2.0)
 */
router.post('/generate', async (req, res) => {
  try {
    const { text, provider = 'edge', voice, speed, pitch } = req.body;

    if (!text) {
      res.status(400).json({ error: '缺少文本内容' });
      return;
    }

    if (text.length > 5000) {
      res.status(400).json({ error: '文本过长，最多支持 5000 字符' });
      return;
    }

    const config: TTSConfig = {
      provider,
      voice,
      speed,
      pitch,
    };

    const result = await ttsService.generate(text, config);

    if (!result) {
      res.status(500).json({ error: '语音生成失败' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[TTS API] 生成失败:', error);
    res.status(500).json({ 
      error: '语音生成失败',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/tts/voices
 * 获取可用语音列表
 */
router.get('/voices', (req, res) => {
  const { provider = 'edge' } = req.query;
  
  const voices = ttsService.getAvailableVoices(provider as 'edge' | 'openai' | 'elevenlabs');
  
  res.json({
    success: true,
    data: voices,
  });
});

/**
 * GET /api/tts/edge-voices
 * 获取 Edge-TTS 中文语音列表
 */
router.get('/edge-voices', (req, res) => {
  const zhVoices = Object.entries(EDGE_VOICES)
    .filter(([key]) => key.startsWith('zh-CN'))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  res.json({
    success: true,
    data: zhVoices,
    total: Object.keys(zhVoices).length,
  });
});

export default router;