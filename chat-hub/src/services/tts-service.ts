/**
 * TTS Service - 文本转语音服务
 * 
 * 支持多种 TTS 提供商：
 * - Edge-TTS: 微软语音，免费，质量好
 * - OpenAI TTS: 高质量，需要 OpenAI API Key
 * - ElevenLabs: 专业级，需要 API Key
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

// TTS 配置
export interface TTSConfig {
  provider: 'edge' | 'openai' | 'elevenlabs';
  voice?: string;
  speed?: number;
  pitch?: number;
  language?: string;
}

// TTS 结果
export interface TTSResult {
  filePath: string;
  fileUrl: string;
  duration: number;
  size: number;
}

// Edge-TTS 可用语音
export const EDGE_VOICES = {
  'zh-CN-XiaoxiaoNeural': '晓晓（女声，温柔）',
  'zh-CN-YunxiNeural': '云希（男声，年轻）',
  'zh-CN-YunyangNeural': '云扬（男声，新闻）',
  'zh-CN-XiaoyiNeural': '晓伊（女声，活泼）',
  'zh-CN-YunjianNeural': '云健（男声，沉稳）',
  'zh-CN-XiaochenNeural': '晓辰（女声，客服）',
  'zh-CN-XiaohanNeural': '晓涵（女声，温柔）',
  'zh-CN-XiaomengNeural': '晓梦（女声，可爱）',
  'zh-CN-XiaomoNeural': '晓墨（女声，知性）',
  'zh-CN-XiaoruiNeural': '晓睿（女声，儿童）',
  'zh-CN-XiaoshuangNeural': '晓双（女声，儿童）',
  'zh-CN-XiaoxuanNeural': '晓萱（女声，成熟）',
  'zh-CN-XiaoyanNeural': '晓颜（女声，客服）',
  'zh-CN-XiaoyouNeural': '晓悠（女声，儿童）',
  'zh-CN-YunfengNeural': '云枫（男声，新闻）',
  'zh-CN-YunhaoNeural': '云皓（男声，广告）',
  'zh-CN-YunxiaNeural': '云夏（男声，儿童）',
  'zh-CN-YunyeNeural': '云野（男声，纪录片）',
  'zh-CN-YunzeNeural': '云泽（男声，新闻）',
  'en-US-JennyNeural': 'Jenny（English, Female）',
  'en-US-GuyNeural': 'Guy（English, Male）',
};

class TTSService {
  private mediaRoot: string;
  private voiceDir: string;

  constructor() {
    this.mediaRoot = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
    this.voiceDir = path.join(this.mediaRoot, 'media', 'tts');
  }

  private async ensureVoiceDir(): Promise<void> {
    await fs.mkdir(this.voiceDir, { recursive: true });
  }

  /**
   * 生成语音文件
   */
  async generate(text: string, config: TTSConfig = { provider: 'edge' }): Promise<TTSResult | null> {
    await this.ensureVoiceDir();

    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filename = `tts_${timestamp}_${randomSuffix}.mp3`;
    const filePath = path.join(this.voiceDir, filename);

    try {
      let result: TTSResult | null = null;

      switch (config.provider) {
        case 'edge':
          result = await this.generateWithEdge(text, filePath, config);
          break;
        case 'openai':
          result = await this.generateWithOpenAI(text, filePath, config);
          break;
        case 'elevenlabs':
          result = await this.generateWithElevenLabs(text, filePath, config);
          break;
        default:
          throw new Error(`不支持的 TTS 提供商: ${config.provider}`);
      }

      return result;
    } catch (error) {
      console.error('[TTS] 生成失败:', error);
      return null;
    }
  }

  /**
   * 使用 Edge-TTS 生成语音
   */
  private async generateWithEdge(text: string, filePath: string, config: TTSConfig): Promise<TTSResult> {
    const voice = config.voice || 'zh-CN-XiaoxiaoNeural';
    const rate = config.speed ? `${config.speed > 1 ? '+' : ''}${Math.round((config.speed - 1) * 100)}%` : '+0%';
    const pitch = config.pitch ? `${config.pitch > 1 ? '+' : ''}${Math.round((config.pitch - 1) * 50)}Hz` : '+0Hz';

    // 使用 edge-tts 命令行工具
    const command = `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --rate="${rate}" --pitch="${pitch}" --write-media="${filePath}"`;

    try {
      await execAsync(command, { timeout: 60000 });
      
      // 获取文件大小
      const stats = await fs.stat(filePath);
      
      // 估算时长（假设平均语速 150 字/分钟，Edge-TTS 生成 MP3）
      const estimatedDuration = Math.ceil(text.length / 2.5); // 粗略估算

      return {
        filePath,
        fileUrl: `/media/tts/${path.basename(filePath)}`,
        duration: estimatedDuration,
        size: stats.size,
      };
    } catch (error) {
      throw new Error(`Edge-TTS 生成失败: ${error}`);
    }
  }

  /**
   * 使用 OpenAI TTS 生成语音
   */
  private async generateWithOpenAI(text: string, filePath: string, config: TTSConfig): Promise<TTSResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key 未配置');
    }

    const voice = config.voice || 'nova';
    const model = 'tts-1'; // 或 tts-1-hd

    const response = await axios({
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/speech',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model,
        input: text,
        voice,
        speed: config.speed || 1.0,
      },
      responseType: 'arraybuffer',
    });

    await fs.writeFile(filePath, response.data);

    const stats = await fs.stat(filePath);
    const estimatedDuration = Math.ceil(text.length / 15); // OpenAI TTS 大约 15 字/秒

    return {
      filePath,
      fileUrl: `/media/tts/${path.basename(filePath)}`,
      duration: estimatedDuration,
      size: stats.size,
    };
  }

  /**
   * 使用 ElevenLabs 生成语音
   */
  private async generateWithElevenLabs(text: string, filePath: string, config: TTSConfig): Promise<TTSResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API Key 未配置');
    }

    const voiceId = config.voice || '21m00Tcm4TlvDq8ikWAM'; // Rachel

    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      },
      responseType: 'arraybuffer',
    });

    await fs.writeFile(filePath, response.data);

    const stats = await fs.stat(filePath);
    const estimatedDuration = Math.ceil(text.length / 15);

    return {
      filePath,
      fileUrl: `/media/tts/${path.basename(filePath)}`,
      duration: estimatedDuration,
      size: stats.size,
    };
  }

  /**
   * 获取可用语音列表
   */
  getAvailableVoices(provider: 'edge' | 'openai' | 'elevenlabs' = 'edge'): Record<string, string> {
    switch (provider) {
      case 'edge':
        return EDGE_VOICES;
      case 'openai':
        return {
          'alloy': 'Alloy（中性）',
          'echo': 'Echo（男声）',
          'fable': 'Fable（英式）',
          'onyx': 'Onyx（深沉）',
          'nova': 'Nova（女声）',
          'shimmer': 'Shimmer（温柔）',
        };
      case 'elevenlabs':
        return {
          '21m00Tcm4TlvDq8ikWAM': 'Rachel',
          'AZnzlk1XvdvUeBnXmlld': 'Domi',
          'ErXwobaYiN019PkySvjV': 'Antoni',
          'MF3mGyEYCl7XYWbV9V6O': 'Elli',
          'TxGEqnHWrfWFTfGW9XjX': 'Josh',
          'VR6AewLTigWG4xSOukaG': 'Arnold',
        };
      default:
        return {};
    }
  }
}

// 导出单例
export const ttsService = new TTSService();
export default ttsService;