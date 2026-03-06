/**
 * Markdown渲染器 - 增强版
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkdownItInstance = any;

class MarkdownRenderer {
  private md: MarkdownItInstance;
  private hasInitialized: boolean;

  constructor() {
    // 在Node.js环境中动态导入markdown-it
    this.md = null;
    this.hasInitialized = false;
  }

  /**
   * 初始化markdown-it
   */
  async initialize(): Promise<MarkdownItInstance> {
    if (this.hasInitialized) {
      return this.md;
    }

    try {
      // 动态导入markdown-it
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mdIt = require('markdown-it');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mdItEmoji = require('markdown-it-emoji');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mdItHighlight = require('highlight.js');
      
      // 初始化markdown-it实例
      this.md = mdIt({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
        highlight: function (str: string, lang: string): string {
          if (lang && mdItHighlight.getLanguage(lang)) {
            try {
              return mdItHighlight.highlight(str, { language: lang }).value;
            } catch (__) {}
          }
          
          try {
            // 如果没有指定语言，尝试自动检测
            return mdItHighlight.highlightAuto(str).value;
          } catch (__) {}
          
          // 如果高亮失败，转义HTML
          return '';
        }
      })
      .use(mdItEmoji);
      
      this.hasInitialized = true;
      console.log('✅ Markdown渲染器初始化成功');
      return this.md;
    } catch (error) {
      const err = error as Error;
      console.error('❌ Markdown渲染器初始化失败:', err.message);
      // 创建一个基础的markdown-it实例
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mdIt = require('markdown-it');
      this.md = mdIt();
      this.hasInitialized = true;
      console.warn('⚠️  Markdown渲染器使用基础模式');
      return this.md;
    }
  }

  /**
   * 渲染markdown文本
   */
  async render(markdownText: string): Promise<string> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }
    
    try {
      // 渲染markdown
      let html = this.md!.render(markdownText);
      
      // 添加安全处理，防止XSS攻击
      html = this.sanitizeHtml(html);
      
      return html;
    } catch (error) {
      const err = error as Error;
      console.error('❌ Markdown渲染错误:', err.message);
      // 如果渲染失败，返回转义的原始文本
      return this.escapeHtml(markdownText);
    }
  }

  /**
   * 渲染行内markdown
   */
  async renderInline(markdownText: string): Promise<string> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }
    
    try {
      return this.md!.renderInline(markdownText);
    } catch (error) {
      const err = error as Error;
      console.error('❌ 行内Markdown渲染错误:', err.message);
      return this.escapeHtml(markdownText);
    }
  }

  /**
   * HTML安全过滤
   */
  sanitizeHtml(html: string): string {
    // 移除潜在危险的标签和属性
    return html
      // 移除script标签
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 移除on*事件处理器
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
      // 移除javascript:链接
      .replace(/href\s*=\s*"javascript:/gi, 'href="#"')
      .replace(/href\s*=\s*'javascript:/gi, "href='#'")
      .replace(/href\s*=\s*javascript:/gi, 'href="#"');
  }

  /**
   * HTML转义
   */
  escapeHtml(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 解析消息中的特殊内容（如@提及、链接等）
   */
  async parseSpecialContent(text: string): Promise<string> {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // 解析@提及
    text = text.replace(/@[\w\u4e00-\u9fa5-]+/g, '<span class="mention">$&</span>');

    // 解析URL链接
    text = text.replace(
      /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return text;
  }

  /**
   * 渲染带特殊内容的markdown
   */
  async renderWithSpecialContent(markdownText: string): Promise<string> {
    if (!this.hasInitialized) {
      await this.initialize();
    }

    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }

    // 首先处理特殊内容（如@提及）
    let processedText = await this.parseSpecialContent(markdownText);

    // 然后渲染markdown
    return await this.render(processedText);
  }
}

// 导出类
export = MarkdownRenderer;