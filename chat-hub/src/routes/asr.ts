/**
 * ASR API 路由 - 语音识别接口
 * 
 * 端点：
 * - POST /api/asr/transcribe - 语音转文字
 * - GET /api/asr/providers - 获取可用提供商
 * - POST /api/asr/convert - 音频格式转换
 */

const express = require('express');
const multer = require('multer');
const { getASRService, initASRService } = require('../services/asr-service');

const router = express.Router();

// Multer 配置 - 用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB (OpenAI Whisper 限制)
  }
});

// 获取 ASR 服务实例
function getService() {
  return getASRService();
}

/**
 * 语音转文字
 * POST /api/asr/transcribe
 * 
 * 支持两种请求格式：
 * 1. JSON Body: { audio: "base64...", format: "wav", language: "zh-CN", provider: "openai" }
 * 2. Multipart Form: file 字段为音频文件
 */
router.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    const service = getService();
    
    let audioData;
    let format;
    let language;
    let provider;
    let options;

    // 处理文件上传
    if (req.file) {
      audioData = req.file.buffer;
      // 从文件名或 mimetype 推断格式
      const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'wav';
      format = ext;
      
      // 从 form fields 获取其他参数
      language = req.body.language;
      provider = req.body.provider;
      options = req.body.options ? JSON.parse(req.body.options) : undefined;
    } else {
      // JSON body
      const body = req.body;
      audioData = body.audio;
      format = body.format || 'wav';
      language = body.language;
      provider = body.provider;
      options = body.options;
    }

    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'No audio data provided. Use "file" field or "audio" in JSON body.'
      });
    }

    // 验证格式
    const supportedFormats = ['wav', 'mp3', 'm4a', 'ogg', 'webm', 'amr', 'pcm'];
    if (!supportedFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}`
      });
    }

    console.log(`[ASR] Transcribe request: format=${format}, provider=${provider || 'default'}`);

    const request = {
      audio: audioData,
      format,
      language,
      provider,
      options
    };

    const result = await service.transcribe(request);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? (error as Error).message : String(error);
    console.error('[ASR] Transcribe error:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 获取可用提供商列表
 * GET /api/asr/providers
 */
router.get('/providers', (req, res) => {
  try {
    const service = getService();
    const providers = service.getProviders();
    const enabled = service.getEnabledProviders();

    res.json({
      success: true,
      providers,
      enabledProviders: enabled,
      defaultProvider: providers.find(p => p.enabled)?.name || 'openai'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error as Error).message : String(error)
    });
  }
});

/**
 * 获取单个提供商详情
 * GET /api/asr/providers/:name
 */
router.get('/providers/:name', (req, res) => {
  try {
    const { name } = req.params;
    const service = getService();
    const providers = service.getProviders();
    const provider = providers.find(p => p.name === name);

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Provider not found: ${name}`
      });
    }

    res.json({
      success: true,
      provider
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error as Error).message : String(error)
    });
  }
});

/**
 * 音频格式转换
 * POST /api/asr/convert
 * 
 * Body: { file: 音频文件 }
 * Query: format=wav, sampleRate=16000
 */
router.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const service = getService();
    const outputFormat = req.query.format || 'wav';
    const sampleRate = parseInt(req.query.sampleRate) || 16000;

    // 推断输入格式
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'wav';

    console.log(`[ASR] Convert request: ${ext} -> ${outputFormat}, sampleRate=${sampleRate}`);

    const converted = await service.convertAudio(
      req.file.buffer,
      ext,
      outputFormat,
      sampleRate
    );

    // 设置响应头
    res.setHeader('Content-Type', outputFormat === 'wav' ? 'audio/wav' : 'application/octet-stream');
    res.setHeader('Content-Length', converted.length);
    res.send(converted);
  } catch (error) {
    const errorMessage = error instanceof Error ? (error as Error).message : String(error);
    console.error('[ASR] Convert error:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 批量语音转文字
 * POST /api/asr/transcribe/batch
 * 
 * Body: { files: [File], provider?: string }
 */
router.post('/transcribe/batch', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      });
    }

    const service = getService();
    const provider = req.body.provider;
    const results = [];

    for (const file of files) {
      const ext = file.originalname?.split('.').pop()?.toLowerCase() || 'wav';
      
      try {
        const result = await service.transcribe({
          audio: file.buffer,
          format: ext,
          provider
        });
        results.push({
          filename: file.originalname,
          ...result
        });
      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          text: '',
          provider: provider || 'default',
          error: error instanceof Error ? (error as Error).message : String(error)
        });
      }
    }

    res.json({
      success: true,
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error as Error).message : String(error)
    });
  }
});

module.exports = router;
// Make this a module
export {};
