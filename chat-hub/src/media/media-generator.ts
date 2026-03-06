/**
 * 统一媒体生成器 - MediaGenerator
 * 
 * 支持：图片 + 视频生成，多供应商可扩展
 * 
 * 供应商：
 * - image: [clawmate, stable-diffusion, mock]
 * - video: [remotion, grok-api, mock]
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import Database from 'better-sqlite3';

interface MediaGeneratorConfig {
  defaultProviders?: { image?: string; video?: string };
  providers?: Record<string, { type: string; url?: string; projectRoot?: string; apiKey?: string }>;
  fallback?: { image?: string[]; video?: string[] };
}

interface GenerateOptions {
  provider?: string;
  duration?: number;
  [key: string]: unknown;
}

interface GenerateResult {
  ok: boolean;
  provider: string;
  imageUrl?: string;
  videoUrl?: string;
  filePath?: string;
  duration?: number;
  error?: string;
}

interface ProviderInfo {
  name: string;
  type: string;
}

class MediaGenerator extends EventEmitter {
  private config: {
    defaultProviders: { image: string; video: string };
    providers: Record<string, { type: string; url?: string; projectRoot?: string; apiKey?: string }>;
    fallback: { image: string[]; video: string[] };
  };
  private db: Database;
  private mediaRoot: string;

  constructor(config: MediaGeneratorConfig = {}) {
    super();
    
    this.config = {
      defaultProviders: { image: 'mock', video: 'remotion', ...config.defaultProviders },
      providers: {
        clawmate: { type: 'image', url: process.env.CLAWMATE_URL || 'http://localhost:9527' },
        'stable-diffusion': { type: 'image', url: process.env.SD_URL || 'http://localhost:7860' },
        remotion: { type: 'video', projectRoot: path.join(os.homedir(), '.openclaw/media/remotion') },
        'grok-api': { type: 'video', apiKey: process.env.GROK_API_KEY || '' },
        ...config.providers
      },
      fallback: { image: ['mock'], video: ['mock'], ...config.fallback }
    };
    
    this.db = new Database(path.join(os.homedir(), '.openclaw/chat-data/messages.db'));
    this.mediaRoot = path.join(os.homedir(), '.openclaw/media');
  }
  
  // 图片生成
  async generateImage(type: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const provider = options.provider || this.config.defaultProviders.image;
    console.log(`[MediaGenerator] 生成图片: type=${type}, provider=${provider}`);
    
    switch (provider) {
      case 'clawmate': return this._generateWithClawMate(type, options);
      default: return this._generateMockImage(type, options);
    }
  }
  
  // 视频生成
  async generateVideo(type: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const provider = options.provider || this.config.defaultProviders.video;
    console.log(`[MediaGenerator] 生成视频: type=${type}, provider=${provider}`);
    
    switch (provider) {
      case 'remotion': return this._generateWithRemotion(type, options);
      case 'grok-api': return this._generateWithGrokAPI(type, options);
      default: return this._generateMockVideo(type, options);
    }
  }
  
  private async _generateMockImage(type: string, options: GenerateOptions): Promise<GenerateResult> {
    const filename = `${type}_${Date.now()}.jpg`;
    const relativePath = `generated/${filename}`;
    const fullPath = path.join(this.mediaRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]));
    return { ok: true, provider: 'mock', imageUrl: `http://localhost:8273/media/${relativePath}`, filePath: fullPath };
  }
  
  private async _generateMockVideo(type: string, options: GenerateOptions): Promise<GenerateResult> {
    const filename = `${type}_${Date.now()}.mp4`;
    const relativePath = `videos/mock/${filename}`;
    const fullPath = path.join(this.mediaRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.from('MOCK'));
    return { ok: true, provider: 'mock', videoUrl: `http://localhost:8273/media/${relativePath}`, duration: options.duration || 5 };
  }
  
  private async _generateWithClawMate(type: string, options: GenerateOptions): Promise<GenerateResult> {
    try {
      const axios = require('axios');
      const res = await axios.post(`${this.config.providers.clawmate?.url}/api/generate`, { type, ...options });
      return { ok: true, provider: 'clawmate', ...res.data };
    } catch (e) {
      return { ok: false, provider: 'clawmate', error: (e as Error).message };
    }
  }
  
  private async _generateWithRemotion(_type: string, _options: GenerateOptions): Promise<GenerateResult> {
    // TODO: Remotion 集成
    return { ok: false, provider: 'remotion', error: 'Remotion 供应商待实现，需要安装 remotion 和 ffmpeg' };
  }
  
  private async _generateWithGrokAPI(_type: string, _options: GenerateOptions): Promise<GenerateResult> {
    if (!this.config.providers['grok-api']?.apiKey) {
      return { ok: false, provider: 'grok-api', error: 'Grok API Key 未配置' };
    }
    // TODO: Grok API 调用
    return { ok: false, provider: 'grok-api', error: 'Grok API 供应商待实现' };
  }
  
  getAvailableProviders(type: string | null = null): ProviderInfo[] {
    return Object.entries(this.config.providers)
      .filter(([_, c]) => !type || c.type === type)
      .map(([name, c]) => ({ name, type: c.type }));
  }
}

export default MediaGenerator;