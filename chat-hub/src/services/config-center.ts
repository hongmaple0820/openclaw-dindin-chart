/**
 * 配置中心
 * 统一管理所有配置（插件、Agent、通道）
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'url' | 'password' | 'boolean' | 'select' | 'array';
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<string | { label: string; value: string }>;
  default?: any;
  validation?: {
    regex?: string;
    message?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

interface ConfigTemplate {
  name: string;
  displayName?: string;
  category: string;
  description?: string;
  fields?: ConfigField[];
}

interface ConfigSession {
  id: string;
  agentId: string;
  configType: string;
  template: ConfigTemplate;
  currentStep: number;
  data: Record<string, any>;
  status: 'in_progress' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface ConfigSessionResult {
  success: boolean;
  sessionId?: string;
  totalSteps?: number;
  currentStep?: number;
  error?: string;
  field?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: ConfigField['options'];
  default?: any;
  validation?: ConfigField['validation'];
  complete?: boolean;
  retry?: boolean;
  progress?: string;
  config?: Record<string, any>;
  configType?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: Array<{ field: string; error: string }>;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface SystemStatus {
  categories: Category[];
  templates: Record<string, Array<{ name: string; displayName: string; description: string }>>;
  status: Record<string, { templates: number; configured: number; lastUpdated: number | null }>;
  activeSessions: number;
}

interface Database {
  run(sql: string, params?: any[]): Promise<{ changes: number }>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

// ==================== 配置中心类 ====================

class ConfigCenter {
  private db: Database;
  private templatesDir: string;
  private sessions: Map<string, ConfigSession>;
  
  constructor(db: Database) {
    this.db = db;
    this.templatesDir = path.join(__dirname, '../../chat-hub-config/templates');
    this.sessions = new Map();
    
    // 确保模板目录存在
    this.ensureTemplatesDir();
  }

  /**
   * 确保模板目录存在
   */
  private ensureTemplatesDir(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      console.log('[ConfigCenter] 创建模板目录:', this.templatesDir);
    }
  }

  // ========== 配置模板 ==========

  /**
   * 获取配置模板
   */
  getTemplate(category: string | null, name: string): ConfigTemplate | null {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.json`);
      
      if (!fs.existsSync(templatePath)) {
        return null;
      }
      
      const content = fs.readFileSync(templatePath, 'utf-8');
      const template: ConfigTemplate = JSON.parse(content);
      
      // 验证分类
      if (category && template.category !== category) {
        return null;
      }
      
      return template;
    } catch (error) {
      console.error('[ConfigCenter] 获取模板失败:', error);
      return null;
    }
  }

  /**
   * 列出所有模板
   */
  listTemplates(category: string | null = null): Record<string, Array<{ name: string; displayName: string; description: string }>> | Array<ConfigTemplate> {
    try {
      const files = fs.readdirSync(this.templatesDir)
        .filter(f => f.endsWith('.json'));
      
      const templates: ConfigTemplate[] = files.map(file => {
        try {
          const content = fs.readFileSync(path.join(this.templatesDir, file), 'utf-8');
          return JSON.parse(content) as ConfigTemplate;
        } catch (e) {
          return null as any;
        }
      }).filter(t => t !== null);
      
      // 按分类过滤
      if (category) {
        return templates.filter(t => t.category === category);
      }
      
      // 按分类分组
      const grouped: Record<string, Array<{ name: string; displayName: string; description: string }>> = {};
      templates.forEach(t => {
        if (!grouped[t.category]) {
          grouped[t.category] = [];
        }
        grouped[t.category].push({
          name: t.name,
          displayName: t.displayName || t.name,
          description: t.description || ''
        });
      });
      
      return grouped;
    } catch (error) {
      console.error('[ConfigCenter] 列出模板失败:', error);
      return {};
    }
  }

  /**
   * 获取模板分类列表
   */
  getCategories(): Category[] {
    return [
      { id: 'channel', name: '通道配置', icon: '🔗' },
      { id: 'plugin', name: '插件配置', icon: '🔌' },
      { id: 'agent', name: 'Agent 配置', icon: '🤖' },
      { id: 'storage', name: '存储配置', icon: '💾' },
      { id: 'integration', name: '集成配置', icon: '🔗' }
    ];
  }

  // ========== 交互式配置 ==========

  /**
   * 开始配置会话
   */
  startConfigSession(agentId: string, configType: string): ConfigSessionResult {
    const template = this.getTemplate(null, configType);
    
    if (!template) {
      return {
        success: false,
        error: `模板 ${configType} 不存在`
      };
    }
    
    const sessionId = uuidv4();
    const session: ConfigSession = {
      id: sessionId,
      agentId,
      configType,
      template,
      currentStep: 0,
      data: {},
      status: 'in_progress',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    
    // 返回第一步问题
    const firstStep = this.getStepQuestion(session);
    
    return {
      success: true,
      sessionId,
      totalSteps: template.fields ? template.fields.length : 0,
      currentStep: 0,
      ...firstStep
    };
  }

  /**
   * 处理配置输入
   */
  processConfigInput(sessionId: string, input: any): ConfigSessionResult {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        success: false,
        error: '会话不存在或已过期'
      };
    }
    
    const { template, currentStep, data } = session;
    const field = template.fields?.[currentStep];
    
    if (!field) {
      return {
        success: false,
        error: '无效的配置步骤'
      };
    }
    
    // 验证输入
    const validationResult = this.validateField(field, input);
    
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error,
        field: field.name,
        retry: true
      };
    }
    
    // 保存数据
    data[field.name] = this.transformInput(field, input);
    session.currentStep++;
    session.updatedAt = Date.now();
    
    // 检查是否完成
    if (session.currentStep >= (template.fields?.length || 0)) {
      return this.completeSession(session);
    }
    
    // 返回下一步问题
    const nextStep = this.getStepQuestion(session);
    
    return {
      success: true,
      sessionId,
      totalSteps: template.fields?.length || 0,
      currentStep: session.currentStep,
      progress: template.fields ? (session.currentStep / template.fields.length * 100).toFixed(0) + '%' : '0%',
      ...nextStep
    };
  }

  /**
   * 获取步骤问题
   */
  private getStepQuestion(session: ConfigSession): { field?: string; type?: string; label?: string; description?: string; placeholder?: string; required?: boolean; options?: ConfigField['options']; default?: any; validation?: ConfigField['validation']; complete?: boolean } {
    const { template, currentStep, data } = session;
    const field = template.fields?.[currentStep];
    
    if (!field) {
      return {
        complete: true
      };
    }
    
    return {
      field: field.name,
      type: field.type,
      label: field.label,
      description: field.description,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
      default: field.default,
      validation: field.validation
    };
  }

  /**
   * 完成配置会话
   */
  private completeSession(session: ConfigSession): ConfigSessionResult {
    session.status = 'completed';
    session.completedAt = Date.now();
    
    // 构建最终配置
    const config = {
      ...session.data,
      _meta: {
        configType: session.configType,
        template: session.template.name,
        createdAt: session.completedAt
      }
    };
    
    return {
      success: true,
      complete: true,
      sessionId: session.id,
      configType: session.configType,
      config
    };
  }

  /**
   * 获取配置状态
   */
  getConfigStatus(agentId: string): Array<{
    sessionId: string;
    configType: string;
    status: string;
    progress: string;
    currentStep: number;
    totalSteps: number;
    createdAt: number;
    updatedAt: number;
  }> {
    const agentSessions = Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId);
    
    return agentSessions.map(s => ({
      sessionId: s.id,
      configType: s.configType,
      status: s.status,
      progress: s.template.fields ? 
        (s.currentStep / s.template.fields.length * 100).toFixed(0) + '%' : '0%',
      currentStep: s.currentStep,
      totalSteps: s.template.fields?.length || 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
  }

  // ========== 配置验证 ==========

  /**
   * 验证字段
   */
  validateField(field: ConfigField, value: any): ValidationResult {
    // 检查必填
    if (field.required && (value === null || value === undefined || value === '')) {
      return {
        valid: false,
        error: `${field.label} 是必填项`
      };
    }
    
    // 如果为空且非必填，则有效
    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }
    
    const strValue = String(value);
    
    // 类型验证
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          return { valid: false, error: `${field.label} 必须是数字` };
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(strValue)) {
          return { valid: false, error: `${field.label} 格式不正确` };
        }
        break;
        
      case 'url':
        try {
          new URL(strValue);
        } catch (e) {
          return { valid: false, error: `${field.label} 必须是有效的 URL` };
        }
        break;
        
      case 'select':
        if (field.options && !field.options.some(opt => 
          typeof opt === 'string' ? opt === value : opt.value === value
        )) {
          return { valid: false, error: `${field.label} 的值无效` };
        }
        break;
        
      case 'password':
        if (field.validation?.minLength && strValue.length < field.validation.minLength) {
          return { valid: false, error: `${field.label} 至少需要 ${field.validation.minLength} 个字符` };
        }
        break;
    }
    
    // 自定义验证规则
    if (field.validation) {
      if (field.validation.regex) {
        const regex = new RegExp(field.validation.regex);
        if (!regex.test(strValue)) {
          return { valid: false, error: field.validation.message || `${field.label} 格式不正确` };
        }
      }
      
      if (field.validation.minLength && strValue.length < field.validation.minLength) {
        return { valid: false, error: `${field.label} 至少需要 ${field.validation.minLength} 个字符` };
      }
      
      if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
        return { valid: false, error: `${field.label} 最多 ${field.validation.maxLength} 个字符` };
      }
      
      if (field.validation.min !== undefined && Number(value) < field.validation.min) {
        return { valid: false, error: `${field.label} 不能小于 ${field.validation.min}` };
      }
      
      if (field.validation.max !== undefined && Number(value) > field.validation.max) {
        return { valid: false, error: `${field.label} 不能大于 ${field.validation.max}` };
      }
    }
    
    return { valid: true };
  }

  /**
   * 转换输入值
   */
  transformInput(field: ConfigField, value: any): any {
    if (value === null || value === undefined || value === '') {
      return field.default;
    }
    
    switch (field.type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === true || value === 'true' || value === '1' || value === 1;
      case 'array':
        if (typeof value === 'string') {
          return value.split(',').map(s => s.trim()).filter(Boolean);
        }
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }

  /**
   * 验证完整配置
   */
  validateConfig(configType: string, config: Record<string, any>): { valid: boolean; errors: Array<{ field: string; error: string }> } {
    const template = this.getTemplate(null, configType);
    
    if (!template) {
      return {
        valid: false,
        errors: [{ field: '', error: `模板 ${configType} 不存在` }]
      };
    }
    
    const errors: Array<{ field: string; error: string }> = [];
    
    // 验证每个字段
    template.fields?.forEach(field => {
      const value = config[field.name];
      const result = this.validateField(field, value);
      
      if (!result.valid && result.error) {
        errors.push({
          field: field.name,
          error: result.error
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 测试配置
   */
  async testConfig(configType: string, config: Record<string, any>): Promise<TestResult> {
    const template = this.getTemplate(null, configType);
    
    if (!template) {
      return {
        success: false,
        error: `模板 ${configType} 不存在`
      };
    }
    
    // 先验证配置
    const validation = this.validateConfig(configType, config);
    if (!validation.valid) {
      return {
        success: false,
        error: '配置验证失败',
        details: validation.errors
      };
    }
    
    // 根据配置类型执行测试
    try {
      switch (configType) {
        case 'email':
          return await this.testEmailConfig(config);
          
        case 'dingtalk':
          return await this.testDingtalkConfig(config);
          
        case 'image-generation':
          return await this.testImageConfig(config);
          
        case 'storage':
          return await this.testStorageConfig(config);
          
        default:
          // 通用测试 - 检查必要字段
          return {
            success: true,
            message: '配置格式正确（未实现连接测试）'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试邮箱配置
   */
  private async testEmailConfig(config: Record<string, any>): Promise<TestResult> {
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.password
        }
      });
      
      await transporter.verify();
      
      return {
        success: true,
        message: '邮箱连接测试成功'
      };
    } catch (error) {
      return {
        success: false,
        error: `邮箱连接失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 测试钉钉配置
   */
  private async testDingtalkConfig(config: Record<string, any>): Promise<TestResult> {
    try {
      const axios = require('axios');
      
      // 测试 Webhook
      if (config.webhook) {
        const response = await axios.post(config.webhook, {
          msgtype: 'text',
          text: { content: '[测试] 配置中心连接测试' }
        });
        
        if (response.data.errcode === 0) {
          return {
            success: true,
            message: '钉钉 Webhook 连接成功'
          };
        } else {
          return {
            success: false,
            error: `钉钉返回错误: ${response.data.errmsg}`
          };
        }
      }
      
      return {
        success: true,
        message: '配置格式正确（未提供 Webhook）'
      };
    } catch (error) {
      return {
        success: false,
        error: `钉钉连接失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 测试图片生成配置
   */
  private async testImageConfig(config: Record<string, any>): Promise<TestResult> {
    try {
      // 检查 API Key 格式
      if (config.apiKey && config.apiKey.length < 10) {
        return {
          success: false,
          error: 'API Key 格式不正确'
        };
      }
      
      // 检查端点
      if (config.endpoint) {
        const axios = require('axios');
        try {
          await axios.get(config.endpoint, { timeout: 5000 });
        } catch (e: any) {
          // 端点可能不支持 GET，只要不是超时就认为可访问
          if (e.code === 'ECONNABORTED') {
            return {
              success: false,
              error: 'API 端点超时'
            };
          }
        }
      }
      
      return {
        success: true,
        message: '图片生成配置格式正确'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试存储配置
   */
  private async testStorageConfig(config: Record<string, any>): Promise<TestResult> {
    try {
      // 测试本地存储
      if (config.type === 'local' || !config.type) {
        const testPath = path.join(config.path || './data', '.test');
        
        fs.mkdirSync(path.dirname(testPath), { recursive: true });
        fs.writeFileSync(testPath, 'test');
        fs.unlinkSync(testPath);
        
        return {
          success: true,
          message: '本地存储路径可写'
        };
      }
      
      // 测试 S3 存储
      if (config.type === 's3') {
        // TODO: 实现 S3 连接测试
        return {
          success: true,
          message: 'S3 配置格式正确（待实现连接测试）'
        };
      }
      
      return {
        success: true,
        message: '存储配置格式正确'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取系统配置状态
   */
  getSystemStatus(): SystemStatus {
    const categories = this.getCategories();
    const templates = this.listTemplates() as Record<string, Array<{ name: string; displayName: string; description: string }>>;
    
    const status: Record<string, { templates: number; configured: number; lastUpdated: number | null }> = {};
    
    Object.keys(templates).forEach(category => {
      status[category] = {
        templates: templates[category].length,
        configured: 0, // TODO: 从数据库读取
        lastUpdated: null
      };
    });
    
    return {
      categories,
      templates,
      status,
      activeSessions: this.sessions.size
    };
  }

  /**
   * 清理过期会话
   */
  cleanupSessions(maxAge: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > maxAge) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[ConfigCenter] 清理了 ${cleaned} 个过期会话`);
    }
    
    return cleaned;
  }
}

export default ConfigCenter;