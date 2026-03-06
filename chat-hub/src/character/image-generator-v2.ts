/**
 * AI 图片生成器 V2
 * 支持多供应商：GrokAPI, OpenAI, Stable Diffusion
 */

import axios from 'axios';

// ==================== 类型定义 ====================

interface ImageProviderConfig {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  quality?: string;
}

interface GenerateOptions {
  n?: number;
  size?: string;
  quality?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  provider?: string;
  scene?: string;
  emotion?: string;
  outfit?: string;
}

interface GenerateResult {
  url: string;
  revisedPrompt?: string;
  provider: string;
}

interface Character {
  name?: string;
}

// ==================== 供应商接口 ====================

interface IImageProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
}

// GrokAPI 供应商
class GrokAPIProvider implements IImageProvider {
  private apiUrl: string;
  private apiKey?: string;
  private model: string;

  constructor(config: ImageProviderConfig) {
    this.apiUrl = config.apiUrl || 'https://api.x.ai/v1';
    this.apiKey = config.apiKey;
    this.model = config.model || 'grok-2-image';
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const response = await axios.post(`${this.apiUrl}/images/generations`, {
      model: this.model,
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024'
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data as { data: Array<{ url: string; revised_prompt?: string }> };
    return {
      url: data.data[0].url,
      revisedPrompt: data.data[0].revised_prompt,
      provider: 'grokapi'
    };
  }
}

// OpenAI 供应商
class OpenAIProvider implements IImageProvider {
  private apiKey?: string;
  private model: string;

  constructor(config: ImageProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'dall-e-3';
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      model: this.model,
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard'
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data as { data: Array<{ url: string; revised_prompt?: string }> };
    return {
      url: data.data[0].url,
      revisedPrompt: data.data[0].revised_prompt,
      provider: 'openai'
    };
  }
}

// Stable Diffusion 供应商
class StableDiffusionProvider implements IImageProvider {
  private apiUrl: string;

  constructor(config: ImageProviderConfig) {
    this.apiUrl = config.apiUrl || 'http://localhost:7860';
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const response = await axios.post(`${this.apiUrl}/sdapi/v1/txt2img`, {
      prompt,
      negative_prompt: options.negativePrompt || '',
      width: options.width || 512,
      height: options.height || 768,
      steps: options.steps || 20,
      cfg_scale: options.cfgScale || 7
    });

    const data = response.data as { images: string[] };
    return {
      url: `data:image/png;base64,${data.images[0]}`,
      provider: 'stable-diffusion'
    };
  }
}

// Mock 供应商（测试用）
class MockProvider implements IImageProvider {
  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    return {
      url: `https://via.placeholder.com/512x768?text=${encodeURIComponent(prompt.substring(0, 20))}`,
      provider: 'mock'
    };
  }
}

// ==================== 图片生成器 ====================

interface ImageGeneratorConfig {
  default?: string;
  grokapi?: ImageProviderConfig;
  openai?: ImageProviderConfig;
  stableDiffusion?: ImageProviderConfig;
}

class ImageGenerator {
  private providers: Map<string, IImageProvider>;
  private defaultProvider: string;

  constructor(config?: ImageGeneratorConfig) {
    this.providers = new Map();
    this.defaultProvider = config?.default || 'mock';
    
    // 注册供应商
    if (config?.grokapi) {
      this.providers.set('grokapi', new GrokAPIProvider(config.grokapi));
    }
    if (config?.openai) {
      this.providers.set('openai', new OpenAIProvider(config.openai));
    }
    if (config?.stableDiffusion) {
      this.providers.set('sd', new StableDiffusionProvider(config.stableDiffusion));
    }
    // 始终注册 mock 作为备用
    this.providers.set('mock', new MockProvider());
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return await provider.generate(prompt, options);
  }

  async generateSelfie(character: Character, options: GenerateOptions = {}): Promise<GenerateResult> {
    const prompt = this.buildSelfiePrompt(character, options);
    return await this.generate(prompt, options);
  }

  buildSelfiePrompt(character: Character, options: GenerateOptions = {}): string {
    const { scene, emotion, outfit } = options;
    const parts: string[] = [
      character.name || 'AI assistant',
      'portrait',
      'high quality',
      'detailed'
    ];
    
    if (scene) parts.push(scene);
    if (emotion) parts.push(emotion);
    if (outfit) parts.push(outfit);
    
    return parts.join(', ');
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export {
  ImageGenerator,
  GrokAPIProvider,
  OpenAIProvider,
  StableDiffusionProvider,
  MockProvider,
  ImageProviderConfig,
  GenerateOptions,
  GenerateResult
};