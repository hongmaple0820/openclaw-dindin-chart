/**
 * TTS 语音合成 API
 * 
 * API 端点：
 * - POST /api/tts/synthesize  合成语音
 * - GET  /api/tts/voices      获取可用语音列表
 * - POST /api/tts/convert     转换文本并发送到钉钉
 */
const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);
const router = express.Router();

// TTS 配置
const DEFAULT_CONFIG = {
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: '+0%',
  pitch: '+0Hz',
  format: 'audio-24khz-48kbitrate-mono-mp3'
};

// 可用语音列表
const AVAILABLE_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', language: '中文', gender: 'female' },
  { id: 'zh-CN-YunxiNeural', name: '云希', language: '中文', gender: 'male' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', language: '中文', gender: 'male' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', language: '中文', gender: 'female' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', language: 'English', gender: 'female' },
  { id: 'en-US-GuyNeural', name: 'Guy', language: 'English', gender: 'male' },
  { id: 'ja-JP-NanamiNeural', name: 'Nanami', language: 'Japanese', gender: 'female' }
];

// 输出目录
const OUTPUT_DIR = path.join(process.env.HOME || '/tmp', '.openclaw', 'chat-data', 'tts');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * POST /api/tts/synthesize
 * 合成语音
 * 
 * Body: { text: string, voice?: string, rate?: string, pitch?: string }
 * Response: { success: boolean, audioUrl?: string, error?: string }
 */
router.post('/synthesize', async (req: any, res: any) => {
  try {
    const { text, voice, rate, pitch } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: '缺少文本内容' });
    }

    // 过滤TTS关键词
    const cleanText = text.replace(/^(tts|TTS|语音|朗读)\s*/i, '');
    
    // 生成唯一文件名
    const audioId = uuidv4();
    const outputPath = path.join(OUTPUT_DIR, `tts_${audioId}.mp3`);

    // 构建edge-tts命令
    const config = { ...DEFAULT_CONFIG };
    if (voice) config.voice = voice;
    if (rate) config.rate = rate;
    if (pitch) config.pitch = pitch;
    
    const command = `edge-tts --text "${cleanText.replace(/"/g, '\\"')}" --voice ${config.voice} --rate="${config.rate}" --pitch="${config.pitch}" --write-media "${outputPath}"`;

    console.log('[TTS] 执行命令:', command);
    
    // 执行TTS命令
    await execAsync(command, { timeout: 30000 });

    // 检查文件是否生成
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ success: false, error: '语音文件生成失败' });
    }

    // 返回音频URL
    const audioUrl = `/media/tts/tts_${audioId}.mp3`;
    res.json({ 
      success: true, 
      audioUrl,
      audioId,
      text: cleanText,
      voice: config.voice
    });

  } catch (error: any) {
    console.error('[TTS] 合成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tts/voices
 * 获取可用语音列表
 */
router.get('/voices', (_req: any, res: any) => {
  res.json({ 
    success: true, 
    voices: AVAILABLE_VOICES 
  });
});

/**
 * POST /api/tts/convert
 * 转换文本为语音并返回音频数据（Base64）
 * 
 * Body: { text: string, voice?: string, rate?: string }
 * Response: { success: boolean, audioData?: string, error?: string }
 */
router.post('/convert', async (req: any, res: any) => {
  try {
    const { text, voice, rate } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: '缺少文本内容' });
    }

    const cleanText = text.replace(/^(tts|TTS|语音|朗读)\s*/i, '');
    const audioId = uuidv4();
    const outputPath = path.join(OUTPUT_DIR, `tts_${audioId}.mp3`);

    const config = { ...DEFAULT_CONFIG, voice, rate };
    const command = `edge-tts --text "${cleanText.replace(/"/g, '\\"')}" --voice ${config.voice} --rate=${config.rate} --write-media "${outputPath}"`;

    await execAsync(command, { timeout: 30000 });

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ success: false, error: '语音文件生成失败' });
    }

    // 读取音频文件并转换为Base64
    const audioBuffer = fs.readFileSync(outputPath);
    const audioBase64 = audioBuffer.toString('base64');

    res.json({ 
      success: true, 
      audioData: audioBase64,
      mimeType: 'audio/mpeg',
      text: cleanText
    });

    // 清理临时文件
    fs.unlinkSync(outputPath);

  } catch (error: any) {
    console.error('[TTS] 转换失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tts/health
 * 健康检查
 */
router.get('/health', (_req: any, res: any) => {
  res.json({ 
    success: true, 
    service: 'TTS API',
    status: 'running',
    outputDir: OUTPUT_DIR
  });
});

module.exports = router;