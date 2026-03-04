/**
 * Skills Router - 技能路由器
 * 
 * 功能：
 * - # 解析（#skill_name, #skill_name param1 param2）
 * - 链式调用解析（skill1 | skill2）
 * - 参数提取
 * - 错误处理
 */

class SkillRouter {
  constructor(options = {}) {
    this.options = {
      // 触发符号
      triggerSymbol: options.triggerSymbol || '#',
      // 管道符号
      pipeSymbol: options.pipeSymbol || '|',
      // 参数分隔符
      paramSeparator: options.paramSeparator || /\s+/,
      // 引号字符
      quoteChars: options.quoteChars || ['"', "'", '`'],
      // 最大链长度
      maxChainLength: options.maxChainLength || 5,
      // 最大参数数量
      maxParams: options.maxParams || 20,
      ...options
    };

    // 路由规则
    this.routes = new Map();
    
    // 中间件
    this.middleware = [];
    
    // 错误处理器
    this.errorHandlers = [];
  }

  /**
   * 注册路由规则
   * @param {string} pattern - 匹配模式
   * @param {Function} handler - 处理函数
   */
  register(pattern, handler) {
    this.routes.set(pattern, {
      pattern,
      handler,
      regex: this._patternToRegex(pattern)
    });
  }

  /**
   * 添加中间件
   * @param {Function} fn - 中间件函数
   */
  use(fn) {
    this.middleware.push(fn);
  }

  /**
   * 添加错误处理器
   * @param {Function} fn - 错误处理函数
   */
  onError(fn) {
    this.errorHandlers.push(fn);
  }

  /**
   * 解析技能调用
   * @param {string} input - 输入文本
   * @returns {Object|null} 解析结果
   */
  parse(input) {
    const { triggerSymbol, pipeSymbol, quoteChars } = this.options;

    // 查找所有技能调用
    const calls = [];
    const regex = new RegExp(
      `${this._escapeRegex(triggerSymbol)}([^${this._escapeRegex(pipeSymbol)}]+)`,
      'g'
    );

    let match;
    while ((match = regex.exec(input)) !== null) {
      const callText = match[1].trim();
      const parsed = this._parseCall(callText, quoteChars);
      
      if (parsed) {
        calls.push({
          ...parsed,
          raw: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }

    if (calls.length === 0) return null;

    // 解析链式调用
    return this._parseChain(calls, input);
  }

  /**
   * 解析单个调用
   * @private
   */
  _parseCall(text, quoteChars) {
    const tokens = this._tokenize(text, quoteChars);
    
    if (tokens.length === 0) return null;

    const skillName = tokens[0];
    const params = tokens.slice(1);

    // 验证技能名称
    if (!this._isValidSkillName(skillName)) {
      return null;
    }

    // 解析命名参数
    const { positional, named } = this._parseParams(params);

    return {
      skill: skillName,
      params: positional,
      namedParams: named
    };
  }

  /**
   * 解析链式调用
   * @private
   */
  _parseChain(calls, originalInput) {
    const { maxChainLength } = this.options;

    if (calls.length > maxChainLength) {
      return {
        error: 'CHAIN_TOO_LONG',
        message: `Chain length exceeds maximum (${maxChainLength})`,
        calls: calls.slice(0, maxChainLength)
      };
    }

    // 检查是否是管道链
    const pipePattern = new RegExp(`\\s*\\${this.options.pipeSymbol}\\s*`, 'g');
    const hasPipes = pipePattern.test(originalInput);

    if (hasPipes && calls.length > 1) {
      // 构建管道链
      return {
        type: 'pipeline',
        calls: calls.map((call, index) => ({
          ...call,
          step: index + 1,
          isInput: index === 0,
          isOutput: index === calls.length - 1
        })),
        raw: originalInput
      };
    }

    // 单一调用
    if (calls.length === 1) {
      return {
        type: 'single',
        call: calls[0],
        calls: [calls[0]],
        raw: originalInput
      };
    }

    // 多个独立调用
    return {
      type: 'multiple',
      calls,
      raw: originalInput
    };
  }

  /**
   * 分词
   * @private
   */
  _tokenize(text, quoteChars) {
    const tokens = [];
    let current = '';
    let inQuote = false;
    let quoteChar = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // 引号处理
      if (quoteChars.includes(char) && !inQuote) {
        inQuote = true;
        quoteChar = char;
        continue;
      }

      if (inQuote && char === quoteChar) {
        inQuote = false;
        quoteChar = null;
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      // 空格分隔
      if (char === ' ' && !inQuote) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * 解析参数
   * @private
   */
  _parseParams(params) {
    const positional = [];
    const named = {};

    for (const param of params) {
      // 检查是否是命名参数 (key=value 或 key:value)
      const namedMatch = param.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)[=:](.+)$/);
      
      if (namedMatch) {
        const [, key, value] = namedMatch;
        named[key] = this._parseValue(value);
      } else {
        positional.push(this._parseValue(param));
      }
    }

    return { positional, named };
  }

  /**
   * 解析值
   * @private
   */
  _parseValue(value) {
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // null
    if (value === 'null') return null;
    
    // 数字
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }
    
    // JSON 尝试解析
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // 不是有效 JSON，返回原字符串
      }
    }

    return value;
  }

  /**
   * 验证技能名称
   * @private
   */
  _isValidSkillName(name) {
    // 技能名称规则：字母开头，可包含字母、数字、下划线、连字符
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
  }

  /**
   * 转义正则特殊字符
   * @private
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 模式转正则
   * @private
   */
  _patternToRegex(pattern) {
    // 将通配符模式转为正则
    const regexStr = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexStr}$`);
  }

  /**
   * 路由技能调用
   * @param {Object} parsed - 解析结果
   * @param {Object} context - 执行上下文
   * @returns {Promise<any>}
   */
  async route(parsed, context = {}) {
    if (!parsed || parsed.error) {
      throw new Error(parsed?.message || 'Invalid skill call');
    }

    const calls = parsed.calls || [parsed.call];
    const results = [];

    // 执行中间件
    for (const fn of this.middleware) {
      await fn(parsed, context);
    }

    // 执行每个调用
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      
      try {
        // 查找匹配的路由
        let matched = null;
        for (const [pattern, route] of this.routes) {
          if (route.regex.test(call.skill)) {
            matched = route;
            break;
          }
        }

        if (!matched) {
          // 使用默认处理
          const result = await this._defaultRoute(call, context, results[i - 1]);
          results.push(result);
        } else {
          // 使用自定义路由
          const result = await matched.handler(call, context, results[i - 1]);
          results.push(result);
        }
      } catch (error) {
        // 错误处理
        for (const handler of this.errorHandlers) {
          await handler(error, call, context);
        }
        
        results.push({
          error: true,
          message: error.message,
          call
        });

        // 管道模式下，错误中断链
        if (parsed.type === 'pipeline') {
          break;
        }
      }
    }

    // 返回结果
    if (parsed.type === 'single') {
      return results[0];
    }

    if (parsed.type === 'pipeline') {
      return results[results.length - 1];
    }

    return results;
  }

  /**
   * 默认路由处理
   * @private
   */
  async _defaultRoute(call, context, previousResult) {
    // 返回调用信息，由执行器处理
    return {
      type: 'skill_call',
      skill: call.skill,
      params: call.params,
      namedParams: call.namedParams,
      context,
      previousResult
    };
  }

  /**
   * 从文本提取所有技能调用
   * @param {string} text - 输入文本
   * @returns {Array} 提取的调用
   */
  extractCalls(text) {
    const results = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const parsed = this.parse(line);
      if (parsed && !parsed.error) {
        results.push(parsed);
      }
    }

    return results;
  }

  /**
   * 替换文本中的技能调用
   * @param {string} text - 输入文本
   * @param {Function} replacer - 替换函数
   * @returns {Promise<string>}
   */
  async replaceCalls(text, replacer) {
    const parsed = this.parse(text);
    
    if (!parsed || parsed.error) {
      return text;
    }

    let result = text;
    const calls = parsed.calls || [parsed.call];

    // 从后往前替换，避免索引偏移
    for (let i = calls.length - 1; i >= 0; i--) {
      const call = calls[i];
      const replacement = await replacer(call);
      
      if (replacement !== undefined && replacement !== null) {
        result = result.slice(0, call.startIndex) + 
                 String(replacement) + 
                 result.slice(call.endIndex);
      }
    }

    return result;
  }

  /**
   * 验证调用语法
   * @param {string} input - 输入文本
   * @returns {Object} 验证结果
   */
  validate(input) {
    const errors = [];
    const warnings = [];

    try {
      const parsed = this.parse(input);

      if (!parsed) {
        return { valid: true, errors: [], warnings: [] };
      }

      if (parsed.error) {
        errors.push({
          code: parsed.error,
          message: parsed.message
        });
      }

      for (const call of parsed.calls || []) {
        // 检查参数数量
        if (call.params && call.params.length > this.options.maxParams) {
          warnings.push({
            code: 'PARAMS_TRUNCATED',
            message: `Too many parameters, truncated to ${this.options.maxParams}`,
            skill: call.skill
          });
        }

        // 检查技能名称
        if (!this._isValidSkillName(call.skill)) {
          errors.push({
            code: 'INVALID_SKILL_NAME',
            message: `Invalid skill name: ${call.skill}`,
            skill: call.skill
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsed
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'PARSE_ERROR',
          message: error.message
        }],
        warnings: []
      };
    }
  }
}

module.exports = { SkillRouter };