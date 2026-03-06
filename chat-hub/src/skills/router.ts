/**
 * Skills Router - 技能路由器
 * 
 * 功能：
 * - # 解析（#skill_name, #skill_name param1 param2）
 * - 链式调用解析（skill1 | skill2）
 * - 参数提取
 * - 错误处理
 */

/**
 * 路由选项接口
 */
export interface RouterOptions {
  triggerSymbol?: string;
  pipeSymbol?: string;
  paramSeparator?: RegExp;
  quoteChars?: string[];
  maxChainLength?: number;
  maxParams?: number;
}

/**
 * 调用信息接口
 */
export interface CallInfo {
  skill: string;
  params: unknown[];
  namedParams: Record<string, unknown>;
  raw?: string;
  startIndex?: number;
  endIndex?: number;
  step?: number;
  isInput?: boolean;
  isOutput?: boolean;
}

/**
 * 解析结果接口
 */
interface ParseResult {
  type?: 'single' | 'pipeline' | 'multiple';
  error?: string;
  message?: string;
  call?: CallInfo;
  calls?: CallInfo[];
  raw?: string;
}

/**
 * 路由规则接口
 */
interface RouteRule {
  pattern: string;
  handler: Function;
  regex: RegExp;
}

export class SkillRouter {
  options: {
    triggerSymbol: string;
    pipeSymbol: string;
    paramSeparator: RegExp;
    quoteChars: string[];
    maxChainLength: number;
    maxParams: number;
  };

  // 路由规则
  private routes: Map<string, RouteRule> = new Map();
  
  // 中间件
  private middleware: Array<(parsed: ParseResult, context: Record<string, unknown>) => Promise<void>> = [];
  
  // 错误处理器
  private errorHandlers: Array<(error: Error, call: CallInfo, context: Record<string, unknown>) => Promise<void>> = [];

  constructor(options: RouterOptions = {}) {
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
      maxParams: options.maxParams || 20
    };
  }

  /**
   * 注册路由规则
   */
  register(pattern: string, handler: Function): void {
    this.routes.set(pattern, {
      pattern,
      handler,
      regex: this._patternToRegex(pattern)
    });
  }

  /**
   * 添加中间件
   */
  use(fn: (parsed: ParseResult, context: Record<string, unknown>) => Promise<void>): void {
    this.middleware.push(fn);
  }

  /**
   * 添加错误处理器
   */
  onError(fn: (error: Error, call: CallInfo, context: Record<string, unknown>) => Promise<void>): void {
    this.errorHandlers.push(fn);
  }

  /**
   * 解析技能调用
   */
  parse(input: string): ParseResult | null {
    const { triggerSymbol, pipeSymbol, quoteChars } = this.options;

    // 查找所有技能调用
    const calls: CallInfo[] = [];
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
   */
  private _parseCall(text: string, quoteChars: string[]): CallInfo | null {
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
   */
  private _parseChain(calls: CallInfo[], originalInput: string): ParseResult {
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
   */
  private _tokenize(text: string, quoteChars: string[]): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar: string | null = null;

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
   */
  private _parseParams(params: string[]): { positional: unknown[]; named: Record<string, unknown> } {
    const positional: unknown[] = [];
    const named: Record<string, unknown> = {};

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
   */
  private _parseValue(value: string): unknown {
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
   */
  private _isValidSkillName(name: string): boolean {
    // 技能名称规则：字母开头，可包含字母、数字、下划线、连字符
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
  }

  /**
   * 转义正则特殊字符
   */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 模式转正则
   */
  private _patternToRegex(pattern: string): RegExp {
    // 将通配符模式转为正则
    const regexStr = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexStr}$`);
  }

  /**
   * 路由技能调用
   */
  async route(parsed: ParseResult, context: Record<string, unknown> = {}): Promise<unknown> {
    if (!parsed || parsed.error) {
      throw new Error(parsed?.message || 'Invalid skill call');
    }

    const calls = parsed.calls || (parsed.call ? [parsed.call] : []);
    const results: unknown[] = [];

    // 执行中间件
    for (const fn of this.middleware) {
      await fn(parsed, context);
    }

    // 执行每个调用
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      
      try {
        // 查找匹配的路由
        let matched: RouteRule | null = null;
        this.routes.forEach((route) => {
          if (!matched && route.regex.test(call.skill)) {
            matched = route;
          }
        });

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
          await handler(error as Error, call, context);
        }
        
        results.push({
          error: true,
          message: (error as Error).message,
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
   */
  private async _defaultRoute(
    call: CallInfo, 
    context: Record<string, unknown>, 
    previousResult: unknown
  ): Promise<{
    type: string;
    skill: string;
    params: unknown[];
    namedParams: Record<string, unknown>;
    context: Record<string, unknown>;
    previousResult: unknown;
  }> {
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
   */
  extractCalls(text: string): ParseResult[] {
    const results: ParseResult[] = [];
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
   */
  async replaceCalls(
    text: string, 
    replacer: (call: CallInfo) => Promise<unknown>
  ): Promise<string> {
    const parsed = this.parse(text);
    
    if (!parsed || parsed.error) {
      return text;
    }

    let result = text;
    const calls = parsed.calls || (parsed.call ? [parsed.call] : []);

    // 从后往前替换，避免索引偏移
    for (let i = calls.length - 1; i >= 0; i--) {
      const call = calls[i];
      const replacement = await replacer(call);
      
      if (replacement !== undefined && replacement !== null && call.startIndex !== undefined && call.endIndex !== undefined) {
        result = result.slice(0, call.startIndex) + 
                 String(replacement) + 
                 result.slice(call.endIndex);
      }
    }

    return result;
  }

  /**
   * 验证调用语法
   */
  validate(input: string): {
    valid: boolean;
    errors: Array<{ code: string; message: string; skill?: string }>;
    warnings: Array<{ code: string; message: string; skill?: string }>;
    parsed?: ParseResult;
  } {
    const errors: Array<{ code: string; message: string; skill?: string }> = [];
    const warnings: Array<{ code: string; message: string; skill?: string }> = [];

    try {
      const parsed = this.parse(input);

      if (!parsed) {
        return { valid: true, errors: [], warnings: [] };
      }

      if (parsed.error) {
        errors.push({
          code: parsed.error,
          message: parsed.message || ''
        });
      }

      const calls = parsed.calls || (parsed.call ? [parsed.call] : []);
      for (const call of calls) {
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
          message: (error as Error).message
        }],
        warnings: []
      };
    }
  }
}