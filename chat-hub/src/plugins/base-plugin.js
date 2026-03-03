/**
 * 基础插件类
 * 所有插件必须继承此类
 */
class BasePlugin {
  constructor(config = {}) {
    this.config = config;
    this.id = config.id || 'unknown';
    this.name = config.name || 'Unknown Plugin';
    this.type = 'unknown';
    this.category = config.category || null;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.capabilities = [];
    this._initialized = false;
    this._status = 'uninitialized'; // uninitialized, initializing, ready, error, disabled
    this._lastError = null;
  }

  /**
   * 插件初始化
   * 子类可以覆盖此方法进行初始化
   */
  async init() {
    if (this._initialized) {
      return { success: true, message: 'Already initialized' };
    }
    
    this._status = 'initializing';
    try {
      // 验证配置
      const validation = this.validateConfig(this.config);
      if (!validation.valid) {
        this._status = 'error';
        this._lastError = validation.error;
        return { success: false, error: validation.error };
      }
      
      this._initialized = true;
      this._status = 'ready';
      return { success: true };
    } catch (error) {
      this._status = 'error';
      this._lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取插件信息
   */
  getInfo() {
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
  getCapabilities() {
    return this.capabilities;
  }

  /**
   * 验证配置
   * 子类可以覆盖此方法实现自定义验证逻辑
   */
  validateConfig(config) {
    if (!config) {
      return { valid: false, error: 'Configuration is required' };
    }
    return { valid: true };
  }

  /**
   * 测试连接/可用性
   * 子类应该覆盖此方法
   */
  async testConnection() {
    if (!this._initialized) {
      return { success: false, error: 'Plugin not initialized' };
    }
    return { success: true, message: 'Connection test not implemented' };
  }

  /**
   * 执行功能
   * 子类必须覆盖此方法
   */
  async execute(action, params = {}) {
    if (!this._initialized) {
      return { success: false, error: 'Plugin not initialized' };
    }
    return { success: false, error: `Unknown action: ${action}` };
  }

  /**
   * 停止插件
   */
  async stop() {
    this._initialized = false;
    this._status = 'disabled';
    return { success: true };
  }

  /**
   * 重启插件
   */
  async restart() {
    await this.stop();
    return this.init();
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      status: this._status,
      initialized: this._initialized,
      lastError: this._lastError
    };
  }
}

module.exports = BasePlugin;
