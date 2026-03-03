/**
 * 交互式配置向导
 * 支持对话式配置
 */

const { v4: uuidv4 } = require('uuid');

class ConfigWizard {
  constructor(configCenter) {
    this.configCenter = configCenter;
    this.sessions = new Map();
  }

  /**
   * 开始配置对话
   */
  startConversation(agentId, type) {
    const template = this.configCenter.getTemplate(null, type);
    
    if (!template) {
      return {
        success: false,
        error: `配置模板 "${type}" 不存在`
      };
    }
    
    // 检查是否已有进行中的会话
    const existingSession = this.findActiveSession(agentId, type);
    if (existingSession) {
      return {
        success: true,
        resumed: true,
        sessionId: existingSession.id,
        message: `继续之前的配置 (${existingSession.progress}% 完成)`,
        ...this.getCurrentStep(existingSession)
      };
    }
    
    // 创建新会话
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      agentId,
      type,
      template,
      currentStep: 0,
      data: {},
      history: [],
      status: 'in_progress',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    
    // 返回欢迎消息和第一步
    return {
      success: true,
      sessionId,
      resumed: false,
      message: this.generateWelcomeMessage(template),
      totalSteps: template.fields?.length || 0,
      ...this.getCurrentStep(session)
    };
  }

  /**
   * 处理用户输入
   */
  async processInput(agentId, input) {
    // 查找活动会话
    const session = this.findActiveSessionByAgent(agentId);
    
    if (!session) {
      return {
        success: false,
        error: '没有进行中的配置会话，请先开始配置'
      };
    }
    
    // 记录用户输入
    session.history.push({
      type: 'user',
      content: input,
      timestamp: Date.now()
    });
    
    const { template, currentStep, data } = session;
    const field = template.fields?.[currentStep];
    
    if (!field) {
      return {
        success: false,
        error: '配置步骤无效'
      };
    }
    
    // 特殊命令处理
    if (this.isSpecialCommand(input)) {
      return this.handleSpecialCommand(session, input);
    }
    
    // 验证输入
    const validationResult = this.configCenter.validateField(field, input);
    
    if (!validationResult.valid) {
      const response = {
        success: false,
        retry: true,
        message: `❌ ${validationResult.error}`,
        tip: this.generateTip(field),
        ...this.getCurrentStep(session)
      };
      
      session.history.push({
        type: 'assistant',
        content: response.message,
        timestamp: Date.now()
      });
      
      return response;
    }
    
    // 保存数据
    const transformedValue = this.configCenter.transformInput(field, input);
    data[field.name] = transformedValue;
    
    // 记录成功
    session.history.push({
      type: 'assistant',
      content: `✅ ${field.label}: ${this.formatValue(field, transformedValue)}`,
      timestamp: Date.now()
    });
    
    // 进入下一步
    session.currentStep++;
    session.updatedAt = Date.now();
    session.progress = Math.round((session.currentStep / template.fields.length) * 100);
    
    // 检查是否完成
    if (session.currentStep >= template.fields.length) {
      return this.completeConfiguration(session);
    }
    
    // 返回下一步
    return {
      success: true,
      progress: session.progress,
      message: `✅ ${field.label} 已保存`,
      ...this.getCurrentStep(session)
    };
  }

  /**
   * 生成配置问题
   */
  generateQuestions(configType, currentStep) {
    const template = this.configCenter.getTemplate(null, configType);
    
    if (!template || !template.fields) {
      return [];
    }
    
    const remaining = template.fields.slice(currentStep);
    
    return remaining.map((field, index) => ({
      step: currentStep + index,
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description,
      placeholder: field.placeholder
    }));
  }

  /**
   * 获取配置进度
   */
  getProgress(agentId) {
    const session = this.findActiveSessionByAgent(agentId);
    
    if (!session) {
      return {
        active: false,
        message: '没有进行中的配置'
      };
    }
    
    return {
      active: true,
      sessionId: session.id,
      type: session.type,
      progress: session.progress,
      currentStep: session.currentStep,
      totalSteps: session.template.fields?.length || 0,
      currentField: session.template.fields?.[session.currentStep]?.label,
      status: session.status,
      elapsed: Date.now() - session.createdAt
    };
  }

  // ========== 私有方法 ==========

  /**
   * 查找 Agent 的活动会话
   */
  findActiveSessionByAgent(agentId) {
    for (const session of this.sessions.values()) {
      if (session.agentId === agentId && session.status === 'in_progress') {
        return session;
      }
    }
    return null;
  }

  /**
   * 查找特定类型的活动会话
   */
  findActiveSession(agentId, type) {
    for (const session of this.sessions.values()) {
      if (session.agentId === agentId && session.type === type && session.status === 'in_progress') {
        return session;
      }
    }
    return null;
  }

  /**
   * 获取当前步骤信息
   */
  getCurrentStep(session) {
    const { template, currentStep, data } = session;
    const field = template.fields?.[currentStep];
    
    if (!field) {
      return { complete: true };
    }
    
    const question = {
      step: currentStep + 1,
      total: template.fields.length,
      field: field.name,
      type: field.type,
      label: field.label,
      description: field.description,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
      default: field.default
    };
    
    // 生成提示消息
    question.message = this.generateQuestionMessage(field);
    
    return question;
  }

  /**
   * 生成欢迎消息
   */
  generateWelcomeMessage(template) {
    const lines = [
      `🔧 开始配置: ${template.displayName || template.name}`,
      ''
    ];
    
    if (template.description) {
      lines.push(template.description);
      lines.push('');
    }
    
    lines.push(`📋 需要配置 ${template.fields?.length || 0} 个项目`);
    lines.push('');
    lines.push('💡 提示:');
    lines.push('  - 输入 "取消" 可以取消配置');
    lines.push('  - 输入 "跳过" 可以跳过非必填项');
    lines.push('  - 输入 "进度" 可以查看当前进度');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 生成问题消息
   */
  generateQuestionMessage(field) {
    const lines = [];
    
    // 问题标题
    const required = field.required ? ' (必填)' : ' (可选)';
    lines.push(`📝 第 ${field.step || '?'} 步: ${field.label}${required}`);
    
    // 描述
    if (field.description) {
      lines.push(`   ${field.description}`);
    }
    
    // 类型和选项
    if (field.type === 'select' && field.options) {
      lines.push('');
      lines.push('   可选值:');
      field.options.forEach(opt => {
        if (typeof opt === 'string') {
          lines.push(`   - ${opt}`);
        } else {
          lines.push(`   - ${opt.label || opt.value}`);
        }
      });
    }
    
    // 占位符/默认值
    if (field.placeholder) {
      lines.push(`   示例: ${field.placeholder}`);
    }
    
    if (field.default !== undefined) {
      lines.push(`   默认: ${field.default}`);
    }
    
    return lines.join('\n');
  }

  /**
   * 生成提示
   */
  generateTip(field) {
    const tips = [];
    
    if (field.description) {
      tips.push(field.description);
    }
    
    if (field.placeholder) {
      tips.push(`示例: ${field.placeholder}`);
    }
    
    if (field.type === 'email') {
      tips.push('请输入有效的邮箱地址，如: user@example.com');
    } else if (field.type === 'url') {
      tips.push('请输入完整的 URL，如: https://example.com');
    } else if (field.type === 'number') {
      if (field.validation?.min !== undefined || field.validation?.max !== undefined) {
        const range = [];
        if (field.validation.min !== undefined) range.push(`最小 ${field.validation.min}`);
        if (field.validation.max !== undefined) range.push(`最大 ${field.validation.max}`);
        tips.push(`数值范围: ${range.join(', ')}`);
      }
    }
    
    return tips.length > 0 ? tips.join('\n') : null;
  }

  /**
   * 格式化值显示
   */
  formatValue(field, value) {
    if (value === null || value === undefined) {
      return '(未设置)';
    }
    
    switch (field.type) {
      case 'password':
        return '••••••••';
      case 'boolean':
        return value ? '是' : '否';
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  }

  /**
   * 检查是否为特殊命令
   */
  isSpecialCommand(input) {
    const commands = ['取消', 'cancel', '跳过', 'skip', '进度', 'progress', '帮助', 'help', '重置', 'reset'];
    return commands.includes(input.toLowerCase().trim());
  }

  /**
   * 处理特殊命令
   */
  handleSpecialCommand(session, input) {
    const command = input.toLowerCase().trim();
    
    switch (command) {
      case '取消':
      case 'cancel':
        session.status = 'cancelled';
        return {
          success: false,
          cancelled: true,
          message: '❌ 配置已取消'
        };
        
      case '跳过':
      case 'skip':
        const currentField = session.template.fields?.[session.currentStep];
        if (currentField?.required) {
          return {
            success: false,
            retry: true,
            message: '❌ 此项为必填，不能跳过',
            ...this.getCurrentStep(session)
          };
        }
        session.currentStep++;
        session.progress = Math.round((session.currentStep / session.template.fields.length) * 100);
        return {
          success: true,
          skipped: true,
          progress: session.progress,
          ...this.getCurrentStep(session)
        };
        
      case '进度':
      case 'progress':
        return {
          success: true,
          showProgress: true,
          progress: session.progress,
          currentStep: session.currentStep + 1,
          totalSteps: session.template.fields.length,
          ...this.getCurrentStep(session)
        };
        
      case '帮助':
      case 'help':
        return {
          success: true,
          showHelp: true,
          message: this.generateHelpMessage(session),
          ...this.getCurrentStep(session)
        };
        
      case '重置':
      case 'reset':
        session.currentStep = 0;
        session.data = {};
        session.progress = 0;
        session.history = [];
        return {
          success: true,
          reset: true,
          message: '🔄 配置已重置',
          ...this.getCurrentStep(session)
        };
        
      default:
        return null;
    }
  }

  /**
   * 生成帮助消息
   */
  generateHelpMessage(session) {
    const lines = [
      '📖 配置帮助',
      '',
      '命令列表:',
      '  取消 - 取消当前配置',
      '  跳过 - 跳过当前非必填项',
      '  进度 - 查看配置进度',
      '  帮助 - 显示此帮助',
      '  重置 - 重置配置',
      '',
      `当前配置: ${session.template.displayName || session.type}`,
      `进度: ${session.progress}% (${session.currentStep + 1}/${session.template.fields.length})`
    ];
    
    return lines.join('\n');
  }

  /**
   * 完成配置
   */
  completeConfiguration(session) {
    session.status = 'completed';
    session.progress = 100;
    session.completedAt = Date.now();
    
    const config = {
      ...session.data,
      _meta: {
        type: session.type,
        template: session.template.name,
        createdAt: session.completedAt
      }
    };
    
    return {
      success: true,
      complete: true,
      sessionId: session.id,
      configType: session.type,
      config,
      message: this.generateCompletionMessage(session, config)
    };
  }

  /**
   * 生成完成消息
   */
  generateCompletionMessage(session, config) {
    const lines = [
      '✅ 配置完成！',
      '',
      `📋 配置类型: ${session.template.displayName || session.type}`,
      `⏱️ 用时: ${Math.round((session.completedAt - session.createdAt) / 1000)} 秒`,
      '',
      '配置内容:'
    ];
    
    // 显示配置项
    session.template.fields.forEach(field => {
      const value = config[field.name];
      lines.push(`  • ${field.label}: ${this.formatValue(field, value)}`);
    });
    
    lines.push('');
    lines.push('💡 提示: 可以使用 "测试配置" 功能验证配置是否正确');
    
    return lines.join('\n');
  }

  /**
   * 清理过期会话
   */
  cleanupSessions(maxAge = 30 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > maxAge) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 获取会话统计
   */
  getStats() {
    const stats = {
      total: this.sessions.size,
      inProgress: 0,
      completed: 0,
      cancelled: 0
    };
    
    for (const session of this.sessions.values()) {
      if (session.status === 'in_progress') stats.inProgress++;
      else if (session.status === 'completed') stats.completed++;
      else if (session.status === 'cancelled') stats.cancelled++;
    }
    
    return stats;
  }
}

module.exports = ConfigWizard;
