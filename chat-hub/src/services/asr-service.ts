/**
 * ASR Service - 语音识别服务
 * 
 * 支持多种 ASR 提供商：
 * - OpenAI Whisper: 准确率高，需要 OpenAI API Key
 * - 百度语音识别: 国内访问快，需要百度云 API Key
 * - 讯飞语音识别: 国内访问快，需要讯飞 AppID/APIKey/APISecret
 * - 阿里云语音识别: 国内访问快，需要阿里云 AccessKey
 */

import axios from 'axios';
import crypto from 'crypto';
import WebSocket from 'ws';
import { spawn } from 'child_process';

// Helper function to check if error is an Axios error
interface AxiosErrorLike {
  response?: { data?: unknown; status?: number };
  message: string;
  isAxiosError?: boolean;
}

function isAxiosError(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosErrorLike).isAxiosError === true
  );
}

// ==================== 类型定义 ====================

type ASRProvider = 'openai' | 'baidu' | 'xunfei' | 'aliyun';

interface ProviderInfo {
  name: string;
  displayName: string;
  enabled: boolean;
  language: string[];
  features: string[];
  pricing: string;
}

interface ASRConfig {
  provider: ASRProvider;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  appId?: string;
  model?: string;
  endpoint?: string;
  language?: string;
  options?: Record<string, any>;
}

interface TranscribeRequest {
  audio: Buffer | string;
  format?: string;
  language?: string;
  provider?: ASRProvider;
}

interface TranscribeSegment {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

interface TranscribeResult {
  success: boolean;
  text: string;
  provider: ASRProvider;
  language?: string;
  duration?: number;
  segments?: TranscribeSegment[];
  error?: string;
}

interface ASRServiceConfig {
  asr?: {
    default?: ASRProvider;
    openai?: Partial<ASRConfig>;
    baidu?: Partial<ASRConfig>;
    xunfei?: Partial<ASRConfig>;
    aliyun?: Partial<ASRConfig>;
  };
}

// API Response Types
interface OpenAIWhisperResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    avg_logprob?: number;
  }>;
}

interface BaiduTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface BaiduASRResponse {
  err_no: number;
  err_msg?: string;
  result?: string[];
}

interface AliyunASRResponse {
  status: number;
  message?: string;
  result?: string;
}

// ==================== 提供商配置 ====================

const PROVIDER_INFO: Record<ASRProvider, ProviderInfo> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI Whisper',
    enabled: false,
    language: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'auto'],
    features: ['高准确率', '多语言支持', '自动语言检测', '时间戳分段'],
    pricing: '$0.006/分钟'
  },
  baidu: {
    name: 'baidu',
    displayName: '百度语音识别',
    enabled: false,
    language: ['zh-CN', 'en-US', 'zh-YUE', 'zh-SICHUAN'],
    features: ['国内访问快', '实时语音识别', '长语音支持'],
    pricing: '免费额度 + 按量计费'
  },
  xunfei: {
    name: 'xunfei',
    displayName: '讯飞语音识别',
    enabled: false,
    language: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'],
    features: ['高准确率', '方言支持', '实时语音识别'],
    pricing: '免费额度 + 按量计费'
  },
  aliyun: {
    name: 'aliyun',
    displayName: '阿里云语音识别',
    enabled: false,
    language: ['zh-CN', 'en-US', 'ja-JP'],
    features: ['国内访问快', '实时语音识别', '录音文件识别'],
    pricing: '免费额度 + 按量计费'
  }
};

// ==================== ASR Service 类 ====================

class ASRService {
  private config: Map<ASRProvider, ASRConfig> = new Map();
  private defaultProvider: ASRProvider = 'openai';
  
  constructor(configs?: ASRConfig[]) {
    if (configs) {
      for (const c of configs) {
        this.configure(c);
      }
    }
  }

  /**
   * 配置 ASR 提供商
   */
  configure(config: ASRConfig): void {
    this.config.set(config.provider, config);
    PROVIDER_INFO[config.provider].enabled = config.enabled;
    
    // 更新默认提供商
    if (config.enabled && !this.config.get(this.defaultProvider)?.enabled) {
      this.defaultProvider = config.provider;
    }
  }

  /**
   * 从配置对象初始化
   */
  static fromConfig(config: ASRServiceConfig): ASRService {
    const service = new ASRService();
    const asrConfig = config.asr;
    
    if (asrConfig) {
      // 配置 OpenAI
      if (asrConfig.openai) {
        const c = asrConfig.openai;
        service.configure({
          provider: 'openai',
          enabled: c.enabled !== false,
          apiKey: c.apiKey,
          model: c.model || 'whisper-1',
          endpoint: c.endpoint || 'https://api.openai.com/v1',
          language: c.language || 'auto'
        });
      }
      
      // 配置百度
      if (asrConfig.baidu) {
        const c = asrConfig.baidu;
        service.configure({
          provider: 'baidu',
          enabled: c.enabled !== false,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          language: c.language || 'zh'
        });
      }
      
      // 配置讯飞
      if (asrConfig.xunfei) {
        const c = asrConfig.xunfei;
        service.configure({
          provider: 'xunfei',
          enabled: c.enabled !== false,
          appId: c.appId,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          language: c.language || 'zh_cn'
        });
      }
      
      // 配置阿里云
      if (asrConfig.aliyun) {
        const c = asrConfig.aliyun;
        service.configure({
          provider: 'aliyun',
          enabled: c.enabled !== false,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          appId: c.appId,
          language: c.language || 'zh-CN'
        });
      }
      
      // 设置默认提供商
      if (asrConfig.default) {
        service.defaultProvider = asrConfig.default;
      }
    }
    
    return service;
  }

  /**
   * 获取可用提供商列表
   */
  getProviders(): ProviderInfo[] {
    return Object.values(PROVIDER_INFO);
  }

  /**
   * 获取启用的提供商
   */
  getEnabledProviders(): ProviderInfo[] {
    return Object.values(PROVIDER_INFO).filter(p => p.enabled);
  }

  /**
   * 语音识别转写
   */
  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    const provider = request.provider || this.defaultProvider;
    const config = this.config.get(provider);
    
    if (!config || !config.enabled) {
      return {
        success: false,
        text: '',
        provider,
        error: `Provider ${provider} is not configured or disabled`
      };
    }

    try {
      switch (provider) {
        case 'openai':
          return await this.transcribeWithOpenAI(request, config);
        case 'baidu':
          return await this.transcribeWithBaidu(request, config);
        case 'xunfei':
          return await this.transcribeWithXunfei(request, config);
        case 'aliyun':
          return await this.transcribeWithAliyun(request, config);
        default:
          return {
            success: false,
            text: '',
            provider,
            error: `Unknown provider: ${provider}`
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ASR] ${provider} transcribe error:`, errorMessage);
      return {
        success: false,
        text: '',
        provider,
        error: errorMessage
      };
    }
  }

  // ==================== OpenAI Whisper ====================

  private async transcribeWithOpenAI(request: TranscribeRequest, config: ASRConfig): Promise<TranscribeResult> {
    if (!config.apiKey) {
      return {
        success: false,
        text: '',
        provider: 'openai',
        error: 'OpenAI API key not configured'
      };
    }

    const endpoint = config.endpoint || 'https://api.openai.com/v1';
    const model = config.model || 'whisper-1';
    
    // 准备音频数据
    const audioBuffer = this.getAudioBuffer(request);
    const filename = this.getFilename(request.format);
    
    // 构建 FormData
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, { filename });
    form.append('model', model);
    
    if (request.language && request.language !== 'auto') {
      form.append('language', request.language.substring(0, 2));
    }
    
    // 响应格式：verbose_json 返回时间戳
    form.append('response_format', 'verbose_json');

    try {
      const response = await axios.post<OpenAIWhisperResponse>(`${endpoint}/audio/transcriptions`, form, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const data = response.data;
      const segments: TranscribeSegment[] = (data.segments || []).map((s) => ({
        text: s.text,
        start: s.start,
        end: s.end,
        confidence: s.avg_logprob ? Math.exp(s.avg_logprob) : undefined
      }));

      return {
        success: true,
        text: data.text || '',
        provider: 'openai',
        language: data.language,
        duration: data.duration,
        segments
      };
    } catch (error) {
      if (isAxiosError(error)) {
        const msg = (error.response?.data as { error?: { message?: string } })?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${msg}`);
      }
      throw error;
    }
  }

  // ==================== 百度语音识别 ====================

  private async transcribeWithBaidu(request: TranscribeRequest, config: ASRConfig): Promise<TranscribeResult> {
    if (!config.apiKey || !config.apiSecret) {
      return {
        success: false,
        text: '',
        provider: 'baidu',
        error: 'Baidu API key/secret not configured'
      };
    }

    // 获取 Access Token
    const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';
    const tokenResponse = await axios.get<BaiduTokenResponse>(tokenUrl, {
      params: {
        grant_type: 'client_credentials',
        client_id: config.apiKey,
        client_secret: config.apiSecret
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to get Baidu access token');
    }

    // 准备音频数据
    const audioBuffer = this.getAudioBuffer(request);
    const base64Audio = audioBuffer.toString('base64');
    
    // 百度语音识别 API
    const apiUrl = 'https://vop.baidu.com/server_api';
    const response = await axios.post<BaiduASRResponse>(apiUrl, {
      format: this.mapFormatToBaidu(request.format),
      rate: 16000,
      channel: 1,
      cuid: 'chat-hub-asr',
      token: accessToken,
      speech: base64Audio,
      len: audioBuffer.length,
      dev_pid: request.language === 'en-US' ? 1737 : 1537  // 1737=英文, 1537=中文普通话
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const data = response.data;
    
    if (data.err_no !== 0) {
      throw new Error(`Baidu ASR error: ${data.err_msg} (${data.err_no})`);
    }

    return {
      success: true,
      text: data.result?.join('') || '',
      provider: 'baidu',
      language: request.language || 'zh-CN'
    };
  }

  private mapFormatToBaidu(format?: string): string {
    const formatMap: Record<string, string> = {
      'wav': 'wav',
      'pcm': 'pcm',
      'amr': 'amr',
      'm4a': 'm4a'
    };
    return formatMap[format || ''] || 'wav';
  }

  // ==================== 讯飞语音识别 ====================

  private async transcribeWithXunfei(request: TranscribeRequest, config: ASRConfig): Promise<TranscribeResult> {
    if (!config.appId || !config.apiKey || !config.apiSecret) {
      return {
        success: false,
        text: '',
        provider: 'xunfei',
        error: 'Xunfei AppID/APIKey/APISecret not configured'
      };
    }

    // 讯飞 WebSocket 流式语音识别
    const host = 'iat-api.xfyun.cn';
    const path = '/v2/iat';
    const url = `wss://${host}${path}`;
    
    // 生成鉴权参数
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureOrigin = `host: ${host}\ndate: ${new Date().toUTCString()}\nGET ${path} HTTP/1.1`;
    const signature = crypto
      .createHmac('sha256', config.apiSecret)
      .update(signatureOrigin)
      .digest('base64');
    const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    const wsUrl = `${url}?authorization=${authorization}&date=${encodeURIComponent(new Date().toUTCString())}&host=${host}`;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      const audioBuffer = this.getAudioBuffer(request);
      let resultText = '';
      
      ws.on('open', () => {
        // 发送音频帧
        const frameSize = 1280; // 每帧大小
        let offset = 0;
        
        const sendFrame = () => {
          if (offset >= audioBuffer.length) {
            // 发送结束帧
            ws.send(JSON.stringify({
              data: {
                status: 2, // 结束
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: ''
              }
            }));
            return;
          }
          
          const chunk = audioBuffer.slice(offset, offset + frameSize);
          ws.send(JSON.stringify({
            data: {
              status: offset === 0 ? 0 : 1, // 0=首帧, 1=中间帧
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: chunk.toString('base64')
            }
          }));
          
          offset += frameSize;
          setTimeout(sendFrame, 40); // 模拟实时发送间隔
        };
        
        sendFrame();
      });
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.data && msg.data.result) {
          const wsArray = msg.data.result.ws;
          if (Array.isArray(wsArray)) {
            resultText += wsArray.map((w: any) => 
              w.cw?.map((c: any) => c.w).join('')
            ).join('') || '';
          }
        }
      });
      
      ws.on('close', () => {
        resolve({
          success: true,
          text: resultText,
          provider: 'xunfei',
          language: request.language || 'zh-CN'
        });
      });
      
      ws.on('error', (error) => {
        reject(new Error(`Xunfei WebSocket error: ${error.message}`));
      });
    });
  }

  // ==================== 阿里云语音识别 ====================

  private async transcribeWithAliyun(request: TranscribeRequest, config: ASRConfig): Promise<TranscribeResult> {
    if (!config.apiKey || !config.apiSecret) {
      return {
        success: false,
        text: '',
        provider: 'aliyun',
        error: 'Aliyun AccessKey/Secret not configured'
      };
    }

    // 阿里云一句话识别 API
    const endpoint = config.endpoint || 'https://nls-gateway.cn-shanghai.aliyuncs.com';
    const audioBuffer = this.getAudioBuffer(request);
    const base64Audio = audioBuffer.toString('base64');
    
    // 生成签名
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHmac('sha256', config.apiSecret)
      .update(timestamp)
      .digest('base64');

    try {
      const response = await axios.post<AliyunASRResponse>(`${endpoint}/stream/v1/asr`, {
        appkey: config.appId,
        format: this.mapFormatToAliyun(request.format),
        sample_rate: 16000,
        enable_punctuation_prediction: true,
        enable_inverse_text_normalization: true,
        audio: base64Audio
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-NLS-Token': this.generateAliyunToken(config),
          'Authorization': signature
        }
      });

      const data = response.data;
      
      if (data.status !== 20000000) {
        throw new Error(`Aliyun ASR error: ${data.message} (${data.status})`);
      }

      return {
        success: true,
        text: data.result || '',
        provider: 'aliyun',
        language: request.language || 'zh-CN'
      };
    } catch (error) {
      if (isAxiosError(error)) {
        const msg = (error.response?.data as { message?: string })?.message || error.message;
        throw new Error(`Aliyun API error: ${msg}`);
      }
      throw error;
    }
  }

  private mapFormatToAliyun(format?: string): string {
    const formatMap: Record<string, string> = {
      'wav': 'wav',
      'pcm': 'pcm',
      'mp3': 'mp3',
      'ogg': 'ogg',
      'amr': 'amr'
    };
    return formatMap[format || ''] || 'pcm';
  }

  private generateAliyunToken(config: ASRConfig): string {
    // 简化版，实际应使用阿里云 STS 服务获取 Token
    // 这里假设已经配置了长效 Token
    return config.options?.token || '';
  }

  // ==================== 辅助方法 ====================

  private getAudioBuffer(request: TranscribeRequest): Buffer {
    if (Buffer.isBuffer(request.audio)) {
      return request.audio;
    }
    
    if (typeof request.audio === 'string') {
      // Base64 解码
      const base64 = request.audio.replace(/^data:audio\/\w+;base64,/, '');
      return Buffer.from(base64, 'base64');
    }
    
    throw new Error('Invalid audio data format');
  }

  private getFilename(format?: string): string {
    return `audio.${format || 'wav'}`;
  }

  /**
   * 音频格式转换（使用 ffmpeg）
   * 将任意格式转换为 WAV/PCM
   */
  async convertAudio(input: Buffer, inputFormat: string, outputFormat: string = 'wav', sampleRate: number = 16000): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', 'pipe:0',
        '-f', outputFormat === 'pcm' ? 's16le' : 'wav',
        '-ar', String(sampleRate),
        '-ac', '1',
        'pipe:1'
      ];
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      const chunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on('data', () => {
        // 静默处理 ffmpeg 输出
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
      ffmpeg.stdin.write(input);
      ffmpeg.stdin.end();
    });
  }
}

// ==================== 导出单例 ====================

let defaultASRService: ASRService | null = null;

function getASRService(): ASRService {
  if (!defaultASRService) {
    defaultASRService = new ASRService();
  }
  return defaultASRService;
}

function initASRService(config: ASRServiceConfig): ASRService {
  defaultASRService = ASRService.fromConfig(config);
  return defaultASRService;
}

export { ASRService, getASRService, initASRService };
export type { ASRProvider, ProviderInfo, ASRConfig, TranscribeRequest, TranscribeResult, TranscribeSegment, ASRServiceConfig };