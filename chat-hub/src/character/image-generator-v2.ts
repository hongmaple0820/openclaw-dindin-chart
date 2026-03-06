/**
 * AI 图片生成器 V2
 * 支持多供应商：GrokAPI, OpenAI, Stable Diffusion
 */

const axios = require('axios');

// 供应商接口
class IImageProvider {
  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented');
  }
}

// GrokAPI 供应商
class GrokAPIProvider extends IImageProvider {
  constructor(config) {
    super();
    this.apiUrl = config.apiUrl || 'https://api.x.ai/v1';
    this.apiKey = config.apiKey;
    this.model = config.model || 'grok-2-image';
  }

  async generate(prompt, options = {}) {
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

    return {
      url: response.data.data[0].url,
      revisedPrompt: response.data.data[0].revised_prompt,
      provider: 'grokapi'
    };
  }
}

// OpenAI 供应商
class OpenAIProvider extends IImageProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'dall-e-3';
  }

  async generate(prompt, options = {}) {
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

    return {
      url: response.data.data[0].url,
      revisedPrompt: response.data.data[0].revised_prompt,
      provider: 'openai'
    };
  }
}

// Stable Diffusion 供应商
class StableDiffusionProvider extends IImageProvider {
  constructor(config) {
    super();
    this.apiUrl = config.apiUrl || 'http://localhost:7860';
  }

  async generate(prompt, options = {}) {
    const response = await axios.post(`${this.apiUrl}/sdapi/v1/txt2img`, {
      prompt,
      negative_prompt: options.negativePrompt || '',
      width: options.width || 512,
      height: options.height || 768,
      steps: options.steps || 20,
      cfg_scale: options.cfgScale || 7
    });

    return {
      url: `data:image/png;base64,${response.data.images[0]}`,
      provider: 'stable-diffusion'
    };
  }
}

// Mock 供应商（测试用）
class MockProvider extends IImageProvider {
  async generate(prompt, options = {}) {
    return {
      url: `https://via.placeholder.com/512x768?text=${encodeURIComponent(prompt.substring(0, 20))}`,
      provider: 'mock'
    };
  }
}

// 图片生成器
class ImageGenerator {
  constructor(config) {
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

  async generate(prompt, options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return await provider.generate(prompt, options);
  }

  async generateSelfie(character, options = {}) {
    const prompt = this.buildSelfiePrompt(character, options);
    return await this.generate(prompt, options);
  }

  buildSelfiePrompt(character, options = {}) {
    const { scene, emotion, outfit } = options;
    const parts = [
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

  listProviders() {
    return Array.from(this.providers.keys());
  }
}

module.exports = {
  ImageGenerator,
  GrokAPIProvider,
  OpenAIProvider,
  StableDiffusionProvider,
  MockProvider
};
