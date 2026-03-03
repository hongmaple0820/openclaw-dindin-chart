/**
 * 统一媒体生成器 - MediaGenerator
 * 
 * 支持：图片 + 视频生成，多供应商可扩展
 * 
 * 供应商：
 * - image: [clawmate, stable-diffusion, mock]
 * - video: [remotion, grok-api, mock]
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const Database = require('better-sqlite3');

class MediaGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      defaultProviders: { image: 'mock', video: 'remotion' },
      providers: {
        clawmate: { type: 'image', url: process.env.CLAWMATE_URL || 'http://localhost:9527' },
        'stable-diffusion': { type: 'image', url: process.env.SD_URL || 'http://localhost:7860' },
        remotion: { type: 'video', projectRoot: path.join(os.homedir(), '.openclaw/media/remotion') },
        'grok-api': { type: 'video', apiKey: process.env.GROK_API_KEY || '' }
      },
      fallback: { image: ['mock'], video: ['mock'] },
      ...config
    };
    
    this.db = new Database(path.join(os.homedir(), '.openclaw/chat-data/messages.db'));
    this.mediaRoot = path.join(os.homedir(), '.openclaw/media');
  }
  
  // 图片生成
  async generateImage(type, options = {}) {
    const provider = options.provider || this.config.defaultProviders.image;
    console.log(`[MediaGenerator] 生成图片: type=${type}, provider=${provider}`);
    
    switch (provider) {
      case 'clawmate': return this._generateWithClawMate(type, options);
      default: return this._generateMockImage(type, options);
    }
  }
  
  // 视频生成
  async generateVideo(type, options = {}) {
    const provider = options.provider || this.config.defaultProviders.video;
    console.log(`[MediaGenerator] 生成视频: type=${type}, provider=${provider}`);
    
    switch (provider) {
      case 'remotion': return this._generateWithRemotion(type, options);
      case 'grok-api': return this._generateWithGrokAPI(type, options);
      default: return this._generateMockVideo(type, options);
    }
  }
  
  async _generateMockImage(type, options) {
    const filename = `${type}_${Date.now()}.jpg`;
    const relativePath = `generated/${filename}`;
    const fullPath = path.join(this.mediaRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]));
    return { ok: true, provider: 'mock', imageUrl: `http://localhost:8273/media/${relativePath}`, filePath: fullPath };
  }
  
  async _generateMockVideo(type, options) {
    const filename = `${type}_${Date.now()}.mp4`;
    const relativePath = `videos/mock/${filename}`;
    const fullPath = path.join(this.mediaRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, Buffer.from('MOCK'));
    return { ok: true, provider: 'mock', videoUrl: `http://localhost:8273/media/${relativePath}`, duration: options.duration || 5 };
  }
  
  async _generateWithClawMate(type, options) {
    const axios = require('axios');
    try {
      const res = await axios.post(`${this.config.providers.clawmate.url}/api/generate`, { type, ...options });
      return { ok: true, provider: 'clawmate', ...res.data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  
  async _generateWithRemotion(type, options) {
    // TODO: Remotion 集成
    return { ok: false, error: 'Remotion 供应商待实现，需要安装 remotion 和 ffmpeg' };
  }
  
  async _generateWithGrokAPI(type, options) {
    if (!this.config.providers['grok-api'].apiKey) {
      return { ok: false, error: 'Grok API Key 未配置' };
    }
    // TODO: Grok API 调用
    return { ok: false, error: 'Grok API 供应商待实现' };
  }
  
  getAvailableProviders(type = null) {
    return Object.entries(this.config.providers)
      .filter(([_, c]) => !type || c.type === type)
      .map(([name, c]) => ({ name, type: c.type }));
  }
}

module.exports = MediaGenerator;
