/**
 * 基础插件类
 * 所有插件必须继承此类
 */

export type PluginStatus = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'disabled';

export interface PluginConfig {
  id?: string;
  name?: string;
  category?: string | null;
  version?: string;
  description?: string;
  channelTypes?: string[];
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface InitResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface PluginInfo {
  id: string;
  name: string;
  type: string;
  category: string | null;
  version: string;
  description: string;
  capabilities: string[];
  status: PluginStatus;
  initialized: boolean;
}

export interface StatusInfo {
  status: PluginStatus;
  initialized: boolean;
  lastError: string | null;
}

class BasePlugin {
  protected config: PluginConfig;
  public id: string;
  public name: string;
  public type: string;
  public category: string | null;
  public version: string;
  public description: string;
  public capabilities: string[];
  protected _initialized: boolean;
  protected _status: PluginStatus;
  protected _lastError: string | null;

  constructor(config: PluginConfig = {}) {
    this.config = config;
    this.id = config.id || 'unknown';
    this.name = config.name || 'Unknown Plugin';
    this.type = 'unknown';
    this.category = config.category || null;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.capabilities = [];
    this._initialized = false;
    this._status = 'uninitialized';
    this._lastError = null;
  }

  /**
   * 插件初始化
   * 子类可以覆盖此方法进行初始化
   */
  async init(): Promise<InitResult> {
    if (this._initialized) {
      return { success: true, message: 'Already initialized' };
    }

    this._status = 'initializing';
    try {
      // 验证配置
      const validation = this.validateConfig(this.config);
      if (!validation.valid) {
        this._status = 'error';
        this._lastError = validation.error || 'Validation failed';
        return { success: false, error: validation.error };
      }

      this._initialized = true;
      this._status = 'ready';
      return { success: true };
    } catch (error) {
      this._status = 'error';
      this._lastError = error instanceof Error ? error.message : String(error);
      return { success: false, error: this._lastError };
    }
  }

  /**
   * 获取插件信息
   */
  getInfo(): PluginInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      category: this.category,
      version: this.version,
      description: this.description,
      capabilities: this.capabilities,
      status: this._status,
      initialized: this._initialized
    };
  }

  /**
   * 获取插件能力
   */
  getCapabilities(): string[] | Record<string, unknown> {
    return this.capabilities;
  }

  /**
   * 验证配置
   * 子类可以覆盖此方法实现自定义验证逻辑
   */
  validateConfig(config: PluginConfig): ValidationResult {
    if (!config) {
      return { valid: false, error: 'Configuration is required' };
    }
    return { valid: true };
  }

  /**
   * 测试连接/可用性
   * 子类应该覆盖此方法
   */
  async testConnection(): Promise<ExecuteResult> {
    if (!this._initialized) {
      return { success: false, error: 'Plugin not initialized' };
    }
    return { success: true, message: 'Connection test not implemented' };
  }

  /**
   * 执行功能
   * 子类必须覆盖此方法
   */
  async execute(action: string, params: Record<string, unknown> = {}): Promise<ExecuteResult> {
    if (!this._initialized) {
      return { success: false, error: 'Plugin not initialized' };
    }
    return { success: false, error: `Unknown action: ${action}` };
  }

  /**
   * 停止插件
   */
  async stop(): Promise<InitResult> {
    this._initialized = false;
    this._status = 'disabled';
    return { success: true };
  }

  /**
   * 重启插件
   */
  async restart(): Promise<InitResult> {
    await this.stop();
    return this.init();
  }

  /**
   * 获取状态
   */
  getStatus(): StatusInfo {
    return {
      status: this._status,
      initialized: this._initialized,
      lastError: this._lastError
    };
  }
}

export default BasePlugin;